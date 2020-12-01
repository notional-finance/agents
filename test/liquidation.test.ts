import ETHNodeClient from 'core/services/ETHNodeClient'
import axios from 'axios'
import {
  BigNumber, Contract, ethers, Wallet,
} from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import GraphClient from 'core/services/GraphClient'
import { Currency } from 'core/model/Schema'
import { IERC20 } from 'core/typechain/IERC20'
import { DEFAULT_SUBGRAPH } from 'config/config'
import setup from './setup'
import BNExpects from './utils/BNExpects'
import defaultAccounts from './defaultAccounts.json'
import UniFlashSwapArtifact from './mocks/UniFlashSwap.json'
import { UniFlashSwap } from './mocks/UniFlashSwap'
import IUniswapV2PairArtifact from './mocks/IUniswapV2Pair.json'
import { IUniswapV2Pair } from './mocks/IUniswapV2Pair'

// import { MockAggregator } from './mocks/MockAggregator'
// const MockAggregatorArtifact = require('./mocks/MockAggregator.json')

const API_VERSION = 'v1'
const LIQUIDATION_ROOT = 'liquidator'
jest.setTimeout(50000)
expect.extend(BNExpects)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Liquidation', () => {
  const { provider } = ETHNodeClient.getClient()
  const wallets = defaultAccounts.map((v) => new Wallet(v.secretKey, provider))
  const [
    owner,
    tokenOnly,
    tokenCollateral,
    collateralOnly,
    flashSwapTokenCollateral,
  ] = wallets

  const { escrow, portfolios } = ETHNodeClient.getClient().contracts
  let allData: any[]
  let daiOnly: any[]
  let daiWeth: any[]

  let dai: Currency
  let weth: Currency
  let daiContract: IERC20
  let wethContract: IERC20

  beforeAll(async () => {
    await new Promise((resolve) => {
      GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
        resolve()
      })
    })

    dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
    weth = GraphClient.getClient().getCurrencyBySymbol('WETH')
    daiContract = ETHNodeClient.getClient().getToken(dai.address)
    wethContract = ETHNodeClient.getClient().getToken(weth.address)

    if (process.env.RUN_SETUP) {
      await setup(
        owner,
        tokenOnly,
        tokenCollateral,
        collateralOnly,
        flashSwapTokenCollateral,
        parseEther('0.012'),
      )
      await delay(6000) // Wait for the graph to catch up
    }

    ({ data: allData } = await axios.get(`http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/liquidation`));
    ({ data: daiOnly } = await axios.get(`http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/liquidation/DAI`));
    ({ data: daiWeth } = await axios.get(
      `http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/liquidation/DAI/WETH`,
    ))
  })

  describe('liquidate routes', () => {
    it('shows liquidatable accounts', () => {
      expect(allData.length).toBe(4)
      expect(daiOnly.length).toBe(4)
      expect(daiWeth.length).toBe(4)

      daiWeth.forEach((account: any) => {
        expect(account.pairs.length).toBe(1)
      })
    })

    it('the token only account does not require weth', () => {
      const resp = allData.find((d: any) => d.address === tokenOnly.address.toLowerCase())
      expect(resp.pairs.length).toBe(2)

      resp.pairs.forEach((p:any) => {
        expect(BigNumber.from(p.localRequired)).toEq(ethers.constants.Zero)
        expect(BigNumber.from(p.collateralPurchased)).toEq(ethers.constants.Zero)
        expect(p.ethShortfallRecovered).toEqual(resp.ethDenominatedShortfall)
      })
    })

    it('the token collateral account has two entries', () => {
      const resp = allData.find((d: any) => d.address === tokenCollateral.address.toLowerCase())
      const ethShortfall = BigNumber.from(resp.ethDenominatedShortfall)
      expect(resp.pairs.length).toBe(2)

      const localOnly = resp.pairs.find((p: any) => p.collateralCurrency === undefined)
      expect(BigNumber.from(localOnly.ethShortfallRecovered).lt(ethShortfall)).toBe(true)

      const wethPair = resp.pairs.find((p: any) => p.collateralCurrency !== undefined)
      expect(BigNumber.from(wethPair.ethShortfallRecovered).gte(ethShortfall)).toBe(true)
    })

    it('the collateral only account has one entry', () => {
      const resp = allData.find((d: any) => d.address === collateralOnly.address.toLowerCase())
      const ethShortfall = BigNumber.from(resp.ethDenominatedShortfall)
      expect(resp.pairs.length).toBe(1)

      const wethPair = resp.pairs.find((p: any) => p.collateralCurrency !== undefined)
      expect(BigNumber.from(wethPair.ethShortfallRecovered).gte(ethShortfall)).toBe(true)
    })
  })

  describe('liquidate execution matches api', () => {
    it('liquidates each account', async () => {
      const accounts = daiWeth.filter((a) => a.address !== flashSwapTokenCollateral.address.toLowerCase())
      expect(accounts.length).toBe(3)

      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < 3; i += 1) {
        const account = accounts[i]
        const daiBalanceBefore = await daiContract.balanceOf(owner.address)
        const wethBalanceBefore = await wethContract.balanceOf(owner.address)

        await escrow.connect(owner).liquidate(account.address, 0, dai.id, weth.id)

        const daiBalanceAfter = await daiContract.balanceOf(owner.address)
        const wethBalanceAfter = await wethContract.balanceOf(owner.address)
        const fcAfter = await portfolios.freeCollateralView(account.address)

        const daiChange = BigNumber.from(account.pairs[0].tokenLiquidateFee)
          .sub(BigNumber.from(account.pairs[0].localRequired))
        const wethChange = BigNumber.from(account.pairs[0].collateralPurchased)
        expect(daiBalanceAfter.sub(daiBalanceBefore).div(100)).toEq(daiChange.div(100))
        expect(wethBalanceAfter.sub(wethBalanceBefore).div(100)).toEq(wethChange.div(100))
        expect(fcAfter[0].gte(0)).toBe(true)
      }
      /* eslint-enable no-await-in-loop */
    })

    it('liquidates via flash swap', async () => {
      const account = daiWeth.find((a) => a.address === flashSwapTokenCollateral.address.toLowerCase())
      const localRequired = BigNumber.from(account.pairs[0].localRequired)
      const flashContract = new Contract(
        '0x995629b19667Ae71483DC812c1B5a35fCaaAF4B8',
        UniFlashSwapArtifact.abi,
        owner,
      ) as UniFlashSwap
      const wethBalanceBefore = await wethContract.balanceOf(flashContract.address)

      const { data } = await axios.get(
        `http://localhost:7879/v1/liquiditySource/DAI/WETH?amountSold=${localRequired.toString()}`,
      )
      const uniswapPair = new Contract(data[0].address, IUniswapV2PairArtifact.abi, owner) as IUniswapV2Pair
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['bytes1', 'address', 'uint128', 'uint16', 'uint16'],
        ['0x03', account.address, 0, dai.id, weth.id],
      )
      await uniswapPair.swap(localRequired, 0, flashContract.address, encodedData)

      const wethBalanceAfter = await wethContract.balanceOf(flashContract.address)
      const fcAfter = await portfolios.freeCollateralView(account.address)

      expect(wethBalanceAfter.sub(wethBalanceBefore).gte(0)).toBe(true)
      expect(fcAfter[0].gte(0)).toBe(true)
    })

    it('api should be updated with no liquidatable accounts', async () => {
      await delay(2000)
      const healthcheck = await axios.get('http://localhost:7879/healthcheck')
      expect(parseInt(healthcheck.data.blockLag, 10)).toBe(0)

      const { data } = await axios.get(`http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/liquidation`)
      expect(data).toHaveLength(0)
    })
  })

  describe('settles accounts at maturity', async () => {
    let allDataSettle
    let daiOnlySettle
    let daiWethSettle

    beforeAll(async () => {
      const { cashMarket: cashMarketAddress } = await portfolios.getCashGroup(2)
      const cashMarket = ETHNodeClient.getClient().getCashMarket(cashMarketAddress)
      const maturities = await cashMarket.getActiveMaturities()
      await provider.send('evm_mine', [maturities[1]])
      await axios.post('http://localhost:7879/healthcheck/faketime', {
        FAKE_TIME: maturities[1],
      });

      ({ data: allDataSettle } = await axios.get(
        `http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/settlement`,
      ));
      ({ data: daiOnlySettle } = await axios.get(
        `http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/settlement/DAI`,
      ));
      ({ data: daiWethSettle } = await axios.get(
        `http://localhost:7879/${API_VERSION}/${LIQUIDATION_ROOT}/settlement/DAI/WETH`,
      ))
    })

    it('has data at maturity', () => {
      expect(allDataSettle).toHaveLength(3)
      expect(daiOnlySettle).toHaveLength(3)
      expect(daiWethSettle).toHaveLength(3)
    })

    it('settles each account', async () => {
      const accounts = daiWethSettle.filter((a) => a.address !== flashSwapTokenCollateral.address.toLowerCase())
      expect(accounts.length).toBe(2)

      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < 2; i += 1) {
        const account = accounts[i]
        const daiBalanceBefore = await daiContract.balanceOf(owner.address)
        const wethBalanceBefore = await wethContract.balanceOf(owner.address)
        const cashBalance = BigNumber.from(account.pairs[0].cashBalance)

        await escrow.connect(owner).settleCashBalance(dai.id, weth.id, account.address, cashBalance)

        const daiBalanceAfter = await daiContract.balanceOf(owner.address)
        const wethBalanceAfter = await wethContract.balanceOf(owner.address)

        const daiChange = BigNumber.from(account.pairs[0].localRequired)
        const wethChange = BigNumber.from(account.pairs[0].collateralPurchased)
        expect(daiBalanceBefore.sub(daiBalanceAfter).div(100)).toEq(daiChange.div(100))
        expect(wethBalanceAfter.sub(wethBalanceBefore).div(100)).toEq(wethChange.div(100))
        expect(await escrow.cashBalances(dai.id, account.address)).toEq(BigNumber.from(0))
      }
      /* eslint-enable no-await-in-loop */
    })

    it('settles via flash swap', async () => {
      const account = daiWethSettle.find((a) => a.address === flashSwapTokenCollateral.address.toLowerCase())
      const localRequired = BigNumber.from(account.pairs[0].localRequired)
      const flashContract = new Contract(
        '0x995629b19667Ae71483DC812c1B5a35fCaaAF4B8',
        UniFlashSwapArtifact.abi,
        owner,
      ) as UniFlashSwap
      const wethBalanceBefore = await wethContract.balanceOf(flashContract.address)

      const { data } = await axios.get(
        `http://localhost:7879/v1/liquiditySource/DAI/WETH?amountSold=${localRequired.toString()}`,
      )
      const uniswapPair = new Contract(data[0].address, IUniswapV2PairArtifact.abi, owner) as IUniswapV2Pair
      const cashBalance = BigNumber.from(account.pairs[0].cashBalance)
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['bytes1', 'uint16', 'uint16', 'address', 'uint128'],
        ['0x01', dai.id, weth.id, account.address, cashBalance],
      )
      await uniswapPair.swap(localRequired, 0, flashContract.address, encodedData)

      const wethBalanceAfter = await wethContract.balanceOf(flashContract.address)

      expect(wethBalanceAfter.sub(wethBalanceBefore).gte(0)).toBe(true)
      expect(await escrow.cashBalances(dai.id, account.address)).toEq(BigNumber.from(0))
    })
  })
})
