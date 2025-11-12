const cacheManager = require("cache-manager");

// Create an in-memory cache
const memoryCache = cacheManager.createCache();
var AppCache = {
  set: async (key, value) => {
    return await memoryCache.set(key, value);
  },
  get: async (key) => {
    return await memoryCache.get(key);
  },
  del: async (key) => {
    return await memoryCache.del(key);
  },
};
module.exports = AppCache;
