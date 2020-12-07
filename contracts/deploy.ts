import {
  Contract, ContractFactory, ethers, Wallet,
} from 'ethers'
import UniFlashSwapArtifact from './UniFlashSwap.json'

const uniswapFactoryV2Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
const escrowAddress = '0x9abd0b8868546105F6F48298eaDC1D9c82f7f683'
// Mainnet Dai Address
const daiAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
// Notional Kovan Test Dai address
// const daiAddress = '0x181D62Ff8C0aEeD5Bc2Bf77A88C07235c4cc6905'

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
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL as string)
  const owner = new Wallet(process.env.CONTRACT_OWNER_PK as string, provider)
  const flashSwapContract = await deployContract(owner, UniFlashSwapArtifact, [uniswapFactoryV2Address, escrowAddress])
  // Alternatively, ownership can be transferred via:
  // Must enable token allowance for Escrow contract
  console.log(`Enabling ${daiAddress} token on flashSwap contract`)
  await (await flashSwapContract.enableToken(daiAddress, ethers.constants.MaxUint256)).wait(3)

  // await flashSwapContract.transferOwnership(newOwner)
  console.log(`Transferring ownership to ${process.env.NEW_OWNER}`)
  await (await flashSwapContract.transferOwnership(process.env.NEW_OWNER as string)).wait(3)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
