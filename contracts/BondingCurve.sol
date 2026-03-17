// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MemeToken — ERC20 with linear bonding curve
/// @notice Supply: 1B total. 800M sold via bonding curve, 200M to creator.
///         Linear price: p(n) = BASE_PRICE + PRICE_SLOPE * n / CURVE_WHOLE  (wei per whole token)
///         Full-curve cost = 1e8 * 8e8 + 5e7 * 4e8 = 0.1 ETH  → graduation threshold.
///         1% fee on every buy and sell, sent to feeRecipient.
contract MemeToken is ERC20 {
    // ── Supply constants ────────────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY  = 1_000_000_000 * 1e18;
    uint256 public constant CURVE_SUPPLY  =   800_000_000 * 1e18; // 80 %
    uint256 public constant CREATOR_SHARE =   200_000_000 * 1e18; // 20 %
    uint256 public constant CURVE_WHOLE   =   800_000_000;        // whole-token divisor

    // ── Curve constants ──────────────────────────────────────────────────────
    // price(n) = BASE_PRICE + PRICE_SLOPE * n / CURVE_WHOLE  (wei / whole token)
    // ∫₀^(8e8) price dn = 1e8·8e8 + 5e7·4e8 = 8e16 + 2e16 = 1e17 wei = 0.1 ETH
    uint256 public constant BASE_PRICE    = 1e8; // wei per whole token at n=0
    uint256 public constant PRICE_SLOPE   = 5e7; // additional wei per token over full curve

    // ── Config ───────────────────────────────────────────────────────────────
    uint256 public constant GRAD_THRESHOLD = 0.1 ether;
    uint256 public constant FEE_BPS        = 100;  // 1 %

    // ── State ────────────────────────────────────────────────────────────────
    address public immutable creator;
    address public immutable feeRecipient;

    uint256 public tokensSold; // 1e18 units sold from the curve
    uint256 public ethRaised;  // cumulative ETH raised (excluding fees)
    bool    public graduated;

    // ── Events ───────────────────────────────────────────────────────────────
    event Buy(address indexed buyer,  uint256 tokenAmount, uint256 ethIn);
    event Sell(address indexed seller, uint256 tokenAmount, uint256 ethOut);
    event Graduated(uint256 totalEthRaised);

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
        address feeRecipient_
    ) ERC20(name_, symbol_) {
        creator      = creator_;
        feeRecipient = feeRecipient_;
        _mint(creator_,        CREATOR_SHARE);
        _mint(address(this),   CURVE_SUPPLY);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /// @notice ETH cost (wei) to buy `amount` tokens (1e18 units) when `sold` already sold.
    ///         Uses closed-form integral of the linear price curve.
    function getCost(uint256 sold, uint256 amount) public pure returns (uint256) {
        uint256 s = sold   / 1e18; // whole tokens already sold
        uint256 a = amount / 1e18; // whole tokens to buy
        if (a == 0) return 0;
        // cost = BASE_PRICE * a  +  PRICE_SLOPE * (a*s + a²/2) / CURVE_WHOLE
        return BASE_PRICE * a
             + PRICE_SLOPE * (a * s + a * a / 2) / CURVE_WHOLE;
    }

    /// @notice Current spot price in wei per whole token.
    function currentPrice() external view returns (uint256) {
        return BASE_PRICE + PRICE_SLOPE * (tokensSold / 1e18) / CURVE_WHOLE;
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    /// @notice Buy tokens from the bonding curve.
    /// @param minTokens  Minimum tokens to receive (slippage guard). Pass 0 to skip.
    function buy(uint256 minTokens) external payable {
        if (graduated)    revert AlreadyGraduated();
        if (msg.value == 0) revert ZeroAmount();

        uint256 fee   = msg.value * FEE_BPS / 10_000;
        uint256 ethIn = msg.value - fee;

        // Solve for maximum whole tokens purchasable with ethIn
        uint256 amount = _tokensForEth(ethIn);
        if (amount == 0) revert ZeroAmount();

        // Cap to remaining curve supply
        uint256 available = CURVE_SUPPLY - tokensSold;
        if (amount > available) amount = available;

        if (amount < minTokens) revert SlippageExceeded();

        uint256 actualCost = getCost(tokensSold, amount);
        uint256 refund     = ethIn - actualCost; // rounding dust

        tokensSold += amount;
        ethRaised  += actualCost;

        _transfer(address(this), msg.sender, amount);

        // Distribute ETH
        (bool feeOk,) = feeRecipient.call{value: fee}("");
        require(feeOk, "Fee transfer failed");
        if (refund > 0) {
            (bool refundOk,) = msg.sender.call{value: refund}("");
            require(refundOk, "Refund failed");
        }

        emit Buy(msg.sender, amount, actualCost);

        if (!graduated && ethRaised >= GRAD_THRESHOLD) {
            graduated = true;
            emit Graduated(ethRaised);
        }
    }

    /// @notice Sell `amount` tokens (1e18 units) back to the bonding curve.
    function sell(uint256 amount) external {
        if (graduated)     revert AlreadyGraduated();
        if (amount == 0)   revert ZeroAmount();
        if (amount > tokensSold) revert InsufficientCurveSupply();

        uint256 proceeds = getCost(tokensSold - amount, amount);
        uint256 fee      = proceeds * FEE_BPS / 10_000;
        uint256 ethOut   = proceeds - fee;

        tokensSold -= amount;
        // Guard against rounding underflow
        ethRaised   = ethRaised > proceeds ? ethRaised - proceeds : 0;

        _transfer(msg.sender, address(this), amount);

        (bool feeOk,) = feeRecipient.call{value: fee}("");
        require(feeOk, "Fee transfer failed");
        (bool ok,) = msg.sender.call{value: ethOut}("");
        require(ok, "ETH transfer failed");

        emit Sell(msg.sender, amount, ethOut);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Binary search: largest whole-token count buyable for `ethIn` wei.
    ///      O(log₂(CURVE_WHOLE)) ≈ 30 iterations.
    function _tokensForEth(uint256 ethIn) internal view returns (uint256) {
        uint256 sold = tokensSold;
        uint256 lo   = 0;
        uint256 hi   = (CURVE_SUPPLY - sold) / 1e18; // max whole tokens remaining

        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (getCost(sold, mid * 1e18) <= ethIn) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        return lo * 1e18;
    }

    receive() external payable {}
}
