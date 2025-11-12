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
import { isAccountsGeneric } from "@coral-xyz/anchor/dist/cjs/program/accounts-resolver";
import { flattenPartialAccounts } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { get } from "http";

describe("capstone_ethanbackhus", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.capstoneEthanbackhus;

  const provider = anchor.getProvider();
  const wallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  const seed = new anchor.BN(Date.now());

  const merchantId = "Amazon";                // in this example, Amazon will be our merchant
  const amount = new anchor.BN(100);
  let referenceId = "Ref12345";
  let payer = wallet.publicKey;
  let createdTs = new anchor.BN(Date.now());
  const uuid = randomBytes(16);
  let settlementAuth = Keypair.generate();
  let bnZero = new anchor.BN(0);

  // describes
  let tokenMint: PublicKey;
  let escrowAta: PublicKey;
  let payerAtaAccount: Account;
  let paymentAmount: bigint;
  let payerBalanceBefore: Account;
  let escrowBalanceBefore: Account;
  let decimals: number = 6;
  
  const [paymentSession] = PublicKey.findProgramAddressSync(
    [Buffer.from("payment_session"), wallet.publicKey.toBuffer(), Buffer.from(uuid)],
    program.programId
  );

  // CPI is creating the escrow ATA
  // we need to derive it here for the test
  /*
  let [escrowAta] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow_ata"), paymentSession.toBuffer()],
    program.programId
  );
  */

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

    // check balances before instruction
    payerBalanceBefore = await getAccount(connection, payerAtaAccount.address);
    escrowBalanceBefore = await getAccount(connection, escrowAta);

    // console logs
    console.log("\n🏦 Initial Setup Complete");
    console.log("-----------------------");
    console.log("Payment Session PDA:", paymentSession.toBase58());
    console.log("Token Mint:", tokenMint.toBase58());
    console.log("Payer ATA:", payerAtaAccount.address.toBase58());

    // log the balances
    console.log("\n💰 Balances Before Transaction");
    console.log("Payer balance before:", payerBalanceBefore.amount.toString());
    console.log("Escrow balance before:", escrowBalanceBefore.amount.toString());

    // assert intial balances
    assert.equal(payerBalanceBefore.amount, paymentAmount);
    assert.equal(escrowBalanceBefore.amount, BigInt(0));
  });

  it("Initialize Payment Session", async () => {
    // execute instruction
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



    // get payer and escrow balances after transaction
    const payerBalanceAfter = await getAccount(
      connection,
      payerAtaAccount.address
    );

    const escrowBalanceAfter = await getAccount(
      connection,
      escrowAta
    );

    console.log("Payer balance after:", payerBalanceAfter.amount.toString());
    console.log("Escrow balance after:", escrowBalanceAfter.amount.toString());

    // assert that the coins were successfully transferred from payer to escrow
    assert.equal(payerBalanceAfter.amount, BigInt(0));                // if full amount transferred
    assert.equal(escrowBalanceAfter.amount, BigInt(paymentAmount));   // should equal the payment amount

    console.log("Your transaction signature", tx);

    // Fetch payment session and assert
    const sessionAccount = await program.account.paymentSession.fetch(paymentSession);

    assert.equal(sessionAccount.payer.toBase58(), payer.toBase58());
    assert.equal(sessionAccount.merchantId, "Amazon");
    assert.equal(sessionAccount.amount.toNumber(), 100);
    assert.ok("initialized" in sessionAccount.status);
    assert.ok(sessionAccount.expiryTs > bnZero);
  });
});
