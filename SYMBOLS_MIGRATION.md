# Symbols Management - Migration Guide

## Overview

The system has been migrated from using environment variable `TICKERS` to a dynamic JSON file `symbols.json` with Telegram bot management.

## Key Changes

### ❌ Removed

- `TICKERS` environment variable
- Static configuration of symbols

### ✅ Added

- `src/config/symbols.json` - Dynamic symbols file
- `src/utils/symbols-manager.ts` - Centralized symbols management
- Telegram bot commands for remote symbol management
- Real-time symbols modification without restart

## Migration Steps

1. **Environment Configuration**
   - Remove `TICKERS` from your `.env` file
   - Symbols are now managed via `src/config/symbols.json`

2. **Initial Setup**
   - Current symbols.json contains: `["magic", "strk"]`
   - Modify this file directly or use Telegram bot commands

3. **Telegram Bot Commands**
   ```
   add BTC     - Add BTC to symbols list
   rm ETH      - Remove ETH from symbols list
   list        - Show all current symbols
   ```

## Technical Details

### New Components

1. **SymbolsManager** (`src/utils/symbols-manager.ts`)

   ```typescript
   await symbolsManager.getSymbols(); // Get current symbols
   await symbolsManager.addSymbol('BTC'); // Add symbol
   await symbolsManager.removeSymbol('ETH'); // Remove symbol
   ```

2. **Config Service Updates**

   ```typescript
   // Old: config.tickers
   // New: await configService.getSymbols()
   ```

3. **Fresh Wallet Service Updates**
   - Now loads symbols dynamically from JSON file
   - Supports empty symbols list with warning
   - All references changed from "tickers" to "symbols"

### File Structure

```
src/
├── config/
│   ├── symbols.json          # Dynamic symbols configuration
│   └── config.service.ts     # Updated to use symbols.json
├── utils/
│   └── symbols-manager.ts    # New symbols management utility
├── tg/
│   └── tg.service.ts         # Updated with symbol commands
└── services/
    └── fresh-wallet.service.ts # Updated to use dynamic symbols
```

### Benefits

1. **Dynamic Management**: Add/remove symbols without restart
2. **Remote Control**: Manage symbols via Telegram bot
3. **Centralized Logic**: All symbol operations in SymbolsManager
4. **Better UX**: Real-time modifications with confirmation
5. **Error Handling**: Robust validation and error reporting

### Usage Examples

1. **Direct File Management**

   ```json
   // src/config/symbols.json
   ["usdc", "eth", "btc", "sol"]
   ```

2. **Telegram Bot Usage**

   ```
   User: add DOGE
   Bot: ✅ Added "DOGE" to the symbols list.

   User: list
   Bot: Current symbols: magic, strk, doge

   User: rm MAGIC
   Bot: ✅ Removed "MAGIC" from the symbols list.
   ```

3. **Programmatic Access**

   ```typescript
   import { symbolsManager } from '../utils/symbols-manager';

   const symbols = await symbolsManager.getSymbols();
   console.log('Current symbols:', symbols);
   ```

## Testing

Run the updated system:

```bash
npm run dev
```

Use Telegram bot to test symbol management:

1. Send `list` to see current symbols
2. Send `add TEST` to add a test symbol
3. Send `list` again to verify
4. Send `rm TEST` to remove it

## Backwards Compatibility

- ❌ `TICKERS` env var is no longer supported
- ❌ `config.tickers` property removed
- ✅ New `getSymbols()` async method available
- ✅ All existing functionality preserved with new symbol source
