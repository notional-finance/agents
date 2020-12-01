import log4js from 'log4js'
import GraphClient from 'core/services/GraphClient'
import Queries from 'core/model/Queries'
import { RateLimiter } from 'limiter'
import { AssetType } from 'core/model/GraphTypes'
import { Account, Currency } from 'core/model/Schema'
import { AccountQueryResult } from 'core/model/queries/AccountQuery'
import { calculateFreeCollateral, FreeCollateralFactors } from 'core/lib/FreeCollateral'
import { BigNumber } from 'ethers'
import { convertToETH } from 'core/lib/ExchangeRate'
import ETHNodeClient from 'core/services/ETHNodeClient'
import { RECONCILIATION_RATE_LIMIT } from 'config/config'
import {
  Liquidatable, LiquidatePair, Settleable, SettlePair,
} from './Schema'
import {
  adjustNetAvailable, calculateCollateralPurchase, effectiveExchangeRate, totalCashClaim, totalHaircutCashClaim,
} from './lib/Generic'
import { getLiquidatePair } from './lib/Liquidation'

const appLogger = log4js.getLogger('app')
appLogger.addContext('controller', 'liquidator')

class LiquidationController {
  public static async getAllAccounts() {
    appLogger.trace('Fetching all accounts')
    const accounts = await GraphClient
      .getClient()
      .queryArray<AccountQueryResult, Account>(
        Queries.AllAccountsQuery,
        Account,
      )

    if (accounts) {
      appLogger.trace(`Fetched ${accounts.length} accounts`)
    }
    return accounts
  }

  private static filterAccountsByPair(
    localSymbol: string | undefined,
    collateralSymbol: string | undefined,
    accounts: {
      pairs: {
        localCurrency: Currency,
        collateralCurrency: Currency | undefined
      }[]
    }[],
  ) {
    if (localSymbol) {
      return accounts.filter((v) => {
        const pairs = v.pairs.filter((p) => {
          if (collateralSymbol) {
            return p.localCurrency.symbol === localSymbol
              && p.collateralCurrency?.symbol === collateralSymbol
          }

          return p.localCurrency.symbol === localSymbol
        })
        // eslint-disable-next-line no-param-reassign
        v.pairs = pairs

        return pairs.length > 0
      })
    }

    return accounts
  }

  public static getLiquidatePairs(
    account: Account,
    factors: FreeCollateralFactors,
    ethShortfall: BigNumber,
  ) {
    const potentialLocal: string[] = []
    const potentialCollateral: string[] = []
    const liquidatePairs: LiquidatePair[] = []

    factors.forEach((v, k) => {
      const hasTokens = account.portfolio.find((a) => a.assetType === AssetType.LiquidityToken && a.symbol === k)

      if (v.cashClaim.gt(0) && hasTokens) {
        const localCurrency = GraphClient.getClient().getCurrencyBySymbol(k)
        liquidatePairs.push(getLiquidatePair(
          localCurrency,
          undefined,
          factors,
          account,
          ethShortfall,
        ))
        potentialLocal.push(k)
      } else if (v.netAvailable.lt(0)) {
        potentialLocal.push(k)
      }

      // This can overlap with cashClaim > 0 && has tokens
      if (v.netAvailable.gt(0)) {
        potentialCollateral.push(k)
      }
    })

    potentialLocal.forEach((local) => {
      potentialCollateral.forEach((collateral) => {
        if (local !== collateral) {
          const localCurrency = GraphClient.getClient().getCurrencyBySymbol(local)
          const collateralCurrency = GraphClient.getClient().getCurrencyBySymbol(collateral)
          liquidatePairs.push(getLiquidatePair(
            localCurrency,
            collateralCurrency,
            factors,
            account,
            ethShortfall,
          ))
        }
      })
    })

    appLogger.trace(`${liquidatePairs.length} liquidate pairs calculated for ${account.address}`)
    return liquidatePairs
  }

  public static async getLiquidatable(localCurrency?: string, collateralCurrency?: string) {
    const accounts = await LiquidationController.getAllAccounts()
    if (!accounts) {
      throw new Error('Accounts did not return any results')
    }

    const liquidatable = accounts.map((account) => {
      const {
        netETHCollateral,
        netETHDebtWithBuffer,
        factors,
      } = calculateFreeCollateral(account.portfolio, account.balances)

      return {
        account,
        netETHCollateral,
        netETHDebtWithBuffer,
        factors,
      }
    }).filter(({ netETHCollateral, netETHDebtWithBuffer }) => netETHCollateral.lt(netETHDebtWithBuffer))
      .map(({
        account, netETHCollateral, netETHDebtWithBuffer, factors,
      }) => {
        const ethDenominatedShortfall = netETHDebtWithBuffer.sub(netETHCollateral)
        const pairs = LiquidationController.getLiquidatePairs(account, factors, ethDenominatedShortfall)

        return new Liquidatable(
          account.address,
          ethDenominatedShortfall,
          pairs,
        )
      })

    return LiquidationController.filterAccountsByPair(localCurrency, collateralCurrency, liquidatable) as Liquidatable[]
  }

