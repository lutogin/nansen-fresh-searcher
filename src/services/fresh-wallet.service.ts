import moment from 'moment';
import { AppConfig, configService } from '../config/config.service';
import { NansenApiClient } from '../nansen/nansen.client';
import {
  FreshWallet,
  SupportedChain,
  TokenTransfersResponse,
} from '../nansen/nansen.types';
import { logger } from '../utils/logger';

export class FreshWalletService {
  private readonly config: AppConfig;
  private readonly nansenClient: NansenApiClient;

  constructor(nansenClient: NansenApiClient) {
    this.config = configService.getConfig();
    this.nansenClient = nansenClient;
  }

  /**
   * Finds fresh wallets based on configured criteria
   * Fresh wallet = wallet that received a significant deposit of TICKER tokens (above threshold)
   * and had ZERO balance and NO previous activity before that deposit
   */
  async findFreshWallets(): Promise<FreshWallet[]> {
    try {
      logger.info('Starting fresh wallet search...');

      const tickers = this.config.tickers;
      const minDepositUSD = this.config.freshWallet.minDepositUSD;
      const freshWallets: FreshWallet[] = [];

      logger.info(
        `Searching for fresh wallets with ${tickers.join(', ')} deposits >= $${minDepositUSD}`
      );

      // Сначала найдем токены для указанных тикеров
      const tokenMap = await this.nansenClient.findTokensForTickers(
        tickers,
        this.config.chains
      );

      if (tokenMap.size === 0) {
        logger.warn(
          `No tokens found for specified tickers: ${tickers.join(', ')}`
        );
        return [];
      }

      // Фильтруем токены только для сетей из конфигурации
      const configuredChains: Set<SupportedChain> = new Set(this.config.chains);
      const filteredTokenMap = new Map<
        string,
        { address: string; chain: SupportedChain; symbol: string }[]
      >();

      for (const [ticker, tokens] of tokenMap.entries()) {
        const filteredTokens = tokens.filter((token) =>
          configuredChains.has(token.chain)
        );

        if (filteredTokens.length > 0) {
          filteredTokenMap.set(ticker, filteredTokens);
        }
      }

      if (filteredTokenMap.size === 0) {
        logger.warn(
          `No tokens found in configured chains (${this.config.chains.join(', ')}) for tickers: ${tickers.join(', ')}. Check if your tickers exist in the specified chains.`
        );
        return [];
      }

      // Обрабатываем каждый найденный токен из указанных тикеров в настроенных сетях
      for (const [ticker, tokens] of filteredTokenMap.entries()) {
        logger.info(
          `🔍 Analyzing ${ticker.toUpperCase()} tokens for fresh wallets (${tokens.length} tokens in configured chains)...`
        );

        for (const token of tokens) {
          try {
            const tokenFreshWallets =
              await this.findFreshWalletsForSpecificToken(
                token.address,
                token.chain,
                token.symbol,
                ticker,
                minDepositUSD
              );
            freshWallets.push(...tokenFreshWallets);

            logger.info(
              `✅ ${token.symbol} on ${token.chain}: found ${tokenFreshWallets.length} fresh wallets`
            );

            // Delay between tokens
            await this.sleep(200);
          } catch (error) {
            logger.warn(
              `❌ Failed to analyze ${token.symbol} on ${token.chain}:`,
              error
            );
          }
        }
      }

      // Remove duplicates and sort by deposit amount
      const uniqueWallets = this.removeDuplicateWallets(freshWallets);
      uniqueWallets.sort((a, b) => b.initDepositUSD - a.initDepositUSD);

      logger.info(
        `Fresh wallet search completed. Found ${uniqueWallets.length} fresh wallets for tickers: ${tickers.join(', ')}`
      );
      return uniqueWallets;
    } catch (error) {
      logger.error('Error in fresh wallet search:', error);
      throw error;
    }
  }

