import {afterEach, expect, mock, test} from "bun:test";
import {appEnv} from "../common/env";
import {
  featuredArtists,
  getSpotifyArtists,
  searchArtistOptions,
} from "./tours.service";

const originalFetch = globalThis.fetch;
const originalClientId = appEnv.SPOTIFY_CLIENT_ID;
const originalClientSecret = appEnv.SPOTIFY_CLIENT_SECRET;

afterEach(() => {
  globalThis.fetch = originalFetch;
  appEnv.SPOTIFY_CLIENT_ID = originalClientId;
  appEnv.SPOTIFY_CLIENT_SECRET = originalClientSecret;
});

test("provides curated artists without an upstream request", () => {
  expect(featuredArtists).toEqual([
    {id: "3l0CmX0FuQjFxr8SK7Vqag", name: "Clairo"},
    {id: "6vWDO969PvNqNYHIOW5v0m", name: "Beyoncé"},
    {id: "2YZyLoL8N0Wb9xBt1NhZWg", name: "Kendrick Lamar"},
    {id: "6qqNVTkY8uBg9cP3Jd7DAH", name: "Billie Eilish"},
    {id: "4q3ewBCX7sLwd24euuV69X", name: "Bad Bunny"},
    {id: "7GlBOeep6PqTfFi59PTUUN", name: "Chappell Roan"},
  ]);
});

test("searches Spotify for artist choices", async () => {
  appEnv.SPOTIFY_CLIENT_ID = "client-id";
  appEnv.SPOTIFY_CLIENT_SECRET = "client-secret";
  const urls: URL[] = [];
  globalThis.fetch = mock(async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    if (url.hostname === "accounts.spotify.com") {
      return Response.json({
        access_token: "app-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
    }
    return Response.json({
      artists: {
        href: url.toString(),
        items: [{
          id: "spotify-artist-1",
          name: "Clairo",
          images: [],
          genres: ["indie pop"],
          popularity: 80,
          external_urls: {spotify: "https://open.spotify.com/artist/1"},
          followers: {href: null, total: 1},
          href: "https://api.spotify.com/v1/artists/spotify-artist-1",
          type: "artist",
          uri: "spotify:artist:spotify-artist-1",
        }],
        limit: 5,
        next: null,
        offset: 0,
        previous: null,
        total: 1,
      },
    });
  }) as unknown as typeof fetch;

  const result = await searchArtistOptions("Clairo");

  expect(result.artists.map((artist) => artist.id)).toEqual(["spotify-artist-1"]);
  expect(urls.map((url) => url.hostname)).toEqual([
    "accounts.spotify.com",
    "api.spotify.com",
  ]);
  expect(urls[1].searchParams.get("type")).toBe("artist");
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
