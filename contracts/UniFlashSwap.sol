// SPDX-License-Identifier: MIT
pragma solidity =0.6.6;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IERC20.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol';
import './IEscrowLiquidator.sol';
import './Ownable.sol';

/**
 * @notice Contract is unaudited and provided as an example only! Please use at your
 * discretion and with care.
 */
contract UniFlashSwap is IUniswapV2Callee, Ownable {
    IUniswapV2Factory public factoryV2;
    IEscrowLiquidator public escrow;
    address public WETH;
    using SafeMath for uint256;

    constructor(address _factoryV2, address _escrow, address _weth) public {
        factoryV2 = IUniswapV2Factory(_factoryV2);
        escrow = IEscrowLiquidator(_escrow);
        WETH = _weth;
    }

    // Must enable allowance on Escrow in order to liquidate
    function enableToken(address token, uint256 allowance) external onlyOwner {
        IERC20(token).approve(address(escrow), allowance);
    }

    function sweep(address token) external {
        uint balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }

    function getAdjustedBalance(uint reserve, uint amount, uint residualOut) internal pure returns (uint) {
        return (reserve.sub(amount).add(residualOut)).mul(1000).sub(residualOut.mul(3));
    }

    /**
     * @notice Accounts for the case when there is some residual amount left in the token input and we want
     * to transfer it back to Uniswap. For example, when flash swapping DAI-WETH for a liquidation we request
     * 110% of the local DAI required figure as a safety buffer. We will then need to repay the additional 10%
     * of DAI requested back to Uniswap in addition to the WETH required. However, since the fee is taken on both
     * sides of the pool and we do not have excess DAI to repay the fee the math is a little trickier:
     *
     * bAdj = (reserve - amountIn + residualOut) * 1000 - residualOut * 3
     * repayAmount = (r1*r0*1000^2 - r1*bAdj*1000) / (997 * bAdj)
     */
    function getRepayAmounts(
        uint amount0,
        uint amount1,
        address tokenOut,
        uint initialTokenOutBalance,
        address pairAddress
    ) internal view returns (uint, uint) {
        (uint reserve0, uint reserve1, /* uint32 blockTime */) = IUniswapV2Pair(pairAddress).getReserves();
        uint currentTokenBalance = IERC20(tokenOut).balanceOf(address(this));
        uint residualOut = currentTokenBalance > initialTokenOutBalance ? currentTokenBalance.sub(initialTokenOutBalance) : 0;

        if (residualOut > 0 && amount0 > 0) {
            uint balAdj = getAdjustedBalance(reserve0, amount0, residualOut);
            uint numerator = (reserve0.mul(reserve1).mul(1000**2)).sub(balAdj.mul(reserve1).mul(1000));
            uint denominator = balAdj.mul(997);
            uint repayAmount = numerator / denominator + 1;

            return (residualOut, repayAmount);
        } else if (residualOut > 0 && amount1 > 0) {
            uint balAdj = getAdjustedBalance(reserve1, amount1, residualOut);
            uint numerator = (reserve0.mul(reserve1).mul(1000**2)).sub(balAdj.mul(reserve0).mul(1000));
            uint denominator = balAdj.mul(997);
            uint repayAmount = numerator / denominator + 1;

            return (residualOut, repayAmount);
        } else if (amount0 > 0) {
            uint repayAmount = UniswapV2Library.getAmountIn(amount0, reserve1, reserve0);
            return (residualOut, repayAmount);
        } else {
            uint repayAmount = UniswapV2Library.getAmountIn(amount1, reserve0, reserve1);
            return (residualOut, repayAmount);
        }
    }

    /**
     * @dev The sender here is irrelevant because the liquidation funds will stick with the contract and can only
     * be swept out by the owner so liquidations can be executed by any caller.
     */
    function uniswapV2Call(address /* sender */, uint amount0, uint amount1, bytes calldata data) external override {

        address tokenIn;
        address tokenOut;
        uint initialTokenOutBalance;
        {
            address token0 = IUniswapV2Pair(msg.sender).token0();
            address token1 = IUniswapV2Pair(msg.sender).token1();
            // Ensure that the caller is actually the uniswap pair
            assert(msg.sender == factoryV2.getPair(token0, token1));

            if (amount0 > 0) {
                tokenIn = token1;
                tokenOut = token0;
                initialTokenOutBalance = IERC20(tokenOut).balanceOf(address(this)) - amount0;
            } else {
                tokenIn = token0;
                tokenOut = token1;
                initialTokenOutBalance = IERC20(tokenOut).balanceOf(address(this)) - amount1;
            }
        }

        (bytes1 action) = abi.decode(data, (bytes1));
        uint16 collateralId;
        if (action == 0x01) {
            (
                /* bytes1 action */,
                uint16 localCurrency,
                uint16 collateralCurrency,
                address payer,
                uint128 value
            ) = abi.decode(data, (bytes1, uint16, uint16, address, uint128));
            escrow.settleCashBalance(localCurrency, collateralCurrency, payer, value);

            collateralId = collateralCurrency;
        } else if (action == 0x02) {
            (
                /* bytes1 action */,
                uint16 localCurrency,
                uint16 collateralCurrency,
                address[] memory payers,
                uint128[] memory values
            ) = abi.decode(data, (bytes1, uint16, uint16, address[], uint128[]));
            escrow.settleCashBalanceBatch(localCurrency, collateralCurrency, payers, values);

            collateralId = collateralCurrency;
        } else if (action == 0x03) {
            (
                /* bytes1 action */,
                address account,
                uint128 maxLiquidateAmount,
                uint16 localCurrency,
                uint16 collateralCurrency
            ) = abi.decode(data, (bytes1, address, uint128, uint16, uint16));
            escrow.liquidate(account, maxLiquidateAmount, localCurrency, collateralCurrency);

            collateralId = collateralCurrency;
        } else if (action == 0x04) {
            (
                /* bytes1 action */,
                address[] memory accounts,
                uint16 localCurrency,
                uint16 collateralCurrency
            ) = abi.decode(data, (bytes1, address[], uint16, uint16));
            escrow.liquidateBatch(accounts, localCurrency, collateralCurrency);

            collateralId = collateralCurrency;
        }

        (uint residualOut, uint repayAmount) = getRepayAmounts(amount0, amount1, tokenOut, initialTokenOutBalance, msg.sender);

        if (collateralId != 0) {
            // If the collateral currency is not WETH then we need to swap the currency we traded
            // (i.e. WBTC) back to WETH before we repay
            address collateralToken = escrow.currencyIdToAddress(collateralId);
            address collateralWethPair = factoryV2.getPair(collateralToken, WETH);
            address token0 = IUniswapV2Pair(collateralWethPair).token0();
            (uint reserve0, uint reserve1, /* uint32 blockTime */) = IUniswapV2Pair(collateralWethPair).getReserves();

            if (token0 == collateralToken) {
                uint collateralIn = UniswapV2Library.getAmountIn(repayAmount, reserve0, reserve1);
                IERC20(collateralToken).transfer(collateralWethPair, collateralIn);
                IUniswapV2Pair(collateralWethPair).swap(0, repayAmount, address(this), "");
            } else {
                uint collateralIn = UniswapV2Library.getAmountIn(repayAmount, reserve1, reserve0);
                IERC20(collateralToken).transfer(collateralWethPair, collateralIn);
                IUniswapV2Pair(collateralWethPair).swap(repayAmount, 0, address(this), "");
            }
        }

        if (residualOut > 0) {
            IERC20(tokenOut).transfer(msg.sender, residualOut);
        }

        IERC20(tokenIn).transfer(msg.sender, repayAmount);
    }
}