  public static getSettlePairs(
    account: Account,
    negativeBalances: Array<string>,
    potentialCollateral: Array<string>,
    factors: FreeCollateralFactors,
    aggregateFC: BigNumber,
  ) {
    const settlePairs: SettlePair[] = []

    negativeBalances.forEach((local) => {
      // NOTE: it's possible that local.symbol == collateral here, when an account has
      // a negative cash balance covered by the token haircut, there is no point in settling
      // against this account in that case but we list it for completeness
      const localCurrency = GraphClient.getClient().getCurrencyBySymbol(local)

      const totalLocalCashClaim = totalCashClaim(local, account.portfolio)
      const netDebt = account.balances.get(local).cashBalance.add(totalLocalCashClaim)

      if (netDebt.lt(0) && aggregateFC.lt(0)) {
        const totalLocalHaircutCashClaim = totalHaircutCashClaim(local, account.portfolio)
        const localNetAvailable = factors.get(local)!.netAvailable
        const postHaircutFC = aggregateFC.add(
          convertToETH(totalLocalHaircutCashClaim, localCurrency, localNetAvailable.lt(0)),
        )

        // If FC is negative after this adjustment then we must liquidate and this is not a settleable currency
        if (postHaircutFC.lt(0)) return
      }

      if (netDebt.gte(0)) {
        // This means that the negative balance is covered by the token haircut, there is no benefit
        // to settling this account
        settlePairs.push(new SettlePair(
          localCurrency,
          undefined,
          account.balances.get(local).cashBalance.mul(-1),
          BigNumber.from(0),
          BigNumber.from(0),
          BigNumber.from(0),
        ))

        return
      }

      potentialCollateral.forEach((collateral) => {
        const collateralCurrency = GraphClient.getClient().getCurrencyBySymbol(collateral)
        const { settlementDiscount } = GraphClient.getClient().getSystemConfiguration()

        const {
          localPurchased,
          collateralPurchased,
        } = calculateCollateralPurchase(
          localCurrency,
          collateralCurrency,
          factors.get(collateralCurrency.symbol)!,
          account,
          netDebt.mul(-1),
          settlementDiscount,
        )

        if (localPurchased.gt(0) && collateralPurchased.gt(0)) {
          settlePairs.push(new SettlePair(
            localCurrency,
            collateralCurrency,
            account.balances.get(local).cashBalance.mul(-1),
            localPurchased,
            collateralPurchased,
            effectiveExchangeRate(localPurchased, collateralPurchased, collateralCurrency),
          ))
        }
      })
    })

    return settlePairs
  }

  public static async getSettleable(localCurrency?: string, collateralCurrency?: string) {
    const accounts = await LiquidationController.getAllAccounts()
    if (!accounts) {
      throw new Error('Accounts did not return any results')
    }

    const settleable = accounts
      .map((account) => {
        const {
          factors,
          netETHCollateral,
          netETHDebtWithBuffer,
        } = calculateFreeCollateral(account.portfolio, account.balances)
        const aggregateFC = netETHCollateral.sub(netETHDebtWithBuffer)
        const negativeBalances: string[] = []
        const potentialCollateral: string[] = []

        // Only negative cash balances can be settled
        // eslint-disable-next-line no-restricted-syntax
        for (const key of account.balances.keys()) {
          const balance = account.balances.get(key)!
          if (balance.cashBalance.isNegative()) {
            negativeBalances.push(key)
          }
        }

        // Adjusted positive collateral can be settled against
        // eslint-disable-next-line no-restricted-syntax
        for (const key of factors.keys()) {
          const adjustedNetAvailable = adjustNetAvailable(key, factors.get(key)!, account)
          if (adjustedNetAvailable.gt(0)) {
            potentialCollateral.push(key)
          }
        }

        return {
          account,
          negativeBalances,
          potentialCollateral,
          factors,
          aggregateFC,
        }
      }).filter((v) => v.negativeBalances.length > 0)
      .map(({
        account,
        negativeBalances,
        potentialCollateral,
        factors,
        aggregateFC,
      }) => new Settleable(
        account.address,
        LiquidationController.getSettlePairs(
          account,
          negativeBalances,
          potentialCollateral,
          factors,
          aggregateFC,
        ),
      ))

    return LiquidationController.filterAccountsByPair(localCurrency, collateralCurrency, settleable) as Settleable[]
  }

  /**
   * Gets local liquidation / settlement accounts and reconciles
   * that against what the node returns.
   */
  public static async reconcile() {
    const allAccounts = await LiquidationController.getAllAccounts()
    if (!allAccounts) return 0

    const { portfolios } = ETHNodeClient.getClient().contracts
    const liquidatable = await LiquidationController.getLiquidatable()
    const limiter = new RateLimiter(RECONCILIATION_RATE_LIMIT, 'second')
    let reconErrors = 0
    let accountsReconciled = 0

    allAccounts.forEach((a) => {
      limiter.removeTokens(1, () => {
        portfolios.freeCollateralView(a.address)
          .then((fc) => {
            if (fc[0].isNegative()) {
              const found = liquidatable.find((l) => l.address === a.address)
              if (!found) reconErrors += 1
            }
            accountsReconciled += 1
          })
      })
    })

    // Wait for reconciliation to finish
    while (accountsReconciled < allAccounts.length) {
      await new Promise((r) => setTimeout(r, 3000))
    }

    return reconErrors
  }
}

export default LiquidationController
