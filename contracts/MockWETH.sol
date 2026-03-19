// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockWETH — mock Wrapped Ether ERC20 for testing
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    /// @notice Anyone can mint — test use only, do not deploy to mainnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
