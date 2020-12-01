import { AssetType } from 'core/model/GraphTypes'
import { Asset } from 'core/model/Schema'
import GraphClient from 'core/services/GraphClient'
import { BigNumber, ethers } from 'ethers'
import { getNowSeconds, SECONDS_IN_YEAR } from './Utils'

export function getHaircutCashReceiverValue(
  notional: BigNumber,
  maturity: number,
  blockTime: number,
) {
  if (maturity <= blockTime) {
    return notional
  }

  const systemConfiguration = GraphClient.getClient().getSystemConfiguration()

  const postHaircutValue = notional.sub(
    notional
      .mul(systemConfiguration.fCashHaircut)
      .mul(maturity - blockTime)
      .div(SECONDS_IN_YEAR)
      .div(ethers.constants.WeiPerEther),
  )

  const maxPostHaircutValue = notional
    .mul(systemConfiguration.fCashMaxHaircut)
    .div(ethers.constants.WeiPerEther)

  if (postHaircutValue.lt(maxPostHaircutValue)) {
    return postHaircutValue
  }
  return maxPostHaircutValue
}

function getLiquidityTokenClaims(asset: Asset, hasMatured: boolean, shouldHaircut = true) {
  if (!asset.cashMarket) {
    throw new Error('Cannot calculate liquidity token claims without cashMarket data')
  }

  if (asset.cashMarket.totalLiquidity.isZero()) {
    throw new Error('No liquidity in market, cannot calculate token claims')
  }
  const systemConfiguration = GraphClient.getClient().getSystemConfiguration()

  const cash = asset.cashMarket.totalCurrentCash
    .mul(asset.notional)
    .div(asset.cashMarket.totalLiquidity)

  const fCash = asset.cashMarket.totalfCash
    .mul(asset.notional)
    .div(asset.cashMarket.totalLiquidity)

  if (hasMatured) {
    return {
      cash: cash.add(fCash),
      fCash: BigNumber.from(0),
    }
  } if (!shouldHaircut) {
    return { cash, fCash }
  }
  return {
    cash: cash
      .mul(systemConfiguration.liquidityHaircut)
      .div(ethers.constants.WeiPerEther),
    fCash: fCash
      .mul(systemConfiguration.liquidityHaircut)
      .div(ethers.constants.WeiPerEther),
  }
}

export function getAssetValue(
  asset: Asset,
  haircut: boolean,
  blockTime: number = getNowSeconds(),
) {
  const hasMatured = asset.maturity <= blockTime

  if (asset.assetType === AssetType.CashPayer) {
    const value = asset.notional.mul(-1)

    return {
      fCash: hasMatured ? BigNumber.from(0) : value,
      cash: hasMatured ? value : BigNumber.from(0),
      tokens: BigNumber.from(0),
    }
  } if (asset.assetType === AssetType.CashReceiver) {
    const value = haircut ? getHaircutCashReceiverValue(
      asset.notional,
      asset.maturity,
      blockTime,
    ) : asset.notional

    return {
      fCash: hasMatured ? BigNumber.from(0) : value,
      cash: hasMatured ? value : BigNumber.from(0),
      tokens: BigNumber.from(0),
    }
  } if (asset.assetType === AssetType.LiquidityToken) {
    const value = getLiquidityTokenClaims(asset, hasMatured, haircut)

    return {
      ...value,
      tokens: asset.notional,
    }
  }

  throw new Error(`Unknown asset type ${asset.assetType}`)
}
