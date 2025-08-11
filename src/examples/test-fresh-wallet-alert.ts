import { TgClient } from '../tg/tg.service';
import { logger } from '../utils/logger';

/**
 * Test script for fresh wallet alerts via Telegram
 */
async function testFreshWalletAlert(): Promise<void> {
  try {
    logger.info('Testing fresh wallet alert...');

    const tgClient = TgClient.getInstance();

    // Test alert with sample data
    await tgClient.sendFreshWalletAlert({
      symbol: 'USDC',
      chain: 'ethereum',
      walletAddress: '0x742d35Cc6634C0532925a3b8D86b0bf6c9A9c123',
      depositAmount: 50000,
      currentBalance: 75000,
    });

    logger.info('✅ Fresh wallet alert sent successfully!');

    // Test another one with different chain
    await tgClient.sendFreshWalletAlert({
      symbol: 'BNB',
      chain: 'bnb',
      walletAddress: '0x456d35Cc6634C0532925a3b8D86b0bf6c9A9c789',
      depositAmount: 25000,
    });

    logger.info('✅ Second fresh wallet alert sent successfully!');
  } catch (error) {
    logger.error('❌ Error testing fresh wallet alert:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  testFreshWalletAlert()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
}

export { testFreshWalletAlert };
