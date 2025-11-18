// content_script.js
// Detect demo portal and inject UI. Communicates with background to create session + poll.

const BACKEND_BASE = "https://your-backend.example.com"; // for QR image alt; primary traffic goes via background

function detectPortal() {
  // primary detection: the demo exposes window.__DEMO_PAYMENT_PORTAL__
  try {
    if (window.__DEMO_PAYMENT_PORTAL__) return window.__DEMO_PAYMENT_PORTAL__;
  } catch (e) {}

  // fallback heuristics (example)
  const checkout = document.querySelector("#checkoutSection") || document.querySelector(".checkout-box");
  if (checkout) {
    // try extract amount text
    const strong = document.querySelector(".product strong");
    const raw = strong ? strong.innerText : null;
    let amount = null;
    if (raw) {
      amount = Math.round(parseFloat(raw.replace(/[^0-9.]/g, "")) * 100); // cents
    }
    return { provider: "Unknown", amount, currency: "USD" };
  }
  return null;
}

function createBanner(portal) {
  if (document.querySelector(".dp-banner")) return; // already present

  const banner = document.createElement("div");
  banner.className = "dp-banner";
  banner.innerHTML = `
    <h4>Pay with Solana</h4>
    <div>Detected: <strong>${portal.provider || "Checkout"}</strong></div>
    <div class="small">Amount: ${formatAmount(portal.amount, portal.currency)}</div>
    <div style="margin-top:8px;">
      <button id="dpPayBtn">Pay with Solana</button>
      <button id="dpCancel" style="margin-left:8px;background:#eee;color:#333">Close</button>
    </div>
  `;
  document.body.appendChild(banner);

  banner.querySelector("#dpCancel").addEventListener("click", () => banner.remove());
  banner.querySelector("#dpPayBtn").addEventListener("click", () => onPay(portal));
}

function formatAmount(a, currency) {
  if (a == null) return "—";
  // if portal.amount is in minor units (like cents), guess
  if (a > 1000) {
    // treat as cents
    return `${(a/100).toFixed(2)} ${currency}`;
  }
  return `${a} ${currency}`;
}

async function onPay(portal) {
  // Create a payment session on your backend
  const payload = {
    merchantId: portal.merchantId || "demo-merchant",
    amount: portal.amount || 19999,       // backend expects minor units (e.g., cents) or specify agreed unit
    currency: portal.currency || "USD",
    reference: portal.reference || `demo-${Date.now()}`
  };

  showModalLoading("Creating payment session...");

  chrome.runtime.sendMessage({ type: "CREATE_SESSION", payload }, (resp) => {
    if (!resp || !resp.ok) return showModalError("Failed to create session: " + (resp && resp.error));
    const data = resp.data;
    // data example: { uuid, depositAddress, depositMint, amount, paymentSessionPda, solanaPayUrl }
    showPaymentModal(data);
    // Optionally start polling for deposits:
    pollSessionStatus(data.uuid);
  });
}

function showModalLoading(message) {
  removeModal();
  const modal = document.createElement("div");
  modal.className = "dp-modal";
  modal.id = "dpModal";
  modal.innerHTML = `<button class="dp-close" id="dpClose">&times;</button>
    <h3>${message}</h3>
    <div style="margin-top:12px;">Please wait...</div>`;
  document.body.appendChild(modal);
  modal.querySelector("#dpClose").addEventListener("click", removeModal);
}

function showModalError(msg) {
  removeModal();
  const modal = document.createElement("div");
  modal.className = "dp-modal";
  modal.id = "dpModal";
  modal.innerHTML = `<button class="dp-close" id="dpClose">&times;</button>
    <h3>Error</h3><div style="color:red;margin-top:8px;">${escapeHtml(msg)}</div>`;
  document.body.appendChild(modal);
  modal.querySelector("#dpClose").addEventListener("click", removeModal);
}

function showPaymentModal(data) {
  removeModal();
  const modal = document.createElement("div");
  modal.className = "dp-modal";
  modal.id = "dpModal";
  // If backend returns a solanaPayUrl (solana:<address>?amount=...), we show QR and link
  // We'll create a small QR using an inline canvas + lightweight QR library (I assume you include one in extension)
  modal.innerHTML = `<button class="dp-close" id="dpClose">&times;</button>
    <h3>Pay with Solana</h3>
    <div style="margin-top:8px">Send <strong>${(data.amount/100).toFixed(2)} ${data.currency}</strong> to the address below:</div>
    <div class="dp-row" style="margin-top:12px;">
      <div class="dp-qr" id="dpQr"></div>
      <div style="flex:1">
        <div style="word-break:break-all;font-family:monospace" id="dpAddress">${escapeHtml(data.depositAddress)}</div>
        <div style="margin-top:8px">
          <button id="dpCopy">Copy Address</button>
          <a id="dpOpenWallet" style="margin-left:8px" href="${escapeHtml(data.solanaPayUrl || "#")}" target="_blank">Open in Wallet</a>
        </div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div>Status: <span id="dpStatus">Waiting for deposit...</span></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#dpClose").addEventListener("click", removeModal);
  modal.querySelector("#dpCopy").addEventListener("click", () => {
    navigator.clipboard.writeText(data.depositAddress);
    alert("Copied address to clipboard");
  });

  // render QR code (lightweight)
  renderQR(data.solanaPayUrl || `solana:${data.depositAddress}?amount=${data.amount/100}`);

  function renderQR(text) {
    const container = document.getElementById("dpQr");
    container.innerHTML = "";
    // use a tiny QR generator inline (simple implementation)
    // For brevity we do a very small QR library; in production add a proper one.
    const canvas = document.createElement("canvas");
    canvas.width = 200; canvas.height = 200;
    container.appendChild(canvas);
    try {
      // Use minimal QR library (not included) — if not available, simply show address text
      if (window.QRCode) {
        new window.QRCode(canvas, { text, width: 200, height: 200 });
      } else {
        const ctx = canvas.getContext("2d");
        ctx.font = "12px monospace"; ctx.fillStyle = "#333";
        wrapText(ctx, text, 10, 20, 180, 14);
      }
    } catch (e) {
      container.innerText = data.depositAddress;
    }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function removeModal() {
  const m = document.getElementById("dpModal");
  if (m) m.remove();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function pollSessionStatus(uuid) {
  const interval = setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_SESSION", payload: { uuid } }, (resp) => {
      if (!resp || !resp.ok) return;
      const data = resp.data;
      const statusEl = document.getElementById("dpStatus");
      if (statusEl) statusEl.innerText = data.status;
      if (data.status === "Funded") {
        // optionally trigger backend to start payout
        chrome.runtime.sendMessage({ type: "START_PAYOUT", payload: { uuid } }, (r) => {
          // ignore errors; backend will handle
        });
      }
      if (data.status === "Settled" || data.status === "Refunded" || data.status === "Failed") {
        clearInterval(interval);
      }
    });
  }, 3000);
}

// mutation observer to detect dynamic pages (single-page apps)
const observer = new MutationObserver(() => {
  const portal = detectPortal();
  if (portal) createBanner(portal);
});
observer.observe(document, { childList: true, subtree: true });

// initial check once page loads
const portal = detectPortal();
if (portal) createBanner(portal);
