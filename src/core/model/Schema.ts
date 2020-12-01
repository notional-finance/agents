/* eslint-disable max-classes-per-file */
import { getAssetValue } from 'core/lib/AssetValue'
import { getNowSeconds } from 'core/lib/Utils'
import GraphClient from 'core/services/GraphClient'
import { BigNumber, Contract, ethers } from 'ethers'
import { CashMarket as CashMarketContract } from 'core/typechain/CashMarket'
import ETHNodeClient from 'core/services/ETHNodeClient'
import CashMarketArtifact from 'core/abi/CashMarket.json'
import { Asset as GraphAssetType, AssetType, CurrencyBalance } from './GraphTypes'
import { ArrayResult } from './Queries'
import { AccountQueryResult } from './queries/AccountQuery'
import { CashMarketQueryResult } from './queries/CashMarketQuery'
import { CurrencyQueryResult } from './queries/CurrenciesQuery'
import { SystemConfigurationQueryResult } from './queries/SystemConfiguration'

export type SchemaObject<T, K> = new (data: T) => K

export abstract class JsonSerializeable {
  protected constructor() {}

  private isBigNumber(obj: any) {
    if (obj.hasOwnProperty('_isBigNumber') && obj._isBigNumber) return true
    return false
  }

  private isMap(obj: any) {
    if (obj instanceof Map) return true
    return false
  }

  private isBalances(obj: any) {
    if (obj instanceof Balances) return true
    return false
  }

  private isArray(obj: any) {
    if (obj instanceof Array) return true
    return false
  }

  private isJSONSerializable(obj: any) {
    if (obj.hasOwnProperty('toJSON')) return true
    if (obj instanceof JsonSerializeable) return true
    return false
  }

  protected serializeKeys<T>(obj: T) {
    const objectKeys = Object.keys(obj) as Array<keyof T>
    const result = {}

    for (const key of objectKeys) {
      const value = obj[key]
      if (typeof value === 'function') continue

      if (typeof value === 'object') {
        if (this.isBigNumber(value)) {
          result[key as string] = (value as unknown as BigNumber).toHexString()
        } else if (this.isBalances(value)) {
          const serialized = {};
          (value as unknown as Balances).forEach((v: Balance, k: string) => {
            serialized[k] = v.toJSON()
          })

          result[key as string] = serialized
        } else if (this.isMap(value)) {
          const map = (value as unknown as Map<string, JsonSerializeable>)
          const serialized = {}
          map.forEach((v, k) => {
            serialized[k] = v.toJSON()
          })

          result[key as string] = serialized
        } else if (this.isArray(value)) {
          result[key as string] = (value as unknown as Array<JsonSerializeable>)
            .map((v) => v.toJSON())
        } else if (this.isJSONSerializable(value)) {
          result[key as string] = (value as unknown as JsonSerializeable).toJSON()
        }
      } else {
        result[key as string] = value
      }
    }

    return result
  }

  abstract toJSON(): object
}

/**
 * A token listed in the Notional system
 * @typedef {object} Currency
 * @property {integer} id.required - Numeric id of token in Notional. -1 represents ETH, 0 represents WETH
 * @property {string} name.required - Name of token
 * @property {string} symbol.required - Ticker symbol of token
 * @property {string} address.required - Contract address for token
 * @property {integer} decimalPlaces.required - Decimal places for token
 * @property {integer} rateDecimalPlaces.required - Decimal places for exchange rate
 * @property {string} rateOracle.required - Address to exchange rate oracle (implements
 * Chainlink Aggregator Interface v2)
 * @property {string} buffer.required - Exchange rate buffer applied to account for FX risk
 * @property {string} currentETHExchangeRate.required - Current exchange rate to ETH
 */
export class Currency extends JsonSerializeable {
  id: number;

  name: string;

  symbol: string;

  address: string;

  decimalPlaces: number;

  rateDecimalPlaces: number;

  rateOracle: string;

  currentETHExchangeRate: BigNumber

  decimals: BigNumber;

