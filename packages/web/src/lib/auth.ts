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
      callbackURL: `${window.location.origin}/dashboard`,
      errorCallbackURL: `${window.location.origin}/login`,
    }),
  });

  if (!response.ok) {
    throw new Error("Spotify sign-in is not configured yet.");
  }

  const data = (await response.json()) as {url?: string};

  if (data.url) {
    window.location.href = data.url;
  }
};
