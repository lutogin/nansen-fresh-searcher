import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';
import { SupportedChain } from '../nansen/nansen.types';
import { logger } from '../utils/logger';
import { symbolsManager } from '../utils/symbols-manager';

// Find and load .env file from project root
const findProjectRoot = (): string => {
  let currentDir = __dirname;

  // Go up directories until we find package.json (project root)
  while (currentDir !== path.dirname(currentDir)) {
    if (require('fs').existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to process.cwd()
  return process.cwd();
};

const projectRoot = findProjectRoot();
const envPath = path.join(projectRoot, '.env');

// Load environment variables
dotenv.config({ path: envPath });

// Debug: log the path being used and some env vars
console.log('Loading .env from:', envPath);
console.log('Environment loaded:', {
  hasApiKey: !!process.env.NANSEN_API_KEY,
  hasChains: !!process.env.CHAINS,
});

// Configuration schema for validation
const configSchema = Joi.object({
  CHAINS: Joi.string().required(),
  INTERVAL_SECONDS: Joi.number().integer().min(60).required(), // Minimum 60 seconds
  NANSEN_BASE_URL: Joi.string().uri().required(),
  NANSEN_API_KEY: Joi.string().min(10).required(),
  NANSEN_MAX_REQUESTS_PER_SECOND: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
  NANSEN_MAX_REQUESTS_PER_MINUTE: Joi.number()
    .integer()
    .min(10)
    .max(1000)
    .default(500),
  NANSEN_RETRY_ATTEMPTS: Joi.number().integer().min(1).max(10).default(3),
  NANSEN_TIMEOUT_MS: Joi.number().integer().min(5000).max(60000).default(30000),
  FRESH_WALLET_MIN_DEPOSIT_USD: Joi.number().min(1).default(1000),
});

export interface AppConfig {
  symbols: string[];
  chains: SupportedChain[];
  intervalSeconds: number; // in seconds
  nodeEnv: string;
  nansen: {
    baseUrl: string;
    apiKey: string;
    maxRequestsPerSecond: number;
    maxRequestsPerMinute: number;
    retryAttempts: number;
    timeoutMs: number;
  };
  tg: {
    botToken: string;
    chatId: string;
    threadId?: number; // Optional thread ID for group chats
  };
  freshWallet: {
    minDepositUSD: number;
  };
}

class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    const envConfig = {
      CHAINS: process.env.CHAINS,
      INTERVAL_SECONDS: Number(process.env.INTERVAL_SECONDS),
      NANSEN_BASE_URL: process.env.NANSEN_BASE_URL,
      NANSEN_API_KEY: process.env.NANSEN_API_KEY,
      NANSEN_MAX_REQUESTS_PER_SECOND: Number(
        process.env.NANSEN_MAX_REQUESTS_PER_SECOND
      ),
      NANSEN_MAX_REQUESTS_PER_MINUTE: Number(
        process.env.NANSEN_MAX_REQUESTS_PER_MINUTE
      ),
      NANSEN_RETRY_ATTEMPTS: Number(process.env.NANSEN_RETRY_ATTEMPTS),
      NANSEN_TIMEOUT_MS: Number(process.env.NANSEN_TIMEOUT_MS),
      FRESH_WALLET_MIN_DEPOSIT_USD: Number(
        process.env.FRESH_WALLET_MIN_DEPOSIT_USD
      ),
      NODE_ENV: process.env.NODE_ENV || 'dev',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
      TELEGRAM_THREAD_ID: process.env.TELEGRAM_THREAD_ID
        ? Number(process.env.TELEGRAM_THREAD_ID)
        : undefined,
    };

    const { error, value } = configSchema.validate(envConfig, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      logger.error('Configuration validation failed:', errorMessages);
      throw new Error(
        `Configuration validation failed: ${errorMessages.join(', ')}`
      );
    }

    const validatedConfig = value as any;

    const config: AppConfig = {
      symbols: [], // Symbols will be loaded from symbols.json file
      chains: (process.env.CHAINS || '')
        .split(',')
        .map((chain: string) => chain.trim().toLowerCase() as SupportedChain),
      intervalSeconds: validatedConfig.INTERVAL_SECONDS,
      nodeEnv: validatedConfig.NODE_ENV,
      nansen: {
        baseUrl: validatedConfig.NANSEN_BASE_URL,
        apiKey: validatedConfig.NANSEN_API_KEY,
        maxRequestsPerSecond: validatedConfig.NANSEN_MAX_REQUESTS_PER_SECOND,
        maxRequestsPerMinute: validatedConfig.NANSEN_MAX_REQUESTS_PER_MINUTE,
        retryAttempts: validatedConfig.NANSEN_RETRY_ATTEMPTS,
        timeoutMs: validatedConfig.NANSEN_TIMEOUT_MS,
      },
      tg: {
        botToken: validatedConfig.TELEGRAM_BOT_TOKEN,
        chatId: validatedConfig.TELEGRAM_CHAT_ID,
        threadId: validatedConfig.TELEGRAM_THREAD_ID,
      },
      freshWallet: {
        minDepositUSD: validatedConfig.FRESH_WALLET_MIN_DEPOSIT_USD,
      },
    };

    logger.info('Configuration loaded successfully', {
      symbols: config.symbols,
      intervalSeconds: config.intervalSeconds,
      minDepositUSD: config.freshWallet.minDepositUSD,
    });

    return config;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public async getSymbols(): Promise<string[]> {
    return await symbolsManager.getSymbols();
  }

  public getInterval(): number {
    return this.config.intervalSeconds;
  }

  public getNansenConfig() {
    return this.config.nansen;
  }

  public getFreshWalletConfig() {
    return this.config.freshWallet;
  }

  public validateApiKey(): boolean {
    return (
      this.config.nansen.apiKey !== 'your_api_key_here' &&
      this.config.nansen.apiKey.length > 10
    );
  }
}

export const configService = new ConfigService();
