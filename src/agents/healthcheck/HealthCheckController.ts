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

  private static async getGraphStatus() {
    return {
      graphStatus: await GraphClient.indexer.getSubgraphStatus(DEFAULT_SUBGRAPH.name),
      blockLag: await GraphClient.indexer.getSubgraphBlockLag(DEFAULT_SUBGRAPH.name),
    }
  }

  public static async healthcheck() {
    const { graphStatus, blockLag } = await HealthCheckController.getGraphStatus()
    const ethNode = await HealthCheckController.getEthNodeStatus()

    return {
      ethNode,
      graphStatus,
      blockLag,
    }
  }
}

export default HealthCheckController
