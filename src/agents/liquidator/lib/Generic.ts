import { Factors } from 'core/lib/FreeCollateral'
import { AssetType } from 'core/model/GraphTypes'
import { Account, Asset, Currency } from 'core/model/Schema'
import { BigNumber, ethers } from 'ethers'

export function totalCashClaim(symbol: string, portfolio: Asset[]) {
  return portfolio
    .filter((a) => a.assetType === AssetType.LiquidityToken
        && a.symbol === symbol
        && !a.assetValue.hasMatured)
    .reduce((agg, a) => agg.add(a.assetValue.cash), BigNumber.from(0))
}

export function totalHaircutCashClaim(symbol: string, portfolio: Asset[]) {
  return portfolio
    .filter((a) => a.assetType === AssetType.LiquidityToken
        && a.symbol === symbol
        && !a.assetValue.hasMatured)
    .reduce((agg, a) => agg.add(a.assetValue.cash).sub(a.assetValue.haircutCash), BigNumber.from(0))
}

export function effectiveExchangeRate(
  localPurchased: BigNumber,
  collateralPurchased: BigNumber,
  collateralCurrency: Currency | undefined,
) {
  return !collateralPurchased.isZero() && collateralCurrency
    ? localPurchased.mul(collateralCurrency.decimals).div(collateralPurchased)
    : BigNumber.from(0)
}

export function adjustfCashValue(
  netAvailable: BigNumber,
  cashBalance: BigNumber,
  haircutCashClaim: BigNumber,
) {
  const fCashValue = netAvailable.sub(cashBalance).sub(haircutCashClaim)

  if (fCashValue.isNegative()) {
    return netAvailable
  }

  if (cashBalance.gte(0)) {
    return netAvailable.sub(fCashValue)
  }

  const netBalanceWithfCashValue = cashBalance.add(fCashValue)
  if (netBalanceWithfCashValue.gt(0)) {
    return netAvailable.sub(netBalanceWithfCashValue)
  }
  return netAvailable
}

export function adjustNetAvailable(
  symbol: string,
  collateralFactors: Factors,
  account: Account,
) {
  const { netAvailable, cashClaim } = collateralFactors
  const adjustedNetAvailable = adjustfCashValue(
    netAvailable,
      account.balances.get(symbol)!.cashBalance,
      cashClaim,
  )

  const totalCollateralHaircutCashClaim = totalHaircutCashClaim(symbol, account.portfolio)
  // Tests if there is actually collateral to liquidate after adjustments for fCash and tokens
  return adjustedNetAvailable.add(totalCollateralHaircutCashClaim)
}

export function calculateCollateralPurchase(
  localCurrency: Currency,
  collateralCurrency: Currency,
  collateralFactors: Factors,
  account: Account,
  localRequired: BigNumber,
  discountFactor: BigNumber,
) {
  const adjustedNetAvailable = adjustNetAvailable(
    collateralCurrency.symbol,
    collateralFactors,
    account,
  )

  if (adjustedNetAvailable.lt(0)) {
    return {
      collateralPurchased: BigNumber.from(0),
      localPurchased: BigNumber.from(0),
    }
  }

  const exchangeRate = localCurrency
    .currentETHExchangeRate
    .mul(collateralCurrency.rateDecimals)
    .div(collateralCurrency.currentETHExchangeRate)

  // Replicating order of operations in Liquidation.sol
  const collateralToSell = exchangeRate
    .mul(localRequired)
    .mul(discountFactor)
    .div(localCurrency.rateDecimals)
    .div(localCurrency.decimals)
    .mul(collateralCurrency.decimals)
    .div(ethers.constants.WeiPerEther)

  if (adjustedNetAvailable.gte(collateralToSell)) {
    return {
      collateralPurchased: collateralToSell,
      localPurchased: localRequired,
    }
  }
  const newLocalPurchased = adjustedNetAvailable
    .mul(localCurrency.rateDecimals)
    .mul(ethers.constants.WeiPerEther)
    .mul(localCurrency.decimals)
    .div(exchangeRate)
    .div(discountFactor)
    .div(collateralCurrency.decimals)

  return {
    collateralPurchased: adjustedNetAvailable,
    localPurchased: newLocalPurchased,
  }
}
