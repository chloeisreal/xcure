const { ethers } = require("ethers");

const L2_BRIDGE = "0xA3365a6FB38bce1a91b4beB37e229B2a7e49562C";
const L3_BRIDGE = "0xF1a538669DCae3D42382De661BFF7d09dfd8dCDC";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
  const fs = require("fs");
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/SimpleBridge.sol/L2Bridge.json", "utf8"));
  const contract = new ethers.Contract(L2_BRIDGE, artifact.abi, wallet);
  
  console.log("Adding L3Bridge as supported token...");
  const tx = await contract.addSupportedToken(L3_BRIDGE);
  await tx.wait();
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
