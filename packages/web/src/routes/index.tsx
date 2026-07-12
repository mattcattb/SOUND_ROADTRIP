import {createFileRoute, Link} from "@tanstack/react-router";
import {Disc3, Map} from "lucide-react";
import {Button} from "../components/ui";
import {signInWithSpotify, useSession} from "../lib/auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const {data: session, isPending} = useSession();

  return (
    <div className="space-y-10">
      <section className="grid min-h-[68vh] gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 text-sm text-muted-foreground">
            <Disc3 className="h-4 w-4 text-primary" />
            Spotify-powered concert mapping
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Spotify Roadtrip
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Sign in with Spotify, pull a handful of your top artists, find upcoming concerts,
              and trace the tour path on an interactive world globe.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isPending ? null : session ? (
              <Link to="/dashboard">
                <Button effect="glow">Open globe</Button>
              </Link>
            ) : (
              <Button effect="glow" onClick={signInWithSpotify}>
                <Disc3 className="h-4 w-4" />
                Sign in with Spotify
              </Button>
            )}
            <Link to="/login">
              <Button variant="outline">Email sign in</Button>
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-[#071013] p-6 text-white">
          <div className="absolute inset-0 opacity-75 [background-image:radial-gradient(circle_at_30%_30%,rgba(20,184,166,0.38),transparent_34%),radial-gradient(circle_at_70%_20%,rgba(245,158,11,0.22),transparent_30%),linear-gradient(140deg,#071013,#0f172a_58%,#111827)]" />
          <div className="relative flex h-full min-h-[372px] flex-col justify-between">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Live route preview</span>
              <Map className="h-5 w-5" />
            </div>
            <div className="space-y-5">
              <div className="h-44 rounded-full border border-white/20 bg-[radial-gradient(circle_at_45%_40%,rgba(45,212,191,0.9),rgba(14,165,233,0.35)_42%,rgba(15,23,42,0.8)_70%)] shadow-[0_0_80px_rgba(20,184,166,0.36)]" />
              <div className="grid grid-cols-3 gap-3 text-sm">
                {["London", "Berlin", "Tokyo"].map((city) => (
                  <div key={city} className="rounded-md border border-white/15 bg-white/10 px-3 py-2">
                    {city}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
