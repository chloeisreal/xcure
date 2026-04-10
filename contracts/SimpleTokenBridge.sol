// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleTokenBridge is Ownable {
    address public counterpartBridge;
    mapping(address => bool) public supportedTokens;
    
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    
    constructor(address _counterpartBridge, address _owner) Ownable(_owner) {
        counterpartBridge = _counterpartBridge;
    }
    
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
    
    function depositETH() external payable {
        require(msg.value > 0, "No ETH sent");
        emit Deposited(msg.sender, msg.value);
    }
    
    function withdrawETH(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        to.transfer(amount);
        emit Withdrawn(to, amount);
    }
    
    function setCounterpartBridge(address _counterpartBridge) external onlyOwner {
        counterpartBridge = _counterpartBridge;
    }
    
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
}