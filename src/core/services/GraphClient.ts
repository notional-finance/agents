// eslint-disable-next-line max-classes-per-file
import {
  ApolloClient,
  NormalizedCacheObject,
  InMemoryCache,
  HttpLink,
  from,
  ObservableQuery,
  ApolloQueryResult,
  DocumentNode,
  ApolloLink,
  InMemoryCacheConfig,
} from '@apollo/client/core'
import { onError } from '@apollo/client/link/error'
import { RetryLink } from '@apollo/client/link/retry'
import fetch from 'cross-fetch'
import log4js from 'log4js'
import {
  DEFAULT_SUBGRAPH, GRAPH_NODE_HOSTNAME, GRAPH_NODE_INDEXER, GRAPH_NODE_SUBGRAPHS,
} from 'config/config'
import { ArrayResult } from 'core/model/Queries'
import SystemConfigurationQuery, { SystemConfigurationQueryResult } from 'core/model/queries/SystemConfiguration'
import {
  CashMarketArray, CashMarket, Currency, CurrencyArray, SchemaObject, SystemConfiguration,
} from 'core/model/Schema'
import CurrenciesArrayQuery, { CurrencyQueryResult } from 'core/model/queries/CurrenciesQuery'
import CashMarketsArrayQuery, { CashMarketQueryResult } from 'core/model/queries/CashMarketQuery'
import NotionalCacheConfig from 'core/model/CacheConfig'
import { GraphStatusQuery, GraphStatusQueryResult } from './GraphStatusQuery'
import ETHNodeClient from './ETHNodeClient'
import AppMetrics from './Metrics'

const logger = log4js.getLogger('app')

class WatchedQuery<T, K> {
  public observable: ObservableQuery<T, {}>;

  public subscription: ZenObservable.Subscription;

  public value?: K;

  private didInit = false

  private handleResultError(error: any) {
    throw error
  }

  constructor(
    client: ApolloClient<NormalizedCacheObject>,
    query: () => DocumentNode,
    ValueObj: SchemaObject<T, K>,
    pollingInterval: number,
    onInit?: (value: K) => void,
    onUpdate?: (value: K) => void,
  ) {
    this.observable = client.watchQuery({ query: query() })

    const nextFn = ((result: ApolloQueryResult<T>) => {
      if (result.data) {
        this.value = new ValueObj(result.data)

        if (!this.didInit && onInit) {
          this.didInit = true
          onInit(this.value)
        }

        if (onUpdate) {
          onUpdate(this.value)
        }
      }
    })

    this.subscription = this.observable.subscribe({
      next: nextFn,
      error: this.handleResultError,
    })

    this.observable.startPolling(pollingInterval)
  }
}

function initApolloClient(uri: string, subgraph: string, cacheConfig?: InMemoryCacheConfig) {
  // Initialize graph client
  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) => {
        logger.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
        AppMetrics.GRAPH_NODE.REQUEST_ERROR.inc({ subgraph })
      })
    }
    if (networkError) logger.error(`[Network error]: ${networkError}`)
  })

  const retryLink = new RetryLink({
    delay: {
      initial: 500,
    },
    attempts: {
      max: 15,
    },
  })
  const httpLink = new HttpLink({ uri, fetch })
  const loggingLink = new ApolloLink((operation, forward) => {
    logger.debug(`[GraphQL]: starting request for ${operation.operationName} to ${uri}`)
    logger.trace(`[GraphQL]: ${operation.query}`)
    const duration = AppMetrics.GRAPH_NODE.REQUEST_DURATION.startTimer({ subgraph })
    const summary = AppMetrics.GRAPH_NODE.REQUEST_SUMMARY.startTimer({ subgraph })
    AppMetrics.GRAPH_NODE.REQUEST_COUNT.inc({ subgraph })

    return forward(operation).map((data) => {
      logger.debug(`[GraphQL]: completed request for ${operation.operationName} to ${uri}`)
      logger.trace(`[GraphQL]: ${data}`)
      duration()
      summary()
      AppMetrics.GRAPH_NODE.REQUEST_SUCCESS.inc({ subgraph })

      return data
    })
  })

  const apollo = new ApolloClient<NormalizedCacheObject>({
    uri,
    cache: new InMemoryCache(cacheConfig),
    link: from([loggingLink, errorLink, retryLink, httpLink]),
  })

  return apollo
}

class GraphIndexer {
  public indexClient: ApolloClient<NormalizedCacheObject>

  constructor(public hostname) {
    this.indexClient = initApolloClient(GRAPH_NODE_INDEXER, 'indexer')
  }

  public async getSubgraphStatus(subgraph: string) {
    const query = GraphStatusQuery(subgraph)
    const result = await this.indexClient.query<GraphStatusQueryResult>({
      query,
      fetchPolicy: 'network-only',
    })

    if (result.data) {
      return result.data
    }

    throw new Error('No data returned from indexer')
  }

  public async getSubgraphBlockLag(subgraph: string) {
    const data = await this.getSubgraphStatus(subgraph)
    const { provider } = ETHNodeClient.getClient()
    const block = await provider.getBlock('latest')

    const blockLag = block.number - data.indexingStatusForCurrentVersion.chains[0].latestBlock.number
    AppMetrics.GRAPH_NODE.BLOCK_LAG.set({ subgraph }, blockLag)

    return blockLag
  }
}

