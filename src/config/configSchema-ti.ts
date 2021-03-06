/**
 * This module was automatically generated by `ts-interface-builder`
 */
import * as t from "ts-interface-checker";
// tslint:disable:object-literal-key-quotes

export const WalletSourceConfig = t.iface([], {
  "address": "string",
});

export const UniswapSourceConfig = t.iface([], {
  "factory": "string",
  "pairs": t.array("string"),
});

export const LiquiditySourceParams = t.union("WalletSourceConfig", "UniswapSourceConfig");

export const ConfigSchema = t.iface([], {
  "graphNode": t.iface([], {
    "hostname": "string",
    "indexer": "string",
    "subgraphs": t.array(t.iface([], {
      "name": "string",
      "pollingInterval": "number",
      "longPollingInterval": "number",
      "maxBlockLag": "number",
    })),
  }),
  "ethNode": t.iface([], {
    "hostname": "string",
    "network": "string",
    "retries": "number",
    "pollingIntervalMs": "number",
  }),
  "liquiditySources": t.array(t.iface([], {
    "name": "string",
    "type": "string",
    "params": "LiquiditySourceParams",
  })),
  "app": t.iface([], {
    "port": "number",
    "apiVersion": "string",
    "enableRoutes": t.array("string"),
    "reconciliationRateLimitSeconds": t.opt("number"),
    "metrics": t.iface([], {
      "enabled": "boolean",
      "prefix": t.opt("string"),
      "defaultMetricsInterval": t.opt("number"),
      "includeQueryParams": t.opt("boolean"),
    }),
  }),
});

const exportedTypeSuite: t.ITypeSuite = {
  WalletSourceConfig,
  UniswapSourceConfig,
  LiquiditySourceParams,
  ConfigSchema,
};
export default exportedTypeSuite;
