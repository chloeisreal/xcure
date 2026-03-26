const { ethers } = require("ethers");

async function main() {
  console.log("Deploying EnhancedL2Bridge to L2...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
  const fs = require("fs");
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EnhancedBridge.sol/EnhancedL2Bridge.json", "utf8"));
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.deploymentTransaction().wait();
  
  console.log("EnhancedL2Bridge deployed to:", contract.target);
  
  // Deploy EnhancedL3Bridge with L2Bridge address
  const l3Artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EnhancedBridge.sol/EnhancedL3Bridge.json", "utf8"));
  const l3Factory = new ethers.ContractFactory(l3Artifact.abi, l3Artifact.bytecode, wallet);
  const l3Contract = await l3Factory.deploy(contract.target);
  await l3Contract.deploymentTransaction().wait();
  
  console.log("EnhancedL3Bridge deployed to:", l3Contract.target);
  
  // Add supported tokens (MockCURE on L2)
  const cureAddress = "0xf4d76f449E66c714105928f24bc9fD59692B1157"; // MockCURE
  const tx = await contract.addSupportedToken(cureAddress);
  await tx.wait();
  console.log("Added MockCURE as supported token");
  
  console.log("\n=== Deployment Summary ===");
  console.log("L2 Bridge:", contract.target);
  console.log("L3 Bridge:", l3Contract.target);
  console.log("Supported Token:", cureAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
