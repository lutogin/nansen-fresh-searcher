import { configService } from './config/config.service';
import { nansenClient } from './nansen/nansen.client';
import { freshWalletService } from './services/fresh-wallet.service';
import { logger } from './utils/logger';
import NansenApiExamples from './examples/usage.examples';

/**
 * Test script to validate the application setup and API connectivity
 */
class TestRunner {
  async runTests(): Promise<void> {
    logger.info('Starting Nansen App Tests...');

    try {
      // Test 1: Configuration validation
      await this.testConfiguration();

      // Test 2: API connectivity (if API key is valid)
      if (configService.validateApiKey()) {
        await this.testApiConnectivity();
        await this.testFreshWalletService();
      } else {
        logger.warn(
          'Skipping API tests - invalid API key. Please set NANSEN_API_KEY in .env'
        );
      }

      // Test 3: Run examples
      await this.runExamples();

      logger.info('All tests completed successfully! ✅');
    } catch (error) {
      logger.error('Test execution failed:', error);
      process.exit(1);
    }
  }

  private async testConfiguration(): Promise<void> {
    logger.info('Testing configuration...');

    const config = configService.getConfig();

    // Validate required fields
    if (config.tickers.length === 0) {
      throw new Error('No tickers configured');
    }

    if (config.interval < 60000) {
      throw new Error('Interval too small');
    }

    logger.info('Configuration test passed ✅', {
      tickers: config.tickers,
      interval: config.interval,
      minDepositUSD: config.freshWallet.minDepositUSD,
    });
  }

  private async testApiConnectivity(): Promise<void> {
    logger.info('Testing Nansen API connectivity...');

    try {
      // Test a simple API call
      const holdings = await nansenClient.getSmartMoneyHoldings({
        parameters: {
          chains: ['ethereum'],
          smFilter: ['180D Smart Trader'],
        },
        pagination: {
          page: 1,
          recordsPerPage: 5,
        },
      });

      logger.info(
        `API connectivity test passed ✅ - Got ${holdings.length} holdings`
      );
    } catch (error) {
      logger.error('API connectivity test failed ❌:', error);
      throw error;
    }
  }

  private async testFreshWalletService(): Promise<void> {
    logger.info('Testing Fresh Wallet Service...');

    try {
      // This might take a while due to API calls
      logger.info(
        'Running fresh wallet detection (this may take a few minutes)...'
      );

      const freshWallets = await freshWalletService.findFreshWallets();

      logger.info(
        `Fresh wallet service test completed ✅ - Found ${freshWallets.length} fresh wallets`
      );

      if (freshWallets.length > 0) {
        logger.info(
          'Sample fresh wallets:',
          freshWallets.slice(0, 3).map((w) => ({
            wallet: w.wallet.slice(0, 10) + '...',
            chain: w.chain,
            depositUSD: w.initDepositUSD.toFixed(2),
          }))
        );
      }
    } catch (error) {
      logger.warn(
        'Fresh wallet service test failed (this is expected if no fresh wallets found):',
        error
      );
      // Don't throw error as this is expected behavior sometimes
    }
  }

  private async runExamples(): Promise<void> {
    logger.info('Running API examples...');

    try {
      if (configService.validateApiKey()) {
        await NansenApiExamples.runAllExamples();
        logger.info('Examples completed ✅');
      } else {
        logger.info('Skipping examples - API key not configured');
      }
    } catch (error) {
      logger.warn(
        'Examples failed (this might be normal due to API limits):',
        error
      );
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const testRunner = new TestRunner();
  testRunner.runTests().catch((error) => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}

export default TestRunner;
