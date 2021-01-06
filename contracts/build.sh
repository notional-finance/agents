#!/bin/sh
solc use 0.6.6
solc @uniswap/=$(pwd)/node_modules/@uniswap/ \
    -o contracts/ \
    --optimize --optimize-runs 200 \
    --combined-json abi,bin \
    contracts/UniFlashSwap.sol

jq '.contracts."contracts/UniFlashSwap.sol:UniFlashSwap" | .["abi"] = (.abi | fromjson) |.["bytecode"] = .bin | del(.["bin"]) ' contracts/combined.json > contracts/UniFlashSwap.json
rm contracts/combined.json
cp contracts/UniFlashSwap.json test/mocks/UniFlashSwap.json