import {
  Contract, ContractFactory, ethers, Wallet,
} from 'ethers'
import UniFlashSwapArtifact from './UniFlashSwap.json'

const uniswapFactoryV2Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
const escrowAddress = '0x9abd0b8868546105F6F48298eaDC1D9c82f7f683'
// Mainnet Dai Address
const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'

async function deployContract(owner: Wallet, artifact: any, args: any[]) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, owner)
  const txn = factory.getDeployTransaction(...args)
  console.log(`Deploying ${artifact.contractName} with owner ${owner.address}...`)
  const receipt = await (await owner.sendTransaction(txn)).wait()
  const contract = new Contract(receipt.contractAddress as string, artifact.abi, owner)
  console.log(`Successfully deployed ${artifact.contractName} at ${contract.address}...`)

  return contract
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
  // Alternatively, ownership can be transferred via:
  // await flashSwapContract.transferOwnership(newOwner)
  const owner = new Wallet(process.env.CONTRACT_OWNER_PK as string, provider)
  const flashSwapContract = await deployContract(owner, UniFlashSwapArtifact, [uniswapFactoryV2Address, escrowAddress])

  // Must enable token allowance for Escrow contract
  await flashSwapContract.enableToken(daiAddress, ethers.constants.MaxUint256)
}

main()
  .then(() => process.exit(0))
  .catch(() => {
    console.log('error')
    process.exit(1)
  })
