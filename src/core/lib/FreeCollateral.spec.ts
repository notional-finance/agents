import { parseEther } from 'ethers/lib/utils'
import GraphClient from 'core/services/GraphClient'
import BNExpects from 'test/utils/BNExpects'
import { Balances } from 'core/model/Schema'
import { AssetType } from 'core/model/GraphTypes'
import { BigNumber } from 'ethers'
import { MockAsset, MockBalance, defaultMaturity } from 'test/utils/TestMocks'
import { DEFAULT_SUBGRAPH } from 'config/config'
import { SECONDS_IN_YEAR } from './Utils'
import { calculateFreeCollateral, netCurrencyAvailable } from './FreeCollateral'

expect.extend(BNExpects)

describe('net currency available', () => {
  beforeAll((done) => {
    GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
      done()
    })
  })

  it('calculates liquidity token values', () => {
    const balances = new Balances([])
    const { netAvailable, cashClaim, netfCash } = netCurrencyAvailable(
      balances.get('DAI'),
      [
        MockAsset(
          AssetType.LiquidityToken,
          defaultMaturity,
          'DAI',
          parseEther('100'),
        ),
        MockAsset(
          AssetType.CashPayer,
          defaultMaturity,
          'DAI',
          parseEther('20'),
        ),
      ],
    )

    expect(cashClaim).toEq(parseEther('80'))
    expect(netfCash).toEq(parseEther('30'))
    expect(netAvailable).toEq(parseEther('110'))
  })

  it('calculates cash payer values', () => {
    const balances = new Balances([])
    const { netAvailable, cashClaim, netfCash } = netCurrencyAvailable(
      balances.get('DAI'),
      [
        MockAsset(
          AssetType.CashPayer,
          defaultMaturity,
          'DAI',
          parseEther('100'),
        ),
      ],
    )

    expect(netAvailable).toEq(parseEther('-100'))
    expect(cashClaim).toEq(parseEther('0'))
    expect(netfCash).toEq(parseEther('-100'))
  })

  it('skips matured assets (already included in cash balance)', () => {
    const balances = new Balances([
      ['DAI', MockBalance('DAI', parseEther('0'))],
    ])

    const { netAvailable, cashClaim, netfCash } = netCurrencyAvailable(
      balances.get('DAI'),
      [
        MockAsset(
          AssetType.CashPayer,
          SECONDS_IN_YEAR,
          'DAI',
          parseEther('100'),
        ),
      ],
    )

    expect(netAvailable).toEq(parseEther('0'))
    expect(cashClaim).toEq(parseEther('0'))
    expect(netfCash).toEq(parseEther('0'))
  })
})

describe('free collateral', () => {
  it('calculates net collateral and debts', () => {
    const balances = new Balances([
      ['WETH', MockBalance('WETH', parseEther('1'))],
      ['DAI', MockBalance('DAI', parseEther('50'))],
      ['USDC', MockBalance('USDC', BigNumber.from(-100e6))],
    ])

    const { netETHCollateral, netETHDebt, netETHDebtWithBuffer } = calculateFreeCollateral(
      [
        MockAsset(
          AssetType.CashPayer,
          defaultMaturity,
          'DAI',
          parseEther('100'),
        ),
        MockAsset(
          AssetType.CashReceiver,
          defaultMaturity,
          'USDC',
          BigNumber.from(50e6),
        ),
      ],
      balances,
    )

    expect(netETHCollateral).toEq(parseEther('1'))
    expect(netETHDebt).toEq(parseEther('1.25'))
    expect(netETHDebtWithBuffer).toEq(parseEther('1.60'))
  })
})
