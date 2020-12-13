import log4js from 'log4js'
import {
  ChainId, Token, Fetcher, Route, Trade, TokenAmount, TradeType, Pair, FACTORY_ADDRESS,
} from '@uniswap/sdk'
import GraphClient from 'core/services/GraphClient'
import { ETH_NETWORK } from 'config/config'
import ETHNodeClient from 'core/services/ETHNodeClient'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import {
  LiquidityPrice, LiquiditySource, LiquiditySourceType, SupportedPair,
} from '../Schema'

const appLogger = log4js.getLogger('app')
appLogger.addContext('liquiditySource', 'UniFlashSwap')

class UniFlashSwap extends LiquiditySource {
  private static getChainId(network: string) {
    switch (network) {
      case 'mainnet':
        return ChainId.MAINNET
      case 'rinkeby':
        return ChainId.RINKEBY
      case 'kovan':
        return ChainId.KOVAN
      case 'local':
        return 1337
      default:
        throw new Error(`Unsupported network: ${network}`)
    }
  }

  private tokens: Map<string, Token>;

  private pairs: Map<string, [Token, Token]>

  private setPair(tokenA: string, tokenB: string) {
    if (!this.tokens.has(tokenA)) {
      throw new Error(`${tokenA} not found in UniFlashSwap`)
    }

    if (!this.tokens.has(tokenB)) {
      throw new Error(`${tokenB} not found in UniFlashSwap`)
    }

    this.pairs.set(`${tokenA}-${tokenB}`, [this.tokens.get(tokenA)!, this.tokens.get(tokenB)!])
  }

  constructor(
    address: string,
    pairs: string[],
  ) {
    super(LiquiditySourceType.UNI_FlashSwap, true, address)
    appLogger.info(`Starting uniswap factory at address ${address} with pairs`, pairs)
    const currencies = GraphClient.getClient().getCurrencies()
    this.tokens = new Map(currencies.map((c) => [c.symbol, new Token(
      UniFlashSwap.getChainId(ETH_NETWORK),
      c.address,
      c.decimalPlaces,
      c.symbol,
      c.name,
    )]))

    this.pairs = new Map<string, [Token, Token]>()
    pairs.forEach((p) => {
      const [a, b] = p.split('-')
      appLogger.info('pair is', a, b)
      this.setPair(a, b)
    })
  }

  private async getPair(input: string, output: string) {
    const { provider } = ETHNodeClient.getClient()
    appLogger.debug(`calling getPair with input: ${input}, output: ${output}`)
    if (this.pairs.has(`${input}-${output}`)) {
      const [token0, token1] = this.pairs.get(`${input}-${output}`)
      appLogger.debug(`fetching uni token pair token0: ${token0.address} and token1: ${token1.address}`)
      const pairData = await Fetcher.fetchPairData(token0, token1, provider)
      const pairAddress = Pair.getAddress(token0, token1)
      const uniRoute = new Route([pairData], token0, token1)

      return {
        pairData,
        uniRoute,
        pairAddress,
      }
    } if (this.pairs.has(`${output}-${input}`)) {
      const [token0, token1] = this.pairs.get(`${output}-${input}`)
      appLogger.debug(`fetching uni token pair token0: ${token0.address} and token1: ${token1.address}`)
      const pairData = await Fetcher.fetchPairData(token0, token1, provider)
      const pairAddress = Pair.getAddress(token0, token1)
      const uniRoute = new Route([pairData], token1, token0)

      return {
        pairData,
        uniRoute,
        pairAddress,
      }
    }

    return {
      pairData: undefined,
      uniRoute: undefined,
    }
  }

  async getSupportedPairs() {
    const { provider } = ETHNodeClient.getClient()

    const result = await Promise.all(Array.from(this.pairs.entries())
      .map(async ([key, [token0, token1]]) => {
        const [input, output] = key.split('-')
        const pairAddress = Pair.getAddress(token0, token1)
        appLogger.debug('pair address is', pairAddress)
        appLogger.debug('factory address is', FACTORY_ADDRESS)
        const pairData = await Fetcher.fetchPairData(token1, token0, provider)
        appLogger.debug('pair data is', pairData)

        const maxAmountSold = BigNumber.from(pairData.reserve0.numerator.toString())
        const maxAmountPurchased = BigNumber.from(pairData.reserve1.numerator.toString())

        return new SupportedPair(
          input,
          output,
          maxAmountSold,
          maxAmountPurchased,
          pairAddress,
        )
      }))

    return result
  }

  async getPurchasePrice(
    currencySold: string,
    currencyPurchased: string,
    amountSold: BigNumber | undefined,
  ) {
    const inputToken = this.tokens.get(currencySold)
    if (!inputToken) {
      appLogger.debug(`Token ${currencySold} is not defined in UniFlashSwap`)
    }

    const {
      pairData,
      uniRoute,
      pairAddress,
    } = await this.getPair(currencySold, currencyPurchased)
    if (!pairData || !uniRoute || !pairAddress) {
      appLogger.debug(`Route from ${currencySold} to ${currencyPurchased} does not exist`)
      return undefined
    }

    const metadata = {
      token0: pairData.token0.address,
      token1: pairData.token1.address,
    }

    if (amountSold) {
      const trade = new Trade(
        uniRoute,
        new TokenAmount(inputToken!, amountSold.toString()),
        TradeType.EXACT_INPUT,
      )

      return new LiquidityPrice(
        pairAddress,
        this.type,
        this.isFlash,
        currencySold,
        currencyPurchased,
        amountSold,
        BigNumber.from(trade.outputAmount.numerator.toString()),
        parseUnits(trade.executionPrice.toFixed(6), 6),
        metadata,
      )
    }
    return new LiquidityPrice(
      pairAddress,
      this.type,
      this.isFlash,
      currencySold,
      currencyPurchased,
      undefined,
      undefined,
      parseUnits(uniRoute.midPrice.toFixed(6), 6),
      metadata,
    )
  }

  async getSoldPrice(
    currencySold: string,
    currencyPurchased: string,
    amountPurchased: BigNumber | undefined,
  ) {
    const inputToken = this.tokens.get(currencySold)
    if (!inputToken) {
      appLogger.debug(`Token ${currencySold} is not defined in UniFlashSwap`)
    }

    const {
      pairData,
      uniRoute,
      pairAddress,
    } = await this.getPair(currencyPurchased, currencySold)
    if (!pairData || !uniRoute || !pairAddress) {
      appLogger.debug(`Route from ${currencySold} to ${currencyPurchased} does not exist`)
      return undefined
    }

    const metadata = {
      token0: pairData.token0.address,
      token1: pairData.token1.address,
    }

    if (amountPurchased) {
      const trade = new Trade(
        uniRoute,
        new TokenAmount(inputToken!, amountPurchased.toString()),
        TradeType.EXACT_OUTPUT,
      )

      return new LiquidityPrice(
        pairAddress,
        this.type,
        this.isFlash,
        currencySold,
        currencyPurchased,
        BigNumber.from(trade.inputAmount.numerator.toString()),
        amountPurchased,
        BigNumber.from(trade.executionPrice.numerator.toString()),
        metadata,
      )
    }
    return new LiquidityPrice(
      pairAddress,
      this.type,
      this.isFlash,
      currencySold,
      currencyPurchased,
      undefined,
      undefined,
      BigNumber.from(uniRoute.midPrice.numerator.toString()),
      metadata,
    )
  }
}

export default UniFlashSwap
