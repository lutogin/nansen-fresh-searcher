import moment from 'moment';
import { AppConfig, configService } from '../config/config.service';
import { NansenApiClient } from '../nansen/nansen.client';
import {
  FreshWallet,
  SupportedChain,
  TokenTransfersResponse,
  TxTypes,
} from '../nansen/nansen.types';
import { TgClient } from '../tg/tg.service';
import { logger } from '../utils/logger';
import { CacheService } from './cache.service';

export class FreshWalletService {
  private readonly config: AppConfig;
  private readonly nansenClient: NansenApiClient;
  private readonly cacheService: CacheService;
  private readonly configService = configService;

  constructor(nansenClient: NansenApiClient, cacheService?: CacheService) {
    this.config = configService.getConfig();
    this.nansenClient = nansenClient;
    this.cacheService = cacheService || new CacheService();
  }

  /**
   * Finds fresh wallets based on configured criteria
   * Fresh wallet = wallet that received a significant deposit of TICKER tokens (above threshold)
   * and had ZERO balance and NO previous activity before that deposit
   */
  async findFreshWallets(): Promise<FreshWallet[]> {
    try {
      logger.info('Starting fresh wallet search...');

      const symbols = await this.configService.getSymbols();
      const minDepositUSD = this.config.freshWallet.minDepositUSD;
      const freshWallets: FreshWallet[] = [];

      if (symbols.length === 0) {
        logger.warn('No symbols configured in symbols.json file');
        return [];
      }

      logger.info(
        `Searching for fresh wallets with ${symbols.join(', ')} deposits >= $${minDepositUSD}`
      );

      // Создаем ключ кеша для поиска токенов
      const tokensSearchCacheKey = CacheService.createKey(
        'tokens_search',
        symbols.sort().join(','), // Сортируем символы для консистентности ключа
        this.config.chains.sort().join(',') // Сортируем цепи для консистентности ключа
      );

      // Сначала найдем токены для указанных символов (с кешированием)
      const tokenMap = await this.cacheService.getOrSet(
        tokensSearchCacheKey,
        async () => {
          logger.info(
            `🔍 Searching tokens for symbols: ${symbols.join(', ')} in chains: ${this.config.chains.join(', ')} (not cached)`
          );
          return await this.nansenClient.findTokensForTickers(
            symbols,
            this.config.chains
          );
        }
      );

      if (!tokenMap || tokenMap.size === 0) {
        logger.warn(
          `No tokens found for specified symbols: ${symbols.join(', ')}`
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
          `No tokens found in configured chains (${this.config.chains.join(', ')}) for symbols: ${symbols.join(', ')}. Check if your symbols exist in the specified chains.`
        );
        return [];
      }

      // Обрабатываем каждый найденный токен из указанных символов в настроенных сетях
      for (const [symbol, tokens] of filteredTokenMap.entries()) {
        logger.info(
          `🔍 Analyzing ${symbol.toUpperCase()} tokens for fresh wallets (${tokens.length} tokens in configured chains)...`
        );

        for (const token of tokens) {
          try {
            const tokenFreshWallets =
              await this.findFreshWalletsForSpecificToken(
                token.address,
                token.chain,
                token.symbol,
                symbol,
                minDepositUSD
              );
            freshWallets.push(...tokenFreshWallets);

            // Отправляем уведомления для каждого найденного fresh кошелька
            for (const wallet of tokenFreshWallets) {
              try {
                await TgClient.getInstance().sendFreshWalletAlert({
                  symbol: token.symbol,
                  chain: token.chain,
                  walletAddress: wallet.wallet,
                  depositAmount: wallet.initDepositUSD,
                  // TODO: Добавить получение текущего баланса
                });
              } catch (alertError) {
                logger.warn(
                  `Failed to send alert for wallet ${wallet.wallet}:`,
                  alertError
                );
              }
            }

            logger.info(
              `✅ ${token.symbol} on ${token.chain}: found ${tokenFreshWallets.length} fresh wallets`
            );

            // Delay between tokens
            await this.sleep(100); // rate limit set up in clinet
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
        `Fresh wallet search completed. Found ${uniqueWallets.length} fresh wallets for symbols: ${symbols.join(', ')}`
      );
      return uniqueWallets;
    } catch (error) {
      logger.error('Error in fresh wallet search:', error);
      throw error;
    }
  }

  /**
   * Find fresh wallets for a specific token from configured symbols
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
      this.config.nodeEnv === 'dev' ? this.config.intervalSeconds + 60 : 7200, // +1 min for 100% intersection, 2 hour for dev
      'seconds'
    );
    const toDate = moment();

    try {
      logger.debug(
        `🔍 Analyzing ${symbol} (${ticker}) transfers on ${chain} from ${fromDate.toISOString()} to ${toDate.toISOString()}...`
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
                to: toDate.toISOString(),
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

      // Filter significant incoming and transfers only to private wallets
      const filteredIncomingTransfers = transfers.filter((transfer) =>
        this.isValidWalletTransfer(transfer)
      );

      logger.info(
        `Found ${filteredIncomingTransfers.length} significant incoming transfers for ${symbol}`
      );

      // Checking each recipient wallet for “freshness”
      for (const transfer of filteredIncomingTransfers) {
        try {
          const recipient = transfer.toAddress;
          const usdValue = transfer.valueUsd;
          const timestamp = transfer.blockTimestamp;
          const recipientLabel = transfer.toLabel;

          if (!recipient) continue;

          logger.debug(`🔍 Checking wallet ${recipient} for freshness...`);

          // CRITICALLY IMPORTANT VERIFICATION: whether the wallet was empty BEFORE this transfer.
          const wasTrulyFresh =
            await this.verifyWalletWasTrulyFreshBeforeTransfer(
              recipient,
              timestamp,
              tokenAddress,
              symbol
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

  private isValidWalletTransfer(transfer: TokenTransfersResponse): boolean {
    const usdValue = transfer.valueUsd || 0;
    const recipient = transfer.toAddress;
    const recipientLabel = transfer.toLabel;
    const transferTxTypes: TxTypes[] = ['transfer', 'swap', 'simpleSwap'];
    const minDepositUSD = configService.getFreshWalletConfig().minDepositUSD;

    // IMPORTANT: check that the recipient is a private wallet (not CEX/DEX).
    // But the sender MAY be CEX/DEX - that's fine!
    return (
      usdValue >= minDepositUSD && // todo return minDepositUSD
      transferTxTypes.includes(transfer.txType) &&
      this.isValidPrivateWallet(recipient, recipientLabel)
    );
  }

  /**
   * КРИТИЧЕСКИ ВАЖНО: Проверяет что кошелек был ДЕЙСТВИТЕЛЬНО свежим до конкретного перевода
   */
  private async verifyWalletWasTrulyFreshBeforeTransfer(
    walletAddress: string,
    transferTimestamp: string,
    tokenAddress: string,
    currentSymbol: string
  ): Promise<boolean> {
    try {
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

      // 3. КРИТИЧНО: проверяем транзакции до перевода
      const previousTransactions = allTransactions.filter((tx) => {
        const txDate = moment(tx.blockTimestamp);
        return txDate.isBefore(transferDate);
      });

      // Фильтруем транзакции, которые не связаны с нашим токеном
      const filteredPreviousTransactions = previousTransactions.filter((tx) => {
        return tx.tokenReceivedTransformed.some((token) => {
          const symbol = token.symbol.toLowerCase();
          const currentTickerLower = currentSymbol.toLowerCase();

          return symbol !== currentTickerLower;
        });
      });

      if (filteredPreviousTransactions.length > 0) {
        logger.debug(
          `${walletAddress} had ${filteredPreviousTransactions.length} previous transactions with other symbols - not fresh`
        );
        return false;
      }

      // // 4. Проверяем текущие балансы - должен быть ТОЛЬКО наш токен
      // const currentBalances = await this.nansenClient.getAddressBalances({
      //   parameters: {
      //     walletAddresses: [walletAddress],
      //     chain: 'all',
      //     suspiciousFilter: 'off',
      //   },
      //   pagination: {
      //     page: 1,
      //     recordsPerPage: 100,
      //   },
      // });

      // // Убираем наш токен и смотрим что осталось
      // const otherTokens = currentBalances.filter(
      //   (balance) =>
      //     balance.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase() &&
      //     (balance.usdValue || 0) > 1 // Больше $1
      // );

      // if (otherTokens.length > 0) {
      //   logger.debug(
      //     `${walletAddress} has other tokens: ${otherTokens.length} - not fresh`
      //   );
      //   return false;
      // }

      // // 6. Дополнительная проверка - исторические балансы
      // try {
      //   const historicalBalances =
      //     await this.nansenClient.getAddressHistoricalBalances({
      //       parameters: {
      //         walletAddresses: [walletAddress],
      //         chain: 'all',
      //         timeFrame: 30, // 30 дней назад
      //         suspiciousFilter: 'off',
      //       },
      //       pagination: {
      //         page: 1,
      //         recordsPerPage: 100,
      //       },
      //     });

      //   // Если есть исторические балансы > $1 - не свежий
      //   const hadHistoricalBalance = historicalBalances.some(
      //     (balance) => (balance.usdValue || 0) > 1
      //   );

      //   if (hadHistoricalBalance) {
      //     logger.debug(`${walletAddress} had historical balances - not fresh`);
      //     return false;
      //   }
      // } catch (error) {
      //   logger.debug(
      //     `Could not get historical balances for ${walletAddress}, continuing...`
      //   );
      // }

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
  private isValidPrivateWallet(address: string, label: string): boolean {
    const regexpWallet = /^\[[^\s]*$/gm;
    // Простые эвристики для фильтрации известных типов адресов
    const lowerAddress = address.toLowerCase();

    // Известные паттерны CEX/DEX адресов (можно расширить)
    const knownAddressPatterns = [
      // Общие паттерны контрактов (много нулей в начале или конце)
      /^0x0{10,}/,
      /0{10,}$/,
    ];

    for (const pattern of knownAddressPatterns) {
      if (typeof pattern === 'string' && lowerAddress === pattern) {
        return false;
      }

      if (pattern instanceof RegExp && pattern.test(lowerAddress)) {
        return false;
      }
    }

    return regexpWallet.test(label);
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
}
