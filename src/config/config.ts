import { config as dotenvConfig } from 'dotenv'
import yaml from 'js-yaml'
import fs from 'fs'
import log4js from 'log4js'
import { createCheckers } from 'ts-interface-checker'
import ConfigSchemaTI from './configSchema-ti'
import { ConfigSchema } from './configSchema'

const { ConfigSchema: ConfigSchemaChecker } = createCheckers(ConfigSchemaTI)

log4js.configure({
  appenders: {
    console: { type: 'console' },
    access: { type: 'file', filename: 'access.log' },
  },
  categories: {
    http: { appenders: ['access'], level: 'info' },
    app: { appenders: ['console'], level: 'debug' },
    testing: { appenders: ['console'], level: 'debug' },
    default: { appenders: ['console'], level: 'debug' },
  },
})

dotenvConfig()
const config = yaml.safeLoad(fs.readFileSync(process.env.CONFIG_FILE as string, 'utf8')) as ConfigSchema
// Get document, or throw exception on error
ConfigSchemaChecker.check(config)

// App Config
export const PORT = config.app.port
export const API_VERSION = config.app.apiVersion
export const RUN_LIQUIDATOR = config.app.enableRoutes.includes('liquidator')
export const METRICS = config.app.metrics
export const RECONCILIATION_RATE_LIMIT = config.app.reconciliationRateLimitSeconds || 5

// Graph Node
export const GRAPH_NODE_HOSTNAME = config.graphNode.hostname
export const GRAPH_NODE_INDEXER = config.graphNode.indexer
export const GRAPH_NODE_SUBGRAPHS = config.graphNode.subgraphs
export const DEFAULT_SUBGRAPH = config.graphNode.subgraphs
  .find((v) => v.name.startsWith('notional-finance')) as {
    name: string,
    pollingInterval: number,
    longPollingInterval: number,
    maxBlockLag: number
  }
if (DEFAULT_SUBGRAPH === undefined) throw new Error('Default subgraph not defined')

// ETH Node Config
export const ETH_NODE_URL = config.ethNode.hostname
export const ETH_NETWORK = config.ethNode.network
export const NODE_RETRIES = config.ethNode.retries
export const NODE_POLLING_INTERVAL = config.ethNode.pollingIntervalMs

// Liquidity Sources
export const LIQUIDITY_SOURCES = config.liquiditySources

export default config
