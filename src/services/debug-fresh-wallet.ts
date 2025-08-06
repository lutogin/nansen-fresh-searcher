import { logger } from '../utils/logger';
import { FreshWalletService } from './fresh-wallet.service';
import { NansenApiClient } from '../nansen/nansen.client';

/**
 * Debug script for Fresh Wallet Service
 * This file is designed to be run with VS Code debugger
 */
async function debugFreshWalletService(): Promise<void> {
  logger.info('🔍 Starting Fresh Wallet Service Debug Session...');

  try {
    // Create services using dependency injection
    const nansenClient = new NansenApiClient();
    const freshWalletService = new FreshWalletService(nansenClient);

    // Set breakpoints here to debug the service
    console.log('✨ Starting fresh wallet search...');

    const freshWallets = await freshWalletService.findFreshWallets();

    console.log(`🎯 Found ${freshWallets.length} fresh wallets:`);
    freshWallets.forEach((wallet, index) => {
      console.log(
        `${index + 1}. ${wallet.wallet} (${wallet.chain}) - $${wallet.initDepositUSD.toFixed(2)}`
      );
    });

    // Test smart money enhanced search
    console.log('\n🧠 Testing smart money enhanced search...');
    const smartMoneyWallets =
      await freshWalletService.findFreshWalletsWithSmartMoney();

    console.log(
      `🎯 Found ${smartMoneyWallets.length} fresh wallets through smart money analysis:`
    );
    smartMoneyWallets.forEach((wallet, index) => {
      console.log(
        `${index + 1}. ${wallet.wallet} (${wallet.chain}) - $${wallet.initDepositUSD.toFixed(2)}`
      );
    });

    logger.info('✅ Debug session completed successfully');
  } catch (error) {
    logger.error('❌ Debug session failed:', error);
    throw error;
  }
}

// Run the debug function
debugFreshWalletService().catch((error) => {
  logger.error('Fatal error in debug session:', error);
  process.exit(1);
});
