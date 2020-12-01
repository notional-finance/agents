import { Request, Response } from 'express'
import { Router } from '@awaitjs/express'
import MetricsCollector from './MetricsCollector'

const MetricsCollectorRouter = Router({ strict: true })

MetricsCollectorRouter.getAsync('/metrics',
  async (_req: Request, res: Response) => {
    const controller = await MetricsCollector.getController()
    res.send(await controller.metrics(false))
  })

MetricsCollectorRouter.getAsync('/metrics.json',
  async (_req: Request, res: Response) => {
    const controller = await MetricsCollector.getController()
    res.send(await controller.metrics(true))
  })

export default MetricsCollectorRouter
