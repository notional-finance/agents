import { Request, Response } from 'express'
import { Router } from '@awaitjs/express'
import { BigNumber } from 'ethers'
import LiquiditySourceController from './Controller'

const LiquiditySourceRouter = Router({ strict: true })

/**
 * GET /v1/liquiditySource/{currencySold}/{currencyPurchased}
 * @summary Gets a list of liquidity sources for the given pair
 * @tags Liquidity Source
 * @param {string} sources - comma delimited list of sources
 * @param {string} flashOnly - only return sources that do not require initial capital
 * @param {string} amountSold - amount of currency to sell
 * @return {array<LiquidityPrice>} 200 - success response - application/json
 * @return {Error} 404 - Currency pair not supported - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquiditySourceRouter.getAsync('/:currencySold/:currencyPurchased',
  async (req: Request, res: Response) => {
    const { currencySold, currencyPurchased } = req.params
    const { amountSold } = req.query

    let amountSoldBN: BigNumber | undefined
    if (amountSold) {
      amountSoldBN = BigNumber.from(amountSold)
    }

    const sources = await LiquiditySourceController
      .getController()
      .getPurchasePrice(
        currencySold,
        currencyPurchased,
        amountSoldBN,
      )

    res.send(sources.map((s) => s.toJSON()))
  })

/**
 * GET /v1/liquiditySource
 * @summary Returns a list of supported liquidity sources and currencies
 * @tags Liquidity Source
 * @return {array<LiquiditySource>} 200 - success response - application/json
 */
LiquiditySourceRouter.getAsync('/',
  async (_req: Request, res: Response) => {
    const sources = await LiquiditySourceController
      .getController()
      .getSupportedPairs()

    res.send(sources.map((s) => ({
      ...s,
      pairs: s.pairs.map((p) => p.toJSON()),
    })))
  })

export default LiquiditySourceRouter
