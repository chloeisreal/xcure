// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CureToken - Native Gas Token for Cure L3 Chain
/// @notice ERC20 token with initial supply for testing and demonstration
/// @dev Deployed on Arbitrum Sepolia, then used as L3 fee token
contract CureToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens

    /// @notice Minimum deposit for L3 fee token (in wei)
    uint256 public constant MIN_DEPOSIT = 1 ether;

    /// @notice Emission rate for testnet faucet (tokens per minute)
    uint256 public emissionRate = 100 * 10**18;

    mapping(address => uint256) public lastClaimTime;

    event TokensMinted(address indexed to, uint256 amount);
    event EmissionRateUpdated(uint256 newRate);

    constructor() ERC20("Cure", "CURE") Ownable(msg.sender) {
        // Mint initial supply to deployer (for testing)
        _mint(msg.sender, MAX_SUPPLY);
    }

    /// @notice Mint new tokens (only owner)
    /// @param to Address to receive tokens
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /// @notice Update emission rate for faucet
    /// @param newRate New emission rate
    function setEmissionRate(uint256 newRate) external onlyOwner {
        emissionRate = newRate;
        emit EmissionRateUpdated(newRate);
    }

    /// @notice Get tokens from faucet (for testing)
    /// @dev Limited to once per minute per address
    function claimFaucet() external {
        require(block.timestamp >= lastClaimTime[msg.sender] + 1 minutes, "Cooldown active");
        
        lastClaimTime[msg.sender] = block.timestamp;
        _mint(msg.sender, emissionRate);
    }

    /// @notice Override decimals to match ETH (18)
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
