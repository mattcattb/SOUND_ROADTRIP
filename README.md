# Sound Roadtrip

Sign in with Spotify, see your top artists, and explore upcoming concert locations on a 3D globe.

## What it uses

- **Spotify Web API**: Spotify OAuth, artist search, and the user's top artists. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- **Ticketmaster Discovery API**: matching selected artists to upcoming events and venue coordinates. Create an API key in the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/).
- **Backend**: Bun, Hono, and Better Auth in stateless mode.
- **Frontend**: React, Vite, TanStack Router/Query, and `react-globe.gl`.

Spotify is the artist-discovery source. Ticketmaster privately resolves the selected
artist name to its own attraction ID; returned events are not confirmed tour itineraries.

Spotify users are temporary: OAuth state, the one-hour session, and Spotify token
material are kept in signed/encrypted HTTP-only cookies. Roadtrip does not create a
user record or store listening data in a database.

## Run locally

Requirements: Bun, Docker, a Spotify app, and a Ticketmaster API key.

```bash
cp .env.example .env
docker compose up -d
bun install
bun run dev
```

Set these values in `.env`:

```bash
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://127.0.0.1:3000
VITE_API_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TICKETMASTER_API_KEY=
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/spotify_roadtrip
REDIS_URL=redis://default:redis@127.0.0.1:6379
CORS_ORIGINS=http://127.0.0.1:5173
```

In the Spotify app, add this redirect URI:

```text
http://127.0.0.1:3000/api/auth/callback/spotify
```

Open the web app at `http://127.0.0.1:5173`; Spotify does not accept `localhost`
redirect URIs. The API runs at `http://127.0.0.1:3000`.

Redis is required when the API starts. PostgreSQL is included in Compose and its URL
is reserved for future persistence, but the current stateless application does not
connect to it.

## Railway

Create a Railway project with **API** and **web** services connected to this
repository, plus a Redis service. `Dockerfile.server` builds and runs the API.
PostgreSQL can use `DATABASE_URL` when persistence is introduced, but is not consumed
by the current stateless runtime.

For the API service:

1. Leave the root directory at the repository root.
2. Generate a public domain.
3. Set `RAILWAY_DOCKERFILE_PATH=Dockerfile.server` and these variables:

```text
BETTER_AUTH_SECRET=<long random secret>
BETTER_AUTH_URL=https://<api-domain>
SPOTIFY_CLIENT_ID=<Spotify app client ID>
SPOTIFY_CLIENT_SECRET=<Spotify app client secret>
TICKETMASTER_API_KEY=<Ticketmaster API key>
REDIS_URL=<Redis connection URL>
DATABASE_URL=<Postgres connection URL>
CORS_ORIGINS=https://<web-domain>
NODE_ENV=production
```

`PORT` is supplied by Railway; do not hard-code it. Add this production redirect URI to the Spotify app:

```text
https://<api-domain>/api/auth/callback/spotify
```

Deploy the web app as a separate service or static site. Its build-time variable must be:

```text
VITE_API_URL=https://<api-domain>
```

Then add the web URL to the API service's `CORS_ORIGINS`. Railway variables are available during builds and at runtime; when they change, redeploy the affected service. See Railway's [Bun guide](https://docs.railway.com/guides/bun), [monorepo guide](https://docs.railway.com/deployments/monorepo), and [variables guide](https://docs.railway.com/variables).

`CORS_ORIGINS` is also Better Auth's trusted-origin list, so it must contain the
exact web origin including `https://` and no path. Multiple web origins are
comma-separated.

Railway's generated API and web domains are cross-site. Production cookies are
therefore emitted as `SameSite=None; Secure`, which works in browsers that permit
cross-site cookies. For the most reliable Safari behavior, use a shared custom
parent domain such as `app.example.com` and `api.example.com`, or proxy `/api`
through the web origin. Better Auth documents why third-party auth cookies can be
blocked in [cross-domain setups](https://better-auth.com/docs/concepts/cookies#safari-itp-and-cross-domain-setups).

## Useful commands

```bash
bun run build       # production build
bun test            # server tests
```
