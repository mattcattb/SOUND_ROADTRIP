import {RedisClient} from "bun";
import {appEnv} from "../common/env";

export const redis = new RedisClient(appEnv.REDIS_URL, {
  connectionTimeout: 5_000,
  autoReconnect: true,
  maxRetries: 10,
  enableOfflineQueue: false,
  enableAutoPipelining: true,
});

export const connectRedis = () => redis.connect();
