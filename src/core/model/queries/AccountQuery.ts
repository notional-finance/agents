import { gql } from '@apollo/client/core'
import { Account, Asset, CurrencyBalance } from '../GraphTypes'

export type AccountQueryResult =
  Account & {
    balances: CurrencyBalance[]
    portfolio: Asset[]
  }

const AccountQueryBody = `{
  id
  lastUpdateTimestamp
  lastUpdateBlockNumber

  balances {
    id
    lastUpdateTimestamp
    lastUpdateBlockNumber

    cashBalance
    currency {
      id
      name
      symbol
    }
  }

  portfolio {
    id
    lastUpdateTimestamp
    lastUpdateBlockNumber

    assetId
    assetType
    notional
    maturity

    cashGroup {
      id
      currency {
        id
        name
        symbol
      }
    }

    cashMarket {
      lastUpdateTimestamp
      lastUpdateBlockNumber
      
      totalfCash
      totalLiquidity
      totalCurrentCash
    }
  }
}
`

export const AccountQuery = (id: string) => gql(`{
    account(id: "${id}") ${AccountQueryBody}
  }`)

export const AllAccountsQuery = () => gql(`{
    results: accounts ${AccountQueryBody}
  }`)

export default AccountQuery
