import { gql } from '@apollo/client/core'

// Schema for this endpoint
// https://github.com/graphprotocol/graph-node/blob/master/server/index-node/src/schema.graphql
export type GraphStatusQueryResult = {
  indexingStatusForCurrentVersion: {
    synced: boolean,
    health: 'healthy' | 'unhealthy' | 'failed'
    fatalError: {
      message: string,
      block: {
        number: number,
        hash: string
      },
      handler: string
    },
    chains: {
      network: string
      chainHeadBlock: {
        number: number,
      },
      latestBlock: {
        number: number,
      }
    }[]
  }
}

export const GraphStatusQuery = (subgraph: string) => gql(`query {
    indexingStatusForCurrentVersion(subgraphName: "${subgraph}") {
      synced
      health
      fatalError {
        message
        block {
          number
          hash
        }
        handler
      }
      chains {
        network
        chainHeadBlock {
          number
        }
        latestBlock {
          number
        }
      }
    }
  }`)
