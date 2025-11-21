Solvia — Solana Checkout Detection Browser Extension

Capstone Project — Solana x Web2 Payments Interoperability

Solvia is a TypeScript-based browser extension that identifies checkout flows on e-commerce websites and prepares them for Solana-based payments. It demonstrates automatic checkout detection, metadata extraction, and a fully working Anchor program for on-chain payment sessions.

The browser extension currently includes functional detection logic and a demo UI, with the final user-facing front-end still in development. This repository focuses on the payment architecture, detection engine, and Solana program that powers the core functionality.

What does SolVia do?

🔍 Automatic Checkout Detection (Still in progress - Not Implemented)

The extension’s content script will be able to detect checkout flows using:
- DOM pattern matching (checkout buttons, payment forms, total price elements)

- URL heuristics (/checkout, /order, /payment)

- Dynamic element detection via MutationObserver

- Form structure scanning (email, shipping, billing fields)

- Once detected, the extension extracts available metadata (price, currency, and order info), to prepare a Solana payment session.

🪙 Solana On-Chain Payment Sessions (Fully Implemented)

The Anchor program provides the core on-chain functionality:

- Init Payment Session PDA
  Stores payer, merchant, amount, UUID, and other metadata.

- Deposit Stablecoin instruction
  Transfers tokens from the payer's wallet to the PaymentSession PDA escrow wallet

- Mark Payment Settled Instruction
  Updates session state once a payment is completed.

- Refund Payment Instruction
  Transfers tokens from the PaymentSession escrow PDA back to the payer's wallet

All logic includes secure PDA authority, seed validation, and comprehensive tests.


This project does feature a demo frontend / backend server that can be used to showcase the full product.


🪙 BitPay Integration
The project intended to use BitPay to offramp crypto to fiat, and send fiat to the merchant.


Project Architecture:

```text
programs/solvia
|
+-- payment_session.rs
|   +-- Initialize Payment Session Instruction
|   +-- Deposit Stablecoin Instruction
|   +-- Refund Payment Instruction
|   \-- Mark Settled Instruction
|
\-- state
    \-- PaymentSession (PDA)
```


🧪 Testing

Includes tests for:
- PDA derivations
- Payment session creation
- Authority and seeds
- Tip/payment flow
- Settlement marking
- Error conditions (wrong authority, double settlement, etc.)


📚 Future Work

- Finalized production UI
- Merchant portal
- SPL token support
- Solana Pay compatibility
- Receipts + refunds
- Better heuristics for detecting complex checkout platforms

👨‍💻 Author

Ethan Backhus
Solana Developer • Web2 → Web3 Engineer • Turbin3 Applicant

