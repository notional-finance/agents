import { InMemoryCacheConfig } from '@apollo/client/core'

const NotionalCacheConfig = {
  typePolicies: {
    Account: {
      fields: {
        portfolio: {
          merge: false,
        },
        balances: {
          merge: false,
        },
      },
    },
  },
} as InMemoryCacheConfig

export default NotionalCacheConfig
