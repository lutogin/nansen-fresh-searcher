import { Application } from './main';
import { logger } from './utils/logger';

// Simple entry point - just start the application
async function main(): Promise<void> {
  try {
    const app = new Application();
    await app.run();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Start the application
main();
