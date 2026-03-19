// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MemeToken — ERC20 with linear bonding curve, settled in CURE token
/// @notice Supply: 1B total. 800M sold via bonding curve, 200M to creator.
///         Linear price: p(n) = BASE_PRICE + PRICE_SLOPE * n / CURVE_WHOLE  (CURE-wei per whole token)
///         Full-curve cost = 1e12 * 8e8 + 5e11 * 4e8 = 8e20 + 2e20 = 1e21 = 1000 CURE → graduation threshold.
///         1% fee on every buy and sell, sent to feeRecipient.
contract MemeToken is ERC20 {
    using SafeERC20 for IERC20;

    // ── Supply constants ────────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY  = 1_000_000_000 * 1e18;
    uint256 public constant CURVE_SUPPLY  =   800_000_000 * 1e18; // 80 %
    uint256 public constant CREATOR_SHARE =   200_000_000 * 1e18; // 20 %
    uint256 public constant CURVE_WHOLE   =   800_000_000;        // whole-token divisor

    // ── Curve constants ──────────────────────────────────────────────────────
    // price(n) = BASE_PRICE + PRICE_SLOPE * n / CURVE_WHOLE  (CURE-wei / whole token)
    // ∫₀^(8e8) price dn = 1e12·8e8 + 5e11·4e8 = 8e20 + 2e20 = 1e21 = 1000 CURE
    uint256 public constant BASE_PRICE    = 1e12; // CURE-wei per whole token at n=0
    uint256 public constant PRICE_SLOPE   = 5e11; // additional CURE-wei per token over full curve

    // ── Config ───────────────────────────────────────────────────────────────
    uint256 public constant GRAD_THRESHOLD = 1_000 * 1e18; // 1000 CURE
    uint256 public constant FEE_BPS        = 100;           // 1 %

    // ── State ────────────────────────────────────────────────────────────────
    address public immutable cureToken;
    address public immutable creator;
    address public immutable feeRecipient;

    uint256 public tokensSold;  // 1e18 units sold from the curve
    uint256 public cureRaised;  // cumulative CURE raised (excluding fees)
    bool    public graduated;

    // ── Events ───────────────────────────────────────────────────────────────
    event Buy(address indexed buyer,  uint256 tokenAmount, uint256 cureIn);
    event Sell(address indexed seller, uint256 tokenAmount, uint256 cureOut);
    event Graduated(uint256 totalCureRaised);

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
        address cureToken_
    ) ERC20(name_, symbol_) {
        creator      = creator_;
        feeRecipient = feeRecipient_;
        cureToken    = cureToken_;
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
    /// @param cureAmount  CURE (in CURE-wei) to spend. Caller must have approved this contract.
    /// @param minTokens   Minimum meme tokens to receive (slippage guard). Pass 0 to skip.
    function buy(uint256 cureAmount, uint256 minTokens) external {
        if (graduated)      revert AlreadyGraduated();
        if (cureAmount == 0) revert ZeroAmount();

        IERC20(cureToken).safeTransferFrom(msg.sender, address(this), cureAmount);

        uint256 fee    = cureAmount * FEE_BPS / 10_000;
        uint256 cureIn = cureAmount - fee;

        uint256 amount = _tokensForCure(cureIn);
        if (amount == 0) revert ZeroAmount();

        uint256 available = CURVE_SUPPLY - tokensSold;
        if (amount > available) amount = available;

        if (amount < minTokens) revert SlippageExceeded();

        uint256 actualCost = getCost(tokensSold, amount);
        uint256 refund     = cureIn - actualCost; // rounding dust

        tokensSold += amount;
        cureRaised += actualCost;

        _transfer(address(this), msg.sender, amount);

        IERC20(cureToken).safeTransfer(feeRecipient, fee);
        if (refund > 0) {
            IERC20(cureToken).safeTransfer(msg.sender, refund);
        }

        emit Buy(msg.sender, amount, actualCost);

        if (!graduated && cureRaised >= GRAD_THRESHOLD) {
            graduated = true;
            emit Graduated(cureRaised);
        }
    }

    /// @notice Sell `tokenAmount` meme tokens back to the bonding curve for CURE.
    /// @param tokenAmount  Meme tokens to sell (1e18 units).
    /// @param minCure      Minimum CURE to receive (slippage guard). Pass 0 to skip.
    function sell(uint256 tokenAmount, uint256 minCure) external {
        if (graduated)            revert AlreadyGraduated();
        if (tokenAmount == 0)     revert ZeroAmount();
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
