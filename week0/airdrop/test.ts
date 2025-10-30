import { address, createSolanaRpc, devnet } from "@solana/kit";
import wallet from "./Turbin3-wallet.json";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { fetchApplicationAccount } from "./clients/js/src/generated/accounts/applicationAccount";

// Program and system addresses
const PROGRAM_ADDRESS = address("TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM");

// Load your wallet keypair
const keypair = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
console.log("Wallet address:", keypair.address);

// Create RPC connection
const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));

// Compute the PDA for your enrollment/account
import { getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";

const addressEncoder = getAddressEncoder();
const accountSeeds = [
  Buffer.from("prereqs", "utf8"),
  addressEncoder.encode(keypair.address),
];

const [enrollmentPda, _bump] = await getProgramDerivedAddress({
  programAddress: PROGRAM_ADDRESS,
  seeds: accountSeeds,
});

// Fetch the account on-chain
const appAccount = await fetchApplicationAccount(rpc, enrollmentPda);

console.log("On-chain enrollment account:");
console.log("User", appAccount.data.user.toString());
console.log("TS prereq done:", appAccount.data.preReqTs.toString());
console.log("RS prereq done:", appAccount.data.preReqRs.toString());
console.log("GitHub username:", appAccount.data.github.toString());
