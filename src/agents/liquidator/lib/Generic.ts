import { Factors, FreeCollateralFactors } from 'core/lib/FreeCollateral'
import { AssetType } from 'core/model/GraphTypes'
import { Account, Asset, Currency } from 'core/model/Schema'
import { BigNumber, ethers } from 'ethers'
import { FCashPurchase } from '../Schema'

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

function calculateCollateralToSell(
  discountFactor: BigNumber,
  localRequired: BigNumber,
  localCurrency: Currency,
  collateralCurrency: Currency,
) {
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

  return { exchangeRate, collateralToSell }
}

function calculateLocalPurchased(
  discountFactor: BigNumber,
  collateralPurchased: BigNumber,
  exchangeRate: BigNumber,
  localCurrency: Currency,
  collateralCurrency: Currency,
) {
  return collateralPurchased
    .mul(localCurrency.rateDecimals)
    .mul(ethers.constants.WeiPerEther)
    .mul(localCurrency.decimals)
    .div(exchangeRate)
    .div(discountFactor)
    .div(collateralCurrency.decimals)
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

  const { exchangeRate, collateralToSell } = calculateCollateralToSell(
    discountFactor,
    localRequired,
    localCurrency,
    collateralCurrency,
  )

  if (adjustedNetAvailable.gte(collateralToSell)) {
    return {
      collateralPurchased: collateralToSell,
      localPurchased: localRequired,
    }
  }

  const newLocalPurchased = calculateLocalPurchased(
    discountFactor,
    adjustedNetAvailable,
    exchangeRate,
    localCurrency,
    collateralCurrency,
  )

  return {
    collateralPurchased: adjustedNetAvailable,
    localPurchased: newLocalPurchased,
  }
}

export function isfCashEligible(account: Account, factors: FreeCollateralFactors, collateralCurrency: Currency) {
  const positiveCash = Array.from(account.balances.entries()).filter(([, b]) => b.cashBalance.gt(0))
  if (positiveCash.length > 0) {
    return false
  }
  const fCashAssets = account.portfolio.filter((a) => a.assetType === AssetType.CashReceiver)
  if (fCashAssets.length !== account.portfolio.length) {
    return false
  }

  if (!factors.has(collateralCurrency.symbol)) {
    return false
  }

  const { netAvailable } = factors.get(collateralCurrency.symbol)!
  if (netAvailable.lte(0)) {
    return false
  }

  return true
}

function fCashNotionalToTransfer(asset: Asset, amountRemaining: BigNumber) {
  if (asset.assetType !== AssetType.CashReceiver) {
    throw new Error('Incorrect asset type')
  }

  const assetValue = asset.assetValue.haircutfCash
  if (assetValue.gte(amountRemaining)) {
    const notional = asset.notional.mul(amountRemaining).div(assetValue)
    const discountedValue = notional.mul(assetValue).div(asset.notional)
    return {
      payment: amountRemaining,
      fCashPurchase: new FCashPurchase(
        asset.maturity,
        asset.marketKey,
        notional,
        discountedValue,
      ),
    }
  }

  return {
    payment: assetValue,
    fCashPurchase: new FCashPurchase(
      asset.maturity,
      asset.marketKey,
      asset.notional,
      assetValue,
    ),
  }
}

/** This is a reimplementation of Liquidation._tradefCash */
export function getfCashPair(
  account: Account,
  localRequired: BigNumber,
  localCurrency: Currency,
  collateralCurrency: Currency,
  factors: FreeCollateralFactors,
  discountFactor: BigNumber,
) {
  let localPurchased: BigNumber
  let collateralPurchased: BigNumber
  let exchangeRate: BigNumber
  if (localCurrency.id === collateralCurrency.id) {
    // Here we do not have to handle exchange rates because the settlement is in local currency
    // form only
    localPurchased = localRequired
    collateralPurchased = localRequired
    exchangeRate = localCurrency.decimals
  } else {
    let collateralToSell
    ({ exchangeRate, collateralToSell } = calculateCollateralToSell(
      discountFactor,
      localRequired,
      localCurrency,
      collateralCurrency,
    ))
    const { netAvailable: collateralNetAvailable } = factors.get(collateralCurrency.symbol)!

    if (collateralToSell.gt(collateralNetAvailable)) {
      localPurchased = calculateLocalPurchased(
        discountFactor,
        collateralNetAvailable,
        exchangeRate,
        localCurrency,
        collateralCurrency,
      )
      collateralPurchased = collateralNetAvailable
    } else {
      localPurchased = localRequired
      collateralPurchased = collateralToSell
    }
  }

  // Calculates how much fCash in the collateral currency we will purchase.
  // NOTE: is this portfolio the same order as on chain?
  const fCashPurchased: FCashPurchase[] = []
  let amountRemaining = collateralPurchased

  account.portfolio
    .filter((a) => a.assetType === AssetType.CashReceiver && a.currencyId === collateralCurrency.id)
    .forEach((a) => {
      if (amountRemaining.lte(0)) return

      const { payment, fCashPurchase } = fCashNotionalToTransfer(a, amountRemaining)
      fCashPurchased.push(fCashPurchase)

      amountRemaining = amountRemaining.sub(payment)
    })

  let finalLocalPurchased = localPurchased
  if (amountRemaining.gt(0)) {
    const localShortfall = calculateLocalPurchased(
      discountFactor,
      amountRemaining,
      exchangeRate,
      localCurrency,
      collateralCurrency,
    )

    finalLocalPurchased = localPurchased.sub(localShortfall)
  }

  return {
    fCashPurchased,
    localPurchased: finalLocalPurchased,
  }
}
