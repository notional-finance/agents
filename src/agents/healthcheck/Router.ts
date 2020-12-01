import { Request, Response } from 'express'
import { Router } from '@awaitjs/express'
import log4js from 'log4js'
import HealthCheckController from './HealthCheckController'

const appLogger = log4js.getLogger('app')
appLogger.addContext('controller', 'healthcheck')
const HealthCheckRouter = Router({ strict: true })

/**
 * GET /healthcheck
 * @summary Returns status information for ETH node and Graph node
 * @tags Admin
 * @return {array<Liquidatable>} 200 - success response - application/json
 * @return {Error} 500 - Bad request response - application/json
 */
HealthCheckRouter.getAsync('/',
  async (_req: Request, res: Response) => {
    const healthcheck = await HealthCheckController.healthcheck()
    res.send(healthcheck)
  })

/**
 * This method is used for integration testing only
 */
HealthCheckRouter.postAsync('/faketime',
  async (req: Request, res: Response) => {
    appLogger.info(`${process.env.NODE_ENV}`)
    if (process.env.NODE_ENV === 'development') {
      process.env.FAKE_TIME = req.body.FAKE_TIME
      appLogger.info(`FAKE_TIME set to ${process.env.FAKE_TIME}, only do this for testing purposes!`)
      res.send(process.env.FAKE_TIME)
    } else {
      res.status(500).send('Invalid requiest')
    }
  })

export default HealthCheckRouter