  rateDecimals: BigNumber;

  buffer: BigNumber;

  constructor(data: CurrencyQueryResult) {
    super()

    this.id = Number(data.id)
    this.name = data.name
    this.symbol = data.symbol
    this.address = data.tokenAddress
    this.decimalPlaces = Math.log10(Number(data.decimals))
    this.decimals = BigNumber.from(data.decimals)

    if (data.ethExchangeRate.length > 0) {
      this.rateDecimals = BigNumber.from(data.ethExchangeRate[0].rateDecimals)
      this.rateDecimalPlaces = Math.log10(Number(data.ethExchangeRate[0].rateDecimals))
      this.rateOracle = data.ethExchangeRate[0].rateOracle
      this.buffer = BigNumber.from(data.ethExchangeRate[0].buffer)

      let rate = BigNumber.from(data.ethExchangeRate[0].latestRate.rate)
      if (data.ethExchangeRate[0].mustInvert) {
        rate = this.rateDecimals.mul(this.rateDecimals).div(rate)
      }
      this.currentETHExchangeRate = rate
    } else if (this.id === 0) {
      // This is WETH, special case
      this.rateDecimals = ethers.constants.WeiPerEther
      this.rateDecimalPlaces = 18
      this.rateOracle = ethers.constants.AddressZero
      this.currentETHExchangeRate = ethers.constants.WeiPerEther
      // When we allow WETH markets, this will go away because an exchange rate object will be set above
      this.buffer = ethers.constants.WeiPerEther
    } else {
      throw new Error(`Currency ${this.symbol} does not have an ETH exchange rate`)
    }
  }

  toJSON() {
    return this.serializeKeys<Currency>(this)
  }
}

export class CurrencyArray extends Array<Currency> {
  constructor(data: ArrayResult<CurrencyQueryResult>) {
    super()

    data.results.forEach((v) => {
      super.push(new Currency(v))
    })
  }
}

/**
 * Represents a market of a currency at a specified maturity time
 * @typedef {object} CashMarket
 * @property {integer} lastUpdateTime.required - Unix timestamp of the last update
 * @property {integer} lastUpdateBlockNumber.required - Block number of the last update
 * @property {string} address.required - Cash market contract address
 * @property {string} marketKey.required - Unique identifier for this market
 * @property {string} totalfCash.required - Total fCash available for purchase
 * @property {string} totalCurrentCash.required - Total current cash available for purchase
 * @property {string} totalLiquidity.required - Total liquidity tokens
 * @property {number} rateAnchor.required - Rate anchor used for liquidity curve calculation
 * @property {number} rateScalar.required - Rate scalar used to determine slippage rate
 * @property {number} lastImpliedRate.required - The most recent implied rate that was traded
 * @property {number} maturity.required - Maturity of the market in unix timestamp seconds
 * @property {number} maturityLength.required - Total seconds in the duration of the maturity from inception
 * @property {number} rateDecimals.required - Decimals in the rate
 * @property {number} rateDecimalPlaces.required -Decimal places of rate precision
 * @property {number} currencyId.required - Currency id of the market
 * @property {string} currencyName.required - Currency name of the market
 * @property {string} currencySymbol.required - Currency symbol of the market
 */
export class CashMarket extends JsonSerializeable {
  lastUpdateTime: Date;

  lastUpdateBlockNumber: number;

  address: string;

  marketKey: string;

  totalfCash: BigNumber;

  totalCurrentCash: BigNumber;

  totalLiquidity: BigNumber;

  rateAnchor: number;

  rateScalar: number;

  lastImpliedRate: number;

  maturity: number;

  maturityLength: number;

  rateDecimals: number;

  rateDecimalPlaces: number;

  currencyId: number;

  currencyName: string;

  currencySymbol: string;

  contract: CashMarketContract

