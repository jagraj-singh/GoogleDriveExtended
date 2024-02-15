import { RedisClient } from "./provider/redis.js"

export const CacheProviders = {
  Redis: () => {
    return RedisClient.getClient()
  },
}
