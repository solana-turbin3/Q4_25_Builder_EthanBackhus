import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { getAnchor } from "./anchor.js";
import { db } from "./database.js";

const app = express();
app.use(cors());
app.use(express.json());

// --------------------
//   CREATE SESSION
// --------------------
app.post("/api/create-session", async (req, res) => {
  try {
    const { payer, amount, merchantId, tokenMint } = req.body;

    const uuid = uuidv4().replace(/-/g, "").slice(0, 16); // 16 bytes

    const { program, provider } = getAnchor();

    const payerPk = new PublicKey(payer);
    const tokenMintPk = new PublicKey(tokenMint);

    // Derive PDA
    const [paymentSessionPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_session"),
        payerPk.toBytes(),
        Buffer.from(uuid, "hex")
      ],
      program.programId
    );

    // CALL INIT INSTRUCTION
    await program.methods
      .initPaymentSession([...Buffer.from(uuid, "hex")])
      .accounts({
        payer: payerPk,
        paymentSession: paymentSessionPda,
        tokenMint: tokenMintPk,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    // Save minimal DB entry
    db.createSession(uuid, {
      uuid,
      payer,
      amount,
      merchantId,
      tokenMint,
      paymentSessionPda: paymentSessionPda.toBase58(),
      status: "PENDING",
    });

    return res.json({
      success: true,
      uuid,
      paymentSessionPda: paymentSessionPda.toBase58(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// --------------------
//   GET SESSION
// --------------------
app.get("/api/get-session/:uuid", (req, res) => {
  const session = db.getSession(req.params.uuid);
  if (!session) return res.status(404).json({ error: "Not found" });
  return res.json(session);
});

// --------------------
//   START PAYOUT
// --------------------
app.post("/api/start-payout/:uuid", async (req, res) => {
  try {
    const session = db.getSession(req.params.uuid);
    if (!session) return res.status(404).json({ error: "Not found" });

    const { program } = getAnchor();

    const payerPk = new PublicKey(session.payer);
    const paymentSessionPk = new PublicKey(session.paymentSessionPda);

    await program.methods
      .markPaymentSettled()
      .accounts({
        paymentSession: paymentSessionPk,
        payer: payerPk,
      })
      .rpc();

    db.updateSession(req.params.uuid, { status: "SETTLED" });

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// --------------------
//   SOLANA PAY URL
// --------------------
app.get("/api/solana-pay/:uuid", (req, res) => {
  const session = db.getSession(req.params.uuid);
  if (!session) return res.status(404).json({ error: "Not found" });

  const url = new URL("solana:");
  url.searchParams.set("address", session.paymentSessionPda);
  url.searchParams.set("amount", (session.amount / 10 ** 6).toString());
  url.searchParams.set("reference", session.uuid);
  url.searchParams.set("label", "Demo Checkout");
  url.searchParams.set("message", "Complete your stablecoin payment");

  return res.json({ solanaPayUrl: url.toString() });
});

// --------------------
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001");
});
