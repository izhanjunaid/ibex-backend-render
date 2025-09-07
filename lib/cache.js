const NodeCache = require('node-cache');

/**
 * A robust, singleton cache manager for the application.
 *
 * This manager provides a centralized caching mechanism using node-cache,
 * featuring standard cache operations (get, set, del) and enhanced
 * capabilities like wildcard pattern deletion and standardized key generation.
 *
 * Key features:
 * - Singleton pattern: Ensures a single cache instance throughout the app.
 * - Standard TTL: Default 1-hour TTL for all cached items.
 * - Automatic cloning: Prevents mutation of stored objects/arrays.
 * - Wildcard deletion: `delPattern` method to invalidate multiple related keys.
 * - Standardized key generation: Methods to create consistent, complex cache keys.
 *
 * @class CacheManager
 */
class CacheManager {
  constructor() {
    if (!CacheManager.instance) {
      /**
       * The underlying node-cache instance.
       * @type {NodeCache}
       * @private
       */
      this.cache = new NodeCache({
        stdTTL: 3600, // 1 hour
        checkperiod: 600, // 10 minutes
        useClones: true, // IMPORTANT: returns clones to prevent object mutation
      });
      console.log('✅ Cache Manager initialized');
      CacheManager.instance = this;
    }
    return CacheManager.instance;
  }

  /**
   * Retrieves a value from the cache.
   * @param {string} key - The cache key.
   * @returns {*} The cached value, or undefined if not found.
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Stores a value in the cache.
   * @param {string} key - The cache key.
   * @param {*} value - The value to store.
   * @param {number} [ttl] - Optional time-to-live in seconds.
   * @returns {boolean} True if the item was successfully set.
   */
  set(key, value, ttl) {
    return this.cache.set(key, value, ttl);
  }

  /**
   * Deletes a key from the cache.
   * @param {string} key - The cache key to delete.
   * @returns {number} The number of keys deleted (0 or 1).
   */
  del(key) {
    return this.cache.del(key);
  }

  /**
   * Deletes keys from the cache that match a wildcard pattern.
   *
   * This method iterates through all keys in the cache and deletes those
   * that match the provided pattern. The pattern uses an asterisk (*) as a
   * wildcard character.
   *
   * @param {string} pattern - The wildcard pattern to match (e.g., "user:*:profile").
   * @returns {number} The number of keys deleted.
   *
   * @example
   * // To clear all daily attendance caches for a specific user:
   * // cacheManager.delPattern("date:*:user:USER_ID:/api/attendance/*");
   */
  delPattern(pattern) {
    const keys = this.cache.keys();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deletedCount = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        if (this.del(key)) {
          deletedCount++;
        }
      }
    }
    return deletedCount;
  }

  /**
   * Flushes the entire cache.
   */
  flush() {
    this.cache.flushAll();
  }

  /**
   * Generates a standardized user-specific cache key part.
   * @param {string} userId - The user's ID.
   * @param {string} url - The request URL.
   * @returns {string} The formatted user key part.
   */
  userKey(userId, url) {
    return `user:${userId}:${url}::`;
  }

  /**
   * Generates a standardized date-specific cache key part.
   * @param {string} date - The date string (e.g., "YYYY-MM-DD").
   * @param {string} userKey - The user-specific key part.
   * @returns {string} The formatted date key part.
   */
  dateKey(date, userKey) {
    return `date:${date}:${userKey}`;
  }
}

const instance = new CacheManager();
Object.freeze(instance);

module.exports = instance;
