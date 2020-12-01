import { AllAccountsQuery } from './queries/AccountQuery'
import CurrenciesArrayQuery from './queries/CurrenciesQuery'

export type ArrayResult<T> = { results: T[] }

const Queries = {
  CurrenciesArrayQuery,
  AllAccountsQuery: AllAccountsQuery(),
}

export default Queries
