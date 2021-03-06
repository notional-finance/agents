import log4js from 'log4js'
import { LIQUIDITY_SOURCES } from 'config/config'
import { BigNumber } from 'ethers'
import { UniswapSourceConfig, WalletSourceConfig } from 'config/configSchema'
import { LiquidityPrice, LiquiditySource, LiquiditySourceType } from './Schema'
import UniFlashSwap from './sources/UniFlashSwap'
import WalletSource from './sources/WalletSource'

const appLogger = log4js.getLogger('app')
appLogger.addContext('liquiditySource', 'controller')

class LiquiditySourceController {
  private static controller: LiquiditySourceController;

  private constructor(
    public sources: LiquiditySource[],
  ) { }

  public static getController(): LiquiditySourceController {
    if (!LiquiditySourceController.controller) {
      const sources: LiquiditySource[] = []
      LIQUIDITY_SOURCES
        .filter((s) => s.type === LiquiditySourceType.Wallet)
        .forEach((w) => {
          const params = w.params as WalletSourceConfig
          // Need to do this for helm chart issue :(
          // https://github.com/helm/helm/issues/4262
          const address = params.address.replace(/^"|"$/g, '')

          if (!address.startsWith('0x')) {
            throw new Error('Address must begin with 0x, consider quoting in the config file')
          }
          appLogger.info(`initializing wallet liquidity source with params: ${w.params}`)
          sources.push(new WalletSource(address as string))
        })

      LIQUIDITY_SOURCES
        .filter((s) => s.type === LiquiditySourceType.UNI_FlashSwap)
        .forEach((w) => {
          const params = w.params as UniswapSourceConfig
          // Need to do this for helm chart issue :(
          // https://github.com/helm/helm/issues/4262
          const factory = params.factory.replace(/^"|"$/g, '')

          if (!factory.startsWith('0x')) {
            throw new Error('Address must begin with 0x, consider quoting in the config file')
          }

          appLogger.info(`initializing uniflashswap liquidity source with params: ${w.params}`)
          sources.push(new UniFlashSwap(factory, params.pairs))
        })

      LiquiditySourceController.controller = new LiquiditySourceController(sources)
    }

    return LiquiditySourceController.controller
  }

  public async getSupportedPairs(
    filterSources: LiquiditySourceType[] = [],
  ) {
    const sources = await Promise.all(
      this.sources
        .filter((s) => filterSources.length === 0 || filterSources.includes(s.type))
        .map(async (s) => ({
          address: s.address,
          isFlash: s.isFlash,
          type: s.type,
          pairs: await s.getSupportedPairs(),
        })),
    )

    return sources
  }

  public async getPurchasePrice(
    currencySold: string,
    currencyPurchased: string,
    amountSold: BigNumber | undefined,
    filterSources: LiquiditySourceType[] = [],
  ): Promise<LiquidityPrice[]> {
    const prices = await Promise.all(
      this.sources
        .filter((s) => filterSources.length === 0 || filterSources.includes(s.type))
        .map((s) => s.getPurchasePrice(
          currencySold,
          currencyPurchased,
          amountSold,
        )),
    )

    return prices.filter((p) => p !== undefined) as LiquidityPrice[]
  }

  public async getSoldPrice(
    currencySold: string,
    currencyPurchased: string,
    amountPurchased: BigNumber | undefined,
    filterSources: LiquiditySourceType[] = [],
  ): Promise<LiquidityPrice[]> {
    const prices = await Promise.all(
      this.sources
        .filter((s) => filterSources.length === 0 || filterSources.includes(s.type))
        .map((s) => s.getSoldPrice(
          currencySold,
          currencyPurchased,
          amountPurchased,
        )),
    )

    return prices.filter((p) => p !== undefined) as LiquidityPrice[]
  }
}

export default LiquiditySourceController
