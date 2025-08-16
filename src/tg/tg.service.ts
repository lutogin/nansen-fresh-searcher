import TelegramClient from 'node-telegram-bot-api';
import { AppConfig, configService } from '../config/config.service';
import { logger } from '../utils/logger';
import { symbolsManager } from '../utils/symbols-manager';
import { ISendMessageParams } from './tg.interfaces';

export class TgClient {
  private static instance: TgClient;
  private readonly bot: TelegramClient;
  private readonly config: AppConfig;

  private constructor() {
    this.config = configService.getConfig();
    this.bot = new TelegramClient(this.config.tg.botToken, { polling: true });

    // ДОБАВИТЬ КОМАНДЫ В МЕНЮ БОТА:
    this.bot.setMyCommands([
      { command: 'list', description: 'Show all symbols' },
      { command: 'add', description: 'Add symbol (e.g. /add btc)' },
      { command: 'rm', description: 'Remove symbol (e.g. /rm eth)' },
    ]);

    this.bot.on('message', (msg) => {
      console.log('Received any message!'); // Добавить это для проверки
      this.handleMessage(msg);
    });
  }

  public static getInstance(): TgClient {
    if (!TgClient.instance) {
      TgClient.instance = new TgClient();
    }
    return TgClient.instance;
  }

  private async handleMessage(msg: any): Promise<void> {
    const text = msg.text?.trim();
    const chatId = msg.chat.id;

    console.log('=== MESSAGE DEBUG ===');
    console.log('Chat ID:', chatId);
    console.log('Chat Type:', msg.chat.type); // private/group/supergroup/channel
    console.log('Text:', text);
    console.log('From:', msg.from?.username);
    console.log('===================');

    if (!text) return;

    // ИСПРАВИТЬ - убрать @ упоминание бота и добавить варианты без /
    let command = text.toLowerCase();
    if (command.includes('@')) {
      command = command.split('@')[0]; // Убираем @nanasen_scanner_bot
    }

    try {
      if (command === '/list' || command === 'list') {
        console.log('Processing list command...');
        const symbols = await configService.getSymbols();
        await this.bot.sendMessage(
          chatId,
          `📋 Current symbols: ${symbols.join(', ')}`
        );
        console.log('List command sent!');
      } else if (command.startsWith('/add ') || command.startsWith('add ')) {
        const symbol = command.replace(/^(\/)?add\s+/, '').toLowerCase();
        console.log(`Adding symbol: ${symbol}`);
        // Логика добавления...
        await this.bot.sendMessage(chatId, `✅ Added: ${symbol.toUpperCase()}`);
      } else if (command.startsWith('/rm ') || command.startsWith('rm ')) {
        const symbol = command.replace(/^(\/)?rm\s+/, '').toLowerCase();
        console.log(`Removing symbol: ${symbol}`);
        // Логика удаления...
        await this.bot.sendMessage(
          chatId,
          `❌ Removed: ${symbol.toUpperCase()}`
        );
      }
    } catch (error) {
      console.error('Error processing command:', error);
      await this.bot.sendMessage(chatId, '❌ Error processing command');
    }
  }

  private async addSymbol(symbol: string, chatId: number): Promise<void> {
    try {
      const success = await symbolsManager.addSymbol(symbol);

      if (!success) {
        await this.bot.sendMessage(
          chatId,
          `Symbol "${symbol.toUpperCase()}" already exists in the list.`
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        `✅ Added "${symbol.toUpperCase()}" to the symbols list.`
      );
      logger.info(`Added symbol via Telegram: ${symbol}`);
    } catch (error) {
      logger.error('Error adding symbol:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ Error adding symbol "${symbol.toUpperCase()}".`
      );
    }
  }

  private async removeSymbol(symbol: string, chatId: number): Promise<void> {
    try {
      const success = await symbolsManager.removeSymbol(symbol);

      if (!success) {
        await this.bot.sendMessage(
          chatId,
          `Symbol "${symbol.toUpperCase()}" not found in the list.`
        );
        return;
      }

      await this.bot.sendMessage(
        chatId,
        `✅ Removed "${symbol.toUpperCase()}" from the symbols list.`
      );
      logger.info(`Removed symbol via Telegram: ${symbol}`);
    } catch (error) {
      logger.error('Error removing symbol:', error);
      await this.bot.sendMessage(
        chatId,
        `❌ Error removing symbol "${symbol.toUpperCase()}".`
      );
    }
  }

  private async listSymbols(chatId: number): Promise<void> {
    try {
      const symbols = await symbolsManager.getSymbols();

      if (symbols.length === 0) {
        await this.bot.sendMessage(chatId, 'No symbols in the list.');
        return;
      }

      const symbolsList = symbols.map((s) => s.toUpperCase()).join(', ');
      await this.bot.sendMessage(chatId, `Current symbols: ${symbolsList}`);
    } catch (error) {
      logger.error('Error listing symbols:', error);
      await this.bot.sendMessage(chatId, '❌ Error getting symbols list.');
    }
  }

  public sendMessage({
    message,
  }: ISendMessageParams): Promise<TelegramClient.Message> {
    return this.bot.sendMessage(this.config.tg.chatId, message, {
      parse_mode: 'Markdown',
      ...(this.config.tg.threadId
        ? { message_thread_id: this.config.tg.threadId }
        : {}),
    });
  }

  public getBotInstance(): TelegramClient {
    return this.bot;
  }

  public async getSymbols(): Promise<string[]> {
    return await symbolsManager.getSymbols();
  }

  /**
   * Отправляет уведомление о найденном fresh кошельке
   */
  public async sendFreshWalletAlert(walletData: {
    symbol: string;
    chain: string;
    walletAddress: string;
    depositAmount: number;
    currentBalance?: number;
  }): Promise<void> {
    try {
      const { symbol, chain, walletAddress, depositAmount, currentBalance } =
        walletData;

      let message = `🔥 *Fresh Wallet Alert!*\n\n`;
      message += `💰 *Token:* ${symbol.toUpperCase()}\n`;
      message += `🌐 *Network:* ${chain.charAt(0).toUpperCase() + chain.slice(1)}\n`;
      message += `👛 *Wallet:* \`${walletAddress}\`\n`;
      message += `💵 *Initial Deposit:* $${depositAmount.toLocaleString()}\n`;

      if (currentBalance !== undefined) {
        message += `💎 *Current Balance:* $${currentBalance.toLocaleString()}\n`;
      }

      message += `\n🔗 *Explorer:* `;

      // Добавляем ссылки на эксплореры в зависимости от сети
      switch (chain.toLowerCase()) {
        case 'ethereum':
          message += `[Etherscan](https://etherscan.io/address/${walletAddress})`;
          break;
        case 'bnb':
        case 'bsc':
          message += `[BSCScan](https://bscscan.com/address/${walletAddress})`;
          break;
        case 'arbitrum':
          message += `[Arbiscan](https://arbiscan.io/address/${walletAddress})`;
          break;
        case 'solana':
          message += `[Solscan](https://solscan.io/account/${walletAddress})`;
          break;
        default:
          message += `\`${walletAddress}\``;
      }

      await this.sendMessage({ message });
      logger.info(
        `Sent fresh wallet alert for ${symbol.toUpperCase()} on ${chain}`
      );
    } catch (error) {
      logger.error('Error sending fresh wallet alert:', error);
    }
  }
}
