import {
  BigNumber,
  Contract, ContractFactory, ethers, Wallet,
} from 'ethers'
import { config } from 'dotenv'
import UniFlashSwapArtifact from './UniFlashSwap.json'

const uniswapFactoryV2Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
const escrowAddress = '0x9abd0b8868546105F6F48298eaDC1D9c82f7f683'
const mainnetAddress = {
  daiAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
  usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
}
const kovanAddress = {
  daiAddress: '0x181D62Ff8C0aEeD5Bc2Bf77A88C07235c4cc6905',
  usdcAddress: '0xF503D5cd87d10Ce8172F9e77f76ADE8109037b4c',
  wethAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
}

async function deployContract(owner: Wallet, artifact: any, args: any[], gasPrice?: BigNumber) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, owner)
  const txn = factory.getDeployTransaction(...args, { gasPrice })
  console.log(`Deploying ${artifact.contractName} with owner ${owner.address}`)
  const receipt = await (await owner.sendTransaction(txn)).wait()
  const contract = new Contract(receipt.contractAddress as string, artifact.abi, owner)
  console.log(`Successfully deployed ${artifact.contractName} at ${contract.address}`)

  return contract
}

async function main() {
  const envPath = `${process.env.DOTENV_CONFIG_PATH}`
  console.log(`Loading enviromnent from ${envPath} from ${process.cwd()}`)
  config({ path: envPath })

  let daiAddress: string
  let usdcAddress: string
  let wethAddress: string
  if (process.env.NETWORK === 'kovan') {
    ({ daiAddress, usdcAddress, wethAddress } = kovanAddress)
  } else if (process.env.NETWORK === 'mainnet') {
    ({ daiAddress, usdcAddress, wethAddress } = mainnetAddress)
  } else {
    throw new Error('Unknown network')
  }

  const gasPrice = ethers.utils.parseUnits(process.env.GAS_PRICE as string, 'gwei')

  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL as string)
  const owner = new Wallet(process.env.CONTRACT_OWNER_PK as string, provider)
  const flashSwapContract = await deployContract(owner, UniFlashSwapArtifact,
    [uniswapFactoryV2Address, escrowAddress, wethAddress], gasPrice)
  // Must enable token allowance for Escrow contract
  console.log('Enabling DAI and USDC tokens on flashSwap contract')
  await (await flashSwapContract.enableToken(daiAddress, ethers.constants.MaxUint256)).wait(3)
  await (await flashSwapContract.enableToken(usdcAddress, ethers.constants.MaxUint256)).wait(3)

  console.log(`Transferring ownership to ${process.env.NEW_OWNER}`)
  await (await flashSwapContract.transferOwnership(process.env.NEW_OWNER as string)).wait(3)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
