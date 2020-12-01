import { parseEther } from 'ethers/lib/utils'
import GraphClient from 'core/services/GraphClient'
import BNExpects from 'test/utils/BNExpects'
import { DEFAULT_SUBGRAPH } from 'config/config'
import { getHaircutCashReceiverValue } from './AssetValue'
import { SECONDS_IN_YEAR } from './Utils'

expect.extend(BNExpects)

describe('Asset Value', () => {
  beforeAll((done) => {
    GraphClient.getClient(DEFAULT_SUBGRAPH.name, () => {
      done()
    })
  })

  it('calculates matured cash receiver values', () => {
    const value = getHaircutCashReceiverValue(parseEther('100'), 0, SECONDS_IN_YEAR)

    expect(value).toEq(parseEther('100'))
  })

  it('calculates matured cash receiver above max haircut', () => {
    const value = getHaircutCashReceiverValue(parseEther('100'), SECONDS_IN_YEAR + 1, SECONDS_IN_YEAR)

    expect(value).toEq(parseEther('95'))
  })

  it('calculates matured cash receiver below max haircut', () => {
    const value = getHaircutCashReceiverValue(
      parseEther('100'),
      SECONDS_IN_YEAR + SECONDS_IN_YEAR / 2,
      SECONDS_IN_YEAR,
    )

    expect(value).toEq(parseEther('75'))
  })
})
