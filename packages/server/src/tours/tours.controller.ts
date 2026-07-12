import {zValidator} from "@hono/zod-validator";
import {createRouter} from "../common/hono";
import {getRoadtrip, tourQuerySchema} from "./tours.service";

export const toursController = createRouter().get(
  "/roadtrip",
  zValidator("query", tourQuerySchema),
  async (c) => {
    const roadtrip = await getRoadtrip(c.get("userId"), c.req.valid("query"));
    return c.json(roadtrip);
  },
);
