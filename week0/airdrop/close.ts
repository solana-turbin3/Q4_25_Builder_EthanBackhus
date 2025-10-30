import {
    address,
    appendTransactionMessageInstructions,
    assertIsTransactionWithinSizeLimit,
    createKeyPairSignerFromBytes,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    createTransactionMessage,
    devnet,
    getSignatureFromTransaction,
    pipe,
    sendAndConfirmTransactionFactory,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    addSignersToTransactionMessage,
    getProgramDerivedAddress,
    generateKeyPairSigner,
    getAddressEncoder,
    lamports
} from "@solana/kit";

import wallet from "./Turbin3-wallet.json";
import { getInitializeInstruction, getUpdateInstruction, getCloseInstruction } from "./clients/js/src/generated/index";

const MPL_CORE_PROGRAM = address("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
const PROGRAM_ADDRESS = address("TRBZyQHB3m68FGeVsqTK39Wm4xejadjVhP5MAZaKWDM");
const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

const keypair = await createKeyPairSignerFromBytes(new Uint8Array(wallet));
console.log(`Your Solana wallet address: ${keypair.address}`);

const rpc = createSolanaRpc(devnet("https://api.devnet.solana.com"));
const rpcSubscriptions = createSolanaRpcSubscriptions(devnet('ws://api.devnet.solana.com'));
const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

const addressEncoder = getAddressEncoder();

const accountSeeds = [
    Buffer.from("prereqs"),
    addressEncoder.encode(keypair.address)
];
const [account, _bump] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ADDRESS,
    seeds: accountSeeds
});

const GITHUB_USERNAME = "EthanBackhus";

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

async function sendTransaction(instructions: any[], signers: any[] = []) {
    const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        tx => setTransactionMessageFeePayerSigner(keypair, tx),
        tx => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        tx => appendTransactionMessageInstructions(instructions, tx),
        tx => addSignersToTransactionMessage(signers, tx)
    );
    const signedTx = await signTransactionMessageWithSigners(txMessage);
    assertIsTransactionWithinSizeLimit(signedTx);
    return sendAndConfirmTransaction(signedTx, { commitment: "confirmed", skipPreflight: false });
}

try {
    console.log("Attempting to close existing enrollment account...");
    const closeIx = getCloseInstruction({
        user: keypair.address,
        account,
        systemProgram: SYSTEM_PROGRAM
    });
    await sendTransaction([closeIx]);
    console.log("Account closed successfully.");
} catch (err: any) {
    console.log("No account to close or already closed:", err.message);
}