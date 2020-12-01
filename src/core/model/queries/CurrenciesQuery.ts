import { gql } from '@apollo/client/core'
import { Currency, ExchangeRate } from '../GraphTypes'

export type CurrencyQueryResult = Currency & {
  ethExchangeRate: ExchangeRate[]
}

const CurrenciesArrayQuery = () => gql`{
    results: currencies {
      id
      name
      tokenAddress
      symbol
      decimals
      isERC777
      ethExchangeRate:
        baseExchangeRates(where: { quoteCurrency: "0"}) {
          rateOracle
          buffer
          rateDecimals
          mustInvert
        
          latestRate {
            lastUpdateTimestamp
            rate
          }
        }
    }
  }`

export default CurrenciesArrayQuery