  /**
   * Find fresh wallets for a specific token from TICKERS
   */
  private async findFreshWalletsForSpecificToken(
    tokenAddress: string,
    chain: SupportedChain,
    symbol: string,
    ticker: string,
    minDepositUSD: number
  ): Promise<FreshWallet[]> {
    const freshWallets: FreshWallet[] = [];
    const fromDate = moment().subtract(
      this.config.nodeEnv === 'dev' ? this.config.intervalSeconds + 60 : 86400, // +1 min for 100% intersection, 1 day for dev
      'seconds'
    );

    try {
      logger.debug(
        `🔍 Analyzing ${symbol} (${ticker}) transfers on ${chain}...`
      );

      // Get transfers for the specific token
      const transfers = [];
      const recordsPerPage = 500;

      for (let page = 1; true; page += 1) {
        const transfersChunk: TokenTransfersResponse[] =
          await this.nansenClient.getTokenTransfers({
            parameters: {
              chain,
              tokenAddress,
              date: {
                from: fromDate.toISOString(),
                to: moment().toISOString(),
              },
              dexIncluded: true,
              cexIncluded: true,
              onlySmartMoney: false,
            },
            pagination: {
              page,
              recordsPerPage,
            },
          });

        transfers.push(...transfersChunk);

        if (transfersChunk.length < recordsPerPage) {
          break;
        }
      }

      // Filter significant incoming transfers only to private wallets
      const significantIncomingTransfers = transfers.filter((transfer) => {
        const usdValue = transfer.valueUsd || 0;
        const recipient = transfer.toAddress;

        // IMPORTANT: check that the recipient is a private wallet (not CEX/DEX).
        // But the sender MAY be CEX/DEX - that's fine!
        return (
          usdValue >= minDepositUSD &&
          recipient &&
          this.isValidPrivateWallet(recipient)
        );
      });

      logger.info(
        `Found ${significantIncomingTransfers.length} significant incoming transfers for ${symbol}`
      );

      // Checking each recipient wallet for “freshness”
      for (const transfer of significantIncomingTransfers) {
        try {
          const recipient = transfer.toAddress;
          const usdValue = transfer.valueUsd;
          const timestamp = transfer.blockTimestamp;

          if (!recipient) continue;

          logger.debug(`🔍 Checking wallet ${recipient} for freshness...`);

          // CRITICALLY IMPORTANT VERIFICATION: whether the wallet was empty BEFORE this transfer.
          const wasTrulyFresh =
            await this.verifyWalletWasTrulyFreshBeforeTransfer(
              recipient,
              chain,
              timestamp,
              tokenAddress,
              usdValue
            );

          if (wasTrulyFresh) {
            freshWallets.push({
              wallet: recipient,
              chain,
              initDepositUSD: usdValue,
            });

            logger.info(
              `🎯 FRESH WALLET FOUND: ${recipient} on ${chain} - $${usdValue.toFixed(2)} (${symbol}/${ticker})`
            );
          } else {
            logger.debug(
              `❌ Wallet ${recipient} had previous activity - not fresh`
            );
          }
        } catch (error) {
          logger.debug('Error checking wallet:', error);
        }
      }
    } catch (error) {
      logger.debug(`Error analyzing ${symbol} transfers:`, error);
    }

    return freshWallets;
  }

