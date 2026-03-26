const { ethers } = require("ethers");

async function main() {
  console.log("Deploying L3Bridge to L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:3347");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
  console.log("Deployer:", wallet.address);
  
  const fs = require("fs");
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/SimpleBridge.sol/L3Bridge.json", "utf8"));
  
  console.log("Bytecode size:", artifact.bytecode.length);
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log("Sending deployment transaction...");
  const contract = await factory.deploy("0x0000000000000000000000000000000000000000");
  console.log("TX hash:", contract.deploymentTransaction().hash);
  
  console.log("Waiting for deployment...");
  await contract.deploymentTransaction().wait();
  
  console.log("L3Bridge deployed to:", contract.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
