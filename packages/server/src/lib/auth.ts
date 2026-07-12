import {betterAuth} from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {genericOAuth} from "better-auth/plugins";
import {db} from "../db";
import * as schema from "../db/schema";
import {appEnv} from "../common/env";

const spotifyScopes = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day - update session if older than this
  },
  socialProviders: {
    ...(appEnv.GOOGLE_CLIENT_ID && appEnv.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: appEnv.GOOGLE_CLIENT_ID,
            clientSecret: appEnv.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [
    ...(appEnv.SPOTIFY_CLIENT_ID && appEnv.SPOTIFY_CLIENT_SECRET
      ? [
          genericOAuth({
            config: [
              {
                providerId: "spotify",
                clientId: appEnv.SPOTIFY_CLIENT_ID,
                clientSecret: appEnv.SPOTIFY_CLIENT_SECRET,
                authorizationUrl: "https://accounts.spotify.com/authorize",
                tokenUrl: "https://accounts.spotify.com/api/token",
                userInfoUrl: "https://api.spotify.com/v1/me",
                scopes: spotifyScopes,
                authentication: "basic",
                overrideUserInfo: true,
                mapProfileToUser: (profile) => ({
                  id: profile.id,
                  name: profile.display_name || profile.id,
                  email: profile.email,
                  image: profile.images?.[0]?.url,
                  emailVerified: Boolean(profile.email),
                }),
              },
            ],
          }),
        ]
      : []),
  ],
});

export type Auth = typeof auth;