  /**
   * КРИТИЧЕСКИ ВАЖНО: Проверяет что кошелек был ДЕЙСТВИТЕЛЬНО свежим до конкретного перевода
   */
  private async verifyWalletWasTrulyFreshBeforeTransfer(
    walletAddress: string,
    chain: SupportedChain,
    transferTimestamp: string,
    tokenAddress: string,
    transferAmountUSD: number
  ): Promise<boolean> {
    try {
      // 1. Проверяем что это приватный кошелек (не CEX/DEX/контракт)
      if (!this.isValidPrivateWallet(walletAddress)) {
        logger.debug(`${walletAddress} is not a private wallet`);
        return false;
      }

      // 2. Получаем ВСЮ историю транзакций кошелька
      const allTransactions = await this.nansenClient.getAddressTransactions({
        parameters: {
          walletAddresses: [walletAddress],
          chain: 'all',
          hideSpamToken: true,
        },
        pagination: {
          page: 1,
          recordsPerPage: 100,
        },
        filters: {
          volumeUsd: { from: 100 },
        },
      });

      const transferDate = moment(transferTimestamp);

      // 3. КРИТИЧНО: проверяем что НЕ БЫЛО транзакций ДО нашего перевода
      const previousTransactions = allTransactions.filter((tx) => {
        const txDate = moment(tx.blockTimestamp);
        return txDate.isBefore(transferDate);
      });

      if (previousTransactions.length > 0) {
        logger.debug(
          `${walletAddress} had ${previousTransactions.length} previous transactions - not fresh`
        );
        return false;
      }

      // 4. Проверяем текущие балансы - должен быть ТОЛЬКО наш токен
      const currentBalances = await this.nansenClient.getAddressBalances({
        parameters: {
          walletAddresses: [walletAddress],
          chain: 'all',
          suspiciousFilter: 'off',
        },
        pagination: {
          page: 1,
          recordsPerPage: 100,
        },
      });

      // Убираем наш токен и смотрим что осталось
      const otherTokens = currentBalances.filter(
        (balance) =>
          balance.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase() &&
          (balance.usdValue || 0) > 1 // Больше $1
      );

      if (otherTokens.length > 0) {
        logger.debug(
          `${walletAddress} has other tokens: ${otherTokens.length} - not fresh`
        );
        return false;
      }

      // 5. Дополнительная проверка - исторические балансы
      try {
        const historicalBalances =
          await this.nansenClient.getAddressHistoricalBalances({
            parameters: {
              walletAddresses: [walletAddress],
              chain: 'all',
              timeFrame: 30, // 30 дней назад
              suspiciousFilter: 'off',
            },
            pagination: {
              page: 1,
              recordsPerPage: 100,
            },
          });

        // Если есть исторические балансы > $1 - не свежий
        const hadHistoricalBalance = historicalBalances.some(
          (balance) => (balance.usdValue || 0) > 1
        );

        if (hadHistoricalBalance) {
          logger.debug(`${walletAddress} had historical balances - not fresh`);
          return false;
        }
      } catch (error) {
        logger.debug(
          `Could not get historical balances for ${walletAddress}, continuing...`
        );
      }

      logger.debug(`✅ ${walletAddress} verified as truly fresh wallet`);
      return true;
    } catch (error) {
      logger.debug(
        `Error verifying wallet freshness for ${walletAddress}:`,
        error
      );
      return false;
    }
  }

  /**
   * Проверяет что адрес - это приватный кошелек (не CEX/DEX/контракт)
   */
  private isValidPrivateWallet(address: string): boolean {
    // Простые эвристики для фильтрации известных типов адресов
    const lowerAddress = address.toLowerCase();

    // Известные паттерны CEX/DEX адресов (можно расширить)
    const knownPatterns = [
      // Uniswap
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
      '0xe592427a0aece92de3edee1f18e0157c05861564',
      // Общие паттерны контрактов (много нулей в начале или конце)
      /^0x0{10,}/,
      /0{10,}$/,
    ];

    for (const pattern of knownPatterns) {
      if (typeof pattern === 'string' && lowerAddress === pattern) {
        return false;
      }
      if (pattern instanceof RegExp && pattern.test(lowerAddress)) {
        return false;
      }
    }

    // Дополнительные проверки можно добавить
    return true;
  }

