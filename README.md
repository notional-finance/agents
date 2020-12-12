# Notional Agent

A stateless agent that can be deployed into a cloud environment to monitor [Notional Finance](https://notional.finance) smart contracts. Currently, it can be used to monitor for liquidatable and settleable accounts. It also exposes endpoints to scrape Prometheus metrics for monitoring and alerting.

## Configuration and Deployment

An example configuration file and `docker-compose.yml` can be found in the `examples` folder. A simple flash swap liquidator is included in `contracts/UniFlashSwap.sol` and can be deployed by running the `contracts/deploy.ts` script in the same folder. An example liquidator script using [OpenZeppelin Defender](https://openzeppelin.com/defender/) is included in `examples/defender.js`.

If deploying in Kubernetes, a sample helm chart is included in `examples/notional-agent-helm`.

The Docker image is published at `https://hub.docker.com/repository/docker/notional/agents`

## API Docs

After startup, the docs for the API can be found at http://<hostname>/api-docs. This is an auto-generated Swagger doc.

# Design Considerations

- Adherence to the 12 factor app methodology: https://12factor.net/. Primarily, this means keeping the app stateless so that it can be deployed easily and safely in a cloud environment.
- Usage of [The Graph](http://thegraph.com) to reduce the number of `eth_call` requests to a blockchain node. The Graph has had issues with downtime in the past so this is a risk for a service that intends to be high availablility like this one. Potential mitigation would be to run a self hosted graph node. Our subgraph is open sourced at https://github.com/notional-finance/subgraph.
- Transaction signing is not included in the agent, the intention is for another process (potentially a cron job) to make REST request to the various endpoints and then handle transaction signing and submission.

# Local Development

Setting up the local dev environment is a work in progress. This repo uses a forked version of the `@uniswap/sdk` package to support local testing. I'm investigating a way to remove this dependency.

## Starting the Environment

`./start.sh` in the root folder will start a local test environment with a Ganache sandbox, the graph node, and the Notional Agent docker image.

## Unit Tests

Unit tests can be found in `src/**/*.spec.ts` and run with `yarn run test`. Note that running unit tests requires the local test environment to be running (it queries configuration from the graph).

## Integration Tests

Integration tests can be run with `yarn run test:integration`.

# Contributing

Contributions are welcome! You can find me on [Discord](https://discord.gg/62eX3K7) or email: jeff at notional finance. Areas where this project can be improved:

- Adding additional liquidity sources
- Improving ApolloClient integration to support multiple subgraphs
