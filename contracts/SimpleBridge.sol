// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IBridge {
    function bridgeTo(
        address token,
        uint256 amount,
        address recipient
    ) external;
}

contract L2Bridge {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedHashes;

    event Bridged(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 nonce
    );

    modifier onlySupportedToken(address token) {
        require(supportedTokens[token], "Token not supported");
        _;
    }

    function addSupportedToken(address token) external {
        supportedTokens[token] = true;
    }

    function bridge(
        address token,
        uint256 amount,
        address recipient,
        bytes32 nonce
    ) external onlySupportedToken(token) {
        bytes32 hash = keccak256(abi.encodePacked(token, recipient, amount, nonce));
        require(!processedHashes[hash], "Already processed");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        processedHashes[hash] = true;
        emit Bridged(token, recipient, amount, nonce);
    }

    function getHash(
        address token,
        address recipient,
        uint256 amount,
        bytes32 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(token, recipient, amount, nonce));
    }
}

contract L3Bridge {
    using SafeERC20 for IERC20;

    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedHashes;

    address public immutable l2Bridge;

    event Bridged(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        bytes32 nonce
    );

    constructor(address _l2Bridge) {
        l2Bridge = _l2Bridge;
    }

    modifier onlySupportedToken(address token) {
        require(supportedTokens[token], "Token not supported");
        _;
    }

    function addSupportedToken(address token) external {
        supportedTokens[token] = true;
    }

    function mint(
        address token,
        uint256 amount,
        address recipient,
        bytes32 nonce
    ) external onlySupportedToken(token) {
        bytes32 hash = keccak256(abi.encodePacked(token, recipient, amount, nonce));
        require(!processedHashes[hash], "Already processed");

        processedHashes[hash] = true;
        IERC20(token).safeTransfer(recipient, amount);

        emit Bridged(token, recipient, amount, nonce);
    }
}