  /**
   * Helper method to add delays between requests
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper method to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Removes duplicate wallets based on address and chain
   */
  private removeDuplicateWallets(wallets: FreshWallet[]): FreshWallet[] {
    const seen = new Set<string>();
    const unique: FreshWallet[] = [];

    for (const wallet of wallets) {
      const key = `${wallet.wallet}:${wallet.chain}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(wallet);
      }
    }

    return unique;
  }

  /**
   * Enhanced fresh wallet detection using Smart Money flows
   */
  async findFreshWalletsWithSmartMoney(): Promise<FreshWallet[]> {
    try {
      logger.info('Starting smart money enhanced fresh wallet search...');

      const freshWallets: FreshWallet[] = [];
      const minDepositUSD = configService.getFreshWalletConfig().minDepositUSD;

      // Get recent smart money activity using moment
      const dateRange = {
        from: moment().subtract(24, 'hours').format('YYYY-MM-DD'),
        to: moment().format('YYYY-MM-DD'),
      };

      // Get smart money trades to find new wallet activity
      const smartTrades = await this.nansenClient.getSmartMoneyDexTrades({
        parameters: {
          chains: this.config.chains,
        },
        pagination: {
          page: 1,
          recordsPerPage: 500,
        },
      });

      // Analyze addresses involved in smart money trades
      const uniqueAddresses = new Set<string>();
      smartTrades.forEach((trade) => {
        uniqueAddresses.add(trade.address);
      });

      logger.info(
        `Analyzing ${uniqueAddresses.size} addresses from smart money trades`
      );

      // Check each address for freshness
      for (const address of Array.from(uniqueAddresses).slice(0, 50)) {
        // Limit for performance
        try {
          const isNew = await this.checkIfWalletWasPreviouslyEmpty(
            address,
            'ethereum'
          );
          if (isNew) {
            // Calculate total smart money activity value
            const addressTrades = smartTrades.filter(
              (trade) => trade.address === address
            );
            const totalValue = addressTrades.reduce(
              (sum, trade) => sum + trade.valueInUsd,
              0
            );

            if (totalValue >= minDepositUSD) {
              freshWallets.push({
                wallet: address,
                chain: 'ethereum', // Default chain for smart money analysis
                initDepositUSD: totalValue,
              });
            }
          }
        } catch (error) {
          logger.debug(
            `Failed to analyze smart money address ${address}:`,
            error
          );
        }
      }

      logger.info(
        `Found ${freshWallets.length} fresh wallets through smart money analysis`
      );
      return freshWallets;
    } catch (error) {
      logger.error('Error in smart money enhanced fresh wallet search:', error);
      return [];
    }
  }

  /**
   * Checks if wallet had zero balance before recent activity
   */
  private async checkIfWalletWasPreviouslyEmpty(
    walletAddress: string,
    chain: SupportedChain
  ): Promise<boolean> {
    try {
      // Get historical balances for the past 7 days
      const historicalBalances =
        await this.nansenClient.getAddressHistoricalBalances({
          parameters: {
            walletAddresses: [walletAddress],
            chain: 'all',
            timeFrame: 7, // Look back 7 days
            suspiciousFilter: 'off',
          },
          pagination: {
            page: 1,
            recordsPerPage: 100,
          },
        });

      // If no historical data or all balances were near zero, consider it fresh
      if (historicalBalances.length === 0) {
        return true;
      }

      // Check if any historical balance was significant (> $10)
      const hadSignificantBalance = historicalBalances.some((balance) => {
        const usdValue = balance.usdValue || 0;
        return usdValue > 10; // Threshold for "significant" balance
      });

      return !hadSignificantBalance;
    } catch (error) {
      // If we can't get historical data, we'll use alternative methods
      logger.debug(
        `Could not get historical balances for ${walletAddress}, using alternative check`
      );
      return await this.checkWalletFreshnessAlternative(walletAddress, chain);
    }
  }

  /**
   * Alternative method to check wallet freshness using current balance vs recent activity
   */
  private async checkWalletFreshnessAlternative(
    walletAddress: string,
    chain: SupportedChain
  ): Promise<boolean> {
    try {
      // Get current balances
      const currentBalances = await this.nansenClient.getAddressBalances({
        parameters: {
          walletAddresses: [walletAddress],
          chain: 'all',
          suspiciousFilter: 'off',
        },
        pagination: {
          page: 1,
          recordsPerPage: 100,
        },
      });

      // Get recent transactions to see if this is the first significant activity
      const recentTransactions = await this.nansenClient.getAddressTransactions(
        {
          parameters: {
            walletAddresses: [walletAddress],
            chain: 'all',
            hideSpamToken: true,
          },
          pagination: {
            page: 1,
            recordsPerPage: 100,
          },
          filters: {
            volumeUsd: { from: 100 }, // Only significant transactions
          },
        }
      );

      // If very few transactions and recent activity, likely fresh
      const hasLimitedHistory = recentTransactions.length < 10;

      // Check if first transaction was recent (within last 30 days)
      const now = moment();
      const thirtyDaysAgo = moment().subtract(30, 'days');

      const firstTransaction = recentTransactions.sort(
        (a, b) =>
          moment(a.blockTimestamp).valueOf() -
          moment(b.blockTimestamp).valueOf()
      )[0];

      const isRecentFirstActivity =
        firstTransaction &&
        moment(firstTransaction.blockTimestamp).isAfter(thirtyDaysAgo);

      return hasLimitedHistory && isRecentFirstActivity;
    } catch (error) {
      logger.debug(
        `Alternative freshness check failed for ${walletAddress}:`,
        error
      );
      // Default to considering it fresh if we can't determine otherwise
      return true;
    }
  }
}

// Note: No global instance exported - use dependency injection instead
