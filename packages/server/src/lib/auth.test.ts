import {expect, test} from "bun:test";
import {appEnv, appOrigins} from "../common/env";
import {auth} from "./auth";

test.skipIf(!appEnv.SPOTIFY_CLIENT_ID || !appEnv.SPOTIFY_CLIENT_SECRET)(
  "accepts the configured web origin for Spotify sign in",
  async () => {
    const webOrigin = appOrigins[0];
    const response = await auth.handler(
      new Request(
        "https://spotify-roadtripserver-production.up.railway.app/api/auth/sign-in/social",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: webOrigin,
          },
          body: JSON.stringify({
            provider: "spotify",
            callbackURL: webOrigin,
            errorCallbackURL: `${webOrigin}/login`,
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    if (appEnv.NODE_ENV === "production") {
      expect(response.headers.get("set-cookie")).toContain("SameSite=None");
    }
    expect(await response.json()).toMatchObject({
      redirect: true,
    });
  },
);
