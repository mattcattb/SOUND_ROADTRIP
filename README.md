# Spotify Roadtrip

Spotify Roadtrip is a Bun monorepo that lets a user sign in with Spotify, reads a few of their top artists through the official Spotify Web API TypeScript SDK, looks up upcoming concerts, and plots the resulting tour stops on an interactive globe.

## Stack

- Server: Bun, Hono, Better Auth, Drizzle ORM, Postgres
- Web: React, TanStack Router, TanStack Query, Tailwind, `react-globe.gl`
- Music API: `@spotify/web-api-ts-sdk`
- Concert API: Ticketmaster Discovery API

## Why Ticketmaster

Ticketmaster Discovery is the first concert provider because it has a simple API-key auth model, supports music event search by artist keyword, and returns venue coordinates that can be plotted directly. Songkick is a strong concert data source, but its developer page currently points to paid licensing and says it is not approving hobby/student API requests. Bandsintown is another option, but its public flow is more artist-name oriented and less reliable for globe-ready venue coordinates.

## Quick Start

1. Copy envs:

```bash
cp .env.example .env
```

2. Fill in the API credentials in `.env`:

```bash
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
TICKETMASTER_API_KEY=
BETTER_AUTH_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000
```

3. Configure Spotify OAuth:

- Create an app in the Spotify Developer Dashboard.
- Add this redirect URI: `http://localhost:3000/api/auth/oauth2/callback/spotify`
- Request scopes: `user-read-email`, `user-read-private`, `user-top-read`

4. Start Postgres and install dependencies:

```bash
bun run infra:up
bun install
```

5. Run migrations and start dev servers:

```bash
bun run db:migrate
bun run dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:3000`.

## Main Flow

1. Web calls `POST /api/auth/sign-in/oauth2` with `providerId: "spotify"`.
2. Better Auth completes Spotify OAuth and stores the Spotify account token.
3. `GET /api/tours/roadtrip` reads the current user's Spotify account token.
4. The server creates a Spotify SDK client with `SpotifyApi.withAccessToken`.
5. The server calls `spotify.currentUser.topItems("artists")`.
6. Each top artist is searched against Ticketmaster Discovery.
7. The web app renders artists, event details, and globe arcs between tour stops.

## Project Structure

```txt
packages/
  server/
    src/lib/auth.ts              Better Auth + Spotify generic OAuth
    src/tours/tours.controller.ts Spotify SDK + Ticketmaster roadtrip endpoint
    src/db/schema.ts             Better Auth tables
  web/
    src/routes/index.tsx         Home/sign-in entry
    src/routes/login.tsx         Email and Spotify sign-in
    src/routes/dashboard.tsx     Globe roadtrip UI
    src/lib/auth.ts              Better Auth client + Spotify OAuth helper
```

## Scripts

- `bun run dev` - run all dev servers
- `bun run dev:server` - server only
- `bun run dev:web` - web only
- `bun run build` - build all packages
- `bun run infra:up` - start local Postgres
- `bun run infra:down` - stop local Postgres
- `bun run db:generate` - generate Drizzle migrations
- `bun run db:migrate` - apply migrations
- `bunx fallow dead-code --format json` - check unused TS/JS code

## Agent Notes

- Follow [AGENTS.md](/Users/matthewboughton/Desktop/spotify-roadtrip/AGENTS.md): keep changes small, colocate route-specific logic, and prefer inferred Hono RPC types.
- Do not add route-local `*.queries.ts`, service wrappers, or DTO type files unless reuse or complexity justifies it.
- Hono RPC is the frontend source of truth. Derive client response types from `rpcClient`, as `dashboard.tsx` does with `InferResponseType`.
- Use Fallow before/after meaningful TypeScript refactors:

```bash
bunx fallow dead-code --format json
```

- The current concert provider is intentionally isolated in `tours.controller.ts`; a future provider switch should preserve the response shape used by the dashboard unless the UI is updated at the same time.
- Ticketmaster results are keyword matches, not guaranteed canonical tour dates. The UI should present them as discovery data and link out to the source event.
