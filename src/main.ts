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
    // Validate configuration
    this.validateConfiguration();

    // Log configuration (without sensitive data)
    const config = configService.getConfig();
    logger.info('Application configuration:', {
      tickers: config.tickers,
      interval: config.interval,
      minDepositUSD: config.freshWallet.minDepositUSD,
      maxRequestsPerSecond: config.nansen.maxRequestsPerSecond,
    });

    logger.info('Application initialization completed');
  }

  /**
   * Start application services
   */
  private async start(): Promise<void> {
    // Start the fresh wallet scanner
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
   * Validates the application configuration
   */
  private validateConfiguration(): void {
    // Check if API key is configured
    if (!configService.validateApiKey()) {
      throw new Error(
        'Invalid Nansen API key. Please set NANSEN_API_KEY in your .env file. ' +
          'Get your API key from https://app.nansen.ai/account?tab=api'
      );
    }

    const config = configService.getConfig();

    // Validate tickers
    if (config.tickers.length === 0) {
      throw new Error(
        'No tickers configured. Please set TICKERS in your .env file.'
      );
    }

    // Validate interval
    if (config.interval < 60) {
      // Minimum 60 seconds
      throw new Error('Interval must be at least 60 seconds (1 minute)');
    }

    logger.info('Configuration validation passed');
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
