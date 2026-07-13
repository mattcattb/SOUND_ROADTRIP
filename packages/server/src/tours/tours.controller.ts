import {zValidator} from "@hono/zod-validator";
import {createRouter} from "../common/hono";
import {authMiddleware} from "../auth/auth.middleware";
import {UnauthorizedException} from "../common/errors";
import {auth} from "../lib/auth";
import {
  artistSearchSchema,
  getRoadtrip,
  searchArtistTour,
  tourQuerySchema,
} from "./tours.service";

export const toursController = createRouter()
  .get("/search", zValidator("query", artistSearchSchema), async (c) => {
    const {artist} = c.req.valid("query");
    return c.json(await searchArtistTour(artist));
  })
  .get(
    "/roadtrip",
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

      const roadtrip = await getRoadtrip(
        token.accessToken,
        c.req.valid("query"),
      );
      return c.json(roadtrip);
    },
  );