  constructor(data: CashMarketQueryResult) {
    super()

    this.lastUpdateTime = new Date(data.lastUpdateTimestamp)
    this.lastUpdateBlockNumber = Number(data.lastUpdateBlockNumber)
    this.address = data.address
    this.totalfCash = BigNumber.from(data.totalfCash)
    this.totalCurrentCash = BigNumber.from(data.totalCurrentCash)
    this.totalLiquidity = BigNumber.from(data.totalLiquidity)
    this.rateAnchor = Number(data.rateAnchor)
    this.rateScalar = Number(data.rateScalar)
    this.lastImpliedRate = Number(data.lastImpliedRate)
    this.maturity = Number(data.maturity)
    this.maturityLength = Number(data.cashGroup.maturityLength)
    this.rateDecimals = Number(data.cashGroup.ratePrecision)
    this.rateDecimalPlaces = Math.log10(this.rateDecimals)
    this.currencyId = Number(data.cashGroup.currency.id)
    this.currencyName = data.cashGroup.currency.name
    this.currencySymbol = data.cashGroup.currency.symbol
    this.marketKey = data.id

    this.contract = new Contract(
      this.address,
      CashMarketArtifact,
      ETHNodeClient.getClient().provider,
    ) as CashMarketContract
  }

  toJSON() {
    return this.serializeKeys<CashMarket>(this)
  }
}

/**
  * Represents a cash balance position in a single currency
  * @typedef {object} Balance
  * @property {integer} lastUpdateTime.required - Unix timestamp of the last update
  * @property {integer} lastUpdateBlockNumber.required - Block number of the last update
  * @property {integer} currencyId.required - Numeric ID of the currency in Notional
  * @property {string} symbol.required - Currency symbol
  * @property {string} cashBalance.required - BigNumber representation of the effective cash balance
  * including matured assets
  */
export class Balance extends JsonSerializeable {
  lastUpdateTime: Date;

  lastUpdateBlockNumber: number;

  currencyId: number;

  symbol: string;

  cashBalance: BigNumber;

  constructor(data: CurrencyBalance) {
    super()

    this.lastUpdateTime = new Date(data.lastUpdateTimestamp * 1000)
    this.lastUpdateBlockNumber = Number(data.lastUpdateBlockNumber)
    this.currencyId = Number(data.currency.id)
    this.symbol = data.currency.symbol
    this.cashBalance = BigNumber.from(data.cashBalance)
  }

  copy() {
    return new Balance({
      lastUpdateTimestamp: (this.lastUpdateTime.getTime() / 1000),
      lastUpdateBlockNumber: this.lastUpdateBlockNumber,
      currency: {
        id: this.currencyId.toString(),
        symbol: this.symbol,
      },
      cashBalance: this.cashBalance.toString(),
    } as CurrencyBalance)
  }

  toJSON() {
    return this.serializeKeys<Balance>(this)
  }
}
/**
 * A mapping of balances on an account object where the key is the currency symbol
 * @typedef {object} Balances
 * @property {string} symbol.required - Currency symbol
 * @property {Balance} balance.required - Cash balance object
 */
export class Balances {
  private map: Map<string, Balance>;

  constructor(args: any) {
    this.map = new Map<string, Balance>(args)
  }

  public static default(symbol: string) {
    const currency = GraphClient.getClient().getCurrencyBySymbol(symbol)
    const id = `${currency.id}`

    return new Balance({
      lastUpdateTime: 0,
      lastUpdateBlockNumber: 0,
      currency: {
        id,
        symbol,
      },
      cashBalance: '0',
    } as unknown as CurrencyBalance)
  }

  public get(symbol: string): Balance {
    if (this.map.has(symbol)) {
      return this.map.get(symbol) as Balance
    }

    return Balances.default(symbol)
  }

  public set(key: string, value: Balance) {
    this.map.set(key, value)
  }

  public entries() {
    return this.map.entries()
  }

  public keys() {
    return this.map.keys()
  }

  public values() {
    return this.map.values()
  }

  public copy() {
    const result = new Balances([])
    this.forEach((v, k) => {
      result.set(k, v.copy())
    })
    return result
  }

  public forEach(
    callback: (value: Balance, key: string, map: Map<string, Balance>) => void,
    thisArg?: any,
  ) {
    return this.map.forEach(callback, thisArg)
  }
}

