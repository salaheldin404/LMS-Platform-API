import Redis from "ioredis";

import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

// const redis = new Redis({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT,
//   password: process.env.REDIS_PASSWORD,
//   maxRetriesPerRequest: 3,
// });

const redis = new Redis(process.env.REDIS_URL);

redis.on("error", (err) => {
  console.log("Redis Client Error", err);
});

redis.on("connect", () => {
  console.log("Redis Client Connected");
});
class CacheService {
  constructor() {
    this.redis = redis;
    this.CACHE_DURATION = {
      COURSE: 3600, // 1hour
      CATALOG: 1800, // 30minute
      SEARCH: 900, // 15minute
      USER_PROGRESS: 300, //5minute
    };
  }

  async set(key, data, expiration) {
    return await this.redis.setex(key, expiration, JSON.stringify(data));
  }

  async get(key) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async del(key) {
    return await this.redis.del(key);
  }
  async clearPattern(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length) {
      await this.redis.del(keys);
    }
  }
}

export default new CacheService();
