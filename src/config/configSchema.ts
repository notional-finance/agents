export interface WalletSourceConfig {
  address: string;
}

export interface UniswapSourceConfig {
  factory: string;
  pairs: string[];
}

type LiquiditySourceParams = WalletSourceConfig | UniswapSourceConfig

export interface ConfigSchema {
  graphNode: {
    hostname: string,
    indexer: string,
    subgraphs: {
      name: string,
      pollingInterval: number,
      longPollingInterval: number,
      maxBlockLag: number
    }[]
  },
  ethNode: {
    hostname: string,
    network: string,
    retries: number,
    pollingIntervalMs: number
  },
  liquiditySources: {
    name: string,
    type: string,
    params: LiquiditySourceParams
  }[],
  app: {
    port: number,
    apiVersion: string,
    enableRoutes: string[],
    reconciliationRateLimitSeconds?: number,
    metrics: {
      enabled: boolean,
      prefix?: string,
      defaultMetricsInterval?: number,
      includeQueryParams?: boolean
    }
  }
}
