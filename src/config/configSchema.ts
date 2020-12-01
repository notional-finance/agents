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
    params: any
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
