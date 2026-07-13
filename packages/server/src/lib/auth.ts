import {betterAuth} from "better-auth";
import {appEnv, appOrigins} from "../common/env";

const spotifyScopes = [
  "user-read-private",
  "user-top-read",
];

export const auth = betterAuth({
  baseURL: appEnv.BETTER_AUTH_URL,
  secret: appEnv.BETTER_AUTH_SECRET,
  trustedOrigins: appOrigins,
  session: {
    expiresIn: 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
      strategy: "jwe",
      refreshCache: true,
    },
  },
  account: {
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
  },
  advanced: appEnv.NODE_ENV === "production"
    ? {
        defaultCookieAttributes: {
          sameSite: "none",
          secure: true,
        },
      }
    : undefined,
  socialProviders: {
    ...(appEnv.SPOTIFY_CLIENT_ID && appEnv.SPOTIFY_CLIENT_SECRET
      ? {
          spotify: {
            clientId: appEnv.SPOTIFY_CLIENT_ID,
            clientSecret: appEnv.SPOTIFY_CLIENT_SECRET,
            scope: spotifyScopes,
          },
        }
      : {}),
  },
});
