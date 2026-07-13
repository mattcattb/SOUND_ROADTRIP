import {defineConfig, loadEnv} from "vite";
import react from "@vitejs/plugin-react";
import TanStackRouterVite from "@tanstack/router-plugin/vite";

import tailwindVite from "@tailwindcss/vite";

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, "../..");

  if (mode === "production") {
    if (!env.VITE_API_URL) {
      throw new Error("VITE_API_URL is required for a production web build.");
    }

    const apiUrl = URL.parse(env.VITE_API_URL);
    if (!apiUrl || !["http:", "https:"].includes(apiUrl.protocol)) {
      throw new Error("VITE_API_URL must be a valid HTTP(S) URL.");
    }
  }

  const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

  return {
    envDir: "../..",
    plugins: [
      tailwindVite(),
      TanStackRouterVite({target: "react", autoCodeSplitting: true}),
      react(),
    ],
    server: {
      allowedHosts: railwayPublicDomain ? [railwayPublicDomain] : [],
    },
  };
});
