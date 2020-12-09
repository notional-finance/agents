import { convertETHTo } from 'core/lib/ExchangeRate'
import { FreeCollateralFactors } from 'core/lib/FreeCollateral'
import { Account, Currency } from 'core/model/Schema'
import GraphClient from 'core/services/GraphClient'
import { BigNumber, ethers } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { LiquidatePair } from '../Schema'
import {
  totalCashClaim, calculateCollateralPurchase, effectiveExchangeRate, isfCashEligible, getfCashPair,
} from './Generic'

const LIQUIDATION_BUFFER = parseEther('1.01')

export function calculateTokenLiquidation(
  localRequired: BigNumber,
  totalLocalCashClaim: BigNumber,
  localNetAvailable: BigNumber,
) {
  const {
    liquidityRepoIncentive,
    liquidityHaircut,
  } = GraphClient.getClient().getSystemConfiguration()

  const localClaimToTrade = localRequired
    .mul(liquidityRepoIncentive)
    .div(ethers.constants.WeiPerEther.sub(liquidityHaircut))

  let localCurrencyRaised: BigNumber
  let cashClaimWithdrawn: BigNumber
  if (localClaimToTrade.lt(totalLocalCashClaim)) {
    cashClaimWithdrawn = localClaimToTrade
    localCurrencyRaised = localRequired
  } else {
    cashClaimWithdrawn = totalLocalCashClaim
    localCurrencyRaised = totalLocalCashClaim
      .mul(ethers.constants.WeiPerEther.sub(liquidityHaircut))
      .div(liquidityRepoIncentive)
  }

  const haircutClaimAmount = cashClaimWithdrawn
    .mul(ethers.constants.WeiPerEther.sub(liquidityHaircut))
    .div(ethers.constants.WeiPerEther)
  const tokenLiquidateFee = haircutClaimAmount.sub(localCurrencyRaised)
  const newLocalNetAvailable = localNetAvailable.add(haircutClaimAmount).sub(tokenLiquidateFee)

  return {
    cashClaimWithdrawn,
    tokenLiquidateFee,
    localNetAvailable: newLocalNetAvailable,
    localRequired: localRequired.add(tokenLiquidateFee).sub(haircutClaimAmount),
  }
}

function calculateLocalCurrencyToTrade(
  localRequired: BigNumber,
  liquidationDiscount: BigNumber,
  buffer: BigNumber,
  maxLocalCurrencyDebt: BigNumber,
) {
  const localToTrade = localRequired
    .mul(ethers.constants.WeiPerEther)
    .div(buffer.sub(liquidationDiscount))

  return maxLocalCurrencyDebt.lt(localToTrade)
    ? maxLocalCurrencyDebt
    : localToTrade
}

function fcAggregateToLocal(ethShortfall: BigNumber, localCurrency: Currency) {
  return convertETHTo(ethShortfall, localCurrency, false)
    .mul(LIQUIDATION_BUFFER)
    .div(ethers.constants.WeiPerEther)
}

export function getLiquidatePair(
  localCurrency: Currency,
  collateralCurrency: Currency | undefined,
  factors: FreeCollateralFactors,
  account: Account,
  ethShortfall: BigNumber,
) {
  const localRequired = fcAggregateToLocal(ethShortfall, localCurrency)
  const { liquidationDiscount } = GraphClient.getClient().getSystemConfiguration()
  const {
    netAvailable: localNetAvailable,
  } = factors.get(localCurrency.symbol)!

  if (collateralCurrency && isfCashEligible(account, factors, collateralCurrency)) {
    // If the account is eligible for fCash liquidation then we short circuit and return here
    const { localPurchased, fCashPurchased } = getfCashPair(
      account,
      localRequired,
      localCurrency,
      collateralCurrency,
      factors,
      liquidationDiscount,
    )

    // This is the discounted value that the fCash was purchased at
    const fCashValue = fCashPurchased.reduce((b, a) => b.add(a.discountValue), BigNumber.from(0))
    const ethShortfallRecovered = localPurchased.eq(localRequired)
      ? ethShortfall
      : localPurchased.mul(ethShortfall).div(localRequired)

    return new LiquidatePair(
      localCurrency,
      collateralCurrency,
      localPurchased,
      BigNumber.from(0),
      BigNumber.from(0),
      BigNumber.from(0),
      ethShortfallRecovered,
      effectiveExchangeRate(localPurchased, fCashValue, collateralCurrency),
      fCashPurchased,
    )
  }

  const totalLocalCashClaim = totalCashClaim(localCurrency.symbol, account.portfolio)

  let cashClaimWithdrawn: BigNumber
  let tokenLiquidateFee: BigNumber
  let newNetAvailable: BigNumber
  // localPurchased is what we would require in the next step after tokens are withdrawn
  let localPurchased: BigNumber
  if (totalLocalCashClaim.gt(0)) {
    ({
      tokenLiquidateFee,
      cashClaimWithdrawn,
      // These are updated to account for the cash taken from the tokens
      localNetAvailable: newNetAvailable,
      localRequired: localPurchased,
    } = calculateTokenLiquidation(
      localRequired,
      totalLocalCashClaim,
      localNetAvailable,
    ))
  } else {
    cashClaimWithdrawn = BigNumber.from(0)
    tokenLiquidateFee = BigNumber.from(0)
    newNetAvailable = localNetAvailable
    localPurchased = localRequired
  }

  let collateralPurchased: BigNumber
  if (collateralCurrency && newNetAvailable.lt(0) && factors.has(collateralCurrency.symbol)) {
    const localToTrade = calculateLocalCurrencyToTrade(
      localPurchased,
      liquidationDiscount,
      localCurrency.buffer,
      newNetAvailable.mul(-1),
    );

    ({
      collateralPurchased,
      localPurchased,
    } = calculateCollateralPurchase(
      localCurrency,
      collateralCurrency,
      factors.get(collateralCurrency.symbol)!,
      account,
      localToTrade,
      liquidationDiscount,
    ))
  } else {
    collateralPurchased = BigNumber.from(0)
    localPurchased = BigNumber.from(0)
  }

  const tokenOffset = newNetAvailable.sub(localNetAvailable)
  const ethShortfallRecovered = localPurchased.add(tokenOffset).eq(localRequired)
    ? ethShortfall
    : localPurchased.add(tokenOffset).mul(ethShortfall).div(localRequired)

  return new LiquidatePair(
    localCurrency,
    collateralCurrency,
    localPurchased,
    collateralPurchased,
    cashClaimWithdrawn,
    tokenLiquidateFee,
    ethShortfallRecovered,
    effectiveExchangeRate(localPurchased, collateralPurchased, collateralCurrency),
  )
}
