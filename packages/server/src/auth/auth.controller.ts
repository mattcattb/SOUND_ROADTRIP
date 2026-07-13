import {createRouter} from "../common/hono";
import {auth} from "../lib/auth";

/**
 * Auth controller that handles all Better Auth routes.
 * Spotify OAuth and sessions are stateless, signed, and cookie-backed.
 */
export const authController = createRouter().all("/*", (c) => {
  return auth.handler(c.req.raw);
});
