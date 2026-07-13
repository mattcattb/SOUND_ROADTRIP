import {afterEach, expect, mock, test} from "bun:test";
import {getSpotifyArtists} from "./tours.service";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("loads Spotify artists without searching for concerts", async () => {
  const urls: URL[] = [];
  globalThis.fetch = mock(async (input) => {
    urls.push(new URL(String(input)));
    return Response.json({
      items: [{
        id: "spotify-artist-1",
        name: "Clairo",
        images: [],
        genres: ["indie pop"],
        popularity: 80,
        external_urls: {spotify: "https://open.spotify.com/artist/1"},
      }],
      href: "https://api.spotify.com/v1/me/top/artists",
      limit: 5,
      next: null,
      offset: 0,
      previous: null,
      total: 1,
    });
  }) as unknown as typeof fetch;

  const result = await getSpotifyArtists("access-token", {limit: 5});

  expect(result.artists.map((artist) => artist.name)).toEqual(["Clairo"]);
  expect(urls).toHaveLength(1);
  expect(urls[0].hostname).toBe("api.spotify.com");
});
