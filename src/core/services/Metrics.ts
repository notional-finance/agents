import Prometheus from 'prom-client'

const AppMetrics = {
  GRAPH_NODE: {
    BLOCK_LAG: new Prometheus.Gauge({
      name: 'graph_node_block_lag',
      help: 'graph node lag behind latest block',
      labelNames: ['subgraph'],
    }),
    REQUEST_COUNT: new Prometheus.Counter({
      name: 'graph_node_request_count_total',
      help: 'total graph node requests by subgraph',
      labelNames: ['subgraph'],
    }),
    REQUEST_SUCCESS: new Prometheus.Counter({
      name: 'graph_node_request_success_total',
      help: 'total successful graph node requests by subgraph',
      labelNames: ['subgraph'],
    }),
    REQUEST_ERROR: new Prometheus.Counter({
      name: 'graph_node_request_error_total',
      help: 'total failed graph node requests by subgraph',
      labelNames: ['subgraph'],
    }),
    REQUEST_DURATION: new Prometheus.Histogram({
      name: 'graph_node_request_duration_seconds',
      help: 'duration of a graph node request',
      buckets: [0.1, 5, 15, 50, 100, 500],
      labelNames: ['subgraph'],
    }),
    REQUEST_SUMMARY: new Prometheus.Summary({
      name: 'graph_node_request_percentile',
      help: 'percentile duration of a graph node request',
      percentiles: [0.01, 0.1, 0.9, 0.99],
      labelNames: ['subgraph'],
    }),
  },
  ETH_NODE: {
    REQUEST_COUNT: new Prometheus.Counter({
      name: 'eth_node_request_count_total',
      help: 'total eth node requests',
      labelNames: ['network'],
    }),
    REQUEST_RETRY: new Prometheus.Counter({
      name: 'eth_node_request_retry_total',
      help: 'total retries for eth node requests',
      labelNames: ['network'],
    }),
    REQUEST_SUCCESS: new Prometheus.Counter({
      name: 'eth_node_request_success_total',
      help: 'total successful eth node requests',
      labelNames: ['network'],
    }),
    REQUEST_ERROR: new Prometheus.Counter({
      name: 'eth_node_request_error_total',
      help: 'total failed eth node requests',
      labelNames: ['network'],
    }),
    REQUEST_DURATION: new Prometheus.Histogram({
      name: 'eth_node_request_duration_seconds',
      help: 'duration of a eth node request including retry attempts',
      buckets: [0.1, 5, 15, 50, 100, 500],
      labelNames: ['network'],
    }),
    REQUEST_SUMMARY: new Prometheus.Summary({
      name: 'eth_node_request_percentile',
      help: 'percentile duration of a eth node request including retry attempts',
      percentiles: [0.01, 0.1, 0.9, 0.99],
      labelNames: ['network'],
    }),
  },
}

export default AppMetrics
