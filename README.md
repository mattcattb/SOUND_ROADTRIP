# Sound Roadtrip

Sign in with Spotify, see your top artists, and explore upcoming concert locations on a 3D globe.

## What it uses

- **Spotify Web API**: Spotify OAuth and the user's top artists. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
- **Ticketmaster Discovery API**: upcoming music events and venue coordinates. Create an API key in the [Ticketmaster Developer Portal](https://developer.ticketmaster.com/).
- **Backend**: Bun, Hono, Better Auth, Drizzle, and Postgres.
- **Frontend**: React, Vite, TanStack Router/Query, and `react-globe.gl`.

Ticketmaster results are artist-name discovery matches, not confirmed tour itineraries.

## Run locally

Requirements: Bun, Docker Desktop, a Spotify app, and a Ticketmaster API key.

```bash
cp .env.example .env
bun install
bun run infra:up
bun run db:generate
bun run db:migrate
bun run dev
```

Set these values in `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/matty_stack
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TICKETMASTER_API_KEY=
```

In the Spotify app, add this redirect URI:

```text
http://localhost:3000/api/auth/oauth2/callback/spotify
```

The web app runs on `http://localhost:5173` and the API on `http://localhost:3000`.

## Railway

Create a Railway project with a **Postgres** service and an **API** service connected to this repository. The included `Dockerfile` deploys the API, builds the server, and applies committed Drizzle migrations before starting it.

For the API service:

1. Leave the root directory at the repository root.
2. Generate a public domain.
3. Set these variables:

```text
DATABASE_URL=<reference to the Postgres service's DATABASE_URL>
BETTER_AUTH_SECRET=<long random secret>
BETTER_AUTH_URL=https://<api-domain>
SPOTIFY_CLIENT_ID=<Spotify app client ID>
SPOTIFY_CLIENT_SECRET=<Spotify app client secret>
TICKETMASTER_API_KEY=<Ticketmaster API key>
CORS_ORIGINS=https://<web-domain>
NODE_ENV=production
```

`PORT` is supplied by Railway; do not hard-code it. Add this production redirect URI to the Spotify app:

```text
https://<api-domain>/api/auth/oauth2/callback/spotify
```

Deploy the web app as a separate service or static site. Its build-time variable must be:

```text
VITE_API_URL=https://<api-domain>
```

Then add the web URL to the API service's `CORS_ORIGINS`. Railway variables are available during builds and at runtime; when they change, redeploy the affected service. See Railway's [Bun guide](https://docs.railway.com/guides/bun), [monorepo guide](https://docs.railway.com/deployments/monorepo), and [variables guide](https://docs.railway.com/variables).

## Useful commands

```bash
bun run build       # production build
bun run db:generate # create a migration after schema changes
bun run db:migrate  # apply migrations
bun run infra:down  # stop local Postgres
```
