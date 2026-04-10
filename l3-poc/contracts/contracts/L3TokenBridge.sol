// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract L3TokenBridge {
    address public counterpartBridge;
    address public owner;
    IERC20 public token;
    
    mapping(bytes32 => bool) public processedHashes;
    
    event BridgedToL1(address indexed from, address indexed to, uint256 amount, bytes32 nonce);
    event BridgedFromL1(address indexed from, address indexed to, uint256 amount, bytes32 nonce);
    event Withdraw(address indexed to, uint256 amount);
    event CounterpartBridgeSet(address newBridge);
    
    constructor(address _counterpartBridge, address _token, address _owner) {
        counterpartBridge = _counterpartBridge;
        token = IERC20(_token);
        owner = _owner;
    }
    
    function setCounterpartBridge(address _counterpartBridge) external {
        require(msg.sender == owner, "Only owner");
        counterpartBridge = _counterpartBridge;
        emit CounterpartBridgeSet(_counterpartBridge);
    }
    
    function bridgeToL1(address to, uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        bytes32 nonce = keccak256(abi.encodePacked(msg.sender, to, amount, block.timestamp));
        emit BridgedToL1(msg.sender, to, amount, nonce);
    }
    
    function finalizeBridgeFromL1(address to, uint256 amount, bytes32 nonce) external {
        require(msg.sender == owner, "Only owner");
        require(!processedHashes[nonce], "Already processed");
        
        processedHashes[nonce] = true;
        require(token.transfer(to, amount), "Transfer failed");
        emit BridgedFromL1(address(0), to, amount, nonce);
    }
    
    function withdrawETH(address payable to, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        emit Withdraw(to, amount);
    }
    
    receive() external payable {}
}