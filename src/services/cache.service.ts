import NodeCache from 'node-cache';
import { logger } from '../utils/logger';

export class CacheService {
  private cache: NodeCache;

  constructor(defaultTtl: number = 3600) {
    this.cache = new NodeCache({
      stdTTL: defaultTtl, // Default TTL в секундах (1 час)
      checkperiod: 120, // Проверка на истекшие ключи каждые 2 минуты
      useClones: false, // Для лучшей производительности
    });

    // Логируем события кеша
    this.cache.on('set', (key, value) => {
      logger.debug(`Cache SET: ${key}`);
    });

    this.cache.on('del', (key, value) => {
      logger.debug(`Cache DEL: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache EXPIRED: ${key}`);
    });

    logger.info('Cache service initialized');
  }

  /**
   * Сохраняет значение в кеше
   * @param key Ключ
   * @param value Значение
   * @param ttl TTL в секундах (по умолчанию 3600 = 1 час)
   * @returns true если успешно сохранено
   */
  set<T>(key: string, value: T, ttl: number = 3600): boolean {
    try {
      const success = this.cache.set(key, value, ttl);
      if (success) {
        logger.debug(`Cache stored: ${key} (TTL: ${ttl}s)`);
      } else {
        logger.warn(`Failed to store in cache: ${key}`);
      }
      return success;
    } catch (error) {
      logger.error(`Error storing in cache [${key}]:`, error);
      return false;
    }
  }

  /**
   * Получает значение из кеша
   * @param key Ключ
   * @returns Значение или undefined если не найдено
   */
  get<T>(key: string): T | undefined {
    try {
      const value = this.cache.get<T>(key);
      if (value !== undefined) {
        logger.debug(`Cache hit: ${key}`);
      } else {
        logger.debug(`Cache miss: ${key}`);
      }
      return value;
    } catch (error) {
      logger.error(`Error getting from cache [${key}]:`, error);
      return undefined;
    }
  }

  /**
   * Проверяет существует ли ключ в кеше
   * @param key Ключ
   * @returns true если ключ существует
   */
  has(key: string): boolean {
    try {
      return this.cache.has(key);
    } catch (error) {
      logger.error(`Error checking cache key [${key}]:`, error);
      return false;
    }
  }

  /**
   * Удаляет ключ из кеша
   * @param key Ключ
   * @returns количество удаленных ключей
   */
  del(key: string): number {
    try {
      const deleted = this.cache.del(key);
      if (deleted > 0) {
        logger.debug(`Cache deleted: ${key}`);
      }
      return deleted;
    } catch (error) {
      logger.error(`Error deleting from cache [${key}]:`, error);
      return 0;
    }
  }

  /**
   * Удаляет несколько ключей из кеша
   * @param keys Массив ключей
   * @returns количество удаленных ключей
   */
  delMultiple(keys: string[]): number {
    try {
      const deleted = this.cache.del(keys);
      logger.debug(`Cache deleted ${deleted} keys: ${keys.join(', ')}`);
      return deleted;
    } catch (error) {
      logger.error(`Error deleting multiple keys from cache:`, error);
      return 0;
    }
  }

  /**
   * Очищает весь кеш
   */
  clear(): void {
    try {
      this.cache.flushAll();
      logger.info('Cache cleared');
    } catch (error) {
      logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Получает все ключи из кеша
   * @returns Массив ключей
   */
  keys(): string[] {
    try {
      return this.cache.keys();
    } catch (error) {
      logger.error('Error getting cache keys:', error);
      return [];
    }
  }

  /**
   * Получает статистику кеша
   * @returns Объект со статистикой
   */
  getStats(): NodeCache.Stats {
    try {
      return this.cache.getStats();
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        keys: 0,
        hits: 0,
        misses: 0,
        ksize: 0,
        vsize: 0,
      };
    }
  }

  /**
   * Получает TTL для ключа
   * @param key Ключ
   * @returns TTL в секундах или undefined
   */
  getTtl(key: string): number | undefined {
    try {
      return this.cache.getTtl(key);
    } catch (error) {
      logger.error(`Error getting TTL for key [${key}]:`, error);
      return undefined;
    }
  }

  /**
   * Устанавливает новый TTL для существующего ключа
   * @param key Ключ
   * @param ttl Новый TTL в секундах
   * @returns true если успешно обновлено
   */
  updateTtl(key: string, ttl: number): boolean {
    try {
      const success = this.cache.ttl(key, ttl);
      if (success) {
        logger.debug(`Cache TTL updated: ${key} (TTL: ${ttl}s)`);
      }
      return success;
    } catch (error) {
      logger.error(`Error updating TTL for key [${key}]:`, error);
      return false;
    }
  }

  /**
   * Получает или устанавливает значение (если его нет в кеше)
   * @param key Ключ
   * @param factory Функция для создания значения
   * @param ttl TTL в секундах
   * @returns Значение из кеша или созданное функцией factory
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttl: number = 3600
  ): Promise<T | undefined> {
    try {
      // Проверяем есть ли в кеше
      let value = this.get<T>(key);

      if (value !== undefined) {
        return value;
      }

      // Создаем новое значение
      logger.debug(`Cache miss for ${key}, creating new value`);
      value = await factory();

      if (value !== undefined) {
        this.set(key, value, ttl);
      }

      return value;
    } catch (error) {
      logger.error(`Error in getOrSet for key [${key}]:`, error);
      return undefined;
    }
  }

  /**
   * Создает ключ кеша с префиксом
   * @param prefix Префикс
   * @param parts Части ключа
   * @returns Сформированный ключ
   */
  static createKey(prefix: string, ...parts: (string | number)[]): string {
    return `${prefix}:${parts.join(':')}`;
  }
}

// Создаем глобальный экземпляр сервиса кеширования
export const cacheService = new CacheService();
