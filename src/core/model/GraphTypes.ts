export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Bytes: string;
  Address: string;
  BigInt: string;
  BigDecimal: string;
};

export type RootQuery = {
  __typename?: 'RootQuery';
  accounts: Array<Account>;
};

export enum AssetType {
  /** Obligation to pay fCash */
  CashPayer = 'CashPayer',
  /** Entitlement to receive fCash */
  CashReceiver = 'CashReceiver',
  /** Represents a share of a liquidity pool */
  LiquidityToken = 'LiquidityToken'
}

export type Directory = {
  __typename?: 'Directory';
  /** Enum number of the contract in the directory */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Address of the contract referred to in the directory */
  contractAddress: Scalars['Bytes'];
};

export type Account = {
  __typename?: 'Account';
  /** Ethereum address of the account */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Cash balances held by account */
  balances: Array<CurrencyBalance>;
  /** Account's portfolio of assets at this block height */
  portfolio: Array<Asset>;
};

export type CurrencyBalance = {
  __typename?: 'CurrencyBalance';
  /** Currency balances of a single account, referenced by account:currencyId */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** References the currency that this balance is denominated in. */
  currency: Currency;
  /** Cash balance held in this currency */
  cashBalance: Scalars['BigInt'];
  /** Account that holds this balance */
  account: Account;
};

export type Asset = {
  __typename?: 'Asset';
  /** Asset held in account portfolio, referenced by account:assetId */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** ERC1155 identifier for the asset */
  assetId: Scalars['BigInt'];
  /** Reference to cash group of the asset */
  cashGroup: CashGroup;
  /** Timestamp when the asset will mature */
  maturity: Scalars['Int'];
  /** Category of the asset that dictates its behavior */
  assetType: AssetType;
  /** Exchange rate of the asset at maturity */
  rate: Scalars['Int'];
  /** Notional amount of this asset */
  notional: Scalars['BigInt'];
  /** Cash market referenced by this asset if it is fCash or a liquidity token */
  cashMarket?: Maybe<CashMarket>;
  /** Account that holds this asset */
  account: Account;
};

export type Deposit = {
  __typename?: 'Deposit';
  /** Record for a deposit made into an account, id defined by account:currency:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that performed the deposit */
  account: Account;
  /** Currency of the deposit */
  currency: Currency;
  /** Amount of the deposit */
  amount: Scalars['BigInt'];
};

export type Withdraw = {
  __typename?: 'Withdraw';
  /** Record for a withdraw made from an account, id defined by account:currency:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that performed the withdraw */
  account: Account;
  /** Currency of the withdraw */
  currency: Currency;
  /** Amount of the withdraw */
  amount: Scalars['BigInt'];
};

export type Trade = {
  __typename?: 'Trade';
  /** Trade entered into by an account, id defined by account:assetId:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that performed the trade */
  account: Account;
  /** ERC1155 identifier for the asset */
  assetId: Scalars['BigInt'];
  /** Reference to cash group of the asset */
  cashGroup: CashGroup;
  /** Maturity of the asset */
  maturity: Scalars['Int'];
  /** Category of the asset that dictates its behavior */
  assetType: AssetType;
  /** Exchange rate of the asset at maturity */
  rate: Scalars['BigDecimal'];
  /** Notional amount of this asset */
  notional: Scalars['BigInt'];
  /** The address of the cash market where this was traded */
  cashMarket?: Maybe<CashMarket>;
  /** Fee paid to the protocol when trading fCash */
  fee: Scalars['BigInt'];
  /** Interest rate implied by this trade normalized over the maturity, null for adding and removing liquidity */
  impliedInterestRate?: Maybe<Scalars['BigDecimal']>;
  /** Exchange rate between cash and fCash for this trade, null for adding and removing liquidity */
  tradeExchangeRate?: Maybe<Scalars['BigDecimal']>;
  /** Postive or negative balance change of the referenced currency from the transaction */
  netCashChange: Scalars['BigInt'];
};

