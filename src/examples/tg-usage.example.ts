import { TgClient } from '../tg/tg.service';
import { logger } from '../utils/logger';

/**
 * Example of using Telegram bot for symbol management
 *
 * Commands supported:
 * - "add BTC" - adds BTC to symbols list
 * - "rm ETH" - removes ETH from symbols list
 * - "list" - shows all current symbols
 */

async function exampleTelegramUsage(): Promise<void> {
  try {
    // Create Telegram client instance
    const tgClient = new TgClient();

    logger.info('Telegram bot started. You can now send commands:');
    logger.info('• add <symbol> - Add a symbol to the list');
    logger.info('• rm <symbol> - Remove a symbol from the list');
    logger.info('• list - Show all symbols');

    // Send startup message to configured chat
    await tgClient.sendMessage({
      message:
        '🤖 Fresh Wallet Scanner bot is now online!\n\nCommands:\n• `add <symbol>` - Add symbol\n• `rm <symbol>` - Remove symbol\n• `list` - Show all symbols',
    });

    // Keep the process running to listen for messages
    process.on('SIGINT', () => {
      logger.info('Shutting down Telegram bot...');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error starting Telegram bot:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleTelegramUsage();
}

export { exampleTelegramUsage };
