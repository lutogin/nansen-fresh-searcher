// Nansen API Types

export interface NansenConfig {
  baseUrl: string;
  apiKey: string;
  maxRequestsPerSecond: number;
  maxRequestsPerMinute: number;
  retryAttempts: number;
  timeoutMs: number;
}

export interface PaginationParams {
  page: number;
  recordsPerPage: number;
}

export interface DateRange {
  from: string | Date;
  to: string | Date;
}

export interface TimeRange {
  from: string;
  to: string;
}

// Smart Money API Types
export interface SmartMoneyHoldingsRequest {
  parameters: {
    chains?: string[];
    smFilter?: string[];
    includeStablecoin?: boolean;
    includeNativeTokens?: boolean;
    excludeSmFilter?: string[];
  };
  pagination: PaginationParams;
}

export interface SmartMoneyHoldingsResponse {
  chain: SupportedChain | 'all';
  tokenAddress: string;
  symbol: string;
  sectors: string[];
  balanceUsd: number;
  balancePctChange24H: number;
  nofHolders: string;
  shareOfHoldings: number;
  tokenAgeDays: string;
  marketCap: number;
}

export interface SmartMoneyDexTradesRequest {
  parameters: {
    chains?: string[];
    smFilter?: string[];
    excludeSmFilter?: string[];
  };
  pagination: PaginationParams;
}

export interface SmartMoneyDexTradesResponse {
  chain: SupportedChain | 'all';
  timestamp: string;
  txHash: string;
  address: string;
  name: string;
  tokenBoughtAddress: string;
  tokenBoughtSymbol: string;
  tokenBoughtAmount: number;
  tokenBoughtAgeDays: string;
  tokenBoughtMarketCap: number;
  tokenSoldAddress: string;
  tokenSoldSymbol: string;
  tokenSoldAmount: number;
  tokenSoldAgeDays: string;
  tokenSoldMarketCap: number;
  valueInUsd: number;
}

export interface SmartMoneyInflowsRequest {
  parameters: {
    chains?: string[];
    smFilter?: string[];
    includeStablecoin?: boolean;
    includeNativeTokens?: boolean;
    excludeSmFilter?: string[];
  };
  pagination: PaginationParams;
}

export interface SmartMoneyInflowsResponse {
  chain: SupportedChain | 'all';
  tokenAddress: string;
  symbol: string;
  sectors: string[];
  volume24hUSD: number;
  volume7dUSD: number;
  volume30dUSD: number;
  nofTraders: string;
  tokenAgeDays: string;
  marketCap: number;
}

// Profiler API Types
export interface AddressBalancesRequest {
  parameters: {
    chain?: SupportedChain | 'all';
    walletAddresses?: string[];
    entityId?: string;
    suspiciousFilter?: string;
  };
  pagination: PaginationParams;
}

export interface AddressBalancesResponse {
  chain: SupportedChain | 'all';
  tokenAddress: string;
  symbol: string;
  name: string;
  tokenAmount: number;
  usdValue: number;
}

export interface AddressTransactionsRequest {
  parameters: {
    chain?: SupportedChain | 'all';
    walletAddresses: string[];
    hideSpamToken?: boolean;
  };
  pagination: PaginationParams; // recordsPerPage max 500
  filters?: {
    volumeUsd?: { from?: number; to?: number };
    blockTimestamp?: DateRange;
  };
}

export interface TokenTransformData {
  symbol: string;
  amount: number;
  price: number;
  value: number;
  address: string;
  chain: SupportedChain;
  fromAddress: string;
  toAddress: string;
  fromLabel: string;
  toLabel: string;
}

export interface AddressTransactionsResponse {
  chain: SupportedChain;
  method: string;
  volumeUsd: number;
  blockTimestamp: string; // ISO format: "2025-05-13T23:59:59Z"
  transactionHashHex: string;
  source: string;
  tokenSentTransformed: TokenTransformData[];
  tokenReceivedTransformed: TokenTransformData[];
}

export interface AddressHistoricalBalancesRequest {
  parameters: {
    walletAddresses?: string[];
    entityId?: string;
    chain?: SupportedChain | 'all';
    suspiciousFilter?: string;
    timeFrame?: number;
  };
  pagination: PaginationParams;
}

