import {z} from "zod";

const spotifyEnvSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string().trim().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().trim().optional(),
});

const ticketmasterEnvSchema = z.object({
  TICKETMASTER_API_KEY: z.string().trim().optional(),
});

const appEnvSchema = z.object({
  ...spotifyEnvSchema.shape,
  ...ticketmasterEnvSchema.shape,
  BETTER_AUTH_SECRET: z.string().trim().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://127.0.0.1:3000"),
  DATABASE_URL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().default("postgresql://postgres:postgres@127.0.0.1:5433/spotify_roadtrip"),
  ),
  REDIS_URL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().default("redis://default:redis@127.0.0.1:6379"),
  ),

  LOG_LEVEL: z.string().optional(),
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .refine(
      (origins) =>
        origins.every((origin) => {
          try {
            new URL(origin);
            return true;
          } catch {
            return false;
          }
        }),
      "Every CORS origin must be a valid URL",
    )
    .transform((origins) => origins.map((origin) => new URL(origin).origin))
    .optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PORT: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  }, z.number().int().positive().default(3000)),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["BETTER_AUTH_SECRET"],
      message: "Required in production",
    });
  }

  if (
    env.NODE_ENV === "production" &&
    env.BETTER_AUTH_URL === "http://127.0.0.1:3000"
  ) {
    context.addIssue({
      code: "custom",
      path: ["BETTER_AUTH_URL"],
      message: "Set this to the public API URL in production",
    });
  }

  if (env.NODE_ENV === "production" && !env.CORS_ORIGINS?.length) {
    context.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message: "Set this to the deployed web origin in production",
    });
  }

  if (env.NODE_ENV === "production" && !env.TICKETMASTER_API_KEY) {
    context.addIssue({
      code: "custom",
      path: ["TICKETMASTER_API_KEY"],
      message: "Required in production",
    });
  }

  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    for (const key of ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"] as const) {
      const spotifyConfigured =
        env.SPOTIFY_CLIENT_ID || env.SPOTIFY_CLIENT_SECRET;
      if (!env[key] && (env.NODE_ENV === "production" || spotifyConfigured)) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Both Spotify credentials are required together",
        });
      }
    }
  }
});
export const appEnv = appEnvSchema.parse(process.env);

export const appOrigins = appEnv.CORS_ORIGINS ?? [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];
