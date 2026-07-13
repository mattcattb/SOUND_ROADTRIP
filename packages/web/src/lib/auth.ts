import { createAuthClient } from "better-auth/react";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

/**
 * Better Auth client for React.
 * Handles the temporary Spotify session.
 */
const authClient = createAuthClient({
  baseURL: API_BASE_URL,
});

// Export auth methods and hooks
const {signIn} = authClient;
export const {useSession} = authClient;

export const signInWithSpotify = async () => {
  const result = await signIn.social({
    provider: "spotify",
    callbackURL: window.location.origin,
    errorCallbackURL: `${window.location.origin}/login`,
  });

  if (result.error) {
    throw new Error(
      result.error.status === 404
        ? "Spotify is not configured on the server. Add both the Spotify client ID and client secret, then redeploy the backend."
        : result.error.message ??
          "Spotify could not be connected. Please try again.",
    );
  }
};
