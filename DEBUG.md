# VS Code Debug Configuration 🐛

Этот проект настроен для отладки в VS Code с поддержкой TypeScript.

## Доступные конфигурации отладки

### 1. 🚀 Debug Fresh Wallet Scanner

**Файл:** `src/main.ts`
**Описание:** Отладка полного приложения со сканером
**Использование:** Полная отладка с планировщиком задач

### 2. 🧪 Debug Test Runner

**Файл:** `src/test.ts`
**Описание:** Отладка тестов приложения
**Использование:** Тестирование всех компонентов

### 3. 🔍 Debug Fresh Wallet Service Only

**Файл:** `src/services/debug-fresh-wallet.ts`
**Описание:** Отладка только сервиса поиска кошельков
**Использование:** Изолированная отладка алгоритма поиска

### 4. ⚡ Debug Built Application

**Файл:** `dist/main.js`
**Описание:** Отладка скомпилированного приложения
**Использование:** Тестирование продакшн версии

## Как использовать отладку

### Шаг 1: Установите точки останова

```typescript
// Пример установки breakpoint в fresh-wallet.service.ts
async findFreshWallets(): Promise<FreshWallet[]> {
  debugger; // 👈 Или кликните слева от номера строки
  const tickers = this.config.tickers;
  // ...
}
```

### Шаг 2: Запустите отладку

1. Откройте **Run and Debug** панель (`Ctrl+Shift+D`)
2. Выберите нужную конфигурацию из выпадающего списка
3. Нажмите **F5** или кнопку **▶️ Start Debugging**

### Шаг 3: Управление отладкой

- **F5** - Continue / Start
- **F10** - Step Over
- **F11** - Step Into
- **Shift+F11** - Step Out
- **Ctrl+Shift+F5** - Restart
- **Shift+F5** - Stop

## Полезные возможности

### 🔍 Инспектирование переменных

- Наведите мышь на переменную для просмотра значения
- Используйте панель **Variables** для просмотра области видимости
- Добавляйте выражения в **Watch** панель

### 📝 Debug Console

Выполняйте код в контексте текущей точки останова:

```javascript
// В Debug Console можно выполнить:
freshWallets.length;
tokenMap.size;
console.log(config);
```

### 📊 Call Stack

Просматривайте стек вызовов функций для понимания последовательности выполнения.

## Настройки проекта

### Source Maps

Включены source maps для корректного маппинга TypeScript → JavaScript:

```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true,
    "declarationMap": true
  }
}
```

### TypeScript Register

Используется `ts-node/register` для прямого выполнения TypeScript файлов.

### Skip Files

Настроено игнорирование внутренних файлов Node.js для чистого дебага.

## Задачи (Tasks)

Доступны предустановленные задачи в **Terminal > Run Task**:

- **Build TypeScript** - Компиляция проекта
- **Start Development Server** - Запуск с hot reload
- **Run App Tests** - Выполнение тестов
- **Lint Code** - Проверка кода
- **Fix Lint Issues** - Автоисправление
- **Clean and Build** - Очистка и пересборка

## Расширения

Рекомендуемые расширения для лучшего опыта отладки:

- **TypeScript** - Поддержка TypeScript
- **ESLint** - Линтинг кода
- **Prettier** - Форматирование кода
- **GitHub Copilot** - AI помощник

## Примеры отладки

### Отладка поиска свежих кошельков

```typescript
// Установите breakpoint в fresh-wallet.service.ts:49
const tokenMap = await nansenClient.findTokensForTickers(
  tickers,
  this.supportedChains
); // 👈 Breakpoint здесь

// В Debug Console можете проверить:
// tokenMap.size
// tickers
// this.supportedChains.length
```

### Отладка API запросов

```typescript
// Установите breakpoint в nansen.client.ts
async getTokenScreener(request: TokenScreenerRequest) {
  debugger; // 👈 Остановка перед API запросом
  const response = await this.client.post('/token-screener', request);
  debugger; // 👈 Остановка после получения ответа
  return response.data;
}
```

### Отладка конфигурации

```typescript
// В config.service.ts
private loadConfig(): AppConfig {
  const envConfig = { /* ... */ };
  debugger; // 👈 Проверить env переменные

  const { error, value } = configSchema.validate(envConfig);
  debugger; // 👈 Проверить результат валидации
}
```

## Советы по отладке

1. **Используйте условные breakpoints** - правый клик на breakpoint для условий
2. **Логируйте промежуточные результаты** - `console.log()` в Debug Console
3. **Проверяйте API ответы** - инспектируйте `response.data`
4. **Тестируйте отдельные части** - используйте "Debug Fresh Wallet Service Only"
5. **Следите за memory leaks** - отслеживайте размеры массивов

## Troubleshooting

### Breakpoints не срабатывают

- Проверьте что source maps включены
- Убедитесь что файл скомпилирован
- Перезапустите отладку

### TypeScript ошибки

- Запустите `npm run build` для проверки компиляции
- Проверьте `tsconfig.json` настройки

### Медленная отладка API

- Используйте мок данные для быстрого тестирования
- Ограничьте количество цепочек в `supportedChains`

Удачной отладки! 🐛✨
