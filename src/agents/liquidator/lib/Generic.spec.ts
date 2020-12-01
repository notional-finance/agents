import { DEFAULT_SUBGRAPH } from 'config/config'
import { AssetType } from 'core/model/GraphTypes'
import GraphClient from 'core/services/GraphClient'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import BNExpects from 'test/utils/BNExpects'
import {
  defaultMaturity, MockAccount, MockAsset, MockBalance,
} from 'test/utils/TestMocks'
import { adjustfCashValue, adjustNetAvailable, calculateCollateralPurchase } from './Generic'

expect.extend(BNExpects)

describe('Generic', () => {
  beforeAll((done) => {
    GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
      done()
    })
  })

  describe('currency net adjustment', () => {
    it('does not adjust negative fCashValue', () => {
      const netAvailable = adjustfCashValue(
        parseEther('100'),
        parseEther('-100'),
        parseEther('200'),
      )

      expect(netAvailable).toEq(parseEther('100'))
    })

    it('removed when payer has positive cash balance', () => {
      const netAvailable = adjustfCashValue(
        parseEther('250'), // 50 in fCash value, no credit
        parseEther('0'),
        parseEther('200'),
      )

      expect(netAvailable).toEq(parseEther('200'))
    })

    it('nets off negative cash balances', () => {
      const netAvailable = adjustfCashValue(
        parseEther('250'), // 150 in fCashValue
        parseEther('-100'),
        parseEther('50'), // This remains
      )

      expect(netAvailable).toEq(parseEther('50'))
    })

    it('partially nets off negative cash balances', () => {
      const netAvailable = adjustfCashValue(
        parseEther('150'), // 50 in fCash value, partially applied
        parseEther('-100'), // net -50 in cash balance
        parseEther('200'),
      )

      expect(netAvailable).toEq(parseEther('150'))
    })

    it('adjusts when there are liquidity tokens', () => {
      const { account, factors } = MockAccount(
        [],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('200'),
          ),
        ],
      )

      const netAvailable = adjustNetAvailable('DAI', factors.get('DAI')!, account)
      expect(netAvailable).toEq(parseEther('200'))
    })
  })

  describe('collateral purchase', () => {
    it('negative net available', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const usdc = GraphClient.getClient().getCurrencyBySymbol('USDC')
      const { account, factors } = MockAccount(
        [
          MockBalance('USDC', BigNumber.from(-100e6)),
        ],
        [],
      )

      const {
        collateralPurchased,
        localPurchased,
      } = calculateCollateralPurchase(
        dai,
        usdc,
        factors.get('USDC')!,
        account,
        parseEther('100'),
        parseEther('1.06'),
      )

      expect(collateralPurchased).toEq(parseEther('0'))
      expect(localPurchased).toEq(parseEther('0'))
    })

    it('insufficient collateral to purchase', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const usdc = GraphClient.getClient().getCurrencyBySymbol('USDC')
      const { account, factors } = MockAccount(
        [
          MockBalance('USDC', BigNumber.from(106e6)),
        ],
        [],
      )

      const {
        collateralPurchased,
        localPurchased,
      } = calculateCollateralPurchase(
        dai,
        usdc,
        factors.get('USDC')!,
        account,
        parseEther('110'),
        parseEther('1.06'),
      )

      expect(collateralPurchased).toEq(BigNumber.from(106e6))
      expect(localPurchased).toEq(parseEther('100'))
    })

    it('sufficient collateral to purchase', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const usdc = GraphClient.getClient().getCurrencyBySymbol('USDC')
      const { account, factors } = MockAccount(
        [
          MockBalance('USDC', BigNumber.from(150e6)),
        ],
        [],
      )

      const {
        collateralPurchased,
        localPurchased,
      } = calculateCollateralPurchase(
        dai,
        usdc,
        factors.get('USDC')!,
        account,
        parseEther('100'),
        parseEther('1.06'),
      )

      expect(collateralPurchased).toEq(BigNumber.from(106e6))
      expect(localPurchased).toEq(parseEther('100'))
    })
  })
})
