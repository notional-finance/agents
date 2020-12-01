import { calculateFreeCollateral } from "core/lib/FreeCollateral";
import { getNowSeconds, SECONDS_IN_YEAR } from "core/lib/Utils"
import { Asset as GraphAssetType, AssetType, CurrencyBalance } from 'core/model/GraphTypes';
import { AccountQueryResult } from "core/model/queries/AccountQuery";
import { Account, Asset, Balance, Balances } from "core/model/Schema"
import GraphClient from "core/services/GraphClient"
import { BigNumber, ethers } from "ethers"
import { parseEther } from "ethers/lib/utils"

export const MockAsset = (
  assetType: AssetType,
  maturity: number,
  symbol: string,
  notional: BigNumber
) => {
  const currency = GraphClient.getClient().getCurrencyBySymbol(symbol)

  return new Asset({
    lastUpdateTimestamp: 0,
    lastUpdateBlockNumber: 0,
    assetId: "",
    assetType,
    notional: notional.toString(),
    maturity,
    cashGroup: {
      id: 1,
      currency: {
        id: currency.id,
        symbol: currency.symbol
      }
    },
    cashMarket: {
      totalfCash: parseEther('1000000').toString(),
      totalCurrentCash: parseEther('1000000').toString(),
      totalLiquidity: parseEther('1000000').toString(),
    }
  } as unknown as GraphAssetType)
}

export const MockBalance = (
  symbol: string,
  cashBalance: BigNumber
) => {
  const currency = GraphClient.getClient().getCurrencyBySymbol(symbol)

  return new Balance({
    lastUpdateTimestamp: 0,
    lastUpdateBlockNumber: 0,
    currency: {
      id: currency.id,
      symbol: currency.symbol
    },
    cashBalance: cashBalance.toString()
  } as unknown as CurrencyBalance)
}

export const MockAccount = (
  balances: Balance[],
  portfolio: Asset[],
  address?: string
) => {
  const account = new Account({
    id: address || ethers.constants.AddressZero,
    balances: [],
    portfolio: []
  } as unknown as AccountQueryResult)

  account.escrowBalances = new Balances(balances.map((b) => {
    return [b.symbol, b]
  }))
  account.portfolio = portfolio || []

  const {
    netETHCollateral,
    netETHDebt,
    netETHDebtWithBuffer,
    factors
  } = calculateFreeCollateral(account.portfolio, account.balances)

  return {
    account,
    netETHCollateral,
    netETHDebt,
    netETHDebtWithBuffer,
    factors
  }
}
export const defaultMaturity = getNowSeconds() + SECONDS_IN_YEAR;