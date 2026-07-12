import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import TanStackRouterVite from "@tanstack/router-plugin/vite";

import tailwindVite from "@tailwindcss/vite";

const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

export default defineConfig({
  envDir: "../..",
  plugins: [
    tailwindVite(),
    TanStackRouterVite({target: "react", autoCodeSplitting: true}),
    react(),
  ],
  server: {
    allowedHosts: railwayPublicDomain ? [railwayPublicDomain] : [],
  },
});
