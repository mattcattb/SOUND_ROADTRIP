import {expect, mock, test} from "bun:test";
import type {RedisClient} from "bun";
import {createMemoryCache, createRedisCache} from "./cache";

test("memory cache coalesces concurrent loads and clears entries", async () => {
  const cache = createMemoryCache({namespace: "test"});
  const load = mock(async () => {
    await Bun.sleep(5);
    return {value: 1};
  });

  const [first, second] = await Promise.all([
    cache.getOrSet("key", 60_000, load),
    cache.getOrSet("key", 60_000, load),
  ]);
  expect(first).toEqual({value: 1});
  expect(second).toEqual({value: 1});
  expect(load).toHaveBeenCalledTimes(1);

  await cache.clear();
  await cache.getOrSet("key", 60_000, load);
  expect(load).toHaveBeenCalledTimes(2);
});

test("memory cache does not retain failed loads", async () => {
  const cache = createMemoryCache({namespace: "test"});
  const load = mock(async () => {
    if (load.mock.calls.length === 1) throw new Error("failed");
    return "recovered";
  });

  await expect(cache.getOrSet("key", 60_000, load)).rejects.toThrow("failed");
  expect(await cache.getOrSet("key", 60_000, load)).toBe("recovered");
});

test("redis cache namespaces, serializes, expires, and coalesces values", async () => {
  const values = new Map<string, string>();
  const commands: Array<[string, string[]]> = [];
  const client = {
    get: mock(async (key: string) => values.get(key) ?? null),
    send: mock(async (command: string, args: string[]) => {
      commands.push([command, args]);
      if (command === "SET") values.set(args[0], args[1]);
      return "OK";
    }),
    scan: mock(async () => ["0", [...values.keys()]] as [string, string[]]),
    del: mock(async (...keys: string[]) => {
      keys.forEach((key) => values.delete(key));
      return keys.length;
    }),
  } as unknown as RedisClient;
  const cache = createRedisCache({namespace: "ticketmaster:artists", client});
  const load = mock(async () => {
    await Bun.sleep(5);
    return [{id: "artist-1", name: "Artist"}];
  });

  const [first, second] = await Promise.all([
    cache.getOrSet("artist", 15_000, load),
    cache.getOrSet("artist", 15_000, load),
  ]);
  expect(first).toEqual(second);
  expect(load).toHaveBeenCalledTimes(1);
  expect(commands).toEqual([[
    "SET",
    ["ticketmaster:artists:artist", JSON.stringify(first), "PX", "15000"],
  ]]);

  expect(await cache.getOrSet("artist", 15_000, load)).toEqual(first);
  expect(load).toHaveBeenCalledTimes(1);
  await cache.clear();
  expect(values.size).toBe(0);
});
