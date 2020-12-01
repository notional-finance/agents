import { gql } from '@apollo/client/core'
import { getNowSeconds } from 'core/lib/Utils'
import { CashMarket } from '../GraphTypes'

export type CashMarketQueryResult = CashMarket

const CashMarketsArrayQuery = (blockTime?: number) => {
  const maturity = blockTime || getNowSeconds()

  return gql(`{
    results: cashMarkets(where: { maturity_gt: ${maturity}}) {
      id
      lastUpdateTimestamp
      lastUpdateBlockNumber

      address
      maturity
      totalfCash
      totalCurrentCash
      totalLiquidity
      rateAnchor
      rateScalar
      lastImpliedRate

      cashGroup {
        id
        numMaturities
        maturityLength
        ratePrecision

        currency {
          id
          name
          symbol
        }
      }
    }
  }`)
}

export default CashMarketsArrayQuery
