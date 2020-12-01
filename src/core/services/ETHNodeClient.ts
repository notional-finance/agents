/* eslint-disable max-classes-per-file */
import { Contract, ethers } from 'ethers'
import log4js from 'log4js'
import {
  ETH_NETWORK, ETH_NODE_URL, NODE_POLLING_INTERVAL, NODE_RETRIES,
} from 'config/config'
import { Directory } from 'core/typechain/Directory'
import { ERC1155Token } from 'core/typechain/ERC1155Token'
import { ERC1155Trade } from 'core/typechain/ERC1155Trade'
import { Escrow } from 'core/typechain/Escrow'
import { Portfolios } from 'core/typechain/Portfolios'
import { CashMarket } from 'core/typechain/CashMarket'
import { IERC20 } from 'core/typechain/IERC20'
import Metrics from './Metrics'

import rinkebyAddresses from '../../config/rinkeby.json'
import kovanAddresses from '../../config/kovan.json'
import mainnetAddresses from '../../config/mainnet.json'

import EscrowABI from '../abi/Escrow.json'
import PortfoliosABI from '../abi/Portfolios.json'
import ERC1155TokenABI from '../abi/ERC1155Token.json'
import ERC1155TradeABI from '../abi/ERC1155Trade.json'
import DirectoryABI from '../abi/Directory.json'
import CashMarketABI from '../abi/CashMarket.json'
import IERC20ABI from '../abi/IERC20.json'

let localAddresses: any
try {
  // Local addresses may not be availble in non-dev environments
  // eslint-disable-next-line global-require
  localAddresses = require('../../config/local.json')
} catch {
  localAddresses = undefined
}

const logger = log4js.getLogger('app')

class RetryRPCProvider extends ethers.providers.JsonRpcProvider {
  constructor(
    url: string,
    public attempts: number = NODE_RETRIES,
    public networkName: string,
  ) {
    super(url)
    this.pollingInterval = NODE_POLLING_INTERVAL
  }

  perform(method: string, params: any) {
    let attempts = 0
    Metrics.ETH_NODE.REQUEST_COUNT.inc({ network: this.networkName })
    const duration = Metrics.ETH_NODE.REQUEST_DURATION.startTimer({ network: this.networkName })
    const summary = Metrics.ETH_NODE.REQUEST_SUMMARY.startTimer({ network: this.networkName })

    return ethers.utils.poll(() => {
      attempts += 1
      return super.perform(method, params).then(
        (result) => {
          Metrics.ETH_NODE.REQUEST_SUCCESS.inc({ network: this.networkName })
          duration()
          summary()
          return result
        },
        (error) => {
          if (error.statusCode !== 429 || attempts >= this.attempts) {
            logger.error(`[ETH Node]: ${error}`)
            Metrics.ETH_NODE.REQUEST_ERROR.inc({ network: this.networkName })
            duration()
            summary()
            return Promise.reject(error)
          }

          Metrics.ETH_NODE.REQUEST_RETRY.inc({ network: this.networkName })
          return Promise.resolve(undefined)
        },
      )
    })
  }
}

interface NotionalContracts {
  directory: Directory;
  escrow: Escrow;
  portfolios: Portfolios;
  erc1155: ERC1155Token;
  erc1155trade: ERC1155Trade;
}

class ETHNodeClient {
  private static client: ETHNodeClient

  public provider: ethers.providers.JsonRpcProvider

  public contracts: NotionalContracts

  private constructor(
    public nodeUrl: string,
    public network: string,
    public attempts: number,
  ) {
    this.provider = new RetryRPCProvider(nodeUrl, attempts, network)

    let addresses
    switch (network) {
      case 'mainnet':
        addresses = mainnetAddresses
        break
      case 'rinkeby':
        addresses = rinkebyAddresses
        break
      case 'kovan':
        addresses = kovanAddresses
        break
      case 'local':
        addresses = localAddresses
        break
      default:
        throw new Error(`Undefined network: ${network}`)
    }

    const directory = new Contract(addresses.directory, DirectoryABI, this.provider) as Directory
    const escrow = new Contract(addresses.escrow, EscrowABI, this.provider) as Escrow
    const portfolios = new Contract(addresses.portfolios, PortfoliosABI, this.provider) as Portfolios
    const erc1155 = new Contract(addresses.erc1155, ERC1155TokenABI, this.provider) as ERC1155Token
    const erc1155trade = new Contract(addresses.erc1155trade, ERC1155TradeABI, this.provider) as ERC1155Trade

    this.contracts = {
      directory,
      escrow,
      portfolios,
      erc1155,
      erc1155trade,
    }
  }

  public getCashMarket(address: string) {
    return new Contract(address, CashMarketABI, this.provider) as CashMarket
  }

  public getToken(address: string) {
    return new Contract(address, IERC20ABI, this.provider) as IERC20
  }

  public static getClient(): ETHNodeClient {
    if (!ETHNodeClient.client) {
      ETHNodeClient.client = new ETHNodeClient(
        ETH_NODE_URL,
        ETH_NETWORK,
        NODE_RETRIES,
      )
    }

    return ETHNodeClient.client
  }
}

export default ETHNodeClient
