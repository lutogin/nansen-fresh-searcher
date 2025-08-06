import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { configService } from '../config/config.service';
import moment from 'moment';
import {
  NansenConfig,
  SmartMoneyHoldingsRequest,
  SmartMoneyHoldingsResponse,
  SmartMoneyDexTradesRequest,
  SmartMoneyDexTradesResponse,
  SmartMoneyInflowsRequest,
  SmartMoneyInflowsResponse,
  AddressBalancesRequest,
  AddressBalancesResponse,
  AddressTransactionsRequest,
  AddressTransactionsResponse,
  AddressHistoricalBalancesRequest,
  TokenScreenerRequest,
  TokenScreenerResponse,
  TokenHoldersRequest,
  TokenDexTradesRequest,
  TokenTransfersRequest,
  ApiResponse,
  SupportedChain,
  SmartMoneyLabel,
} from './nansen.types';

export class NansenApiClient {
  private client: AxiosInstance;
  private config: NansenConfig;
  private requestTimes: number[] = [];
  private minuteRequestTimes: number[] = [];

  constructor() {
    const appConfig = configService.getNansenConfig();
    this.config = {
      baseUrl: appConfig.baseUrl,
      apiKey: appConfig.apiKey,
      maxRequestsPerSecond: appConfig.maxRequestsPerSecond,
      maxRequestsPerMinute: appConfig.maxRequestsPerMinute,
      retryAttempts: appConfig.retryAttempts,
      timeoutMs: appConfig.timeoutMs,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        apiKey: this.config.apiKey,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.enforceRateLimit();
        logger.debug(`Making API request to: ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug(`API response from ${response.config.url}:`, {
          status: response.status,
          dataLength: Array.isArray(response.data)
            ? response.data.length
            : 'non-array',
        });
        return response;
      },
      async (error: AxiosError) => {
        const errorDetails = {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          code: error.code,
          data: error.response?.data,
          headers: error.response?.headers,
          requestData: error.config?.data ? this.safeParseJson(error.config.data) : null,
        };

        // Логируем каждое поле отдельно для лучшей читаемости
        logger.error('API request failed:', {
          url: errorDetails.url,
          method: errorDetails.method,
          status: errorDetails.status,
          statusText: errorDetails.statusText,
          message: errorDetails.message,
          code: errorDetails.code,
        });

        // Логируем данные ответа отдельно, если они есть
        if (errorDetails.data) {
          logger.error('API error response data:', errorDetails.data);
        }

        // Логируем данные запроса отдельно, если они есть
        if (errorDetails.requestData) {
          logger.error('API request data:', errorDetails.requestData);
        }

        // Retry logic for rate limiting (429) and server errors (5xx)
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        return Promise.reject(error);
      }
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();

    // Clean old request times (older than 1 second)
    this.requestTimes = this.requestTimes.filter((time) => now - time < 1000);

    // Clean old minute request times (older than 1 minute)
    this.minuteRequestTimes = this.minuteRequestTimes.filter(
      (time) => now - time < 60000
    );

    // Check per-second rate limit
    if (this.requestTimes.length >= this.config.maxRequestsPerSecond) {
      const waitTime = 1000 - (now - this.requestTimes[0]);
      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }

    // Check per-minute rate limit
    if (this.minuteRequestTimes.length >= this.config.maxRequestsPerMinute) {
      const waitTime = 60000 - (now - this.minuteRequestTimes[0]);
      if (waitTime > 0) {
        logger.debug(`Minute rate limit reached, waiting ${waitTime}ms`);
        await this.sleep(waitTime);
      }
    }

    // Record this request
    this.requestTimes.push(now);
    this.minuteRequestTimes.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) return false;

    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  private async retryRequest(
    error: AxiosError,
    attempt: number = 1
  ): Promise<AxiosResponse> {
    if (attempt >= this.config.retryAttempts) {
      return Promise.reject(error);
    }

    const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
    logger.warn(
      `Retrying request (attempt ${attempt + 1}/${this.config.retryAttempts}) after ${waitTime}ms`
    );

    await this.sleep(waitTime);

    try {
      return await this.client.request(error.config!);
    } catch (retryError) {
      return this.retryRequest(retryError as AxiosError, attempt + 1);
    }
  }

  // Smart Money API Methods
  async getSmartMoneyHoldings(
    request: SmartMoneyHoldingsRequest
  ): Promise<SmartMoneyHoldingsResponse[]> {
    const response = await this.client.post<SmartMoneyHoldingsResponse[]>(
      '/smart-money/holdings',
      request
    );
    return response.data;
  }

  async getSmartMoneyDexTrades(
    request: SmartMoneyDexTradesRequest
  ): Promise<SmartMoneyDexTradesResponse[]> {
    const response = await this.client.post<SmartMoneyDexTradesResponse[]>(
      '/smart-money/dex-trades',
      request
    );
    return response.data;
  }

  async getSmartMoneyInflows(
    request: SmartMoneyInflowsRequest
  ): Promise<SmartMoneyInflowsResponse[]> {
    const response = await this.client.post<SmartMoneyInflowsResponse[]>(
      '/smart-money/inflows',
      request
    );
    return response.data;
  }

  // Profiler API Methods
  async getAddressBalances(
    request: AddressBalancesRequest
  ): Promise<AddressBalancesResponse[]> {
    const response = await this.client.post<AddressBalancesResponse[]>(
      '/profiler/address/balances',
      request
    );
    return response.data;
  }

  async getAddressTransactions(
    request: AddressTransactionsRequest
  ): Promise<AddressTransactionsResponse[]> {
    const response = await this.client.post<AddressTransactionsResponse[]>(
      '/profiler/address/transactions',
      request
    );
    return response.data;
  }

  async getAddressHistoricalBalances(
    request: AddressHistoricalBalancesRequest
  ): Promise<AddressBalancesResponse[]> {
    const response = await this.client.post<AddressBalancesResponse[]>(
      '/profiler/address/historical-balances',
      request
    );
    return response.data;
  }

  async getAddressCounterparties(
    walletAddress: string,
    chain: string = 'all',
    timeRange?: { from: string; to: string }
  ): Promise<any[]> {
    const request = {
      parameters: {
        walletAddresses: [walletAddress],
        chain,
        sourceInput: 'Combined',
        groupBy: 'wallet',
        ...(timeRange && { timeRange }),
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>(
      '/profiler/address/counterparties',
      request
    );
    return response.data;
  }

  async getAddressRelatedWallets(
    walletAddress: string,
    chain: string = 'ethereum'
  ): Promise<any[]> {
    const request = {
      parameters: {
        walletAddresses: [walletAddress],
        chain,
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>(
      '/profiler/address/related-wallets',
      request
    );
    return response.data;
  }

  async getWalletPnLSummary(
    walletAddress: string,
    dateRange: { from: string; to: string },
    chain: string = 'all'
  ): Promise<any[]> {
    const request = {
      parameters: {
        walletAddress,
        date: dateRange,
        chain,
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>(
      '/profiler/address/pnl-summary',
      request
    );
    return response.data;
  }

  // Token God Mode API Methods
  async getTokenScreener(
    request: TokenScreenerRequest
  ): Promise<TokenScreenerResponse[]> {
    const response = await this.client.post<TokenScreenerResponse[]>(
      '/token-screener',
      request
    );

    return response.data;
  }

  async getTokenHolders(request: TokenHoldersRequest): Promise<any[]> {
    const response = await this.client.post<any[]>('/tgm/holders', request);
    return response.data;
  }

  async getTokenDexTrades(request: TokenDexTradesRequest): Promise<any[]> {
    const response = await this.client.post<any[]>('/tgm/dex-trades', request);
    return response.data;
  }

  async getTokenTransfers(request: TokenTransfersRequest): Promise<any[]> {
    const response = await this.client.post<any[]>('/tgm/transfers', request);

    return response.data;
  }

  async getTokenFlows(
    tokenAddress: string,
    chain: string,
    dateRange: { from: string; to: string },
    label: string = 'top_100_holders'
  ): Promise<any[]> {
    const request = {
      parameters: {
        chain,
        tokenAddress,
        date: dateRange,
        label,
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>('/tgm/flows', request);
    return response.data;
  }

  async getTokenFlowIntelligence(
    tokenAddress: string,
    chain: string,
    timeframe: string = '1d'
  ): Promise<any[]> {
    const request = {
      parameters: {
        chain,
        tokenAddress,
        timeframe,
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>(
      '/tgm/flow-intelligence',
      request
    );
    return response.data;
  }

  async getWhoBoughtSold(
    tokenAddress: string,
    chain: string,
    buyOrSell: 'BUY' | 'SELL',
    timeRange: { from: string; to: string }
  ): Promise<any[]> {
    const request = {
      parameters: {
        chain,
        buyOrSell,
        timeRange,
        tokenAddress,
      },
      pagination: {
        page: 1,
        recordsPerPage: 100,
      },
    };

    const response = await this.client.post<any[]>(
      '/tgm/who-bought-sold',
      request
    );
    return response.data;
  }

  // Helper methods for fresh wallet detection
  async getRecentTransactions(
    chains: SupportedChain[],
    dateRange: { from: string; to: string }
  ): Promise<any[]> {
    const allTransactions: any[] = [];

    for (const chain of chains) {
      try {
        const smartMoneyTrades = await this.getSmartMoneyDexTrades({
          parameters: {
            chains: [chain],
          },
          pagination: {
            page: 1,
            recordsPerPage: 1000,
          },
        });

        allTransactions.push(...smartMoneyTrades);
      } catch (error) {
        logger.warn(`Error fetching smart money trades for ${chain}:`, error);
      }
    }

    return allTransactions;
  }

  async findTokensForTickers(
    tickers: string[],
    chains: SupportedChain[]
  ): Promise<
    Map<string, { address: string; chain: string; symbol: string }[]>
  > {
    const tokenMap = new Map<
      string,
      { address: string; chain: string; symbol: string }[]
    >();

    const now = moment();
    const yesterday = moment().subtract(24, 'hours');

    // Process chains in smaller batches to avoid API limits
    const chainBatches = this.chunkArray(chains, 3); // Process 3 chains at a time

    for (const chainBatch of chainBatches) {
      for (const chain of chainBatch) {
        try {
          logger.debug(`Searching for tokens on chain: ${chain}`);

          const tokens = await this.getTokenScreener({
            parameters: {
              chains: [chain],
              date: {
                from: yesterday.format('YYYY-MM-DD'),
                to: now.format('YYYY-MM-DD'),
              },
              watchlistFilter: [],
              sectorsFilter: [],
              onlySmartMoney: false,
            },
            filters: {
              // Add some basic filters to get relevant tokens
              volume: { from: 1000 }, // Minimum $1000 volume
              marketCap: { from: 10000 }, // Minimum $10k market cap
            },
            order: {
              orderBy: 'volume',
              order: 'desc',
            },
            pagination: {
              page: 1,
              recordsPerPage: 500, // Reduced from 1000 to be safer
            },
          });

          logger.debug(`Found ${tokens.length} active tokens on ${chain}`);

          for (const token of tokens) {
            const tickerLower = token.tokenSymbol.toLowerCase();
            if (tickers.includes(tickerLower)) {
              if (!tokenMap.has(tickerLower)) {
                tokenMap.set(tickerLower, []);
              }
              tokenMap.get(tickerLower)!.push({
                address: token.tokenAddressHex,
                chain: token.chain,
                symbol: token.tokenSymbol,
              });
            }
          }

          // Add small delay between requests to be respectful to API
          await this.sleep(200);
        } catch (error) {
          logger.warn(`Failed to search tokens for chain ${chain}:`, {
            error: error instanceof Error ? error.message : error,
            chain,
          });
        }
      }
    }

    logger.info(`Token search completed. Found tokens for tickers:`, {
      foundTickers: Array.from(tokenMap.keys()),
      totalTokens: Array.from(tokenMap.values()).reduce(
        (sum, tokens) => sum + tokens.length,
        0
      ),
    });

    return tokenMap;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
