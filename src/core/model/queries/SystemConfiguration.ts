import { gql } from '@apollo/client/core'
import { SystemConfiguration } from '../GraphTypes'

export type SystemConfigurationQueryResult = {
  systemConfiguration: SystemConfiguration
}

const SystemConfigurationQuery = () => gql`{
    systemConfiguration(id: "0") {
      lastUpdateBlockNumber
      lastUpdateTimestamp

      settlementDiscount
      liquidationDiscount
      liquidityHaircut
      liquidityRepoIncentive
      fCashHaircut
      fCashMaxHaircut
      maxAssets
    }
  }`

export default SystemConfigurationQuery
