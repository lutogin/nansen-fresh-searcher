import { NansenApiClient } from './nansen/nansen.client';
import { logger } from './utils/logger';
import moment from 'moment';

/**
 * Простой тест Token Screener API
 */
async function testTokenScreener(): Promise<void> {
  logger.info('🧪 Testing Token Screener API...');

  try {
    const client = new NansenApiClient();

    // Используем moment для дат
    const now = moment();
    const yesterday = moment().subtract(1, 'day');

    // Минимальный запрос для ethereum
    const testRequest = {
      parameters: {
        chains: ['ethereum'],
        date: {
          from: yesterday.format('YYYY-MM-DD'),
          to: now.format('YYYY-MM-DD'),
        },
        onlySmartMoney: false,
      },
      pagination: {
        page: 1,
        recordsPerPage: 10, // Очень маленький размер для быстрого теста
      },
    };

    logger.info('🚀 Sending test request...');
    console.log('Request:', JSON.stringify(testRequest, null, 2));
    console.log(`Date range: ${yesterday.format('YYYY-MM-DD')} to ${now.format('YYYY-MM-DD')}`);

    const startTime = Date.now();

    // Используем Promise.race для таймаута
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000);
    });

    const result = await Promise.race([
      client.getTokenScreener(testRequest),
      timeoutPromise
    ]);

    const duration = Date.now() - startTime;

    logger.info(`✅ Test completed in ${duration}ms`);
    console.log(`Found ${(result as any[]).length} tokens`);

    if ((result as any[]).length > 0) {
      console.log('Sample token:', (result as any[])[0]);
    }

  } catch (error) {
    logger.error('❌ Test failed:', error);

    if (error instanceof Error) {
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
    }
  }
}

// Запуск теста
testTokenScreener().catch(console.error);
