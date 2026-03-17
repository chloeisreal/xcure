// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20 — minimal ERC20 with a public mint for testing
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    /// @notice Anyone can mint — test use only, do not deploy to mainnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
