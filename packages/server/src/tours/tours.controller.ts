import {zValidator} from "@hono/zod-validator";
import {createRouter} from "../common/hono";
import {authMiddleware} from "../auth/auth.middleware";
import {UnauthorizedException} from "../common/errors";
import {auth} from "../lib/auth";
import {
  artistOptionsSchema,
  artistSearchSchema,
  featuredArtists,
  getSpotifyArtists,
  searchArtistOptions,
  searchArtistTour,
  tourQuerySchema,
} from "./tours.service";

export const toursController = createRouter()
  .get("/artists/featured", (c) => c.json({artists: featuredArtists}))
  .get("/artists/search", zValidator("query", artistOptionsSchema), async (c) => {
    return c.json(await searchArtistOptions(c.req.valid("query").query));
  })
  .get("/events", zValidator("query", artistSearchSchema), async (c) => {
    return c.json(await searchArtistTour(c.req.valid("query").artist));
  })
  .get(
    "/artists/spotify",
    authMiddleware,
    zValidator("query", tourQuerySchema),
    async (c) => {
      const {headers, response: token} = await auth.api.getAccessToken({
        headers: c.req.raw.headers,
        body: {providerId: "spotify"},
        returnHeaders: true,
      });

      for (const cookie of headers.getSetCookie()) {
        c.header("Set-Cookie", cookie, {append: true});
      }

      if (!token.accessToken) {
        throw new UnauthorizedException("Connect Spotify to build a tour map.");
      }

      const artists = await getSpotifyArtists(
        token.accessToken,
        c.req.valid("query"),
      );
      return c.json(artists);
    },
  );
