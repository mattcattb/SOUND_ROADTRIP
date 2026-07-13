import { cors } from "hono/cors";

import {appOrigins} from "./env";

export const corsMiddleware = cors({
  origin: appOrigins,
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 86400, // 24 hours
});
