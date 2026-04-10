// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ── Uniswap V2 minimal interfaces ────────────────────────────────────────────
interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function factory() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/// @title MemeToken — ERC20 with linear bonding curve, settled in CURE token.
/// @notice Supply: 1B total. 800M sold via bonding curve, 200M to creator.
///         Linear price: p(n) = BASE_PRICE + PRICE_SLOPE * n / CURVE_WHOLE  (CURE-wei per whole token)
///         Full-curve cost = 1e12 * 8e8 + 5e11 * 4e8 = 8e20 + 2e20 = 1e21 = 1000 CURE → graduation threshold.
///         1% fee on every buy and sell, sent to feeRecipient.
///         On graduation: all raised CURE + remaining curve tokens are deposited into a
///         Uniswap V2 pool; LP tokens are sent to address(0) (permanently locked).
contract MemeToken is ERC20 {
    using SafeERC20 for IERC20;

    // ── Supply constants ─────────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY  = 1_000_000_000 * 1e18;
    uint256 public constant CURVE_SUPPLY  =   800_000_000 * 1e18; // 80%
    uint256 public constant CREATOR_SHARE =   200_000_000 * 1e18; // 20%
    uint256 public constant CURVE_WHOLE   =   800_000_000;        // whole-token divisor

    // ── Curve constants ──────────────────────────────────────────────────────
    uint256 public constant BASE_PRICE  = 1e12; // CURE-wei per whole token at n=0
    uint256 public constant PRICE_SLOPE = 5e11; // additional CURE-wei per token over full curve

    // ── Config ───────────────────────────────────────────────────────────────
    uint256 public constant GRAD_THRESHOLD = 1_000 * 1e18; // 1000 CURE
    uint256 public constant FEE_BPS        = 100;           // 1%

    // ── Immutables ───────────────────────────────────────────────────────────
    address public immutable cureToken;
    address public immutable creator;
    address public immutable feeRecipient;
    address public immutable uniswapV2Router;

    // ── State ─────────────────────────────────────────────────────────────────
    uint256 public tokensSold;  // 1e18 units sold from the curve
    uint256 public cureRaised;  // cumulative CURE raised (excluding fees)
    bool    public graduated;

    // ── Events ───────────────────────────────────────────────────────────────
    event Buy(address indexed buyer,   uint256 tokenAmount, uint256 cureIn);
    event Sell(address indexed seller, uint256 tokenAmount, uint256 cureOut);
    event Graduated(uint256 totalCureRaised);
    event GraduatedToUniswap(address indexed pair, uint256 cureAmount, uint256 tokenAmount);

    // ── Errors ───────────────────────────────────────────────────────────────
    error AlreadyGraduated();
    error ZeroAmount();
    error SlippageExceeded();
    error InsufficientCurveSupply();

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(
        string memory name_,
        string memory symbol_,
        address creator_,
        address feeRecipient_,
        address cureToken_,
        address uniswapV2Router_
    ) ERC20(name_, symbol_) {
        creator          = creator_;
        feeRecipient     = feeRecipient_;
        cureToken        = cureToken_;
        uniswapV2Router  = uniswapV2Router_;
        _mint(creator_,      CREATOR_SHARE);
        _mint(address(this), CURVE_SUPPLY);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /// @notice CURE cost (CURE-wei) to buy `amount` tokens (1e18 units) when `sold` already sold.
    function getCost(uint256 sold, uint256 amount) public pure returns (uint256) {
        uint256 s = sold   / 1e18;
        uint256 a = amount / 1e18;
        if (a == 0) return 0;
        return BASE_PRICE * a
             + PRICE_SLOPE * (a * s + a * a / 2) / CURVE_WHOLE;
    }

    /// @notice Current spot price in CURE-wei per whole token.
    function currentPrice() external view returns (uint256) {
        return BASE_PRICE + PRICE_SLOPE * (tokensSold / 1e18) / CURVE_WHOLE;
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    /// @notice Buy tokens from the bonding curve using CURE.
    function buy(uint256 cureAmount, uint256 minTokens) external {
        if (graduated)       revert AlreadyGraduated();
        if (cureAmount == 0) revert ZeroAmount();

        IERC20(cureToken).safeTransferFrom(msg.sender, address(this), cureAmount);

        uint256 fee    = cureAmount * FEE_BPS / 10_000;
        uint256 cureIn = cureAmount - fee;

        uint256 available = CURVE_SUPPLY - tokensSold;
        if (available == 0) revert AlreadyGraduated(); // all tokens sold, should have graduated

        uint256 amount = _tokensForCure(cureIn);
        if (amount == 0) revert ZeroAmount();

        if (amount > available) amount = available;

        if (amount < minTokens) revert SlippageExceeded();

        uint256 actualCost = getCost(tokensSold, amount);
        uint256 refund     = cureIn - actualCost;

        tokensSold += amount;
        cureRaised += actualCost;

        _transfer(address(this), msg.sender, amount);

        IERC20(cureToken).safeTransfer(feeRecipient, fee);
        if (refund > 0) IERC20(cureToken).safeTransfer(msg.sender, refund);

        emit Buy(msg.sender, amount, actualCost);

        // Graduate when threshold is hit OR all curve supply is sold (prevents rounding-induced stuck state)
        if (cureRaised >= GRAD_THRESHOLD || tokensSold >= CURVE_SUPPLY) {
            graduated = true;
            emit Graduated(cureRaised);
            try this._graduateToUniswap() {} catch {} // best-effort LP; graduation is not blocked
        }
    }

    /// @notice Sell `tokenAmount` meme tokens back to the bonding curve for CURE.
    function sell(uint256 tokenAmount, uint256 minCure) external {
        if (graduated)              revert AlreadyGraduated();
        if (tokenAmount == 0)       revert ZeroAmount();
        if (tokenAmount > tokensSold) revert InsufficientCurveSupply();

        uint256 proceeds = getCost(tokensSold - tokenAmount, tokenAmount);
        uint256 fee      = proceeds * FEE_BPS / 10_000;
        uint256 cureOut  = proceeds - fee;

        if (cureOut < minCure) revert SlippageExceeded();

        tokensSold -= tokenAmount;
        cureRaised  = cureRaised > proceeds ? cureRaised - proceeds : 0;

        _transfer(msg.sender, address(this), tokenAmount);

        IERC20(cureToken).safeTransfer(feeRecipient, fee);
        IERC20(cureToken).safeTransfer(msg.sender, cureOut);

        emit Sell(msg.sender, tokenAmount, cureOut);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Deposit all raised CURE + remaining curve tokens into a Uniswap V2 pool.
    ///      LP tokens are sent to address(0) — permanently locked.
    ///      Called via `try this._graduateToUniswap()` so failures don't block graduation.
    function _graduateToUniswap() external {
        require(msg.sender == address(this), "only self");
        uint256 cureAmt  = IERC20(cureToken).balanceOf(address(this));
        uint256 memeAmt  = balanceOf(address(this)); // remaining unsold curve tokens

        if (cureAmt == 0 || memeAmt == 0) return;

        // Approve router to spend both tokens
        IERC20(cureToken).forceApprove(uniswapV2Router, cureAmt);
        _approve(address(this), uniswapV2Router, memeAmt);

        // Add liquidity; LP goes to address(0) — burned forever
        (uint256 usedCure, uint256 usedMeme,) = IUniswapV2Router02(uniswapV2Router).addLiquidity(
            cureToken,
            address(this),
            cureAmt,
            memeAmt,
            (cureAmt * 95) / 100, // 5% slippage tolerance on CURE
            (memeAmt * 95) / 100, // 5% slippage tolerance on meme token
            address(0),           // LP recipient = burn address
            block.timestamp + 300 // 5-minute deadline
        );

        // Retrieve the pair address for the event
        address uniFactory = IUniswapV2Router02(uniswapV2Router).factory();
        address pair = IUniswapV2Factory(uniFactory).getPair(cureToken, address(this));

        emit GraduatedToUniswap(pair, usedCure, usedMeme);
    }

    /// @dev Binary search: largest whole-token count buyable for `cureIn` CURE-wei.
    function _tokensForCure(uint256 cureIn) internal view returns (uint256) {
        uint256 sold = tokensSold;
        uint256 lo   = 0;
        uint256 hi   = (CURVE_SUPPLY - sold) / 1e18;

        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (getCost(sold, mid * 1e18) <= cureIn) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo * 1e18;
    }
}
