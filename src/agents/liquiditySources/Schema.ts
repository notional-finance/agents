import { JsonSerializeable } from 'core/model/Schema'
import { BigNumber } from 'ethers'

export enum LiquiditySourceType {
  Wallet = 'Wallet',
  AAVE_FlashLoan = 'AAVE_FlashLoan',
  UNI_FlashSwap = 'UNI_FlashSwap',
  UNI_Swap = 'UNI_Swap'
}

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
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<LiquidityPrice>(this)
  }
}
