// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBridge {
    function bridgeTo(
        address token,
        uint256 amount,
        address recipient,
        bytes32 nonce
    ) external;
}

contract EnhancedL2Bridge is Ownable {
    using SafeERC20 for IERC20;

    struct BridgeRequest {
        address token;
        address sender;
        address recipient;
        uint256 amount;
        bytes32 nonce;
        uint256 timestamp;
        bool processed;
    }

    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedHashes;
    mapping(bytes32 => BridgeRequest) public pendingRequests;

    bytes32[] public requestIds;
    mapping(bytes32 => uint256) public requestIndex;

    event BridgeRequestCreated(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 nonce
    );

    event BridgeRequestProcessed(
        bytes32 indexed nonce,
        address indexed recipient,
        uint256 amount
    );

    event TokenSupportAdded(address indexed token);

    constructor() Ownable(msg.sender) {}

    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = true;
        emit TokenSupportAdded(token);
    }

    function addSupportedTokens(address[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            supportedTokens[tokens[i]] = true;
            emit TokenSupportAdded(tokens[i]);
        }
    }

    function bridge(
        address token,
        uint256 amount,
        address recipient,
        bytes32 nonce
    ) external {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        bytes32 hash = keccak256(abi.encodePacked(token, msg.sender, recipient, amount, nonce));
        require(!processedHashes[hash], "Already processed");
        require(pendingRequests[hash].timestamp == 0, "Pending request exists");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        pendingRequests[hash] = BridgeRequest({
            token: token,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            nonce: nonce,
            timestamp: block.timestamp,
            processed: false
        });
        requestIds.push(hash);
        requestIndex[hash] = requestIds.length - 1;

        emit BridgeRequestCreated(token, msg.sender, recipient, amount, nonce);
    }

    function processRequest(bytes32 hash) external onlyOwner {
        BridgeRequest storage request = pendingRequests[hash];
        require(request.timestamp > 0, "Request not found");
        require(!request.processed, "Already processed");

        request.processed = true;
        processedHashes[hash] = true;

        emit BridgeRequestProcessed(hash, request.recipient, request.amount);
    }

    function batchProcessRequests(bytes32[] calldata hashes) external onlyOwner {
        for (uint256 i = 0; i < hashes.length; i++) {
            bytes32 hash = hashes[i];
            BridgeRequest storage request = pendingRequests[hash];
            if (request.timestamp > 0 && !request.processed) {
                request.processed = true;
                processedHashes[hash] = true;
                emit BridgeRequestProcessed(hash, request.recipient, request.amount);
            }
        }
    }

    function getHash(
        address token,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(token, sender, recipient, amount, nonce));
    }

    function getPendingRequests(uint256 offset, uint256 limit) external view returns (BridgeRequest[] memory) {
        uint256 total = requestIds.length;
        if (offset >= total) return new BridgeRequest[](0);
        
        uint256 end = offset + limit;
        if (end > total) end = total;
        
        uint256 size = end - offset;
        BridgeRequest[] memory result = new BridgeRequest[](size);
        
        for (uint256 i = 0; i < size; i++) {
            bytes32 hash = requestIds[offset + i];
            result[i] = pendingRequests[hash];
        }
        return result;
    }

    function getPendingRequestsCount() external view returns (uint256) {
        return requestIds.length;
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}

contract EnhancedL3Bridge is Ownable {
    using SafeERC20 for IERC20;

    struct BridgeRequest {
        address token;
        address sender;
        address recipient;
        uint256 amount;
        bytes32 nonce;
        uint256 timestamp;
        bool processed;
    }

    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public processedHashes;
    mapping(bytes32 => BridgeRequest) public pendingRequests;

    bytes32[] public requestIds;

    address public l2Bridge;

    event BridgeRequestCreated(
        address indexed token,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes32 nonce
    );

    event BridgeRequestProcessed(
        bytes32 indexed nonce,
        address indexed recipient,
        uint256 amount
    );

    event TokenSupportAdded(address indexed token);
    event L2BridgeUpdated(address indexed oldBridge, address indexed newBridge);

    constructor(address _l2Bridge) Ownable(msg.sender) {
        l2Bridge = _l2Bridge;
    }

    function setL2Bridge(address _l2Bridge) external onlyOwner {
        require(_l2Bridge != address(0), "Invalid bridge");
        emit L2BridgeUpdated(l2Bridge, _l2Bridge);
        l2Bridge = _l2Bridge;
    }

    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        supportedTokens[token] = true;
        emit TokenSupportAdded(token);
    }

    function addSupportedTokens(address[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            supportedTokens[tokens[i]] = true;
            emit TokenSupportAdded(tokens[i]);
        }
    }

    function bridge(
        address token,
        uint256 amount,
        address recipient,
        bytes32 nonce
    ) external {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        bytes32 hash = keccak256(abi.encodePacked(token, msg.sender, recipient, amount, nonce));
        require(!processedHashes[hash], "Already processed");
        require(pendingRequests[hash].timestamp == 0, "Pending request exists");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        pendingRequests[hash] = BridgeRequest({
            token: token,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            nonce: nonce,
            timestamp: block.timestamp,
            processed: false
        });
        requestIds.push(hash);

        emit BridgeRequestCreated(token, msg.sender, recipient, amount, nonce);
    }

    function processRequest(bytes32 hash) external onlyOwner {
        BridgeRequest storage request = pendingRequests[hash];
        require(request.timestamp > 0, "Request not found");
        require(!request.processed, "Already processed");

        request.processed = true;
        processedHashes[hash] = true;

        IERC20(request.token).safeTransfer(request.recipient, request.amount);

        emit BridgeRequestProcessed(hash, request.recipient, request.amount);
    }

    function batchProcessRequests(bytes32[] calldata hashes) external onlyOwner {
        for (uint256 i = 0; i < hashes.length; i++) {
            bytes32 hash = hashes[i];
            BridgeRequest storage request = pendingRequests[hash];
            if (request.timestamp > 0 && !request.processed) {
                request.processed = true;
                processedHashes[hash] = true;
                
                IERC20(request.token).safeTransfer(request.recipient, request.amount);
                
                emit BridgeRequestProcessed(hash, request.recipient, request.amount);
            }
        }
    }

    function getHash(
        address token,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(token, sender, recipient, amount, nonce));
    }

    function getPendingRequests(uint256 offset, uint256 limit) external view returns (BridgeRequest[] memory) {
        uint256 total = requestIds.length;
        if (offset >= total) return new BridgeRequest[](0);
        
        uint256 end = offset + limit;
        if (end > total) end = total;
        
        uint256 size = end - offset;
        BridgeRequest[] memory result = new BridgeRequest[](size);
        
        for (uint256 i = 0; i < size; i++) {
            bytes32 hash = requestIds[offset + i];
            result[i] = pendingRequests[hash];
        }
        return result;
    }

    function getPendingRequestsCount() external view returns (uint256) {
        return requestIds.length;
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
