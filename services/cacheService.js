// services/cacheService.js

const NodeCache = require('node-cache');

// Create a cache instance with standard TTL (time to live) of 5 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {any} - Cached data or undefined if not found
 */
function get(key) {
  return cache.get(key);
}

/**
 * Set data in cache
 * @param {string} key - Cache key
 * @param {any} value - Data to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {boolean} - True if success
 */
function set(key, value, ttl = undefined) {
  return cache.set(key, value, ttl);
}

/**
 * Delete data from cache
 * @param {string} key - Cache key
 * @returns {number} - Number of deleted entries
 */
function del(key) {
  return cache.del(key);
}

/**
 * Clear the entire cache
 * @returns {void}
 */
function flush() {
  return cache.flushAll();
}

/**
 * Generate a standard cache key for a dataset
 * @param {string} userId - User ID
 * @param {string} datasetId - Dataset ID (optional)
 * @param {string} type - Type of data (e.g., 'list', 'schema')
 * @returns {string} - Cache key
 */
function generateDatasetKey(userId, datasetId = null, type = 'detail') {
  if (datasetId) {
    return `user:${userId}:dataset:${datasetId}:${type}`;
  }
  return `user:${userId}:datasets:${type}`;
}

/**
 * Wrapper function to get cached data or fetch it if not in cache
 * @param {string} key - Cache key
 * @param {Function} fetchData - Function to fetch data if not in cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<any>} - Data from cache or freshly fetched
 */
async function getOrSet(key, fetchData, ttl = undefined) {
  const cachedData = get(key);

  if (cachedData !== undefined) {
    return cachedData;
  }

  // Data not in cache, fetch it
  const freshData = await fetchData();

  // Cache the data
  set(key, freshData, ttl);

  return freshData;
}

module.exports = {
  get,
  set,
  del,
  flush,
  generateDatasetKey,
  getOrSet
};