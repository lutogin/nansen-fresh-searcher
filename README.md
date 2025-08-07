# Nansen Fresh Wallet Scanner 🔍

Сервис для поиска "свежих" кошельков на основе анализа депозитов в Nansen API.

## Возможности

- 🔍 **Поиск свежих кошельков** - детекция кошельков с значительными депозитами после периода неактивности
- 📊 **Анализ токенов** - работа с конкретными тикерами (MAGIC, BANANAS31, etc.)
- ⏰ **Автоматический скан** - запуск по расписанию через cron
- 🔄 **Rate limiting** - контроль нагрузки на API (20 req/sec, 500 req/min)
- 📝 **Детальное логирование** - структурированные логи через Pino
- ⚙️ **Конфигурация** - валидация настроек через Joi
- 🐛 **VS Code отладка** - готовые конфигурации для debugging

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Создание .env файла
cp .env.example .env
# Отредактируйте .env и добавьте ваш NANSEN_API_KEY

# Запуск в разработке
npm run dev
```

## Конфигурация

Создайте файл `.env`:

```env
NANSEN_API_KEY=your_api_key_here
INTERVAL_SECONDS=300                      # Интервал сканирования в секундах
TICKERS=magic,bananas31            # Токены для анализа
FRESH_WALLET_MIN_DEPOSIT_USD=1000  # Минимальный депозит для считывания "свежим"
NODE_ENV=dev
LOG_LEVEL=info
```

## Команды

```bash
# Разработка с hot reload
npm run dev

# Сборка проекта
npm run build

# Продакшн запуск
npm start

# Тестирование
npm test

# Линтинг
npm run lint
npm run lint:fix

# Очистка
npm run clean
```

## VS Code отладка 🐛

Проект настроен для отладки в VS Code. Подробная документация: [DEBUG.md](./DEBUG.md)

**Доступные конфигурации:**

- **Debug Fresh Wallet Scanner** - полное приложение
- **Debug Test Runner** - тесты
- **Debug Fresh Wallet Service Only** - только сервис поиска
- **Debug Built Application** - продакшн версия

Для запуска: `F5` или **Run and Debug** панель в VS Code.

### Разработка

```bash
npm run dev
```

### Продакшн

```bash
npm run build
npm start
```

### Разовый запуск

```bash
npm run start:dev
```

## Архитектура

### Основные компоненты

- **NansenApiClient** (`src/clients/nansen.client.ts`) - полный клиент для Nansen API
- **FreshWalletService** (`src/services/fresh-wallet.service.ts`) - логика поиска свежих кошельков
- **FreshWalletScanner** (`src/services/scanner.service.ts`) - планировщик задач с cron
- **ConfigService** (`src/config/config.service.ts`) - управление конфигурацией с валидацией

### Типы данных

Все типы описаны в `src/types/nansen.types.ts`:

- API запросы и ответы
- Конфигурация приложения
- Данные свежих кошельков

## API Методы

### Smart Money API

- `getSmartMoneyHoldings()` - холдинги умных трейдеров
- `getSmartMoneyDexTrades()` - DEX торги умных трейдеров
- `getSmartMoneyInflows()` - притоки средств

### Profiler API

- `getAddressBalances()` - текущие балансы адресов
- `getAddressTransactions()` - история транзакций
- `getAddressHistoricalBalances()` - исторические балансы
- `getAddressCounterparties()` - контрагенты адреса
- `getWalletPnLSummary()` - сводка прибыли/убытков

### Token God Mode API

- `getTokenScreener()` - поиск токенов по критериям
- `getTokenHolders()` - холдеры токена
- `getTokenDexTrades()` - DEX торги токеном
- `getTokenTransfers()` - переводы токена
- `getTokenFlows()` - потоки токена
- `getWhoBoughtSold()` - кто покупал/продавал

## Алгоритм поиска свежих кошельков

1. **Поиск токенов** - находит адреса токенов для настроенных тикеров
2. **Анализ переводов** - получает все переводы за последние 24 часа
3. **Фильтрация по сумме** - оставляет только переводы выше минимального порога
4. **Проверка истории** - проверяет, был ли у кошелька нулевой баланс ранее
5. **Smart Money анализ** - дополнительная проверка через активность умных трейдеров

### Критерии "свежего" кошелька

- Получен депозит выше порога (настраивается в `FRESH_WALLET_MIN_DEPOSIT_USD`)
- До депозита баланс был нулевой или близко к нулю
- Ограниченная история транзакций (менее 10 транзакций)
- Первая активность в течение последних 30 дней

## Примеры использования

```typescript
import { nansenClient, freshWalletService } from 'arkham-app';

// Получить холдинги умных трейдеров
const holdings = await nansenClient.getSmartMoneyHoldings({
  parameters: {
    chains: ['ethereum', 'solana'],
    smFilter: ['180D Smart Trader', 'Fund'],
  },
  pagination: { page: 1, recordsPerPage: 100 },
});

// Найти свежие кошельки
const freshWallets = await freshWalletService.findFreshWallets();
console.log('Найдено свежих кошельков:', freshWallets.length);

// Анализ конкретного кошелька
const balances = await nansenClient.getAddressBalances({
  parameters: {
    walletAddresses: ['0x...'],
    chain: 'ethereum',
  },
  pagination: { page: 1, recordsPerPage: 50 },
});
```

Больше примеров в файле `src/examples/usage.examples.ts`.

## Логирование

Приложение использует структурированное логирование с помощью Pino:

```typescript
import { logger } from './src/utils/logger';

logger.info('Информационное сообщение');
logger.warn('Предупреждение');
logger.error('Ошибка', { context: 'дополнительные данные' });
```

## Конфигурация

Настройки валидируются с помощью Joi схемы:

- `TICKERS` - список токенов для мониторинга (обязательно)
- `INTERVAL_SECONDS` - интервал сканирования, минимум 60 секунд (обязательно)
- `NANSEN_API_KEY` - API ключ Nansen (обязательно)
- `FRESH_WALLET_MIN_DEPOSIT_USD` - минимальная сумма депозита в USD

## Rate Limiting

Клиент автоматически соблюдает лимиты API:

- 20 запросов в секунду
- 500 запросов в минуту
- Экспоненциальная задержка при превышении
- Автоматические повторы для временных ошибок

## Поддерживаемые блокчейны

- Ethereum, Solana, Arbitrum, Avalanche
- Base, BNB Chain, Blast, Fantom
- Optimism, Polygon, zkSync, и другие
- Полный список в `src/types/nansen.types.ts`

## Структура результата

Метод поиска свежих кошельков возвращает массив объектов:

```typescript
interface FreshWallet {
  wallet: string; // Адрес кошелька
  chain: string; // Блокчейн
  initDepositUSD: number; // Сумма первоначального депозита в USD
}
```

## Разработка

### Структура проекта

```
src/
├── clients/         # API клиенты
├── config/          # Конфигурация
├── services/        # Бизнес-логика
├── types/           # TypeScript типы
├── utils/           # Утилиты
├── examples/        # Примеры использования
└── main.ts          # Точка входа
```

### Команды разработки

```bash
npm run dev          # Запуск в режиме разработки
npm run build        # Сборка проекта
npm run lint         # Линтинг кода
npm run lint:fix     # Исправление ошибок линтинга
npm run clean        # Очистка dist папки
```

## Лицензия

ISC

## Поддержка

Для получения поддержки:

1. Проверьте настройки в `.env`
2. Убедитесь, что API ключ Nansen действителен
3. Проверьте логи приложения
4. Создайте issue в репозитории
