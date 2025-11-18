// background.js - handles network calls for content scripts
const BACKEND_BASE = "https://your-backend.example.com"; // <<-- set your backend

self.addEventListener("message", (ev) => {
  // Not usually invoked in service_worker; content uses chrome.runtime.sendMessage
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // All messages are simple RPC calls to the backend
  (async () => {
    try {
      if (msg.type === "CREATE_SESSION") {
        // msg.payload: { merchantId, amount, currency, reference }
        const res = await fetch(`${BACKEND_BASE}/api/create-session`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        const json = await res.json();
        sendResponse({ ok: true, data: json });
      } else if (msg.type === "GET_SESSION") {
        const res = await fetch(`${BACKEND_BASE}/api/get-session/${encodeURIComponent(msg.payload.uuid)}`);
        sendResponse({ ok: true, data: await res.json() });
      } else if (msg.type === "START_PAYOUT") {
        const res = await fetch(`${BACKEND_BASE}/api/start-payout/${encodeURIComponent(msg.payload.uuid)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(msg.payload),
        });
        sendResponse({ ok: true, data: await res.json() });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  // Tell Chrome we will respond asynchronously
  return true;
});
