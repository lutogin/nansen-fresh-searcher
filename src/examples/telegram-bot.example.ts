import { Application } from '../main';
import { logger } from '../utils/logger';

/**
 * Example showing complete application startup with Telegram bot
 */
async function runApplicationWithTelegram(): Promise<void> {
  logger.info('🚀 Starting Fresh Wallet Scanner with Telegram Bot...');

  const app = new Application();

  try {
    await app.run();
  } catch (error) {
    logger.error('Application failed to start:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runApplicationWithTelegram()
    .then(() => {
      logger.info('✅ Application started successfully with Telegram bot');
    })
    .catch((error) => {
      logger.error('❌ Failed to start application:', error);
      process.exit(1);
    });
}

export { runApplicationWithTelegram };
