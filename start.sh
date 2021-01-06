#!/bin/bash
rm -Rf build
cp -R ~/code/notional-finance/subgraph/build build
export AGENT_VERSION=`jq -r '.version' package.json`
export FACTORY_ADDRESS=`yq -r '.liquiditySources[0].params.factory' compose.config.yaml`

docker-compose down
docker-compose up -d
sleep 15

# TODO: snapshot these containers as a service
graph create --node http://127.0.0.1:8020 notional-finance/local
graph deploy notional-finance/local \
    ~/code/notional-finance/subgraph/subgraph.yaml \
    --ipfs http://localhost:5001 \
    --node http://127.0.0.1:8020 \
    --output-dir ~/code/notional-finance/subgraph/build