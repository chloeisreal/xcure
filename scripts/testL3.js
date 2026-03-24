const hre = require("hardhat");

async function main() {
  console.log("Testing L3 connection...");
  const provider = hre.ethers.getDefaultProvider("http://127.0.0.1:3347");
  const blockNumber = await provider.getBlockNumber();
  console.log("L3 block number:", blockNumber);
  
  const accounts = await provider.listAccounts();
  console.log("Available accounts:", accounts.length);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
