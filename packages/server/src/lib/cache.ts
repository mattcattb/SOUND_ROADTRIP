import type {RedisClient} from "bun";
import {redis} from "./redis";

export interface Cache {
  getOrSet: <T>(key: string, ttlMs: number, load: () => Promise<T>) => Promise<T>;
  clear: () => Promise<void>;
}

export const createMemoryCache = ({namespace, maxEntries = 500}: {
  namespace: string;
  maxEntries?: number;
}): Cache => {
  const entries = new Map<string, {expiresAt: number; value: Promise<unknown>}>();
  const cacheKey = (key: string) => `${namespace}:${key}`;

  return {
    getOrSet: <T>(key: string, ttlMs: number, load: () => Promise<T>) => {
      const namespacedKey = cacheKey(key);
      const cached = entries.get(namespacedKey);
      if (cached && cached.expiresAt > Date.now()) return cached.value as Promise<T>;
      if (cached) entries.delete(namespacedKey);

      if (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey) entries.delete(oldestKey);
      }

      const value = load().catch((error) => {
        entries.delete(namespacedKey);
        throw error;
      });
      entries.set(namespacedKey, {expiresAt: Date.now() + ttlMs, value});
      return value;
    },
    clear: async () => {
      entries.clear();
    },
  };
};

export const createRedisCache = ({namespace, client = redis}: {
  namespace: string;
  client?: RedisClient;
}): Cache => {
  const inFlight = new Map<string, Promise<unknown>>();
  const cacheKey = (key: string) => `${namespace}:${key}`;

  return {
    getOrSet: <T>(key: string, ttlMs: number, load: () => Promise<T>) => {
      const namespacedKey = cacheKey(key);
      const pending = inFlight.get(namespacedKey);
      if (pending) return pending as Promise<T>;

      const value = (async () => {
        const cached = await client.get(namespacedKey);
        if (cached !== null) return JSON.parse(cached) as T;
        const loaded = await load();
        await client.send("SET", [namespacedKey, JSON.stringify(loaded), "PX", String(ttlMs)]);
        return loaded;
      })().finally(() => inFlight.delete(namespacedKey));
      inFlight.set(namespacedKey, value);
      return value;
    },
    clear: async () => {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", `${namespace}:*`, "COUNT", 100);
        if (keys.length) await client.del(...keys);
        cursor = nextCursor;
      } while (cursor !== "0");
      inFlight.clear();
    },
  };
};
