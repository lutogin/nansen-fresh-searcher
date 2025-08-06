import { configService } from './config/config.service';
import { NansenApiClient } from './nansen/nansen.client';
import { FreshWalletService } from './services/fresh-wallet.service';
import { FreshWalletScanner } from './services/scanner.service';
import { logger } from './utils/logger';

/**
 * Main Application class following SOLID principles
 * - Single Responsibility: Manages application lifecycle
 * - Dependency Injection: Services injected in constructor
 * - Open/Closed: Can be extended without modification
 */
export class Application {
  private isShuttingDown = false;
  private readonly scanner: FreshWalletScanner;
  private readonly freshWalletService: FreshWalletService;
  private readonly nansenClient: NansenApiClient;

  constructor(
    scanner?: FreshWalletScanner,
    freshWalletService?: FreshWalletService,
    nansenClient?: NansenApiClient
  ) {
    // Dependency injection with defaults (can be overridden for testing)
    this.nansenClient = nansenClient || new NansenApiClient();
    this.freshWalletService =
      freshWalletService || new FreshWalletService(this.nansenClient);
    this.scanner = scanner || new FreshWalletScanner(this.freshWalletService);

    this.setupSignalHandlers();
  }

  /**
   * Main application entry point
   */
  public async run(): Promise<void> {
    try {
      logger.info('Starting Nansen Fresh Wallet Scanner...');

      await this.initialize();
      await this.start();

      logger.info('Nansen Fresh Wallet Scanner started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      throw error;
    }
  }

  /**
   * Initialize application components
   */
  private async initialize(): Promise<void> {
    // Log configuration (without sensitive data)
    const config = configService.getConfig();
    logger.info('Application configuration:', {
      tickers: config.tickers,
      interval: config.intervalSeconds,
      minDepositUSD: config.freshWallet.minDepositUSD,
      maxRequestsPerSecond: config.nansen.maxRequestsPerSecond,
    });

    logger.info('Application initialization completed');
  }

  /**
   * Start application services
   */
  private async start(): Promise<void> {
    this.scanner.start();

    logger.info('Scanner status:', this.scanner.getStatus());
  }

  /**
   * Stops the application gracefully
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down Nansen Fresh Wallet Scanner...');

    try {
      // Stop the scanner
      this.scanner.stop();

      logger.info('Application stopped successfully');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }

  /**
   * Sets up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await this.stop();
        process.exit(0);
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.stop().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
      this.stop().then(() => process.exit(1));
    });
  }

  /**
   * Get application status
   */
  public getStatus(): {
    isRunning: boolean;
    isShuttingDown: boolean;
    scannerStatus: { isActive: boolean; isRunning: boolean };
  } {
    return {
      isRunning: !this.isShuttingDown,
      isShuttingDown: this.isShuttingDown,
      scannerStatus: this.scanner.getStatus(),
    };
  }

  /**
   * Run a manual scan (useful for testing or on-demand scanning)
   */
  public async runManualScan(): Promise<any[]> {
    return await this.scanner.runManualScan();
  }
}
