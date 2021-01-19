// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

interface IEscrowLiquidator {

    function currencyIdToAddress(uint16 id) external view returns (address);

    function liquidateBatch(
        address[] calldata accounts,
        uint16 localCurrency,
        uint16 collateralCurrency
    ) external;

    function liquidate(
        address account,
        uint128 maxLiquidateAmount,
        uint16 localCurrency,
        uint16 collateralCurrency
    ) external;

    function settleCashBalanceBatch(
        uint16 localCurrency,
        uint16 collateralCurrency,
        address[] calldata payers,
        uint128[] calldata values
    ) external;

    function settleCashBalance(
        uint16 localCurrency,
        uint16 collateralCurrency,
        address payer,
        uint128 value
    ) external;

    function settlefCash(
        address payer,
        uint16 localCurrency,
        uint16 collateralCurrency,
        uint128 valueToSettle
    ) external;

    function liquidatefCash(
        address payer,
        uint16 localCurrency,
        uint16 collateralCurrency
    ) external;
}