import BNExpects from 'test/utils/BNExpects'
import GraphClient from 'core/services/GraphClient'
import { parseEther } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import {
  defaultMaturity, MockAccount, MockAsset, MockBalance,
} from 'test/utils/TestMocks'
import { AssetType } from 'core/model/GraphTypes'
import { DEFAULT_SUBGRAPH } from 'config/config'
import { calculateTokenLiquidation, getLiquidatePair } from './Liquidation'
import LiquidationController from '../Controller'

expect.extend(BNExpects)

describe('Liquidation', () => {
  beforeAll((done) => {
    GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
      done()
    })
  })

  describe('token purchase', () => {
    it('has sufficient tokens', () => {
      const {
        cashClaimWithdrawn,
        tokenLiquidateFee,
        localNetAvailable,
        localRequired,
      } = calculateTokenLiquidation(
        parseEther('1000'),
        parseEther('10000'),
        parseEther('2000'),
      )

      const raiseNum = Math.trunc((1000 * 1.1) / (1 - 0.8))
      const haircutAmount = Math.trunc(raiseNum * 0.2)
      const incentiveAmount = Math.trunc(-(haircutAmount / 1.1 - haircutAmount))
      const expectedRaise = parseEther(raiseNum.toString())
      const expectedIncentive = parseEther(incentiveAmount.toString())
      const netCurrency = parseEther('2000')

      expect(cashClaimWithdrawn).toEq(expectedRaise)
      expect(tokenLiquidateFee).toEq(expectedIncentive)
      expect(localNetAvailable).toEq(netCurrency.add(parseEther('1000')))
      expect(localRequired).toEq(parseEther('0'))
    })

    it('has insufficient tokens', () => {
      const {
        cashClaimWithdrawn,
        tokenLiquidateFee,
        localNetAvailable,
        localRequired,
      } = calculateTokenLiquidation(
        parseEther('1000'),
        parseEther('3300'),
        parseEther('2000'),
      )

      const raiseNum = Math.trunc((1000 * 1.1) / (1 - 0.8))
      const remainderNum = Math.trunc(raiseNum * 0.4)
      const haircutAmount = Math.trunc((raiseNum - remainderNum) * 0.2)
      const incentiveAmount = Math.trunc(-(haircutAmount / 1.1 - haircutAmount))
      const expectedRemainder = parseEther(remainderNum.toString())
      const expectedRaise = parseEther(raiseNum.toString())
      const expectedIncentive = parseEther(incentiveAmount.toString())
      const netCurrency = parseEther('2000')

      expect(cashClaimWithdrawn).toEq(expectedRaise.sub(expectedRemainder))
      expect(tokenLiquidateFee).toEq(expectedIncentive)
      expect(localNetAvailable).toEq(netCurrency.add(parseEther('600')))
      expect(localRequired).toEq(parseEther('400'))
    })
  })

  describe('liquidated pairs', () => {
    // These tests evaluate a single pair
    it('has sufficient tokens, no collateral specified', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')

      const {
        account,
        factors,
      } = MockAccount([],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('200'),
          ),
        ])

      const pair = getLiquidatePair(
        dai,
        undefined,
        factors,
        account,
        parseEther('0.20'), // 20 Dai worth of shortfall
      )

      expect(pair.collateralCurrency).toBeUndefined()
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(BigNumber.from(0))
      expect(pair.collateralPurchased).toEq(BigNumber.from(0))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('111.1'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('2.02'))
      expect(pair.ethShortfallRecovered).toEq(parseEther('0.2'))
      expect(pair.effectiveExchangeRate).toEq(parseEther('0'))
    })

    it('has insufficient tokens, no collateral specified', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')

      const {
        account,
        factors,
      } = MockAccount(
        [
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('110'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        undefined,
        factors,
        account,
        parseEther('0.50'), // 50 Dai worth of shortfall
      )

      expect(pair.collateralCurrency).toBeUndefined()
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(BigNumber.from(0))
      expect(pair.collateralPurchased).toEq(BigNumber.from(0))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('110'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('2'))
      expect(pair.ethShortfallRecovered).toEq(BigNumber.from('198019801980198019'))
      // expect(pair.ethShortfallRecovered).toApproxEq(parseEther('1980198'), 10)
      expect(pair.effectiveExchangeRate).toEq(parseEther('0'))
    })

    it('has sufficient tokens and collateral specified', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-0.20')),
          MockBalance('WETH', BigNumber.from('1')),
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('200'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        parseEther('0.20'),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(BigNumber.from(0))
      expect(pair.collateralPurchased).toEq(BigNumber.from(0))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('111.1'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('2.02'))
      expect(pair.ethShortfallRecovered).toEq(parseEther('0.2'))
      expect(pair.effectiveExchangeRate).toEq(parseEther('0'))
    })

    it('has insufficient tokens and sufficient collateral', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const {
        account,
        factors,
        netETHCollateral,
        netETHDebtWithBuffer,
      } = MockAccount(
        [
          MockBalance('DAI', parseEther('-200')),
          MockBalance('WETH', parseEther('0.5')),
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('110'),
          ),
          MockAsset(
            AssetType.CashPayer,
            defaultMaturity,
            'DAI',
            parseEther('110'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        netETHDebtWithBuffer.sub(netETHCollateral),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(BigNumber.from('47169811320754716981'))
      expect(pair.collateralPurchased).toEq(parseEther('0.50'))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('110'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('2'))
      expect(pair.ethShortfallRecovered.lte(netETHDebtWithBuffer.sub(netETHCollateral))).toBe(true)
      expect(pair.effectiveExchangeRate).toEq(BigNumber.from('94339622641509433962'))
    })

    it('has insufficient tokens and insufficient collateral', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-500')),
          MockBalance('WETH', parseEther('1.06')),
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'DAI',
            parseEther('110'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        parseEther('5'),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(parseEther('100'))
      expect(pair.collateralPurchased).toEq(parseEther('1.06'))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('110'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('2'))
      expect(pair.effectiveExchangeRate).toEq(BigNumber.from('94339622641509433962'))
      expect(pair.ethShortfallRecovered).toEq(BigNumber.from('1188118811881188118'))
    })

    it('no tokens and sufficient collateral', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const {
        account, factors, netETHCollateral, netETHDebtWithBuffer,
      } = MockAccount(
        [
          MockBalance('DAI', parseEther('-100')),
          MockBalance('WETH', parseEther('1.06')),
        ],
        [],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        netETHDebtWithBuffer.sub(netETHCollateral),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(parseEther('100'))
      expect(pair.collateralPurchased).toEq(parseEther('1.06'))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('0'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('0'))
      expect(pair.effectiveExchangeRate).toEq(BigNumber.from('94339622641509433962'))
      expect(pair.ethShortfallRecovered.gte(netETHDebtWithBuffer.sub(netETHCollateral))).toBe(true)
    })

    it('no tokens and insufficient collateral', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const { account, factors } = MockAccount(
        [
          MockBalance('WETH', parseEther('1.06')),
          MockBalance('DAI', parseEther('-200')),
        ],
        [],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        parseEther('2'),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(parseEther('100'))
      expect(pair.collateralPurchased).toEq(parseEther('1.06'))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('0'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('0'))
      expect(pair.effectiveExchangeRate).toEq(BigNumber.from('94339622641509433962'))
      expect(pair.ethShortfallRecovered).toEq(BigNumber.from('990099009900990099'))
    })

    it('no tokens and sufficient collateral in tokens', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const {
        account,
        factors,
        netETHCollateral,
        netETHDebtWithBuffer,
      } = MockAccount(
        [
          MockBalance('DAI', parseEther('-100')),
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'WETH',
            parseEther('1'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        netETHDebtWithBuffer.sub(netETHCollateral),
      )

      expect(pair.collateralCurrency).toEqual(weth)
      expect(pair.localCurrency).toEqual(dai)
      expect(pair.localRequired).toEq(BigNumber.from('59411764705882352941'))
      expect(pair.collateralPurchased).toEq(BigNumber.from('629764705882352941'))
      expect(pair.localTokenCashWithdrawn).toEq(parseEther('0'))
      expect(pair.tokenLiquidateFee).toEq(parseEther('0'))
      expect(pair.effectiveExchangeRate).toEq(BigNumber.from('94339622641509433988'))
      expect(pair.ethShortfallRecovered.gte(netETHDebtWithBuffer.sub(netETHCollateral))).toBe(true)
    })

    it('no tokens and insufficient collateral in tokens', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const weth = GraphClient.getClient().getCurrencyBySymbol('WETH')

      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-200')),
        ],
        [
          MockAsset(
            AssetType.LiquidityToken,
            defaultMaturity,
            'WETH',
            parseEther('1.1'),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        weth,
        factors,
        account,
        parseEther('2'),
      )

      expect(pair.localRequired).toEq(BigNumber.from('103773584905660377358'))
      expect(pair.collateralPurchased).toEq(parseEther('1.1'))
    })

    it('calculates liquidate fcash', () => {
      const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
      const usdc = GraphClient.getClient().getCurrencyBySymbol('USDC')

      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-200')),
        ],
        [
          MockAsset(
            AssetType.CashReceiver,
            defaultMaturity,
            'USDC',
            BigNumber.from(50e6),
          ),
          MockAsset(
            AssetType.CashReceiver,
            defaultMaturity + 100000,
            'USDC',
            BigNumber.from(400e6),
          ),
        ],
      )

      const pair = getLiquidatePair(
        dai,
        usdc,
        factors,
        account,
        parseEther('1'),
      )

      expect(pair.localRequired).toEq(parseEther('101'))
      expect(pair.collateralPurchased).toEq(BigNumber.from(0))
      expect(pair.localTokenCashWithdrawn).toEq(BigNumber.from(0))
      expect(pair.tokenLiquidateFee).toEq(BigNumber.from(0))
      expect(pair.ethShortfallRecovered).toEq(parseEther('1'))
      expect(pair.fCashPurchased!.length).toBe(2)

      expect(pair.fCashPurchased![0].marketKey).toBe(account.portfolio[0].marketKey)
      expect(pair.fCashPurchased![1].marketKey).toBe(account.portfolio[1].marketKey)
      expect(pair.fCashPurchased![0].maturity).toBe(account.portfolio[0].maturity)
      expect(pair.fCashPurchased![1].maturity).toBe(account.portfolio[1].maturity)

      expect(pair.fCashPurchased![0].notional).toBe(account.portfolio[0].notional)
      expect(BigNumber.from(107.06e6).sub(
          pair.fCashPurchased![0].discountValue.add(pair.fCashPurchased![1].discountValue),
      ).abs().lte(1)).toBe(true)
    })
  })

  describe('settlement pairs', () => {
    it('calculates settle currency', () => {

    })

    it('calculates settle fcash local currency', () => {
      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-100')),
        ],
        [
          MockAsset(
            AssetType.CashReceiver,
            defaultMaturity,
            'DAI',
            parseEther('250'),
          ),
        ],
      )

      const pairs = LiquidationController.getSettlePairs(
        account,
        ['DAI'],
        ['DAI'],
        factors,
        parseEther('1'),
      )

      expect(pairs[0].cashBalance).toEq(parseEther('100'))
      expect(pairs[0].localRequired).toEq(parseEther('100'))
      expect(pairs[0].fCashPurchased!).toHaveLength(1)
      expect(parseEther('100').sub(pairs[0].fCashPurchased![0].discountValue).abs().lte(1)).toBe(true)
    })

    it('calculates settle fcash collateral currency', () => {
      const { account, factors } = MockAccount(
        [
          MockBalance('DAI', parseEther('-200')),
        ],
        [
          MockAsset(
            AssetType.CashReceiver,
            defaultMaturity,
            'USDC',
            BigNumber.from(50e6),
          ),
          MockAsset(
            AssetType.CashReceiver,
            defaultMaturity + 100000,
            'USDC',
            BigNumber.from(400e6),
          ),
        ],
      )

      const pairs = LiquidationController.getSettlePairs(
        account,
        ['DAI'],
        ['USDC'],
        factors,
        parseEther('1'),
      )

      expect(pairs[0].cashBalance).toEq(parseEther('200'))
      expect(pairs[0].localRequired).toEq(parseEther('200'))
      expect(pairs[0].fCashPurchased!).toHaveLength(2)
      expect(BigNumber.from(204e6).sub(
          pairs[0].fCashPurchased![0].discountValue.add(pairs[0].fCashPurchased![1].discountValue),
      ).abs().lte(1)).toBe(true)
    })
  })
})
