import log4js from 'log4js'
import ETHNodeClient from 'core/services/ETHNodeClient'
import GraphClient from 'core/services/GraphClient'
import { DEFAULT_SUBGRAPH } from 'config/config'

const appLogger = log4js.getLogger('app')
appLogger.addContext('controller', 'healthcheck')

class HealthCheckController {
  private static async getEthNodeStatus() {
    const { provider } = ETHNodeClient.getClient()
    const { network } = ETHNodeClient.getClient()
    const requestStart = new Date()
    const block = await provider.getBlock('latest')
    const requestEnd = new Date()

    return {
      network,
      latestBlock: block.number,
      blockFetchTime: requestEnd.getTime() - requestStart.getTime(),
    }
  }

  public static async healthcheck() {
    const [graphStatus, blockLag, ethNode] = await Promise.all([
      GraphClient.indexer.getSubgraphStatus(DEFAULT_SUBGRAPH.name),
      GraphClient.indexer.getSubgraphBlockLag(DEFAULT_SUBGRAPH.name),
      HealthCheckController.getEthNodeStatus(),
    ])

    return {
      ethNode,
      graphStatus,
      blockLag,
    }
  }
}

export default HealthCheckController
