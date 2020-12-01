import { ethers, BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import BNExpects from 'test/utils/BNExpects'
import { CurrencyQueryResult } from '../model/queries/CurrenciesQuery'
import { convertToETH, convertETHTo, convert } from './ExchangeRate'

import { Currency } from '../model/Schema'

expect.extend(BNExpects)

describe('Exchange Rates', () => {
  const invertRateCurrency = new Currency({
    id: '1',
    name: 'Test',
    symbol: 'Test',
    address: ethers.constants.AddressZero,
    decimals: BigNumber.from(1e6).toString(),
    ethExchangeRate: [{
      rateDecimals: BigNumber.from(1e6).toString(),
      rateOracle: ethers.constants.AddressZero,
      buffer: parseEther('1.4').toString(),
      mustInvert: true,
      latestRate: {
        rate: BigNumber.from(100e6).toString(),
      },
    }],
  } as unknown as CurrencyQueryResult)

  const currency = new Currency({
    id: '2',
    name: 'Test',
    symbol: 'Test',
    address: ethers.constants.AddressZero,
    decimals: ethers.constants.WeiPerEther.toString(),
    ethExchangeRate: [{
      rateDecimals: ethers.constants.WeiPerEther.toString(),
      rateOracle: ethers.constants.AddressZero,
      buffer: parseEther('1.4').toString(),
      mustInvert: false,
      latestRate: {
        rate: parseEther('0.01').toString(),
      },
    }],
  } as unknown as CurrencyQueryResult)

  it('currency object should store inverted exchange rates', () => {
    expect(invertRateCurrency.currentETHExchangeRate).toEq(BigNumber.from(0.01e6))
  })

  it('convert to eth', () => {
    const ethValue = convertToETH(BigNumber.from(1e6), invertRateCurrency, false)
    expect(ethValue).toEq(parseEther('0.01'))
  })

  it('convert to eth with buffer', () => {
    const ethValue = convertToETH(BigNumber.from(1e6), invertRateCurrency, true)
    expect(ethValue).toEq(parseEther('0.014'))
  })

  it('convert from eth', () => {
    const ethValue = convertETHTo(parseEther('1'), invertRateCurrency, false)
    expect(ethValue).toEq(BigNumber.from(100e6))
  })

  it('convert from eth with buffer', () => {
    const ethValue = convertETHTo(parseEther('1'), invertRateCurrency, true)
    expect(ethValue).toEq(BigNumber.from(71428571))
  })

  it('convert between base and quote', () => {
    const value1 = convert(parseEther('1'), currency, invertRateCurrency)
    expect(value1).toEq(BigNumber.from(1e6))

    const value2 = convert(BigNumber.from(1e6), invertRateCurrency, currency)
    expect(value2).toEq(ethers.constants.WeiPerEther)
  })
})
