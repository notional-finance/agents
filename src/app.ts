import express, { Request, Response } from 'express'
import compression from 'compression'
import log4js from 'log4js'
import bodyParser from 'body-parser'
import expressJSDocSwagger from 'express-jsdoc-swagger'
import apiMetrics from 'prometheus-api-metrics'
import {
  PORT, API_VERSION, METRICS, RUN_LIQUIDATOR,
} from 'config/config'

import LiquiditySourceRouter from 'agents/liquiditySources/Router'
import HealthCheckRouter from 'agents/healthcheck/Router'
import LiquidatorRouter from 'agents/liquidator/Router'
import MetricsCollectorRouter from 'agents/metrics/Router'
import GraphClient from 'core/services/GraphClient'

const httpLogger = log4js.getLogger('http')
const appLogger = log4js.getLogger('app')

const app = express()
// This will kick off initialization as soon as possible
GraphClient.getClient()

app.use(compression())
app.use(log4js.connectLogger(httpLogger, {
  level: 'auto',
  format: (req, _res, format) => format(`:remote-addr :method :url :status ${JSON.stringify(req.body)}`),
})) // HTTP request logging

// HTTP POST parsing
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use('/healthcheck', HealthCheckRouter)
// Enables default express metrics
if (METRICS.enabled) {
  app.use(apiMetrics({
    metricsPrefix: METRICS.prefix || 'notional_agent',
    defaultMetricsInterval: METRICS.defaultMetricsInterval || 10000,
    includeQueryParams: METRICS.includeQueryParams || true,
  }))
  app.use('/notional', MetricsCollectorRouter)
}

if (RUN_LIQUIDATOR) {
  app.use(`/${API_VERSION}/liquidator`, LiquidatorRouter)
}

app.use(`/${API_VERSION}/liquiditySource`, LiquiditySourceRouter)

// Adds swagger documentation
expressJSDocSwagger(app)(
  {
    info: {
      version: `${API_VERSION}`,
      title: 'Notional Agents',
      license: {
        name: 'GPLv3-only',
      },
    },
    filesPattern: ['./**/*.ts', './**/*.js'],
    swaggerUIPath: '/api-docs',
    baseDir: __dirname,
  },
)

// limiter https://github.com/jhurliman/node-rate-limiter

app.use((_req: Request, res: Response) => {
  res.send('404').status(404)
})

app.listen(PORT, () => {
  appLogger.info(`Server is listening on port ${PORT}`)
})
