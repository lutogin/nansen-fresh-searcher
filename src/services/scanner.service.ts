import * as cron from 'node-cron';
import { FreshWalletService } from './fresh-wallet.service';
import { configService } from '../config/config.service';
import { logger } from '../utils/logger';
import { FreshWallet } from '../nansen/nansen.types';

export class FreshWalletScanner {
  private job: cron.ScheduledTask | null = null;
  private isRunning = false;
  private readonly freshWalletService: FreshWalletService;

  constructor(freshWalletService: FreshWalletService) {
    this.freshWalletService = freshWalletService;
  }

  /**
   * Starts the fresh wallet scanning service
   */
  public start(): void {
    try {
      if (this.job) {
        logger.warn('Fresh wallet scanner is already running');
        return;
      }

      const interval = configService.getInterval();
      const cronExpression = this.convertIntervalToCron(interval);

      logger.info(
        `Starting fresh wallet scanner with interval: ${interval}s (${cronExpression})`
      );

      this.job = cron.schedule(
        cronExpression,
        async () => {
          await this.runScan();
        },
        {
          timezone: 'UTC',
        }
      );

      this.job.start();
      logger.info('Fresh wallet scanner scheduled successfully');

      // Run initial scan immediately (non-blocking)
      logger.info('🚀 Starting initial scan immediately...');
      this.runScan().catch((error) => {
        logger.error('Initial scan failed:', error);
      });
    } catch (error) {
      logger.error('Failed to start fresh wallet scanner:', error);
      throw error;
    }
  }

  /**
   * Stops the fresh wallet scanning service
   */
  public stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('Fresh wallet scanner stopped');
    }
  }

  /**
   * Runs a manual scan for fresh wallets
   */
  public async runManualScan(): Promise<FreshWallet[]> {
    logger.info('Running manual fresh wallet scan...');
    return await this.performScan();
  }

  /**
   * Internal method to run the scanning process
   */
  private async runScan(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Fresh wallet scan already in progress, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Starting scheduled fresh wallet scan...');
      const startTime = Date.now();

      const freshWallets = await this.performScan();

      const duration = Date.now() - startTime;
      logger.info(
        `Fresh wallet scan completed in ${duration}ms. Found ${freshWallets.length} fresh wallets`,
        {
          duration,
          walletCount: freshWallets.length,
          wallets: freshWallets.slice(0, 5), // Log first 5 for inspection
        }
      );

      // Here you could add logic to:
      // - Store results in database
      // - Send notifications
      // - Trigger other processes
    } catch (error) {
      logger.error('Error during fresh wallet scan:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Performs the actual fresh wallet scanning
   */
  private async performScan(): Promise<FreshWallet[]> {
    try {
      // Validate API key before scanning
      if (!configService.validateApiKey()) {
        throw new Error(
          'Invalid Nansen API key. Please check your configuration.'
        );
      }

      // Run both scanning methods and combine results
      const [regularWallets, smartMoneyWallets] = await Promise.allSettled([
        this.freshWalletService.findFreshWallets(),
        this.freshWalletService.findFreshWalletsWithSmartMoney(),
      ]);

      const allWallets: FreshWallet[] = [];

      if (regularWallets.status === 'fulfilled') {
        allWallets.push(...regularWallets.value);
      } else {
        logger.warn('Regular fresh wallet scan failed:', regularWallets.reason);
      }

      if (smartMoneyWallets.status === 'fulfilled') {
        allWallets.push(...smartMoneyWallets.value);
      } else {
        logger.warn(
          'Smart money fresh wallet scan failed:',
          smartMoneyWallets.reason
        );
      }

      // Remove duplicates
      const uniqueWallets = this.removeDuplicateWallets(allWallets);

      // Sort by deposit amount (descending)
      uniqueWallets.sort((a, b) => b.initDepositUSD - a.initDepositUSD);

      return uniqueWallets;
    } catch (error) {
      logger.error('Error in fresh wallet scanning:', error);
      throw error;
    }
  }

  /**
   * Converts interval in seconds to cron expression
   */
  private convertIntervalToCron(intervalSeconds: number): string {
    const intervalMinutes = Math.floor(intervalSeconds / 60);

    if (intervalMinutes < 1) {
      throw new Error('Interval must be at least 60 seconds (1 minute)');
    }

    if (intervalMinutes < 60) {
      // If less than 60 minutes, run every N minutes
      return `*/${intervalMinutes} * * * *`;
    } else {
      // If 60 minutes or more, convert to hours
      const intervalHours = Math.floor(intervalMinutes / 60);
      if (intervalHours < 24) {
        return `0 */${intervalHours} * * *`;
      } else {
        // If 24 hours or more, run daily
        return '0 0 * * *';
      }
    }
  }

  /**
   * Removes duplicate wallets from the results
   */
  private removeDuplicateWallets(wallets: FreshWallet[]): FreshWallet[] {
    const seen = new Map<string, FreshWallet>();

    for (const wallet of wallets) {
      const key = `${wallet.wallet}:${wallet.chain}`;
      const existing = seen.get(key);

      // Keep the wallet with higher deposit amount if duplicate found
      if (!existing || wallet.initDepositUSD > existing.initDepositUSD) {
        seen.set(key, wallet);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Gets the current status of the scanner
   */
  public getStatus(): { isActive: boolean; isRunning: boolean } {
    return {
      isActive: this.job !== null,
      isRunning: this.isRunning,
    };
  }
}

// Note: No global instance exported - use dependency injection instead