/**
 * Calculated value of a single Asset
 * @typedef {object} AssetValue
 * @property {boolean} boolean.required - True if the asset is past its maturity date and will be
 * settled on the next transaction
 * @property {string} fCash.required - fCash value of the asset
 * @property {string} cash.required - Cash value of the asset
 * @property {string} haircutfCash.required - Haircut fCash value of the asset
 * @property {string} haircutCash.required - Ethereum address of the account
 * @property {string} tokens.required - Ethereum address of the account
 */
export class AssetValue extends JsonSerializeable {
  get hasMatured() {
    const blockTime = getNowSeconds()
    return this.asset.maturity <= blockTime
  }

  get fCash() {
    const { fCash } = getAssetValue(this.asset, false)
    return fCash
  }

  get cash() {
    const { cash } = getAssetValue(this.asset, false)
    return cash
  }

  get haircutfCash() {
    const { fCash } = getAssetValue(this.asset, true)
    return fCash
  }

  get haircutCash() {
    const { cash } = getAssetValue(this.asset, true)
    return cash
  }

  get tokens() {
    const { tokens } = getAssetValue(this.asset, true)
    return tokens
  }

  // eslint-disable-next-line no-use-before-define
  constructor(private asset: Asset) {
    super()
  }

  toJSON() {
    return {
      hasMatured: this.hasMatured,
      fCash: this.fCash.toHexString(),
      cash: this.cash.toHexString(),
      tokens: this.fCash.toHexString(),
      haircutfCash: this.haircutfCash.toHexString(),
      haircutCash: this.haircutCash.toHexString(),
    }
  }
}

/**
 * Represents a portfolio position
 * @typedef {object} Asset
 * @property {integer} lastUpdateTime.required - Unix timestamp of the last update
 * @property {integer} lastUpdateBlockNumber.required - Block number of the last update
 * @property {integer} currencyId.required - Numeric ID of currency in Notional
 * @property {integer} cashGroupId.required - Numeric ID of cash group
 * @property {integer} maturity.required - Timestamp of maturity in seconds
 * @property {string} marketKey.required - {cashGroupId:maturity} key to reference market
 * @property {string} symbol.required - Symbol of currency
 * @property {string} assetId.required - ERC1155 Asset ID for the asset
 * @property {string} assetType.required - Asset Type - enum:CashPayer,CashReceiver,LiquidityToken
 * @property {string} notional.required - BigNumber representation of notional value
 */
export class Asset extends JsonSerializeable {
  lastUpdateTime: Date;

  lastUpdateBlockNumber: number;

  currencyId: number;

  cashGroupId: number;

  maturity: number;

  symbol: string;

  marketKey: string;

  assetId: string;

  assetType: AssetType;

  notional: BigNumber;

  assetValue: AssetValue;

  cashMarket?: {
    totalfCash: BigNumber;
    totalCurrentCash: BigNumber;
    totalLiquidity: BigNumber
  }

  constructor(data: GraphAssetType) {
    super()

    this.lastUpdateTime = new Date(data.lastUpdateTimestamp * 1000)
    this.lastUpdateBlockNumber = Number(data.lastUpdateBlockNumber)
    this.assetId = data.assetId
    this.assetType = data.assetType
    this.notional = BigNumber.from(data.notional)
    this.maturity = data.maturity
    this.marketKey = `${data.cashGroup.id}:${data.maturity}`

    this.cashGroupId = Number(data.cashGroup.id)
    this.currencyId = Number(data.cashGroup.currency.id)
    this.symbol = data.cashGroup.currency.symbol

    if (data.cashMarket) {
      this.cashMarket = {
        totalfCash: BigNumber.from(data.cashMarket.totalfCash),
        totalCurrentCash: BigNumber.from(data.cashMarket.totalCurrentCash),
        totalLiquidity: BigNumber.from(data.cashMarket.totalLiquidity),
      }
    }

    this.assetValue = new AssetValue(this)
  }

