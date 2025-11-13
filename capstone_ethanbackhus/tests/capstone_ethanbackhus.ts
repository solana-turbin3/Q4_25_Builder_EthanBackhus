import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CapstoneEthanbackhus } from "../target/types/capstone_ethanbackhus";
import { publicKey, token } from "@coral-xyz/anchor/dist/cjs/utils";
import { assert } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";
import { randomBytes } from "crypto";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  createAccount,
  mintTo,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  Account,
} from "@solana/spl-token";
import { formatDuration } from "./helpers";
import { isAccountsGeneric } from "@coral-xyz/anchor/dist/cjs/program/accounts-resolver";
import { flattenPartialAccounts } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { get } from "http";
import { format } from "path";
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";

describe("capstone_ethanbackhus", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.capstoneEthanbackhus;

  const provider = anchor.getProvider();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;
  const merchant = Keypair.generate();

  const seed = new anchor.BN(Date.now());

  const merchantId = "Amazon";                // in this example, Amazon will be our merchant
  const amount = new anchor.BN(100);
  let referenceId = "Ref12345";
  let payer = wallet.publicKey;
  let createdTs = new anchor.BN(Date.now());
  const uuid = randomBytes(16);
  let settlementAuth = Keypair.generate();
  let bnZero = new anchor.BN(0);

  // declarations
  let tokenMint: PublicKey;
  let escrowAta: PublicKey;
  let payerAtaAccount: Account;
  let paymentAmount: bigint;
  let payerBalanceBefore: Account;
  let escrowBalanceBefore: Account;
  let payerBalanceAfter: Account;
  let escrowBalanceAfter: Account;
  let merchantBalanceAfter: Account;
  let decimals: number = 6;
  
  const [paymentSession] = PublicKey.findProgramAddressSync(
    [Buffer.from("payment_session"), wallet.publicKey.toBuffer(), Buffer.from(uuid)],
    program.programId
  );

  before(async () => {
    // create token Mint for testing
    tokenMint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey,
      null,
      decimals
    );

    // get the escrow ata address (this will be created by CPI call in the instruction)
    escrowAta = getAssociatedTokenAddressSync(
      tokenMint,
      paymentSession, // authority = payment session PDA
      true
    );

    // create an ATA and mint tokens to it for testing
    payerAtaAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      tokenMint,
      payer
    );

    // define payment amount
    paymentAmount = BigInt(100);

    // mint tokens to payer ATA
    await mintTo(
      connection,
      wallet.payer,
      tokenMint,
      payerAtaAccount.address,
      wallet.payer,
      paymentAmount
    );

    // console logs
    console.log("\n🏦 Initial Setup Complete");
    console.log("-----------------------");
    console.log("Payment Session PDA:", paymentSession.toBase58());
    console.log("Token Mint:", tokenMint.toBase58());
    console.log("Payer ATA:", payerAtaAccount.address.toBase58()); 
  });

  it("Initialize Payment Session", async () => {
    // execute initialize payment session instruction
    const tx = await program.methods
    .initPaymentSession(
      Array.from(uuid),
      merchantId,
      amount,
      referenceId,
      settlementAuth.publicKey
    )
    .accountsStrict({
      payer: payer,
      tokenMint: tokenMint,
      payerAta: payerAtaAccount.address,
      paymentSession: paymentSession,
      escrowAta: escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

    console.log("\n✅ PaymentSession Initialized")
    console.log("Transaction signature:", tx);

    // get payer and escrow balances before transaction
    payerBalanceBefore = await getAccount(connection, payerAtaAccount.address);
    escrowBalanceBefore = await getAccount(connection, escrowAta);

    // log the balances
    console.log("\n💰 Balances Before Transaction");
    console.log("Payer balance before:", payerBalanceBefore.amount.toString());
    console.log("Escrow balance before:", escrowBalanceBefore.amount.toString());

    // assert intial balances
    assert.equal(payerBalanceBefore.amount, paymentAmount);
    assert.equal(escrowBalanceBefore.amount, BigInt(0));

    // Fetch payment session and assert
    const sessionAccount = await program.account.paymentSession.fetch(paymentSession);

    const escrowAtaSessionAccount = await getAccount(connection, sessionAccount.escrowAta);
    const payerAtaSessionAccount = await getAccount(connection, sessionAccount.payerAta);

    // get readable timestamps
    const createdTs = Number(sessionAccount.createdTs);
    const expiryTs = Number(sessionAccount.expiryTs);
    const durationSeconds = expiryTs - createdTs;

    console.log("\n📊 PaymentSession PDA:")
    console.log("  Payer:", sessionAccount.payer.toBase58());
    console.log("  Merchant ID:", sessionAccount.merchantId.toString());
    console.log("  Amount:", sessionAccount.amount.toString());
    console.log("  Token Mint:", sessionAccount.tokenMint.toBase58());
    console.log("  Escrow ATA:", sessionAccount.escrowAta.toBase58());
    console.log("  Payer ATA:", sessionAccount.payerAta.toBase58());
    console.log("  Payer ATA amount:", sessionAccount.amount);
    console.log("  Status:", sessionAccount.status);
    //console.log("  Expiry Timestamp:", sessionAccount.expiryTs.toString());
    //console.log("  Created Timestamp:", sessionAccount.createdTs.toString());
    console.log("  Created Timestamp:", formatDuration(createdTs));
    console.log("  Expiry Timestamp:", formatDuration(expiryTs));
    console.log("  Duration (HH:MM:SS):", formatDuration(durationSeconds));
    console.log("  Bump:", sessionAccount.bump.toString());

    console.log("\n💰 PaymentSession Balances:");
    console.log("Payer balance before:", payerAtaSessionAccount.amount.toString());
    console.log("Escrow balance before:", escrowAtaSessionAccount.amount.toString());

    // assert
    assert.equal(tokenMint.toBase58(), sessionAccount.tokenMint.toBase58());                // make sure token mint is equal to sessionAccount mint
    assert.equal(payerBalanceBefore.amount, paymentAmount);                                 // DO WE NEED THIS? Need to make sure the mint amounts are equal
    assert.equal(sessionAccount.payerAta.toBase58(), payerAtaAccount.address.toBase58());   // make sure payer ata is equal to sessionAccount payer ata
    assert.equal(sessionAccount.escrowAta.toBase58(), escrowAta.toBase58());                // make sure escrow ata is equal to sessionAccount escrow ata
    assert.equal(escrowAtaSessionAccount.amount, escrowBalanceBefore.amount);               // make sure escrow ata amount is equal to sessionAccount escrow ata amount
    assert.equal(sessionAccount.payer.toBase58(), payer.toBase58());                        // make sure payer is equal to sessionAccount payer
    assert.equal(sessionAccount.merchantId, "Amazon");                                      // make sure merchant id is equal to sessionAccount merchant id
    assert.equal(sessionAccount.amount.toNumber(), paymentAmount);                          // make sure amount is equal to sessionAccount amount
    assert.ok("initialized" in sessionAccount.status);                                      // make sure status is initialized     
    assert.ok(sessionAccount.expiryTs > bnZero);                                            // make sure expiry timestamp is greater than zero
  });

  it("Deposit Stablecoins into escrow", async () => {
    // execute deposit stablecoin instructions
    const tx = await program.methods
    .depositStablecoin(
      Array.from(uuid),
    )
    .accountsStrict({
      payer: payer,
      paymentSession: paymentSession,
      payerAta: payerAtaAccount.address,
      escrowAta: escrowAta,
      tokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

    console.log("\n✅ Stablecoins Deposited")
    console.log("Transaction signature:", tx);

    // fetch session
    const sessionAccount = await program.account.paymentSession.fetch(paymentSession);

    // get payer and escrow balances after transaction
    payerBalanceAfter = await getAccount(connection, sessionAccount.payerAta);
    escrowBalanceAfter = await getAccount(connection, sessionAccount.escrowAta);

    console.log("\n✅ Balances After Transaction");
    console.log("Transaction signature:", tx);
    console.log("\n💰 After Deposit:");
    console.log("Payer balance after:", payerBalanceAfter.amount.toString());
    console.log("Escrow balance after:", escrowBalanceAfter.amount.toString());

    // assert that the coins were successfully transferred from payer to escrow
    assert.equal(payerBalanceAfter.amount, BigInt(0));                // if full amount transferred
    assert.equal(escrowBalanceAfter.amount, BigInt(paymentAmount));   // should equal the payment amount
  });

  it("Payment failed, refunding payment", async () => {
    // execute refund payment instruction
    const tx = await program.methods
    .refundPayment(
      Array.from(uuid),
    )
    .accountsStrict({
      payer: payer,
      paymentSession: paymentSession,
      payerAta: payerAtaAccount.address,
      escrowAta: escrowAta,
      tokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

    console.log("\n✅ Payment Refunded");
    console.log("Transaction signature:", tx);
    
    // fetch session
    const sessionAccount = await program.account.paymentSession.fetch(paymentSession);

    // get payer and escrow balances after refund
    payerBalanceAfter = await getAccount(connection, sessionAccount.payerAta);
    escrowBalanceAfter = await getAccount(connection, sessionAccount.escrowAta);

    console.log("\n✅ Balances After Transaction");
    console.log("Transaction signature:", tx);
    console.log("\n💰 After Deposit:");
    console.log("Payer balance after:", payerBalanceAfter.amount.toString());
    console.log("Escrow balance after:", escrowBalanceAfter.amount.toString());

    // assert that the coins were successfully transferred from payer to escrow
    assert.equal(payerBalanceAfter.amount, BigInt(paymentAmount));                // if full amount transferred
    assert.equal(escrowBalanceAfter.amount, BigInt(0));                           // should equal zero after refund (NOTE: Make a randomizer for cases in which float is less tha 0)
  });

  it("Payment was successful, marking payment settled", async () => {

    // define the merchant ata
    const merchantAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,     // switch from merchant, merchant is not funded so it will not create the ATA and silently fail
      tokenMint,
      settlementAuth.publicKey
    );

    // execute mark payment settled instruction
    const tx = await program.methods
    .markPaymentSettled(
      Array.from(uuid),
    )
    .accountsStrict({
      payer: payer,
      paymentSession: paymentSession,
      payerAta: payerAtaAccount.address,
      escrowAta: escrowAta,
      merchantAta: merchantAta.address,
      settlementAuthority: settlementAuth.publicKey,
      tokenMint: tokenMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

    console.log("\n✅ Payment Settled");
    console.log("Transaction signature:", tx);

    // fetch session
    const sessionAccount = await program.account.paymentSession.fetch(paymentSession);

    // get payer and escrow balances after refund
    payerBalanceAfter = await getAccount(connection, sessionAccount.payerAta);
    escrowBalanceAfter = await getAccount(connection, sessionAccount.escrowAta);
    merchantBalanceAfter = await getAccount(connection, merchantAta.address);

    console.log("\n✅ Balances After Transaction");
    console.log("Transaction signature:", tx);
    console.log("\n💰 After Deposit:");
    console.log("Payer balance after:", payerBalanceAfter.amount.toString());
    console.log("Escrow balance after:", escrowBalanceAfter.amount.toString());
    console.log("Merchant balance after:", merchantBalanceAfter.amount.toString());

    // assert that the coins were successfully transferred from payer to escrow
    assert.equal(payerBalanceAfter.amount, BigInt(0));                        // payer balance should be zero
    assert.equal(escrowBalanceAfter.amount, BigInt(0));                       // escrow balance should be zero
    assert.equal(merchantBalanceAfter.amount, BigInt(paymentAmount));         // merchant balance should equal payment amount
  });

});
