require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;

const CURE_TOKEN_ADDRESS = "0xf4d76f449E66c714105928f24bc9fD59692B1157";
const RECIPIENT_ADDRESS = "0xa51B2CB15E4DE90dc242FB4d1ff1E93CC82dBA5D";
const MINT_AMOUNT = ethers.parseEther("1000000");

const ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) view returns (uint256)"
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Minting CURE tokens...");
  console.log("Deployer:", deployer.address);
  console.log("Recipient:", RECIPIENT_ADDRESS);
  
  const cureToken = new ethers.Contract(CURE_TOKEN_ADDRESS, ABI, deployer);
  
  const tx = await cureToken.mint(RECIPIENT_ADDRESS, MINT_AMOUNT);
  console.log("Transaction sent:", tx.hash);
  
  await tx.wait();
  console.log("Transaction confirmed!");
  
  const balance = await cureToken.balanceOf(RECIPIENT_ADDRESS);
  console.log("CURE balance:", ethers.formatEther(balance));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });