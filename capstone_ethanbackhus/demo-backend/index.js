require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const anchor = require('@coral-xyz/anchor');
const { Keypair, PublicKey, Connection, clusterApiUrl } = require('@solana/web3.js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Anchor setup
const connection = new Connection(process.env.RPC_URL || clusterApiUrl('devnet'), 'confirmed');
const wallet = anchor.Wallet.local(); // local keypair
const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: 'confirmed' });
anchor.setProvider(provider);

// Load IDL and program
const idl = require("./target/idl/capstone_ethanbackhus.json");
const programId = new PublicKey("DDR17KNMbiT9pFnncgeyLeLz6UXSnbBrwvwxzUDwLrV6");
const program = new anchor.Program(idl, programId, provider);

// In-memory session storage
const sessions = {};

/**
 * Create payment session
 */
app.post('/api/create-session', async (req, res) => {
  try {
    const { payer, amount = 100, merchantId = 'demo-merchant', tokenMint } = req.body;
    const uuid = Buffer.from(uuidv4().replace(/-/g, '').slice(0, 16), 'utf8');

    // Compute PDAs
    const [paymentSessionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('payment_session'), new PublicKey(payer).toBuffer(), uuid],
      programId
    );
    const [settlementAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('settlement_authority'), paymentSessionPda.toBuffer(), uuid],
      programId
    );

    // Store in memory
    sessions[uuid.toString('hex')] = {
      uuid: uuid.toString('hex'),
      payer,
      amount,
      merchantId,
      paymentSessionPda: paymentSessionPda.toBase58(),
      settlementAuthorityPda: settlementAuthorityPda.toBase58(),
      status: 'Created'
    };

    res.json(sessions[uuid.toString('hex')]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get session by UUID
 */
app.get('/api/get-session/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const session = sessions[uuid];
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

/**
 * Start payout (mark payment settled)
 */
app.post('/api/start-payout/:uuid', async (req, res) => {
  try {
    const uuid = req.params.uuid;
    const session = sessions[uuid];
    if (!session) return res.status(404).json({ error: 'Not found' });

    // Here you would call Anchor program's markPaymentSettled
    session.status = 'Settled';

    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Return Solana Pay URL (simple)
 */
app.get('/api/solana-pay/:uuid', async (req, res) => {
  const uuid = req.params.uuid;
  const session = sessions[uuid];
  if (!session) return res.status(404).json({ error: 'Not found' });

  // Example: solana:<escrow_address>?amount=...
  const url = `solana:${session.paymentSessionPda}?amount=${session.amount / 100}&reference=${uuid}`;
  res.json({ solanaPayUrl: url });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