export type Settlement = {
  __typename?: 'Settlement';
  /** Settlements of debts, defined by payerAccount:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that submitted the transaction to settle */
  settleAccount: Account;
  /** Account that paid currency to the receiver */
  payerAccount: Account;
  /** Local currency that the debt was settled in */
  localCurrency: Currency;
  /** Amount of local currency settled in the transaction */
  settledAmount: Scalars['BigInt'];
  /** Collateral currency (if any) that was sold to settle the debt */
  collateralCurrency?: Maybe<Currency>;
  /** Amount of deposit currency (if any) that was sold to settle the debt */
  collateralCurrencyPurchased?: Maybe<Scalars['BigInt']>;
  /** Exchange rate between the deposit currency and the local currency */
  exchangeRate?: Maybe<Scalars['BigDecimal']>;
  /** Assets of the payer traded (if any) when settling cash */
  assetsTraded?: Maybe<Array<Asset>>;
  /** Reserve balance was used to settle in the event of insolvancy */
  reserveAccountUsed: Scalars['Boolean'];
};

export type Liquidation = {
  __typename?: 'Liquidation';
  /** Liquidation of an account, defined by liquidatedAccount:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that triggered the liquidation */
  liquidator: Account;
  /** Account that was liquidated */
  liquidatedAccount: Account;
  /** Local currency that the liquidation occured in */
  localCurrency: Currency;
  /** Amount of local currency liquidated in the transaction */
  liquidatedAmount: Scalars['BigInt'];
  /** Collateral currency that was sold to cover the debt */
  collateralCurrency: Currency;
  /** Amount of deposit currency purchased by the liquidator during liquidation */
  collateralCurrencyPurchased: Scalars['BigInt'];
  /** Exchange rate between the deposit currency and the local currency */
  exchangeRate?: Maybe<Scalars['BigDecimal']>;
  /** Assets of the liquidated account traded (if any) to reduce risk */
  assetsTraded?: Maybe<Array<Trade>>;
};

export type Transfer = {
  __typename?: 'Transfer';
  /** id is fromAccount:toAccount:assetId:transactionHash:logIndex */
  id: Scalars['ID'];
  blockNumber: Scalars['Int'];
  blockTimestamp: Scalars['Int'];
  blockHash: Scalars['Bytes'];
  transactionHash: Scalars['Bytes'];
  gasUsed: Scalars['BigInt'];
  gasPrice: Scalars['BigInt'];
  /** Account that initiated the transaction */
  operator: Account;
  /** Account that the transfer originates from */
  from: Account;
  /** Account that receives the asset */
  to: Account;
  /** ERC1155 identifier for the transferred asset */
  assetId: Scalars['BigInt'];
  /** Reference to cash group of the asset */
  cashGroup: CashGroup;
  /** Category of the asset that dictates its behavior */
  assetType: AssetType;
  /** Notional amount of this asset */
  notional: Scalars['BigInt'];
  /** Timestamp when the asset will mature */
  maturity: Scalars['Int'];
  /** Cash market referenced by this asset if it is fCash or a liquidity token */
  cashMarket?: Maybe<CashMarket>;
};

export type Currency = {
  __typename?: 'Currency';
  /** ID is the currency id */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Name of the currency */
  name: Scalars['String'];
  /** Symbol of the currency */
  symbol: Scalars['String'];
  /** Address of the token */
  tokenAddress: Scalars['Bytes'];
  /** Decimal position of token balances (defaults to 18) */
  decimals: Scalars['BigInt'];
  /** Does the contract support ERC777 */
  isERC777: Scalars['Boolean'];
  /** Does the contract have transfer fees */
  hasTransferFee: Scalars['Boolean'];
};

export type ExchangeRate = {
  __typename?: 'ExchangeRate';
  /** Exchange rate between two currencies, referenced by base currency id:quote currency id */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Base currency in the exchange rate */
  baseCurrency: Currency;
  /** Quote currency in the exchange rate */
  quoteCurrency: Currency;
  /** Rate oracle that is used to reference the exchange rate */
  rateOracle: Scalars['Bytes'];
  /** Currency buffer used when calculating free collateral */
  buffer: Scalars['BigInt'];
  /** Decimals of precision for the exchange rate */
  rateDecimals: Scalars['BigInt'];
  /** Does the exchange rate need to invert */
  mustInvert: Scalars['Boolean'];
  /** Most recent rate value for the exchange rate */
  latestRate: RateValue;
};

export type PriceOracle = {
  __typename?: 'PriceOracle';
  /** Address of a chainlink price oracle, used for reverse lookup */
  id: Scalars['ID'];
  /** Exchange rate that references this chainlink oracle */
  exchangeRate?: Maybe<ExchangeRate>;
};