// Token God Mode API Types
export interface TokenScreenerRequest {
  parameters: {
    chains: string[];
    date: DateRange;
    watchlistFilter: string[];
    sectorsFilter: string[];
    smLabelFilter?: string[];
    onlySmartMoney: boolean;
  };
  filters?: {
    tokenAgeDays?: { from?: number; to?: number };
    buyVolume?: { from?: number; to?: number };
    sellVolume?: { from?: number; to?: number };
    volume?: { from?: number; to?: number };
    liquidity?: { from?: number; to?: number };
    marketCap?: { from?: number; to?: number };
    fdv?: { from?: number; to?: number };
    netflow?: { from?: number; to?: number };
    holders?: { from?: number; to?: number };
    nofBuyers?: { from?: number; to?: number };
    nofSellers?: { from?: number; to?: number };
    nofTxs?: { from?: number; to?: number };
    nofTraders?: { from?: number; to?: number };
    priceChange?: { from?: number; to?: number };
  };
  order?: {
    orderBy?: string;
    order?: 'asc' | 'desc';
  };
  pagination: PaginationParams;
}

export interface TokenScreenerResponse {
  tokenAddressHex: string;
  chain: SupportedChain | 'all';
  logoUrl: string;
  tokenSymbol: string;
  priceUsd: number;
  tokenAgeDays: string;
  priceChange: number;
  marketCap: number;
  fdv: number;
  fdvMcRatio: number;
  buyVolume: number;
  inflowFdvRatio: number;
  outflowFdvRatio: number;
  sellVolume: number;
  volume: number;
  netflow: number;
  liquidity: number;
}

export interface TokenHoldersRequest {
  parameters: {
    chain: SupportedChain | 'all';
    tokenAddress: string;
    date: DateRange;
    isEntity?: boolean;
    includeLabels?: string[];
    label?: string;
    isStablecoin?: boolean;
  };
  pagination: PaginationParams;
}

export interface TokenDexTradesRequest {
  parameters: {
    chain: SupportedChain | 'all';
    tokenAddress: string;
    onlySmartMoney?: boolean;
    date: DateRange;
  };
  pagination: PaginationParams;
}

export interface TokenTransfersRequest {
  parameters: {
    chain: SupportedChain | 'all';
    tokenAddress: string;
    date: DateRange;
    dexIncluded?: boolean;
    cexIncluded?: boolean;
    onlySmartMoney?: boolean;
  };
  pagination: PaginationParams;
}

export type TxTypes =
  | 'transfer'
  | 'swap'
  | 'simpleSwap'
  | 'multicall'
  | 'transferAndMulticall';

export interface TokenTransfersResponse {
  fromLabel: string;
  fromAddress: string;
  toLabel: string;
  toAddress: string;
  value: number;
  valueUsd: number;
  blockTimestamp: string; // ISO format: "2025-08-01T06:46:35Z"
  transactionHash: string;
  txType: TxTypes;
}

// Fresh Wallet Detection Types
export interface FreshWallet {
  wallet: string;
  chain: SupportedChain | 'all';
  initDepositUSD: number;
}

export interface WalletDepositInfo {
  address: string;
  chain: SupportedChain | 'all';
  depositUSD: number;
  timestamp: string;
  tokenSymbol: string;
  previousBalance: number;
}

// Supported chains
export type SupportedChain =
  | 'ethereum'
  | 'solana'
  | 'arbitrum'
  | 'avalanche'
  | 'base'
  | 'berachain'
  | 'bnb'
  | 'blast'
  | 'fantom'
  | 'hyperevm'
  | 'iotaevm'
  | 'linea'
  | 'mantle'
  | 'optimism'
  | 'polygon'
  | 'ronin'
  | 'scroll'
  | 'sei'
  | 'sonic'
  | 'ton'
  | 'tron'
  | 'unichain'
  | 'zksync';

// Smart Money Labels
export type SmartMoneyLabel =
  | '30D Smart Trader'
  | '90D Smart Trader'
  | '180D Smart Trader'
  | 'Fund'
  | 'Smart Trader';

// API Response wrapper
export interface ApiResponse<T> {
  data: T[];
  success: boolean;
  message?: string;
  credits_used?: number;
}

// Rate limiting
export interface RateLimitInfo {
  requestsPerSecond: number;
  requestsPerMinute: number;
  currentRequests: number;
  resetTime: number;
}
