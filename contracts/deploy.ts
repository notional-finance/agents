import {
  Contract, ContractFactory, ethers, Wallet,
} from 'ethers'
import { config } from 'dotenv'
import UniFlashSwapArtifact from './UniFlashSwap.json'

const uniswapFactoryV2Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
const escrowAddress = '0x9abd0b8868546105F6F48298eaDC1D9c82f7f683'
const mainnetAddress = {
  daiAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
  usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
}
const kovanAddress = {
  daiAddress: '0x181D62Ff8C0aEeD5Bc2Bf77A88C07235c4cc6905',
  usdcAddress: '0xF503D5cd87d10Ce8172F9e77f76ADE8109037b4c',
}

async function deployContract(owner: Wallet, artifact: any, args: any[]) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, owner)
  const txn = factory.getDeployTransaction(...args)
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
  if (process.env.NETWORK === 'kovan') {
    ({ daiAddress, usdcAddress } = kovanAddress)
  } else if (process.env.NETWORK === 'mainnet') {
    ({ daiAddress, usdcAddress } = mainnetAddress)
  } else {
    throw new Error('Unknown network')
  }

  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL as string)
  const owner = new Wallet(process.env.CONTRACT_OWNER_PK as string, provider)
  const flashSwapContract = await deployContract(owner, UniFlashSwapArtifact, [uniswapFactoryV2Address, escrowAddress])
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
