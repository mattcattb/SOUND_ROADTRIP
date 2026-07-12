import {zValidator} from "@hono/zod-validator";
import {createRouter} from "../common/hono";
import {authMiddleware} from "../auth/auth.middleware";
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
      const roadtrip = await getRoadtrip(c.get("userId"), c.req.valid("query"));
      return c.json(roadtrip);
    },
  );
