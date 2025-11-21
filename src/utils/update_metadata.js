
const { updateMetadataAccountV2, findMetadataPda } = require("@metaplex-foundation/mpl-token-metadata");
const { createSignerFromKeypair, signerIdentity, publicKey } = require("@metaplex-foundation/umi");
const { createUmi } = require("@metaplex-foundation/umi-bundle-defaults");
const fs = require("fs");

(async () => {
  try {
    // 1. Load Wallet
    const keypairData = JSON.parse(fs.readFileSync("devnet-wallet.json", "utf-8"));
    
    // 2. Setup Umi
    const umi = createUmi("https://api.devnet.solana.com");
    
    const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(keypairData));
    const signer = createSignerFromKeypair(umi, keypair);
    
    umi.use(signerIdentity(signer));

    const mintAddress = publicKey("Hp2sfoeguEduFf9xYpvY4uwTEXdRc4pKgyRWbpeTNTSY"); 

    // Use a sample JSON URI
    const jsonUri = "https://raw.githubusercontent.com/solana-developers/professional-education/main/labs/sample-token-metadata.json";

    console.log("Updating metadata for mint:", mintAddress);

    // Use the helper function to find the PDA
    const metadataAccount = findMetadataPda(umi, { mint: mintAddress });

    const tx = await updateMetadataAccountV2(umi, {
      metadata: metadataAccount,
      updateAuthority: signer,
      data: {
        name: "Niladri Token",
        symbol: "NIL",
        uri: jsonUri, 
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      },
      isMutable: true,
    }).sendAndConfirm(umi);

    console.log("Metadata updated successfully!");
  } catch (e) {
    console.error("Error:", e);
    if (e.logs) {
        console.log("Logs:", e.logs);
    }
  }
})();