export type RateValue = {
  __typename?: 'RateValue';
  /** Value of an exchange rate at a point in time, referenced by base currency id:quote currency id */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Exchange rate that this rate value references */
  exchangeRate: ExchangeRate;
  /** Value of the rate, only updated on change */
  rate: Scalars['BigInt'];
};

export type SystemConfiguration = {
  __typename?: 'SystemConfiguration';
  /** ID equals the chain id */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Reserve account used as backstop, set on the Escrow contract */
  reserveAccount?: Maybe<Scalars['Bytes']>;
  /** Discount on collateral exchange given to liquidators */
  liquidationDiscount?: Maybe<Scalars['BigInt']>;
  /** Discount on collateral exchange given to settlers */
  settlementDiscount?: Maybe<Scalars['BigInt']>;
  /** Incentive for liquidating liquidity tokens */
  liquidityRepoIncentive?: Maybe<Scalars['BigInt']>;
  /** Haircut applied to liquidity token claims to account for risk */
  liquidityHaircut?: Maybe<Scalars['BigInt']>;
  /** Haircut applied to fCash value to account for risk of trading */
  fCashHaircut?: Maybe<Scalars['BigInt']>;
  /** Limit for fCashHaircut as value approaches maturity */
  fCashMaxHaircut?: Maybe<Scalars['BigInt']>;
  /** Max assets allowed in a portfolio */
  maxAssets?: Maybe<Scalars['BigInt']>;
};

export type CashGroup = {
  __typename?: 'CashGroup';
  /** Cash group that is referenced by a set of cash markets */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Number of forward maturities that an cash group can trade */
  numMaturities: Scalars['Int'];
  /** Length of each maturity in terms of seconds */
  maturityLength: Scalars['Int'];
  /** Decimals in the interest rate */
  ratePrecision: Scalars['BigInt'];
  /** Local currency that all trades occur in for this cash group */
  currency: Currency;
  /**
   * If true, this cash group is idiosyncratic, meaning that there is no on
   * chain cash market and fCash of any maturity up to periodSize can be minted off chain.
   */
  isIdiosyncratic: Scalars['Boolean'];
  /** Cash market referenced by this cash group, empty for idiosyncratic cash groups. */
  cashMarketContract?: Maybe<Scalars['Bytes']>;
  /** Current rate anchor set on the fCash contract */
  rateAnchor?: Maybe<Scalars['Int']>;
  /** Current rate scalar set on the fCash contract */
  rateScalar?: Maybe<Scalars['Int']>;
  /** Current liquidity set on the fCash contract */
  liquidityFee?: Maybe<Scalars['Int']>;
  /** Current max trade size set on the fCash contract */
  maxTradeSize?: Maybe<Scalars['BigInt']>;
  /** Current transaction fee set on the fCash contract */
  transactionFee?: Maybe<Scalars['BigInt']>;
  /** All maturities past and present for this fCash contract */
  cashMarkets: Array<CashMarket>;
};

export type CashMarket = {
  __typename?: 'CashMarket';
  /** Marketplace for a single maturity on a fCash contract */
  id: Scalars['ID'];
  lastUpdateBlockHash: Scalars['Bytes'];
  lastUpdateBlockNumber: Scalars['Int'];
  lastUpdateTimestamp: Scalars['Int'];
  lastUpdateTransactionHash: Scalars['Bytes'];
  /** Address of the parent fCash contract */
  address: Scalars['Bytes'];
  /** Block height that this market matures at */
  maturity: Scalars['Int'];
  /** Total available fCash */
  totalfCash: Scalars['BigInt'];
  /** Total available current cash */
  totalCurrentCash: Scalars['BigInt'];
  /** Total liquidity tokens in the market */
  totalLiquidity: Scalars['BigInt'];
  /** Rate anchor within this particular cash market */
  rateAnchor: Scalars['Int'];
  /** Rate scalar within this particular cash market */
  rateScalar: Scalars['Int'];
  /** Last implied rate the market traded at */
  lastImpliedRate: Scalars['Int'];
  /** Cash group referenced by this cash market */
  cashGroup: CashGroup;
};

export type Unnamed_1_QueryVariables = Exact<{ [key: string]: never; }>;

export type Unnamed_1_Query = (
  { __typename?: 'RootQuery' }
  & { accounts: Array<(
    { __typename?: 'Account' }
    & Pick<Account, 'id'>
  )> }
);