  toJSON() {
    return this.serializeKeys<Asset>(this)
  }
}

/**
 * An account is comprised of balances and a portfolio
 * @typedef {object} Account
 * @property {string} address.required - Ethereum address of the account
 * @property {Balances} balances.required - Cash balances calculated including matured assets, it's
 * recommended to use this for calculations
 * @property {Balances} escrowBalances.required - Cash balances as represented on the Escrow contract
 * @property {array<Asset>} portfolio.required - Array of assets held by the account
 */
export class Account extends JsonSerializeable {
  address: string;

  escrowBalances: Balances;

  portfolio: Asset[];

  get balances() {
    return this.portfolio
      .filter((a) => a.assetValue.hasMatured)
      .reduce((result, maturedAsset) => {
        // This needs to copy
        const b = result.get(maturedAsset.symbol).copy()
        b.cashBalance = b.cashBalance.add(maturedAsset.assetValue.cash)
        result.set(b.symbol, b)

        return result
      }, this.escrowBalances.copy())
  }

  constructor(data: AccountQueryResult) {
    super()

    this.address = data.id
    this.portfolio = data.portfolio.map((a) => new Asset(a))
    this.escrowBalances = new Balances(data.balances.map((c) => [c.currency.symbol, new Balance(c)]))
  }

  toJSON() {
    return Object.assign(this.serializeKeys<Account>(this), {
      balances: this.serializeKeys<Balances>(this.balances),
    })
  }
}

/**
 * System wide governance parameters
 * @typedef {object} SystemConfiguration
 * @property {integer} lastUpdateTime.required - Unix timestamp of the last update
 * @property {integer} lastUpdateBlockNumber.required - Block number of the last update
 * @property {integer} maxAssets.required - Maximum assets allowed in a portfolio
 * @property {string} settlementDiscount.required - Discount to exchange rate given for settlement
 * @property {string} liquidationDiscount.required - Discount to exchange rate given for liquidation
 * @property {string} liquidityHaircut.required - Haircut to value of liquidity token claims
 * @property {string} liquidityRepoIncentive.required - Incentive given to liquidating liquidity tokens
 * @property {string} fCashHaircut.required - Haircut given to positive fCash value in a portfolio
 * @property {string} fCashMaxHaircut.required - Limit to the fCashHaircut as assets get close to maturity
 */
export class SystemConfiguration extends JsonSerializeable {
  lastUpdateTime: Date;

  lastUpdateBlockNumber: number;

  maxAssets: number;

  settlementDiscount: BigNumber;

  liquidationDiscount: BigNumber;

  liquidityHaircut: BigNumber;

  liquidityRepoIncentive: BigNumber;

  fCashHaircut: BigNumber;

  fCashMaxHaircut: BigNumber;

  // This should only be instantiated as a singleton in the GraphClient object
  constructor(data: SystemConfigurationQueryResult) {
    super()
    const config = data.systemConfiguration

    this.lastUpdateTime = new Date(config.lastUpdateTimestamp)
    this.lastUpdateBlockNumber = Number(config.lastUpdateBlockNumber)
    this.maxAssets = BigNumber.from(config.maxAssets).toNumber()
    this.settlementDiscount = BigNumber.from(config.settlementDiscount)
    this.liquidationDiscount = BigNumber.from(config.liquidationDiscount)
    this.liquidityHaircut = BigNumber.from(config.liquidityHaircut)
    this.liquidityRepoIncentive = BigNumber.from(config.liquidityRepoIncentive)
    this.fCashHaircut = BigNumber.from(config.fCashHaircut)
    this.fCashMaxHaircut = BigNumber.from(config.fCashMaxHaircut)
  }

  toJSON() {
    return this.serializeKeys<SystemConfiguration>(this)
  }
}

export class CashMarketArray extends Array<CashMarket> {
  constructor(data: ArrayResult<CashMarketQueryResult>) {
    super()

    data.results.forEach((v) => {
      super.push(new CashMarket(v))
    })
  }
}
