import { Currency } from 'core/model/Schema'
import { BigNumber, ethers } from 'ethers'

export function convertToETH(amount: BigNumber, currency: Currency, applyBuffer: boolean) {
  const buffer = applyBuffer ? currency.buffer : ethers.constants.WeiPerEther

  return currency.currentETHExchangeRate
    .mul(amount)
    .mul(buffer)
    .div(currency.rateDecimals)
    .div(currency.decimals)
}

export function convertETHTo(amount: BigNumber, currency: Currency, applyBuffer: boolean) {
  const buffer = applyBuffer ? currency.buffer : ethers.constants.WeiPerEther
  const rate = currency.rateDecimals.mul(currency.rateDecimals).div(currency.currentETHExchangeRate)

  return rate
    .mul(amount)
    .mul(currency.decimals)
    .div(currency.rateDecimals)
    .div(buffer)
}

export function convert(amount: BigNumber, baseCurrency: Currency, quoteCurrency: Currency) {
  const ethValue = convertToETH(amount, baseCurrency, false)
  const quoteValue = convertETHTo(ethValue, quoteCurrency, false)

  return quoteValue
}
