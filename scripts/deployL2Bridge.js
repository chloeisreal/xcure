const { ethers } = require("ethers");

async function main() {
  console.log("Deploying L2Bridge to L2 (Sequencer)...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
  console.log("Deployer:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  const fs = require("fs");
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/SimpleBridge.sol/L2Bridge.json", "utf8"));
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const l2Bridge = await factory.deploy();
  
  console.log("Transaction hash:", l2Bridge.deploymentTransaction().hash);
  const receipt = await l2Bridge.deploymentTransaction().wait();
  console.log("L2Bridge deployed to:", l2Bridge.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
