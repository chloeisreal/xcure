// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title SimpleSwap — constant-product AMM (x·y = k) for a single token pair
/// @notice 0.3 % swap fee, no LP tokens, no price oracle — for local testing only
contract SimpleSwap {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    event LiquidityAdded(uint256 amountA, uint256 amountB);
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != _tokenB, "Same token");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    /// @notice Seed the pool with initial liquidity (no LP token minted)
    function addLiquidity(uint256 amountA, uint256 amountB) external {
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);
        reserveA += amountA;
        reserveB += amountB;
        emit LiquidityAdded(amountA, amountB);
    }

    /// @notice Constant-product output calculation with 0.3 % fee
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "Zero input");
        require(reserveIn > 0 && reserveOut > 0, "No liquidity");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    /// @notice Swap `amountIn` of `tokenIn` for the other token
    /// @param tokenIn  Address of the token being sold (must be tokenA or tokenB)
    /// @param amountIn Amount of tokenIn to sell (in wei)
    /// @param minAmountOut Minimum acceptable output (slippage guard)
    function swap(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        bool sellA = tokenIn == address(tokenA);
        require(sellA || tokenIn == address(tokenB), "Invalid token");

        (uint256 rIn, uint256 rOut) = sellA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);

        amountOut = getAmountOut(amountIn, rIn, rOut);
        require(amountOut >= minAmountOut, "Slippage exceeded");

        // Transfer tokenIn from sender → pool
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Transfer tokenOut from pool → sender
        IERC20 tokenOut = sellA ? tokenB : tokenA;
        tokenOut.safeTransfer(msg.sender, amountOut);

        // Update reserves
        if (sellA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }
}
