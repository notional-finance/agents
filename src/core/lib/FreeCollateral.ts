import { AssetType } from 'core/model/GraphTypes'
import { Asset, Balance, Balances } from 'core/model/Schema'
import GraphClient from 'core/services/GraphClient'
import { BigNumber } from 'ethers'
import { getHaircutCashReceiverValue } from './AssetValue'
import { convertToETH } from './ExchangeRate'
import { getNowSeconds } from './Utils'

export interface Factors {
  netAvailable: BigNumber,
  cashClaim: BigNumber,
  netfCash: BigNumber
}
export type FreeCollateralFactors = Map<string, Factors>

export function netCurrencyAvailable(
  balance: Balance,
  portfolio: Asset[],
  blockTime = getNowSeconds(),
) {
  const filteredAssets = portfolio
    .filter((a) => !a.assetValue.hasMatured)
    .filter((a) => a.currencyId === balance.currencyId
        // Test for equivalence of ETH to WETH
        || (balance.currencyId === -1 && a.currencyId === 0))

  /* eslint-disable no-param-reassign */
  const cashLadder = filteredAssets.reduce(
    (ladder, asset) => {
      // 0 will represent current cash
      ladder[0] = (ladder[0] || BigNumber.from(0))
      ladder[0] = ladder[0].add(asset.assetValue.haircutCash)

      // If assets have matured they will also have a key of zero
      const maturity = asset.assetValue.hasMatured ? 0 : asset.maturity
      ladder[maturity] = (ladder[maturity] || BigNumber.from(0))

      if (asset.assetType === AssetType.LiquidityToken) {
        ladder[maturity] = ladder[maturity].add(asset.assetValue.haircutfCash)
      } else {
        ladder[maturity] = ladder[maturity].add(asset.assetValue.fCash)
      }

      return ladder
    },
    {} as {
      [key: number]: BigNumber;
    },
  )
  /* eslint-enable no-param-reassign */

  const netfCash = Object.keys(cashLadder).reduce((netAvailable, maturity) => {
    // If maturity is zero then we ignore it
    if (Number(maturity) === 0) return netAvailable

    let value = cashLadder[Number(maturity)]
    if (value.gt(0)) {
      value = getHaircutCashReceiverValue(value, Number(maturity), blockTime)
    }

    return netAvailable.add(value)
  }, BigNumber.from(0))

  const cashClaim = cashLadder[0] || BigNumber.from(0)
  const netAvailable = balance.cashBalance.add(cashClaim).add(netfCash)

  return {
    netAvailable, cashClaim, netfCash, cashLadder, filteredAssets,
  }
}

export function calculateFreeCollateral(
  portfolio: Asset[],
  balances: Balances,
  blockTime = getNowSeconds(),
) {
  const currencies = GraphClient.getClient().getCurrencies()
  let netETHCollateral = BigNumber.from(0)
  let netETHDebt = BigNumber.from(0)
  let netETHDebtWithBuffer = BigNumber.from(0)

  const factors: FreeCollateralFactors = new Map<
    string,
    {
      netAvailable: BigNumber;
      cashClaim: BigNumber;
      netfCash: BigNumber;
    }
  >()

  currencies.forEach((currency) => {
    const { netAvailable, cashClaim, netfCash } = netCurrencyAvailable(
      balances.get(currency.symbol),
      portfolio,
      blockTime,
    )
    factors.set(currency.symbol, { netAvailable, cashClaim, netfCash })

    if (netAvailable.lt(0)) {
      // Calculate with and without buffers so we can get two versions of collateral ratio
      netETHDebt = netETHDebt.add(
        convertToETH(netAvailable.abs(), currency, false),
      )
      netETHDebtWithBuffer = netETHDebtWithBuffer.add(
        convertToETH(netAvailable.abs(), currency, true),
      )
    } else {
      netETHCollateral = netETHCollateral.add(
        convertToETH(netAvailable, currency, false),
      )
    }
  })

  return {
    netETHCollateral,
    netETHDebt,
    netETHDebtWithBuffer,
    factors,
  }
}