class GraphClient {
  private static clients = new Map<string, GraphClient>();

  public static indexer = new GraphIndexer(GRAPH_NODE_HOSTNAME);

  private systemConfiguration: WatchedQuery<SystemConfigurationQueryResult, SystemConfiguration>;

  private currencies: WatchedQuery<ArrayResult<CurrencyQueryResult>, Currency[]>;

  private cashMarkets: WatchedQuery<ArrayResult<CashMarketQueryResult>, CashMarket[]>;

  private initCallbacks: (() => void)[]

  public hasInit() {
    return (this.systemConfiguration.value && this.currencies.value)
  }

  private clientDidInit() {
    if (this.hasInit()) {
      this.initCallbacks.forEach((c) => c())
    }
  }

  private constructor(
    public graphNodeUrl: string,
    public pollingInterval: number,
    public longPollingInterval: number,
    public apolloClient: ApolloClient<NormalizedCacheObject>,
    didInit?: () => void,
  ) {
    logger.debug('Instantiating graph client')

    // TODO: this is not generic to other subgraphs
    this.systemConfiguration = new WatchedQuery<SystemConfigurationQueryResult, SystemConfiguration>(
      apolloClient,
      SystemConfigurationQuery,
      SystemConfiguration,
      longPollingInterval,
      this.clientDidInit.bind(this),
    )

    this.currencies = new WatchedQuery<ArrayResult<CurrencyQueryResult>, CurrencyArray>(
      apolloClient,
      CurrenciesArrayQuery,
      CurrencyArray,
      pollingInterval,
      this.clientDidInit.bind(this),
    )

    this.cashMarkets = new WatchedQuery<ArrayResult<CashMarketQueryResult>, CashMarketArray>(
      apolloClient,
      CashMarketsArrayQuery,
      CashMarketArray,
      pollingInterval,
      this.clientDidInit.bind(this),
    )

    this.initCallbacks = []
    if (didInit) {
      this.initCallbacks.push(didInit)
    }
  }

  public static getClient(subgraph: string = DEFAULT_SUBGRAPH.name, didInit?: () => void): GraphClient {
    if (!GraphClient.clients.get(subgraph)) {
      // Initialize graph client
      const subgraphConfig = GRAPH_NODE_SUBGRAPHS.find((s) => s.name === subgraph)
      if (!subgraphConfig) throw new Error(`Subgraph ${subgraph} not found in configuration`)

      const subgraphUrl = `${GRAPH_NODE_HOSTNAME}/subgraphs/name/${subgraphConfig.name}`
      const apollo = initApolloClient(subgraphUrl, subgraph, NotionalCacheConfig)

      GraphClient.clients.set(subgraph, new GraphClient(
        subgraphUrl,
        subgraphConfig.pollingInterval,
        subgraphConfig.longPollingInterval,
        apollo,
        didInit,
      ))
    } else if (didInit) {
      if (GraphClient.clients.get(subgraph)!.hasInit()) {
        didInit()
      } else {
        GraphClient.clients.get(subgraph)!.initCallbacks.push(didInit)
      }
    }

    return GraphClient.clients.get(subgraph)!
  }

  public getSystemConfiguration(): SystemConfiguration {
    if (!this.systemConfiguration.value) {
      throw new Error('Configuration value not initialized')
    }

    return this.systemConfiguration.value
  }

  public getCurrencies(): Currency[] {
    if (!this.currencies.value) {
      throw new Error('Currencies value not initialized')
    }

    return this.currencies.value
  }

  public getCashMarkets(): CashMarket[] {
    if (!this.cashMarkets.value) {
      throw new Error('Cash markets value not initialized')
    }

    return this.cashMarkets.value
  }

  public getCurrencyById(id: number): Currency {
    const currencies = this.getCurrencies()
    const currency = currencies.find((c) => c.id === id)

    if (!currency) {
      throw new Error(`${id} not found`)
    }

    return currency
  }

  public getCurrencyBySymbol(symbol: string): Currency {
    const currencies = this.getCurrencies()
    const currency = currencies.find((c) => c.symbol === symbol)

    if (!currency) {
      throw new Error(`${symbol} not found`)
    }

    return currency
  }

  private handleResultError(result: ApolloQueryResult<any>) {
    throw result.error
  }

  public async queryArray<T, K>(query: DocumentNode, ValueObj: SchemaObject<T, K>) {
    const result = await this.apolloClient.query<ArrayResult<T>>({
      query,
      fetchPolicy: 'network-only',
    })

    if (result.data) {
      return result.data.results.map((v) => new ValueObj(v))
    }

    this.handleResultError(result)
    return undefined
  }

  public async query<T, K>(query: DocumentNode, ValueObj: SchemaObject<T, K>) {
    const result = await this.apolloClient.query<T>({
      query,
      fetchPolicy: 'network-only',
    })

    if (result.data) {
      return new ValueObj(result.data)
    }

    this.handleResultError(result)
    return undefined
  }
}

export default GraphClient
