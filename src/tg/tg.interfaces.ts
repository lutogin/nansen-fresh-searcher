import TelegramBot from 'node-telegram-bot-api';

export interface ISendMessageParams {
  originMsg?: TelegramBot.Message;
  message: string;
  chatId?: number;
  threadId?: number;
}
