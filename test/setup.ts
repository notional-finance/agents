import { getNowSeconds } from 'core/lib/Utils'
import {
  BigNumber, Contract, ContractFactory, ethers, Wallet,
} from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import log4js from 'log4js'
import { Escrow } from 'core/typechain/Escrow'
import { DEFAULT_SUBGRAPH } from 'config/config'
import ETHNodeClient from '../src/core/services/ETHNodeClient'
import GraphClient from '../src/core/services/GraphClient'
import { MockAggregator } from './mocks/MockAggregator'
import UniswapFactoryArtifact from './mocks/UniswapV2Factory.json'
import UniswapRouterArtifact from './mocks/UniswapV2Router02.json'
import { UniswapV2Factory } from './mocks/UniswapV2Factory'
import { UniswapV2Router02 } from './mocks/UniswapV2Router02'
import UniFlashSwapArtifact from './mocks/UniFlashSwap.json'
import { UniFlashSwap } from './mocks/UniFlashSwap'

const MockAggregatorArtifact = require('./mocks/MockAggregator.json')

const logger = log4js.getLogger('testing')

async function setupEnvironment() {
  await new Promise((resolve) => {
    GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
      resolve()
    })
  })
  logger.info('Graph client initialized')

  const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')

  return {
    dai,
  }
}

async function deployContract(owner: Wallet, artifact: any, args: any[]) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, owner)
  const txn = factory.getDeployTransaction(...args)
  logger.info(`Deploying ${artifact.contractName}...`)
  const receipt = await (await owner.sendTransaction(txn)).wait()
  const contract = new Contract(receipt.contractAddress as string, artifact.abi, owner)
  logger.info(`Successfully deployed ${artifact.contractName} at ${contract.address}...`)

  return contract
}

async function deployPrerequisites(owner: Wallet) {
  const wethAddress = GraphClient.getClient().getCurrencyBySymbol('WETH').address
  const uniswapFactory = (await deployContract(owner, UniswapFactoryArtifact, [
    owner.address,
  ])) as UniswapV2Factory

  const uniswapRouter = (await deployContract(owner, UniswapRouterArtifact, [
    uniswapFactory.address,
    wethAddress,
  ])) as UniswapV2Router02

  return { uniswapFactory, uniswapRouter }
}

async function deployUniswap(
  owner: Wallet,
  seedEthBalance: BigNumber,
  initialExchangeRate: BigNumber,
) {
  // This is set here if there is no uniswap exchange defined
  const wethAddress = GraphClient.getClient().getCurrencyBySymbol('WETH').address
  const dai = GraphClient.getClient().getCurrencyBySymbol('DAI')
  const daiContract = ETHNodeClient.getClient().getToken(dai.address)
  const { uniswapFactory, uniswapRouter } = await deployPrerequisites(owner)

  logger.info('Deploying mock uniswap')
  await uniswapFactory.connect(owner).createPair(dai.address, wethAddress)
  logger.info('Uniswap pair deployed to', await uniswapFactory.getPair(dai.address, wethAddress))

  const tokenBalance = seedEthBalance
    .mul(ethers.constants.WeiPerEther)
    .div(initialExchangeRate)

  await daiContract.connect(owner).approve(uniswapRouter.address, parseEther('100000000'))

  // This is required in ganache to get the block timestamp correct.
  logger.info('Resetting network timestamp')
  await (owner.provider as ethers.providers.JsonRpcProvider)
    .send('evm_mine', [getNowSeconds()])
  const currentBlock = await owner.provider.getBlock(await owner.provider.getBlockNumber())

  // Setup the liquidity pool
  logger.info('Seeding mock uniswap pool')
  await uniswapRouter.connect(owner).addLiquidityETH(
    dai.address,
    tokenBalance,
    tokenBalance,
    seedEthBalance,
    await uniswapRouter.signer.getAddress(),
    currentBlock.timestamp + 10000,
    { value: seedEthBalance },
  )

  logger.info(`Uniswap factory deployed to ${uniswapFactory.address}`)

  return { uniswapFactory, uniswapRouter }
}

async function deployFlashContract(owner: Wallet, uniswapFactory: UniswapV2Factory, escrow: Escrow) {
  return await deployContract(owner, UniFlashSwapArtifact, [uniswapFactory.address, escrow.address]) as UniFlashSwap
}

