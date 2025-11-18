import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PROGRAM_ID = new anchor.web3.PublicKey(process.env.PROGRAM_ID);
const AUTHORITY_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(process.env.AUTHORITY_KEYPAIR)))
);

export function getAnchor() {
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL, "confirmed");

  const wallet = new anchor.Wallet(AUTHORITY_KEYPAIR);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync("./idl.json", "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  return { provider, program };
}
