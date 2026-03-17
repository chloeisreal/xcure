// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BondingCurve.sol";

/// @title MemeFactory — deploys MemeToken instances and maintains a registry
contract MemeFactory {
    address public immutable feeRecipient;

    address[] public allTokens;

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string  name,
        string  symbol,
        uint256 index
    );

    constructor(address feeRecipient_) {
        feeRecipient = feeRecipient_;
    }

    /// @notice Deploy a new MemeToken bonding curve.
    /// @return token Address of the newly deployed MemeToken.
    function createToken(
        string calldata name,
        string calldata symbol
    ) external returns (address token) {
        MemeToken meme = new MemeToken(name, symbol, msg.sender, feeRecipient);
        token = address(meme);
        allTokens.push(token);
        emit TokenCreated(token, msg.sender, name, symbol, allTokens.length - 1);
    }

    /// @notice Total number of tokens created.
    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    /// @notice Paginated token list. Returns up to `limit` addresses starting at `offset`.
    function getTokens(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result)
    {
        uint256 total = allTokens.length;
        if (offset >= total) return result;
        uint256 end = offset + limit;
        if (end > total) end = total;
        result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allTokens[i];
        }
    }
}
