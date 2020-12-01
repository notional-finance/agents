import { Request, Response } from 'express'
import { Router } from '@awaitjs/express'
import LiquidationController from './Controller'

const LiquidatorRouter = Router({ strict: true })

/**
 * GET /v1/liquidator/accounts
 * @summary Returns all accounts in the system
 * @tags Liquidator
 * @return {array<Account>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/accounts',
  async (_req: Request, res: Response) => {
    const accounts = await LiquidationController.getAllAccounts()
    if (accounts) {
      res.send(accounts.map((c) => c.toJSON()))
    }
  })

/**
 * GET /v1/liquidator/reconcile
 * @summary Reconciles calculated settlement and liquidation figures with on chain figures, this method
 * makes rate limited calls to the ETH node so set an appropriately long timeout when calling
 * @tags Liquidator
 * @return {array<Account>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/reconcile',
  async (_req: Request, res: Response) => {
    const reconErrors = await LiquidationController.reconcile()
    res.send({ reconErrors })
  })

/**
 * GET /v1/liquidator/liquidation
 * @summary Returns accounts that can be liquidated
 * @tags Liquidator
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/liquidation',
  async (_req: Request, res: Response) => {
    const liquidatable = await LiquidationController
      .getLiquidatable()

    res.send(liquidatable.map((l) => l.toJSON()))
  })
/**
 * POST /v1/liquidator/liquidation
 * @summary Submit liquidation transactions via stored signer
 * @tags Liquidator
 * @param {Liquidate} request.body.required - liquidation request - application/json
 * @return {array<PendingTransaction>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
// .post((req: Request, res: Response) => {
// })

/**
 * GET /v1/liquidator/liquidation/{localCurrency}
 * @summary Returns accounts that can be liquidated in the specified local currency
 * @tags Liquidator
 * @param {string} localCurrency.path - symbol of local currency to be liquidated
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */

/**
 * GET /v1/liquidator/liquidation/{localCurrency}/{collateralCurrency}
 * @summary Returns accounts that can be liquidated in the specified currency pair
 * @tags Liquidator
 * @param {string} localCurrency.path - symbol of local currency to be liquidated
 * @param {string} collateralCurrency.path - symbol of local currency to be liquidated
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/liquidation/:localCurrency?/:collateralCurrency?',
  async (req: Request, res: Response) => {
    const { localCurrency, collateralCurrency } = req.params
    const liquidatable = await LiquidationController
      .getLiquidatable(localCurrency, collateralCurrency)

    res.send(liquidatable.map((l) => l.toJSON()))
  })

/**
 * GET /v1/liquidator/settlement
 * @summary Returns accounts that can be settled
 * @tags Liquidator
 * @return {array<Settleable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/settlement',
  async (_req: Request, res: Response) => {
    const settleable = await LiquidationController
      .getSettleable()

    res.send(settleable.map((l) => l.toJSON()))
  })

/**
 * GET /v1/liquidator/settlement/{localCurrency}
 * @summary Returns accounts that can be settled in the specified local currency
 * @tags Liquidator
 * @param {string} localCurrency.path - symbol of local currency to be settled
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */

/**
 * GET /v1/liquidator/settlement/{localCurrency}/{collateralCurrency}
 * @summary Returns accounts that can be settled in the specified currency pair
 * @tags Liquidator
 * @param {string} localCurrency.path - symbol of local currency to be settled
 * @param {string} collateralCurrency.path - symbol of local currency to be settled
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
LiquidatorRouter.getAsync('/settlement/:localCurrency?/:collateralCurrency?',
  async (req: Request, res: Response) => {
    const { localCurrency, collateralCurrency } = req.params
    const settleable = await LiquidationController
      .getSettleable(localCurrency, collateralCurrency)

    res.send(settleable.map((l) => l.toJSON()))
  })

export default LiquidatorRouter
