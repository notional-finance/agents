# Notional Agent

A stateless agent that can be deployed into a cloud environment to monitor [Notional Finance](https://notional.finance) smart contracts. Currently, it can be used to monitor for liquidatable and settleable accounts. It also exposes endpoints to scrape Prometheus metrics for monitoring and alerting.

## Configuration and Deployment

An example configuration file and docker-compose.yml can be found in the example folder.

## API Docs

After startup, the docs for the API can be found at http://<hostname>/api-docs. This is an auto-generated Swagger doc.

# Design Considerations

- Adherence to the 12 factor app methodology: https://12factor.net/. Primarily, this means keeping the app stateless so that it can be deployed easily and safely in a cloud environment.
- Usage of [The Graph](http://thegraph.com) to reduce the number of `eth_call` requests to a blockchain node. The Graph has had issues with downtime in the past so this is a risk for a service that intends to be high availablility like this one. Potential mitigation would be to run a self hosted graph node. Our subgraph is open sourced at https://github.com/notional-finance/subgraph.
- Transaction signing is not included in the agent, the intention is for another process (potentially a cron job) to make REST request to the various endpoints and then handle transaction signing and submission.

# Contributing

Contributions are welcome! You can find me on [Discord](https://discord.gg/62eX3K7) or email: jeff at notional finance.
