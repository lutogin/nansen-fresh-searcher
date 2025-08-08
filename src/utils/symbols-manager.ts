import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

export class SymbolsManager {
  private readonly symbolsFilePath: string;

  constructor() {
    // Путь к файлу symbols.json в корне проекта
    this.symbolsFilePath = path.join(
      process.cwd(),
      'src',
      'config',
      'symbols.json'
    );
  }

  /**
   * Читает символы из файла symbols.json
   * Если файл не существует, создает его с пустым массивом
   */
  async getSymbols(): Promise<string[]> {
    try {
      if (!existsSync(this.symbolsFilePath)) {
        logger.info('symbols.json not found, creating with empty array');
        await this.writeSymbols([]);
        return [];
      }

      const data = await fs.readFile(this.symbolsFilePath, 'utf8');
      const symbols = JSON.parse(data);

      if (!Array.isArray(symbols)) {
        logger.warn(
          'symbols.json contains invalid data, resetting to empty array'
        );
        await this.writeSymbols([]);
        return [];
      }

      return symbols.map((symbol) => symbol.toLowerCase());
    } catch (error) {
      logger.error('Error reading symbols file:', error);
      return [];
    }
  }

  /**
   * Записывает символы в файл symbols.json
   */
  async writeSymbols(symbols: string[]): Promise<void> {
    try {
      const dir = path.dirname(this.symbolsFilePath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(
        this.symbolsFilePath,
        JSON.stringify(symbols, null, 2),
        'utf8'
      );
    } catch (error) {
      logger.error('Error writing symbols file:', error);
      throw error;
    }
  }

  /**
   * Добавляет символ в список
   */
  async addSymbol(symbol: string): Promise<boolean> {
    const symbols = await this.getSymbols();
    const normalizedSymbol = symbol.toLowerCase();

    if (symbols.includes(normalizedSymbol)) {
      return false; // Уже существует
    }

    symbols.push(normalizedSymbol);
    await this.writeSymbols(symbols);
    return true;
  }

  /**
   * Удаляет символ из списка
   */
  async removeSymbol(symbol: string): Promise<boolean> {
    const symbols = await this.getSymbols();
    const normalizedSymbol = symbol.toLowerCase();
    const index = symbols.indexOf(normalizedSymbol);

    if (index === -1) {
      return false; // Не найден
    }

    symbols.splice(index, 1);
    await this.writeSymbols(symbols);
    return true;
  }

  /**
   * Получает путь к файлу symbols.json
   */
  getSymbolsFilePath(): string {
    return this.symbolsFilePath;
  }
}

export const symbolsManager = new SymbolsManager();