async function setup(
  owner: Wallet,
  tokenOnly: Wallet,
  tokenCollateral: Wallet,
  collateralOnly: Wallet,
  flashSwapTokenCollateral: Wallet,
  finalExchangeRate: BigNumber,
) {
  const { dai } = await setupEnvironment()

  const { escrow, portfolios } = ETHNodeClient.getClient().contracts
  const daiContract = ETHNodeClient.getClient().getToken(dai.address)

  const { uniswapFactory } = await deployUniswap(owner, parseEther('90000'), finalExchangeRate)

  logger.info('Deploying and enabling flash contract for DAI')
  const flashContract = await deployFlashContract(owner, uniswapFactory, escrow)
  await flashContract.enableToken(dai.address, ethers.constants.MaxUint256)

  const { cashMarket: cashMarketAddress } = await portfolios.getCashGroup(2)
  const cashMarket = ETHNodeClient.getClient().getCashMarket(cashMarketAddress)
  const maturities = await cashMarket.getActiveMaturities()

  // These two accounts will provide liquidity
  logger.info('Transferring and approving DAI to LPs')
  await daiContract.connect(owner).transfer(tokenOnly.address, parseEther('1000'))
  await daiContract.connect(owner).transfer(tokenCollateral.address, parseEther('1000'))
  await daiContract.connect(owner).transfer(flashSwapTokenCollateral.address, parseEther('1000'))
  await daiContract.connect(tokenOnly).approve(escrow.address, parseEther('100000'))
  await daiContract.connect(tokenCollateral).approve(escrow.address, parseEther('100000'))
  await daiContract.connect(flashSwapTokenCollateral).approve(escrow.address, parseEther('100000'))

  logger.info('Depositing DAI')
  await escrow.connect(tokenOnly).deposit(dai.address, parseEther('1000'))
  await escrow.connect(tokenCollateral).deposit(dai.address, parseEther('100'))
  await escrow.connect(flashSwapTokenCollateral).deposit(dai.address, parseEther('100'))

  logger.info('Depositing ETH')
  await escrow.connect(tokenOnly).depositEth({ value: parseEther('4.35') })
  await escrow.connect(tokenCollateral).depositEth({ value: parseEther('14') })
  await escrow.connect(flashSwapTokenCollateral).depositEth({ value: parseEther('14') })
  await escrow.connect(collateralOnly).depositEth({ value: parseEther('14') })

  logger.info('Providing Liquidity')
  await cashMarket.connect(tokenOnly).addLiquidity(
    maturities[0],
    parseEther('1000'),
    parseEther('1000'),
    0,
    100_000_000,
    getNowSeconds() + 10000,
  )

  await cashMarket.connect(tokenCollateral).addLiquidity(
    maturities[0],
    parseEther('100'),
    parseEther('100'),
    0,
    100_000_000,
    getNowSeconds() + 10000,
  )

  await cashMarket.connect(flashSwapTokenCollateral).addLiquidity(
    maturities[0],
    parseEther('100'),
    parseEther('100'),
    0,
    100_000_000,
    getNowSeconds() + 10000,
  )

  // Requires 140 Dai
  await cashMarket.connect(tokenOnly).takeCurrentCash(
    maturities[1],
    parseEther('900'),
    getNowSeconds() + 10000,
    100_000_000,
  )

  // Requires 1288 Dai
  await cashMarket.connect(tokenCollateral).takeCurrentCash(
    maturities[1],
    parseEther('1000'),
    getNowSeconds() + 10000,
    100_000_000,
  )

  await cashMarket.connect(flashSwapTokenCollateral).takeCurrentCash(
    maturities[1],
    parseEther('1000'),
    getNowSeconds() + 10000,
    100_000_000,
  )

  // Requires 1400 Dai
  await cashMarket.connect(collateralOnly).takeCurrentCash(
    maturities[1],
    parseEther('1000'),
    getNowSeconds() + 10000,
    100_000_000,
  )

  logger.info('Withdrawing')
  let balance: BigNumber
  balance = await escrow.cashBalances(dai.id, tokenOnly.address)
  await escrow.connect(tokenOnly).withdraw(dai.address, balance)

  balance = await escrow.cashBalances(dai.id, tokenCollateral.address)
  await escrow.connect(tokenCollateral).withdraw(dai.address, balance)

  balance = await escrow.cashBalances(dai.id, flashSwapTokenCollateral.address)
  await escrow.connect(flashSwapTokenCollateral).withdraw(dai.address, balance)

  balance = await escrow.cashBalances(dai.id, collateralOnly.address)
  await escrow.connect(collateralOnly).withdraw(dai.address, balance)
  logger.info('Done')

  const daiOracle = new Contract(dai.rateOracle, MockAggregatorArtifact.abi, owner) as MockAggregator
  await daiOracle.setAnswer(finalExchangeRate)

  return flashContract

  // Three undercollateralized accts
  // Provide in maturity[0], Borrow in maturity[1]
  // Tokens only: provide > borrow, provide * haircut < borrow
  // Tokens + collateral: provide < borrow
  // Collateral only: no provide

  // Three liquidation scnearios
  // Full: marginal FX shift
  // Partial: severe FX shift
  // Max Amount: set parameters
}

export default setup
