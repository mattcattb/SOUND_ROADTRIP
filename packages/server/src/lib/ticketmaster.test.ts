import {afterEach, beforeEach, describe, expect, mock, test} from "bun:test";
import {appEnv} from "../common/env";
import {ticketmasterConcertProvider} from "./ticketmaster";

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

beforeEach(() => {
  appEnv.TICKETMASTER_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  appEnv.TICKETMASTER_API_KEY = originalApiKey;
});

describe("Ticketmaster artist search", () => {
  test("throws when Ticketmaster is not configured", async () => {
    appEnv.TICKETMASTER_API_KEY = undefined;

    await expect(
      ticketmasterConcertProvider.searchArtistEvents("Clairo"),
    ).rejects.toThrow("Ticketmaster is not configured");
  });

  test("throws when Ticketmaster returns an upstream error", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({fault: "invalid key"}, {status: 401}),
    ) as unknown as typeof fetch;

    await expect(
      ticketmasterConcertProvider.searchArtistEvents("Clairo"),
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

    const result = await ticketmasterConcertProvider.searchArtistEvents("clairo");

    expect(result.events).toHaveLength(1);
    expect(urls).toHaveLength(2);
    expect(urls[1].searchParams.get("attractionId")).toBe("artist-1");
    expect(urls[1].searchParams.has("keyword")).toBe(false);
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

    const result = await ticketmasterConcertProvider.searchArtistEvents("Taylor Swift");

    expect(result.events.map((item) => item.id)).toEqual(["event-2"]);
  });
});
