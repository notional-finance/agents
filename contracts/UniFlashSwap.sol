// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.6.6;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IERC20.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol';
import './IEscrowLiquidator.sol';
import './Ownable.sol';

contract UniFlashSwap is IUniswapV2Callee, Ownable {
    IUniswapV2Factory public factoryV2;
    IEscrowLiquidator public escrow;
    using SafeMath for uint256;

    constructor(address _factoryV2, address _escrow) public {
        factoryV2 = IUniswapV2Factory(_factoryV2);
        escrow = IEscrowLiquidator(_escrow);
    }

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
            // repayAmount >= (r1r0*1000^2 - r1*b0Adj*1000) / (997*b0Adj)
            // b0Adj = (reserve0 - amount0 + residualOut) * 1000 - (residualOut) * 3

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
        if (action == 0x01) {
            (
                /* bytes1 action */,
                uint16 localCurrency,
                uint16 collateralCurrency,
                address payer,
                uint128 value
            ) = abi.decode(data, (bytes1, uint16, uint16, address, uint128));
            escrow.settleCashBalance(localCurrency, collateralCurrency, payer, value);
        } else if (action == 0x02) {
            (
                /* bytes1 action */,
                uint16 localCurrency,
                uint16 collateralCurrency,
                address[] memory payers,
                uint128[] memory values
            ) = abi.decode(data, (bytes1, uint16, uint16, address[], uint128[]));
            escrow.settleCashBalanceBatch(localCurrency, collateralCurrency, payers, values);
        } else if (action == 0x03) {
            (
                /* bytes1 action */,
                address account,
                uint128 maxLiquidateAmount,
                uint16 localCurrency,
                uint16 collateralCurrency
            ) = abi.decode(data, (bytes1, address, uint128, uint16, uint16));
            escrow.liquidate(account, maxLiquidateAmount, localCurrency, collateralCurrency);
        } else if (action == 0x04) {
            (
                /* bytes1 action */,
                address[] memory accounts,
                uint16 localCurrency,
                uint16 collateralCurrency
            ) = abi.decode(data, (bytes1, address[], uint16, uint16));
            escrow.liquidateBatch(accounts, localCurrency, collateralCurrency);
        }

        (uint residualOut, uint repayAmount) = getRepayAmounts(amount0, amount1, tokenOut, initialTokenOutBalance, msg.sender);

        if (residualOut > 0) {
            IERC20(tokenOut).transfer(msg.sender, residualOut);
        }

        IERC20(tokenIn).transfer(msg.sender, repayAmount);
    }
}