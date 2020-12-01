import log4js from 'log4js'
import { DEFAULT_SUBGRAPH } from 'config/config'
import ETHNodeClient from 'core/services/ETHNodeClient'
import GraphClient from 'core/services/GraphClient'
import LiquidationController from 'agents/liquidator/Controller'
import client from 'prom-client'
import { Currency } from 'core/model/Schema'
import { BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { convertToETH } from 'core/lib/ExchangeRate'
import { AssetType } from 'core/model/GraphTypes'
import NotionalMetrics, { NotionalMetricsRegistry } from './NotionalMetrics'

const appLogger = log4js.getLogger('app')
appLogger.addContext('controller', 'metrics')

class MetricsCollector {
  private static controller: MetricsCollector

  private constructor() {
    // Register event listeners
    const { provider } = ETHNodeClient.getClient()
    const { escrow } = ETHNodeClient.getClient().contracts
    const filter = { address: escrow.address }
    appLogger.info('Metrics Colletector initializing')
    provider.on(filter, (log) => {
      const parsed = escrow.interface.parseLog(log)
      appLogger.debug('Escrow event filter triggered, ', parsed)
      switch (parsed.name) {
        case 'Deposit': {
          const { currency, value } = parsed.args
          const { symbol, decimalPlaces } = GraphClient.getClient().getCurrencyById(currency)
          const units = parseFloat(formatUnits(value, decimalPlaces))
          NotionalMetrics.BALANCES.TOTAL_DEPOSITS.inc({ currency: symbol }, units)
          NotionalMetrics.BALANCES.COUNT_DEPOSITS.inc({ currency: symbol }, 1)
          break
        }

        case 'Withdraw': {
          const { currency, value } = parsed.args
          const { symbol, decimalPlaces } = GraphClient.getClient().getCurrencyById(currency)
          const units = parseFloat(formatUnits(value, decimalPlaces))
          NotionalMetrics.BALANCES.TOTAL_WITHDRAWS.inc({ currency: symbol }, units)
          NotionalMetrics.BALANCES.COUNT_WITHDRAWS.inc({ currency: symbol }, 1)
          break
        }

        case 'Liquidate': {
          const { localCurrency, collateralCurrency } = parsed.args
          const { symbol: localSymbol } = GraphClient.getClient().getCurrencyById(localCurrency)
          const { symbol: collateralSymbol } = GraphClient.getClient().getCurrencyById(collateralCurrency)
          NotionalMetrics.ACCOUNTS.LIQUIDATION_COUNT.inc(
            { currencyPair: `${localSymbol}-${collateralSymbol}` },
          )
          break
        }
        case 'LiquidateBatch': {
          const { localCurrency, collateralCurrency, accounts } = parsed.args
          const { symbol: localSymbol } = GraphClient.getClient().getCurrencyById(localCurrency)
          const { symbol: collateralSymbol } = GraphClient.getClient().getCurrencyById(collateralCurrency)
          NotionalMetrics.ACCOUNTS.LIQUIDATION_COUNT.inc(
            { currencyPair: `${localSymbol}-${collateralSymbol}` },
            accounts.length,
          )
          break
        }

        case 'SettleCash': {
          const { localCurrency, collateralCurrency } = parsed.args
          const { symbol: localSymbol } = GraphClient.getClient().getCurrencyById(localCurrency)
          const { symbol: collateralSymbol } = GraphClient.getClient().getCurrencyById(collateralCurrency)
          NotionalMetrics.ACCOUNTS.SETTLEMENT_COUNT.inc(
            { currencyPair: `${localSymbol}-${collateralSymbol}` },
          )
          break
        }

        case 'SettleCashBatch': {
          const { localCurrency, collateralCurrency, payers } = parsed.args
          const { symbol: localSymbol } = GraphClient.getClient().getCurrencyById(localCurrency)
          const { symbol: collateralSymbol } = GraphClient.getClient().getCurrencyById(collateralCurrency)
          NotionalMetrics.ACCOUNTS.SETTLEMENT_COUNT.inc(
            { currencyPair: `${localSymbol}-${collateralSymbol}` },
            payers.length,
          )
          break
        }

        default:
          break
      }
    })

    const allMarkets = GraphClient.getClient().getCashMarkets()
    allMarkets.forEach((m) => {
      const marketEventFilter = { address: m.contract.address }
      provider.on(marketEventFilter, (log) => {
        const labels = { currency: m.currencySymbol, marketKey: m.marketKey }
        const { decimalPlaces } = GraphClient.getClient().getCurrencyBySymbol(m.currencySymbol)
        const parsed = m.contract.interface.parseLog(log)

        switch (parsed.name) {
          case 'AddLiquidity': {
            const { tokens, cash, fCash } = parsed.args
            NotionalMetrics.MARKETS.ACTIVITY.COUNT_ADD_LIQUIDITY.inc(labels)
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_ADD_LIQUIDITY_CASH.inc(
              labels, parseFloat(formatUnits(cash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_ADD_LIQUIDITY_FCASH.inc(
              labels, parseFloat(formatUnits(fCash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_ADD_LIQUIDITY_TOKEN.inc(
              labels, parseFloat(formatUnits(tokens, decimalPlaces)),
            )
            break
          }

          case 'RemoveLiquidity': {
            const { tokens, cash, fCash } = parsed.args
            NotionalMetrics.MARKETS.ACTIVITY.COUNT_REMOVE_LIQUIDITY.inc(labels)
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_REMOVE_LIQUIDITY_CASH.inc(
              labels, parseFloat(formatUnits(cash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_REMOVE_LIQUIDITY_FCASH.inc(
              labels, parseFloat(formatUnits(fCash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_REMOVE_LIQUIDITY_TOKEN.inc(
              labels, parseFloat(formatUnits(tokens, decimalPlaces)),
            )
            break
          }

          case 'TakeCurrentCash': {
            const { cash, fCash } = parsed.args
            NotionalMetrics.MARKETS.ACTIVITY.COUNT_TAKE_CURRENT_CASH.inc(labels)
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_CASH_BORROW.inc(
              labels, parseFloat(formatUnits(cash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_FCASH_BORROW.inc(
              labels, parseFloat(formatUnits(fCash, decimalPlaces)),
            )
            break
          }

          case 'TakefCash': {
            const { cash, fCash } = parsed.args
            NotionalMetrics.MARKETS.ACTIVITY.COUNT_TAKE_FCASH.inc(labels)
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_CASH_LEND.inc(
              labels, parseFloat(formatUnits(cash, decimalPlaces)),
            )
            NotionalMetrics.MARKETS.ACTIVITY.TOTAL_FCASH_LEND.inc(
              labels, parseFloat(formatUnits(fCash, decimalPlaces)),
            )
            break
          }

          default:
            break
        }
      })
    })

    appLogger.info('Metrics Collector initialized')
  }

  public static async getController() {
    if (!MetricsCollector.controller) {
      // Awaits until the graph client has initialized
      await new Promise((resolve) => {
        GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
          resolve()
        })
      })

      MetricsCollector.controller = new MetricsCollector()
    }

    return MetricsCollector.controller
  }

  private static async initCounters() {
    const { provider } = ETHNodeClient.getClient()
    const initBlock = await provider.getBlock('latest')
    const i = 0
    while (i < 30) {
      const status = await GraphClient.indexer.getSubgraphStatus(DEFAULT_SUBGRAPH.name)
      if (status.indexingStatusForCurrentVersion.chains[0].latestBlock.number < initBlock.number) {
        // Wait one second between polling
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    // Initialize counters at the specified block, then we will attach listeners from there
    // NotionalMetrics.ACCOUNTS.SETTLEMENT_COUNT
    // NotionalMetrics.ACCOUNTS.LIQUIDATION_COUNT
    // NotionalMetrics.ACCOUNTS.SETTLE_FCASH_COUNT
    // NotionalMetrics.ACCOUNTS.LIQUIDATE_FCASH_COUNT
    // NotionalMetrics.BALANCES.TOTAL_DEPOSITS
    // NotionalMetrics.BALANCES.TOTAL_WITHDRAWS
    // NotionalMetrics.BALANCES.COUNT_DEPOSITS
    // NotionalMetrics.BALANCES.COUNT_WITHDRAWS
    // NotionalMetrics.MARKETS.ACTIVITY.*
  }

  public static async initialize(initCounters: boolean) {
    if (MetricsCollector.controller) {
      return
    }

    if (initCounters) {
      MetricsCollector.initCounters()
    } else {
      let i = 0
      while (i < 30) {
        const status = await GraphClient.indexer.getSubgraphBlockLag(DEFAULT_SUBGRAPH.name)
        if (status > DEFAULT_SUBGRAPH.maxBlockLag) {
          // Wait one second between polling
          await new Promise((r) => setTimeout(r, 1000))
        } else {
          break
        }
        i += 1
      }
      const status = await GraphClient.indexer.getSubgraphBlockLag(DEFAULT_SUBGRAPH.name)
      if (status > DEFAULT_SUBGRAPH.maxBlockLag) {
        appLogger.fatal(`Graph client trailing block header by ${status}, cannot init metrics. Quitting`)
        process.exit(1)
      }
    }
  }

  private static countCurrencyPairs(
    pairable: {
      pairs: {
        localCurrency: Currency,
        collateralCurrency: Currency | undefined
      }[]
    }[],
    metric: client.Gauge<'currencyPair'>,
  ) {
    const result = pairable.reduce((allPairs, l) => {
      l.pairs
        .map((p) => (p.collateralCurrency
          ? `${p.localCurrency.symbol}-${p.collateralCurrency?.symbol}`
          : `${p.localCurrency.symbol}`))
        .forEach((p) => {
          // eslint-disable-next-line no-param-reassign
          allPairs[p] = allPairs[p] + 1 || 1
        })

      return allPairs
    }, {} as { [keys: string]: number })

    Object.keys(result).forEach((k) => {
      metric.set({ currencyPair: k }, result[k])
    })
  }

  private static async fetchAccountGauges() {
    const [
      allAccounts,
      liquidatable,
      settleable,
    ] = await Promise.all([
      LiquidationController.getAllAccounts(),
      LiquidationController.getLiquidatable(),
      LiquidationController.getSettleable(),
    ])

    // Reset these metrics here to clear the previous counts
    NotionalMetrics.ACCOUNTS.LIQUIDATABLE.reset()
    NotionalMetrics.ACCOUNTS.SETTLEABLE.reset()

    NotionalMetrics.ACCOUNTS.TOTAL.set(allAccounts!.length)
    NotionalMetrics.ACCOUNTS.LIQUIDATABLE.set(liquidatable!.length)
    MetricsCollector.countCurrencyPairs(liquidatable, NotionalMetrics.ACCOUNTS.LIQUIDATABLE)
    MetricsCollector.countCurrencyPairs(settleable, NotionalMetrics.ACCOUNTS.SETTLEABLE)
    // TODO: settle fcash
    // TODO: liquidate fcash
  }

  private static async fetchBalanceGauges() {
    const currencies = GraphClient.getClient().getCurrencies()
    const allAccounts = await LiquidationController.getAllAccounts()
    if (!allAccounts) {
      throw new Error('No accounts returned')
    }

    let tvl = BigNumber.from(0)
    // eslint-disable-next-line no-restricted-syntax
    for (const c of currencies) {
      const token = ETHNodeClient.getClient().getToken(c.address)
      const escrowAddress = ETHNodeClient.getClient().contracts.escrow.address
      const escrowBalance = await token.balanceOf(escrowAddress)
      const ethBalance = convertToETH(escrowBalance, c, false)
      tvl = tvl.add(ethBalance)

      NotionalMetrics.BALANCES.TOTAL_CURRENCY_BALANCE.set(
        { currency: c.symbol },
        parseFloat(formatUnits(escrowBalance, c.decimalPlaces)),
      )

      NotionalMetrics.BALANCES.EXCHANGE_RATE_ETH.set(
        { currency: c.symbol },
        parseFloat(formatUnits(c.currentETHExchangeRate, c.rateDecimalPlaces)),
      )
    }

    NotionalMetrics.BALANCES.TOTAL_VALUE_LOCKED.set(parseFloat(formatUnits(tvl, 'ether')))

    /* eslint-disable no-param-reassign */
    const factors = allAccounts.reduce((perCurrencyFactors, a) => {
      a.balances.forEach((b, k) => {
        if (!perCurrencyFactors[k]) {
          perCurrencyFactors[k] = {
            positiveCash: BigNumber.from(0),
            negativeCash: BigNumber.from(0),
            positivefCash: BigNumber.from(0),
            negativefCash: BigNumber.from(0),
          }
        }

        if (b.cashBalance.gt(0)) {
          perCurrencyFactors[k].positiveCash = perCurrencyFactors[k].positiveCash.add(b.cashBalance)
        } else if (b.cashBalance.lt(0)) {
          perCurrencyFactors[k].negativeCash = perCurrencyFactors[k].negativeCash.add(b.cashBalance.abs())
        }
      })

      a.portfolio.forEach((asset) => {
        if (asset.assetValue.hasMatured) return
        if (!perCurrencyFactors[asset.symbol]) {
          perCurrencyFactors[asset.symbol] = {
            positiveCash: BigNumber.from(0),
            negativeCash: BigNumber.from(0),
            positivefCash: BigNumber.from(0),
            negativefCash: BigNumber.from(0),
          }
        }

        if (asset.assetType === AssetType.CashPayer) {
          perCurrencyFactors[asset.symbol].negativefCash = perCurrencyFactors[asset.symbol]
            .negativefCash.add(asset.notional)
        } else if (asset.assetType === AssetType.CashReceiver) {
          perCurrencyFactors[asset.symbol].positivefCash = perCurrencyFactors[asset.symbol]
            .positivefCash.add(asset.notional)
        } else if (asset.assetType === AssetType.LiquidityToken) {
          perCurrencyFactors[asset.symbol].positivefCash = perCurrencyFactors[asset.symbol]
            .positivefCash.add(asset.assetValue.fCash)
          perCurrencyFactors[asset.symbol].positiveCash = perCurrencyFactors[asset.symbol]
            .positiveCash.add(asset.assetValue.cash)
        }
      })
      /* eslint-enable no-param-reassign */

      return perCurrencyFactors
    }, {} as {
      [key: string]: {
        positiveCash: BigNumber,
        negativeCash: BigNumber,
        positivefCash: BigNumber,
        negativefCash: BigNumber,
      }
    })

    Object.keys(factors).forEach((k) => {
      const postiveCash = factors[k].positiveCash || BigNumber.from(0)
      const negativeCash = factors[k].negativeCash || BigNumber.from(0)
      const positivefCash = factors[k].positivefCash || BigNumber.from(0)
      const negativefCash = factors[k].negativefCash || BigNumber.from(0)
      const { decimalPlaces } = GraphClient.getClient().getCurrencyBySymbol(k)

      NotionalMetrics.BALANCES.NET_CASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(postiveCash.sub(negativeCash), decimalPlaces)),
      )
      NotionalMetrics.BALANCES.POSITIVE_CASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(postiveCash, decimalPlaces)),
      )
      NotionalMetrics.BALANCES.NEGATIVE_CASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(negativeCash, decimalPlaces)),
      )

      NotionalMetrics.BALANCES.NET_FCASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(positivefCash.sub(negativefCash), decimalPlaces)),
      )
      NotionalMetrics.BALANCES.POSITIVE_FCASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(positivefCash, decimalPlaces)),
      )
      NotionalMetrics.BALANCES.NEGATIVE_FCASH_BALANCE.set(
        { currency: k },
        parseFloat(formatUnits(negativefCash, decimalPlaces)),
      )
    })
  }

  private static async fetchMarketGauges() {
    const allMarkets = GraphClient.getClient().getCashMarkets()

    allMarkets.forEach((m) => {
      const labels = { currency: m.currencySymbol, marketKey: m.marketKey }
      const { decimalPlaces } = GraphClient.getClient().getCurrencyBySymbol(m.currencySymbol)

      NotionalMetrics.MARKETS.TOTAL_LIQUIDITY.set(
        labels, parseFloat(formatUnits(m.totalLiquidity, decimalPlaces)),
      )
      NotionalMetrics.MARKETS.TOTAL_CURRENT_CASH.set(
        labels, parseFloat(formatUnits(m.totalCurrentCash, decimalPlaces)),
      )
      NotionalMetrics.MARKETS.TOTAL_FCASH.set(
        labels, parseFloat(formatUnits(m.totalfCash, decimalPlaces)),
      )
      NotionalMetrics.MARKETS.LAST_IMPLIED_RATE.set(labels, m.lastImpliedRate)
      NotionalMetrics.MARKETS.RATE_ANCHOR.set(labels, m.rateAnchor)
    })
  }

  // eslint-disable-next-line class-methods-use-this
  public async metrics(asJson: boolean) {
    await Promise.all([
      MetricsCollector.fetchBalanceGauges(),
      MetricsCollector.fetchAccountGauges(),
      MetricsCollector.fetchMarketGauges(),
    ])

    if (asJson) {
      return NotionalMetricsRegistry.getMetricsAsJSON()
    }

    return NotionalMetricsRegistry.metrics()
  }
}

export default MetricsCollector
