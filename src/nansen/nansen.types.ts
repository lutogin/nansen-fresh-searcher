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
  chain: string;
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
  chain: string;
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
  chain: string;
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
    chain?: string;
    walletAddresses?: string[];
    entityId?: string;
    suspiciousFilter?: string;
  };
  pagination: PaginationParams;
}

export interface AddressBalancesResponse {
  chain: string;
  tokenAddress: string;
  symbol: string;
  name: string;
  tokenAmount: number;
  usdValue: number;
}

export interface AddressTransactionsRequest {
  parameters: {
    chain?: string;
    walletAddresses: string[];
    hideSpamToken?: boolean;
  };
  pagination: PaginationParams;
  filters?: {
    volumeUsd?: { from?: number; to?: number };
    blockTimestamp?: DateRange;
  };
}

export interface AddressTransactionsResponse {
  chain: string;
  timestamp: string;
  txHash: string;
  from: string;
  to: string;
  value: number;
  gas: number;
  gasPrice: number;
  gasUsed: number;
  status: string;
  blockNumber: number;
  volumeUsd: number;
}

export interface AddressHistoricalBalancesRequest {
  parameters: {
    walletAddresses?: string[];
    entityId?: string;
    chain?: string;
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
  chain: string;
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
    chain: string;
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
    chain: string;
    tokenAddress: string;
    onlySmartMoney?: boolean;
    date: DateRange;
  };
  pagination: PaginationParams;
}

export interface TokenTransfersRequest {
  parameters: {
    chain: string;
    tokenAddress: string;
    date: DateRange;
    dexIncluded?: boolean;
    cexIncluded?: boolean;
    onlySmartMoney?: boolean;
  };
  pagination: PaginationParams;
}

export interface TokenTransfersResponse {
  fromLabel: string;
  fromAddress: string;
  toLabel: string;
  toAddress: string;
  value: number;
  valueUsd: number;
  blockTimestamp: string; // ISO format: "2025-08-01T06:46:35Z"
  transactionHash: string;
  txType: string; // e.g., "transfer", "multicall"
}

// Fresh Wallet Detection Types
export interface FreshWallet {
  wallet: string;
  chain: string;
  initDepositUSD: number;
}

export interface WalletDepositInfo {
  address: string;
  chain: string;
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
