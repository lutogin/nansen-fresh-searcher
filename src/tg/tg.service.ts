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
    this.setupMessageHandling();
  }

  public static getInstance(): TgClient {
    if (!TgClient.instance) {
      TgClient.instance = new TgClient();
    }
    return TgClient.instance;
  }

  private setupMessageHandling(): void {
    this.bot.on('message', (msg) => {
      this.handleMessage(msg);
    });
  }

  private async handleMessage(msg: any): Promise<void> {
    try {
      const chatId = msg.chat.id;
      const text = msg.text?.trim();

      if (!text) return;

      // Regex patterns for commands
      const addPattern = /^add\s+([A-Za-z0-9]+)$/i;
      const rmPattern = /^rm\s+([A-Za-z0-9]+)$/i;

      if (addPattern.test(text)) {
        const match = text.match(addPattern);
        const symbol = match![1].toLowerCase(); // Храним в нижнем регистре
        await this.addSymbol(symbol, chatId);
      } else if (rmPattern.test(text)) {
        const match = text.match(rmPattern);
        const symbol = match![1].toLowerCase(); // Храним в нижнем регистре
        await this.removeSymbol(symbol, chatId);
      } else if (text.toLowerCase() === 'list') {
        await this.listSymbols(chatId);
      } else {
        await this.bot.sendMessage(
          chatId,
          'Available commands:\n• add <symbol>\n• rm <symbol>\n• list'
        );
      }
    } catch (error) {
      logger.error('Error handling Telegram message:', error);
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
