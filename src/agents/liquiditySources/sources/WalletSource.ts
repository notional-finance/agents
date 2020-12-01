import { zip } from 'core/lib/Utils'
import ETHNodeClient from 'core/services/ETHNodeClient'
import GraphClient from 'core/services/GraphClient'
import { BigNumber } from 'ethers'
import { LiquiditySource, LiquiditySourceType, SupportedPair } from '../Schema'

class WalletSource extends LiquiditySource {
  constructor(
    address: string,
  ) {
    super(LiquiditySourceType.Wallet, false, address)
  }

  public async getSupportedPairs() {
    const currencies = GraphClient.getClient().getCurrencies()
    const { escrow } = ETHNodeClient.getClient().contracts

    const tokens = currencies.map((c) => ({
      symbol: c.symbol,
      contract: ETHNodeClient.getClient().getToken(c.address),
    }))

    const tokenBalances = await Promise.all(
      tokens.map(async (t) => ({
        symbol: t.symbol,
        balance: await t.contract.balanceOf(this.address),
        allowance: await t.contract.allowance(this.address, escrow.address),
      })),
    )

    const pairs = zip(tokenBalances, tokenBalances)
      .filter(([sold, purchased]) => {
        if (sold.symbol === purchased.symbol) return false
        if (sold.allowance.isZero()) return false
        if (sold.balance.isZero()) return false
        return true
      })
      .map(([sold, purchased]) => new SupportedPair(
        sold.symbol,
        purchased.symbol,
        sold.balance.lt(sold.allowance) ? sold.balance : sold.allowance,
        undefined,
        this.address,
      ))

    return pairs
  }

  public async getPurchasePrice(
    _currencySold: string,
    _currencyPurchased: string,
    _amountSold: BigNumber | undefined,
  ) {
    return undefined
  }

  public async getSoldPrice(
    _currencySold: string,
    _currencyPurchased: string,
    _amountSold: BigNumber | undefined,
  ) {
    return undefined
  }
}

export default WalletSource
