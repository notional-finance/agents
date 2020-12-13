/* eslint-disable max-classes-per-file */
import { JsonSerializeable } from 'core/model/Schema'
import { BigNumber } from 'ethers'

export enum LiquiditySourceType {
  Wallet = 'Wallet',
  AAVE_FlashLoan = 'AAVE_FlashLoan',
  UNI_FlashSwap = 'UNI_FlashSwap',
  UNI_Swap = 'UNI_Swap'
}

/**
 * A supported currency pair for a given liquidity source
 * @typedef {object} SupportedPair
 * @property {string} currencySold.required - currency symbol to be sold
 * @property {string} currencyPurchased.required - currency symbol to be purchased
 * @property {string} maxAmountSold - the maximum amount of currency can be sold on this pair
 * @property {string} maxAmountPurchased - the maximum amount of currency can be purchased on this pair
 * @property {string} address - the contract address of the liquidity source
 */
export class SupportedPair extends JsonSerializeable {
  constructor(
    public currencySold: string,
    public currencyPurchased: string,
    public maxAmountSold: BigNumber | undefined,
    public maxAmountPurchased: BigNumber | undefined,
    public address: string | undefined,
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<SupportedPair>(this)
  }
}

/**
 * The price on a liquidity source for a given amount and currency pair
 *
 * @typedef {object} LiquidityPrice
 * @property {string} address.required - the contract address of the liquidity source
 * @property {string} type.required - the type of the liquidity source
 * @property {boolean} isFlash.required - is the type a flash swap or flash loan
 * @property {string} currencySold.required - currency symbol to be sold
 * @property {string} currencyPurchased.required - currency symbol to be purchased
 * @property {string} amountSold - the amount of currency sold on this pair
 * @property {string} amountPurchased - the amount of currency purchased on this pair
 * @property {string} effectiveExchangeRate - the effective exchange rate between sold and purchased
 * @property {object} metadata - arbitrary metadata for the price
 */
export class LiquidityPrice extends JsonSerializeable {
  constructor(
    public address: string,
    public type: LiquiditySourceType,
    public isFlash: boolean,
    public currencySold: string,
    public currencyPurchased: string,
    public amountSold: BigNumber | undefined,
    public amountPurchased: BigNumber | undefined,
    public effectiveExchangeRate: BigNumber,
    public metadata?: {[key: string]: string},
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<LiquidityPrice>(this)
  }
}

/**
 * A given configured liquidity source
 *
 * @typedef {object} LiquiditySource
 * @property {string} address.required - the contract address of the liquidity source
 * @property {string} type.required - the type of the liquidity source
 * @property {boolean} isFlash.required - is the type a flash swap or flash loan
 */
export abstract class LiquiditySource extends JsonSerializeable {
  constructor(
    public type: LiquiditySourceType,
    public isFlash: boolean,
    public address: string,
  ) {
    super()
  }

  abstract async getSupportedPairs(): Promise<SupportedPair[]>

  abstract async getPurchasePrice(
    currencySold: string,
    currencyPurchased: string,
    amountSold: BigNumber | undefined,
  ): Promise<LiquidityPrice | undefined>

  abstract async getSoldPrice(
    currencySold: string,
    currencyPurchased: string,
    amountPurchased: BigNumber | undefined,
  ): Promise<LiquidityPrice | undefined>

  toJSON() {
    return this.serializeKeys<LiquiditySource>(this)
  }
}
