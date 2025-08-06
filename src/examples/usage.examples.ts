import { nansenClient } from '../nansen/nansen.client';
import { freshWalletService } from '../services/fresh-wallet.service';
import { logger } from '../utils/logger';

/**
 * Example usage of the Nansen API client
 */
export class NansenApiExamples {
  /**
   * Example: Get Smart Money Holdings
   */
  static async getSmartMoneyHoldingsExample(): Promise<void> {
    try {
      logger.info('Fetching Smart Money Holdings...');

      const holdings = await nansenClient.getSmartMoneyHoldings({
        parameters: {
          chains: ['ethereum', 'solana'],
          smFilter: ['180D Smart Trader', 'Fund', 'Smart Trader'],
          includeStablecoin: true,
          includeNativeTokens: true,
        },
        pagination: {
          page: 1,
          recordsPerPage: 10,
        },
      });

      logger.info(
        `Found ${holdings.length} smart money holdings:`,
        holdings.slice(0, 3).map((h) => ({
          chain: h.chain,
          symbol: h.symbol,
          balanceUsd: h.balanceUsd,
          balancePctChange24H: h.balancePctChange24H,
        }))
      );
    } catch (error) {
      logger.error('Error fetching smart money holdings:', error);
    }
  }

  /**
   * Example: Get Recent Smart Money Trades
   */
  static async getSmartMoneyTradesExample(): Promise<void> {
    try {
      logger.info('Fetching Smart Money DEX Trades...');

      const trades = await nansenClient.getSmartMoneyDexTrades({
        parameters: {
          chains: ['ethereum', 'solana'],
        },
        pagination: {
          page: 1,
          recordsPerPage: 10,
        },
      });

      logger.info(
        `Found ${trades.length} smart money trades:`,
        trades.slice(0, 3).map((t) => ({
          chain: t.chain,
          timestamp: t.timestamp,
          tokenBought: t.tokenBoughtSymbol,
          tokenSold: t.tokenSoldSymbol,
          valueUsd: t.valueInUsd,
        }))
      );
    } catch (error) {
      logger.error('Error fetching smart money trades:', error);
    }
  }

  /**
   * Example: Analyze Wallet Balance
   */
  static async analyzeWalletExample(walletAddress: string): Promise<void> {
    try {
      logger.info(`Analyzing wallet: ${walletAddress}`);

      // Get current balances
      const balances = await nansenClient.getAddressBalances({
        parameters: {
          walletAddresses: [walletAddress],
          chain: 'all',
        },
        pagination: {
          page: 1,
          recordsPerPage: 50,
        },
      });

      const totalUsdValue = balances.reduce(
        (sum, balance) => sum + balance.usdValue,
        0
      );

      logger.info(`Wallet ${walletAddress} analysis:`, {
        totalTokens: balances.length,
        totalUsdValue: totalUsdValue.toFixed(2),
        topTokens: balances
          .sort((a, b) => b.usdValue - a.usdValue)
          .slice(0, 5)
          .map((b) => ({ symbol: b.symbol, usdValue: b.usdValue.toFixed(2) })),
      });
    } catch (error) {
      logger.error(`Error analyzing wallet ${walletAddress}:`, error);
    }
  }

  /**
   * Example: Get Token Transfers
   */
  static async getTokenTransfersExample(
    tokenAddress: string,
    chain: string
  ): Promise<void> {
    try {
      logger.info(
        `Fetching transfers for token ${tokenAddress} on ${chain}...`
      );

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const transfers = await nansenClient.getTokenTransfers({
        parameters: {
          chain,
          tokenAddress,
          date: {
            from: yesterday.toISOString().split('T')[0],
            to: now.toISOString().split('T')[0],
          },
          dexIncluded: true,
          cexIncluded: true,
        },
        pagination: {
          page: 1,
          recordsPerPage: 20,
        },
      });

      logger.info(`Found ${transfers.length} transfers in the last 24 hours`);
    } catch (error) {
      logger.error(`Error fetching token transfers:`, error);
    }
  }

  /**
   * Example: Screen for New Tokens
   */
  static async screenForNewTokensExample(): Promise<void> {
    try {
      logger.info('Screening for new tokens with smart money activity...');

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const tokens = await nansenClient.getTokenScreener({
        parameters: {
          chains: ['ethereum', 'solana'],
          date: {
            from: yesterday.toISOString().split('T')[0],
            to: now.toISOString().split('T')[0],
          },
          onlySmartMoney: true,
        },
        filters: {
          tokenAgeDays: { from: 1, to: 7 }, // New tokens (1-7 days old)
          liquidity: { from: 100000 }, // Minimum liquidity
          priceChange: { from: 0.1 }, // Positive price change
        },
        order: {
          orderBy: 'priceChange',
          order: 'desc',
        },
        pagination: {
          page: 1,
          recordsPerPage: 10,
        },
      });

      logger.info(
        `Found ${tokens.length} new tokens with smart money activity:`,
        tokens.slice(0, 5).map((t) => ({
          symbol: t.symbol,
          chain: t.chain,
          priceChange24h: `${(t.priceChange24h * 100).toFixed(2)}%`,
          tokenAgeDays: t.tokenAgeDays,
        }))
      );
    } catch (error) {
      logger.error('Error screening for new tokens:', error);
    }
  }

  /**
   * Example: Find Fresh Wallets
   */
  static async findFreshWalletsExample(): Promise<void> {
    try {
      logger.info('Searching for fresh wallets...');

      const freshWallets = await freshWalletService.findFreshWallets();

      logger.info(
        `Found ${freshWallets.length} fresh wallets:`,
        freshWallets.slice(0, 5).map((w) => ({
          wallet: w.wallet.slice(0, 10) + '...',
          chain: w.chain,
          initDepositUSD: w.initDepositUSD.toFixed(2),
        }))
      );
    } catch (error) {
      logger.error('Error finding fresh wallets:', error);
    }
  }

  /**
   * Run all examples
   */
  static async runAllExamples(): Promise<void> {
    logger.info('Running Nansen API Examples...');

    // Note: Uncomment the examples you want to run
    // Be mindful of API rate limits when running multiple examples

    // await this.getSmartMoneyHoldingsExample();
    // await this.getSmartMoneyTradesExample();
    // await this.screenForNewTokensExample();
    await this.findFreshWalletsExample();

    // Example wallet analysis (Ethereum)
    // await this.analyzeWalletExample('0x28c6c06298d514db089934071355e5743bf21d60');

    logger.info('Examples completed');
  }
}

// Export for use in other modules
export default NansenApiExamples;
