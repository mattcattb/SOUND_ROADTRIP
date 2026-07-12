import { createAuthClient } from "better-auth/react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Better Auth client for React.
 * Handles authentication state, sign-in, sign-up, and sign-out.
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
});

// Export auth methods and hooks
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;

export const signInWithSpotify = async () => {
  const response = await fetch(`${API_BASE_URL}/api/auth/sign-in/oauth2`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      providerId: "spotify",
      callbackURL: window.location.origin,
      errorCallbackURL: `${window.location.origin}/login`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Spotify is not configured on the server. Add both the Spotify client ID and client secret, then redeploy the backend."
        : "Spotify could not be connected. Please try again.",
    );
  }

  const data = (await response.json()) as {url?: string};

  if (data.url) {
    window.location.href = data.url;
  }
};
