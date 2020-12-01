/* eslint-disable max-classes-per-file */
import { BigNumber } from 'ethers'
import { Currency, JsonSerializeable } from 'core/model/Schema'

/**
 * Net currency amounts when liquidating a currency pair
 *
 * @typedef {object} LiquidatePair
 * @property {Currency} localCurrency.required - Currency to be liquidated
 * @property {Currency} collateralCurrency - Collateral currency (may not be present) if local currency tokens
 * can be liquidated
 * @property {string} localRequired.required - Amount of local currency required to liquidate
 * @property {string} collateralPurchased.required - Amount of collateral that will be purchased as a result
 * @property {string} localTokenCashWithdrawn.required - Amount of cash from liquidity tokens that will be withdrawn
 * from the liquidated account
 * @property {string} tokenLiquidateFee.required - Fee paid to liquidator token liquidation action
 * @property {string} ethShortfallRecovered.required - Amount of total ETH shortfall recovered by this
 * liquidation action
 * @property {string} effectiveExchangeRate.required - The local to collateral exchange rate from this action
 */
export class LiquidatePair extends JsonSerializeable {
  constructor(
    public localCurrency: Currency,
    public collateralCurrency: Currency | undefined,
    public localRequired: BigNumber,
    public collateralPurchased: BigNumber,
    public localTokenCashWithdrawn: BigNumber,
    public tokenLiquidateFee: BigNumber,
    public ethShortfallRecovered: BigNumber,
    public effectiveExchangeRate: BigNumber,
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<LiquidatePair>(this)
  }
}

/**
 * An account that can be liquidated along with potential liquidation pairs.
 * @typedef {object} Liquidatable
 * @property {string} address.required - Account address
 * @property {string} ethDenominatedShortfall.required - Free collateral shortfall in ETH denominated terms
 * @property {array<LiquidatePair>} pairs.required - Potential currency pairs for liquidating the account
 */
export class Liquidatable extends JsonSerializeable {
  constructor(
    public address: string,
    public ethDenominatedShortfall: BigNumber,
    public pairs: LiquidatePair[],
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<Liquidatable>(this)
  }
}

/**
 * Net currency amounts when settling a currency pair
 *
 * @typedef {object} SettlePair
 * @property {Currency} localCurrency.required - Currency with debt to be settled
 * @property {Currency} collateralCurrency - Collateral currency (may not be present) if local currency tokens
 * can be withdrawn
 * @property {string} cashBalance.required - Amount of local currency debt that needs to be settled
 * @property {string} localRequired.required - Amount of local currency required to settle the debt
 * (accounts for liquidity tokens)
 * @property {string} collateralPurchased.required - Amount of collateral that will be purchased as a result
 * @property {string} effectiveExchangeRate.required - The local to collateral exchange rate from this action
 */
export class SettlePair extends JsonSerializeable {
  constructor(
    public localCurrency: Currency,
    public collateralCurrency: Currency | undefined,
    public cashBalance: BigNumber,
    public localRequired: BigNumber,
    public collateralPurchased: BigNumber,
    public effectiveExchangeRate: BigNumber,
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<SettlePair>(this)
  }
}

/**
 * An account that can be settled along with potential pairs.
 * @typedef {object} Settleable
 * @property {string} address.required - Account address
 * @property {array<SettlePair>} pairs.required - Potential currency pairs for settling the account
 */
export class Settleable extends JsonSerializeable {
  constructor(
    public address: string,
    public pairs: SettlePair[],
  ) {
    super()
  }

  toJSON() {
    return this.serializeKeys<Settleable>(this)
  }
}
