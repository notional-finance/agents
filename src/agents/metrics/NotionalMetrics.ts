import client from 'prom-client'

export const NotionalMetricsRegistry = new client.Registry()

const NotionalMetrics = {
  ACCOUNTS: {
    TOTAL: new client.Gauge({
      name: 'notional_accounts_total',
      help: 'total accounts in the notional system',
      registers: [NotionalMetricsRegistry],
    }),
    INSOLVENT: new client.Gauge({
      name: 'notional_accounts_insolvent_current',
      help: 'total current insolvent accounts',
      registers: [NotionalMetricsRegistry],
    }),
    SETTLEABLE: new client.Gauge({
      name: 'notional_accounts_settleable_current',
      help: 'total current settleable accounts',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    LIQUIDATABLE: new client.Gauge({
      name: 'notional_accounts_liquidatable_current',
      help: 'total current liquidatable accounts',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    SETTLE_FCASH: new client.Gauge({
      name: 'notional_accounts_settle_fcash_current',
      help: 'total current accounts that must be settled via fCash',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    LIQUIDATE_FCASH: new client.Gauge({
      name: 'notional_accounts_liquidate_fcash_current',
      help: 'total current accounts that must be liquidated via fcash accounts',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    SETTLEMENT_COUNT: new client.Counter({
      name: 'notional_accounts_settlement_count',
      help: 'total settlement events count',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    LIQUIDATION_COUNT: new client.Counter({
      name: 'notional_accounts_liquidation_count',
      help: 'total liquidation events count',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    SETTLE_FCASH_COUNT: new client.Counter({
      name: 'notional_accounts_settle_fcash_count',
      help: 'total settle fcash events count',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
    LIQUIDATE_FCASH_COUNT: new client.Counter({
      name: 'notional_accounts_liquidate_fcash_count',
      help: 'total liquidate fcash events count',
      labelNames: ['currencyPair'],
      registers: [NotionalMetricsRegistry],
    }),
  },
  BALANCES: {
    EXCHANGE_RATE_ETH: new client.Gauge({
      name: 'notional_balances_exchange_rate',
      help: 'current exchange rate of currency to ETH',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_CURRENCY_BALANCE: new client.Gauge({
      name: 'notional_balances_escrow_total',
      help: 'total currency balance held in the escrow account',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    NET_CASH_BALANCE: new client.Gauge({
      name: 'notional_balances_net_cash',
      help: 'total systemwide net cash balance for a currency (should be zero)',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    NET_FCASH_BALANCE: new client.Gauge({
      name: 'notional_balances_net_fcash',
      help: 'total systemwide net fcash balance for a market (should be zero)',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    POSITIVE_CASH_BALANCE: new client.Gauge({
      name: 'notional_balances_positive_cash',
      help: 'total systemwide positive cash balance',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    POSITIVE_FCASH_BALANCE: new client.Gauge({
      name: 'notional_balances_positive_fcash',
      help: 'total systemwide positive fcash balance for a market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    NEGATIVE_CASH_BALANCE: new client.Gauge({
      name: 'notional_balances_negative_cash',
      help: 'total systemwide negative cash balance',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    NEGATIVE_FCASH_BALANCE: new client.Gauge({
      name: 'notional_balances_negative_fcash',
      help: 'total systemwide negative fcash balance for a market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_VALUE_LOCKED: new client.Gauge({
      name: 'notional_total_value_locked_eth',
      help: 'total system wide value locked (aggregate currency balance) denominated in ETH',
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_DEPOSITS: new client.Counter({
      name: 'notional_deposits_total_value',
      help: 'total deposit value for a currency',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_WITHDRAWS: new client.Counter({
      name: 'notional_withdraws_total_value',
      help: 'total withdraw value for a currency',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    COUNT_DEPOSITS: new client.Counter({
      name: 'notional_deposits_count',
      help: 'count of deposit transactions for a currency',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
    COUNT_WITHDRAWS: new client.Counter({
      name: 'notional_withdraws_count',
      help: 'count of withdraw transactions for a currency',
      labelNames: ['currency'],
      registers: [NotionalMetricsRegistry],
    }),
  },
  MARKETS: {
    TOTAL_LIQUIDITY: new client.Gauge({
      name: 'notional_market_total_liquidity',
      help: 'total liquidity in the specified market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_CURRENT_CASH: new client.Gauge({
      name: 'notional_market_total_current_cash',
      help: 'total current cash in the specific market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    TOTAL_FCASH: new client.Gauge({
      name: 'notional_market_total_fcash',
      help: 'total fcash in the specified market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    LAST_IMPLIED_RATE: new client.Gauge({
      name: 'notional_market_last_implied_rate',
      help: 'current last impleid rate value in the market',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    RATE_ANCHOR: new client.Gauge({
      name: 'notional_market_rate_anchor',
      help: 'current value of the notional market rate anchor',
      labelNames: ['currency', 'marketKey'],
      registers: [NotionalMetricsRegistry],
    }),
    ACTIVITY: {
      TOTAL_CASH_BORROW: new client.Counter({
        name: 'notional_market_borrow_cash_value',
        help: 'total value of take current cash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_CASH_LEND: new client.Counter({
        name: 'notional_market_lend_cash_value',
        help: 'total value of take fcash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_FCASH_BORROW: new client.Counter({
        name: 'notional_market_borrow_fcash_value',
        help: 'total value of take current cash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_FCASH_LEND: new client.Counter({
        name: 'notional_market_lend_fcash_value',
        help: 'total value of take fcash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_ADD_LIQUIDITY_TOKEN: new client.Counter({
        name: 'notional_market_add_liquidity_token_value',
        help: 'total value of add liquidity transactions in token terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_REMOVE_LIQUIDITY_TOKEN: new client.Counter({
        name: 'notional_market_remove_liquidity_token_value',
        help: 'total value of remove liquidity transactions in token terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_ADD_LIQUIDITY_CASH: new client.Counter({
        name: 'notional_market_add_liquidity_cash_value',
        help: 'total value of add liquidity transactions in cash terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_REMOVE_LIQUIDITY_CASH: new client.Counter({
        name: 'notional_market_remove_liquidity_cash_value',
        help: 'total value of remove liquidity transactions in cash terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_ADD_LIQUIDITY_FCASH: new client.Counter({
        name: 'notional_market_add_liquidity_fcash_value',
        help: 'total value of add liquidity transactions in fcash terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      TOTAL_REMOVE_LIQUIDITY_FCASH: new client.Counter({
        name: 'notional_market_remove_liquidity_fcash_value',
        help: 'total value of remove liquidity transactions in fcash terms',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      COUNT_TAKE_CURRENT_CASH: new client.Counter({
        name: 'notional_market_take_current_cash_count',
        help: 'count of take current cash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      COUNT_TAKE_FCASH: new client.Counter({
        name: 'notional_market_take_fcash_count',
        help: 'count of take fcash transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      COUNT_ADD_LIQUIDITY: new client.Counter({
        name: 'notional_market_add_liquidity_count',
        help: 'count of add liquidity transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
      COUNT_REMOVE_LIQUIDITY: new client.Counter({
        name: 'notional_market_remove_liquidity_count',
        help: 'count of remove liquidity transactions',
        labelNames: ['currency', 'marketKey'],
        registers: [NotionalMetricsRegistry],
      }),
    },
  },
}

export default NotionalMetrics
