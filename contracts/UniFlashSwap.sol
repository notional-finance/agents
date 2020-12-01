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

    function uniswapV2Call(address /* sender */, uint amount0, uint amount1, bytes calldata data) external override {

        address tokenIn;
        uint repayAmount;
        {
            address token0 = IUniswapV2Pair(msg.sender).token0();
            address token1 = IUniswapV2Pair(msg.sender).token1();
            // Ensure that the caller is actually the uniswap pair
            assert(msg.sender == factoryV2.getPair(token0, token1));

            (uint reserve0, uint reserve1, /* uint32 blockTime */) = IUniswapV2Pair(msg.sender).getReserves();

            if (amount0 > 0) {
                tokenIn = token1;
                repayAmount = UniswapV2Library.getAmountIn(amount0, reserve1, reserve0);
            } else {
                tokenIn = token0;
                repayAmount = UniswapV2Library.getAmountIn(amount1, reserve0, reserve1);
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

        IERC20(tokenIn).transfer(msg.sender, repayAmount);
    }

}