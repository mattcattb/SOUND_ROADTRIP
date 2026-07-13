import {afterEach, beforeEach, describe, expect, mock, test} from "bun:test";
import {appEnv} from "../common/env";
import {
  clearTicketmasterCache,
  searchTicketmasterArtistEvents,
} from "./ticketmaster";

const originalFetch = globalThis.fetch;
const originalApiKey = appEnv.TICKETMASTER_API_KEY;

const event = (attractions: Array<{id: string; name: string}>) => ({
  id: "event-1",
  name: "Festival",
  url: "https://example.com/event",
  dates: {start: {dateTime: "2026-08-01T20:00:00Z"}},
  _embedded: {
    attractions,
    venues: [{
      name: "The Venue",
      city: {name: "New York"},
      country: {countryCode: "US"},
      location: {latitude: "40.7", longitude: "-74"},
    }],
  },
});

beforeEach(async () => {
  appEnv.TICKETMASTER_API_KEY = "test-key";
  await clearTicketmasterCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  appEnv.TICKETMASTER_API_KEY = originalApiKey;
});

describe("Ticketmaster artist search", () => {
  test("caches artist options and events, including concurrent requests", async () => {
    const urls: URL[] = [];
    globalThis.fetch = mock(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      await Bun.sleep(5);
      return Response.json(
        url.pathname.endsWith("attractions.json")
          ? {_embedded: {attractions: [{id: "cache-artist", name: "Cache Artist"}]}}
          : {_embedded: {events: [event([{id: "cache-artist", name: "Cache Artist"}])] }},
      );
    }) as unknown as typeof fetch;

    await Promise.all([
      searchTicketmasterArtistEvents("Cache Artist"),
      searchTicketmasterArtistEvents("cache artist"),
    ]);

    expect(urls.filter((url) => url.pathname.endsWith("attractions.json"))).toHaveLength(1);
    expect(urls.filter((url) => url.pathname.endsWith("events.json"))).toHaveLength(1);
  });

  test("paces concurrent searches to avoid Ticketmaster spike limits", async () => {
    let activeRequests = 0;
    let rateLimited = false;

    globalThis.fetch = mock(async (input) => {
      activeRequests += 1;
      if (activeRequests > 1) {
        rateLimited = true;
        activeRequests -= 1;
        return Response.json({fault: "spike limit"}, {status: 429});
      }

      await Bun.sleep(5);
      activeRequests -= 1;
      const url = new URL(String(input));
      const artistName = url.searchParams.get("keyword") ?? "Artist";
      return Response.json(
        url.pathname.endsWith("attractions.json")
          ? {_embedded: {attractions: [{id: artistName, name: artistName}]}}
          : {_embedded: {events: [event([{id: artistName, name: artistName}])] }},
      );
    }) as unknown as typeof fetch;

    const results = await Promise.all(
      ["Clairo", "Lorde", "Haim"].map((artistName) =>
        searchTicketmasterArtistEvents(artistName),
      ),
    );

    expect(rateLimited).toBe(false);
    expect(results.every((result) => result.events.length === 1)).toBe(true);
  });

  test("throws when Ticketmaster is not configured", async () => {
    appEnv.TICKETMASTER_API_KEY = undefined;

    await expect(
      searchTicketmasterArtistEvents("Clairo"),
    ).rejects.toThrow("Ticketmaster is not configured");
  });

  test("throws when Ticketmaster returns an upstream error", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({fault: "invalid key"}, {status: 401}),
    ) as unknown as typeof fetch;

    await expect(
      searchTicketmasterArtistEvents("Clairo"),
    ).rejects.toThrow("Ticketmaster returned 401");
  });

  test("uses an exact attraction id to request events", async () => {
    const urls: URL[] = [];
    globalThis.fetch = mock(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      return Response.json(
        url.pathname.endsWith("attractions.json")
          ? {_embedded: {attractions: [{id: "artist-1", name: "Clairo"}]}}
          : {_embedded: {events: [event([{id: "artist-1", name: "Clairo"}])] }},
      );
    }) as unknown as typeof fetch;

    const result = await searchTicketmasterArtistEvents("clairo");

    expect(result.events).toHaveLength(1);
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get("attractionId")).toBe("artist-1");
    expect(urls[1].searchParams.has("keyword")).toBe(false);
  });

  test("uses a selected attraction without another artist lookup", async () => {
    const urls: URL[] = [];
    globalThis.fetch = mock(async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      return Response.json({
        _embedded: {events: [event([{id: "artist-1", name: "Clairo"}])]},
      });
    }) as unknown as typeof fetch;

    const result = await searchTicketmasterArtistEvents(
      "Clairo",
      "artist-1",
    );

    expect(result.events).toHaveLength(1);
    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toEndWith("events.json");
    expect(urls[0].searchParams.get("attractionId")).toBe("artist-1");
  });

  test("filters keyword fallback events not attributed to the artist", async () => {
    globalThis.fetch = mock(async (input) => {
      const url = new URL(String(input));
      return Response.json(
        url.pathname.endsWith("attractions.json")
          ? {_embedded: {attractions: []}}
          : {_embedded: {events: [
              event([{id: "tribute", name: "Miss Americana"}]),
              {...event([{id: "artist-1", name: "Taylor Swift"}]), id: "event-2"},
            ]}},
      );
    }) as unknown as typeof fetch;

    const result = await searchTicketmasterArtistEvents("Taylor Swift");

    expect(result.events.map((item) => item.id)).toEqual(["event-2"]);
  });
});
