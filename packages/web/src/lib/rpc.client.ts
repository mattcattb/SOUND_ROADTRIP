import {hc} from "hono/client";
import type {AppType} from "@spotify-roadtrip/server/rpc";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const API_BASE_URL = rawBaseUrl.startsWith("http")
  ? rawBaseUrl
  : `http://${rawBaseUrl}`;

export const rpcClient = hc<AppType>(`${API_BASE_URL.replace(/\/$/, "")}/api`, {
  init: {
    credentials: "include",
  },
});
