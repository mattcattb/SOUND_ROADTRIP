import {createFileRoute, Link} from "@tanstack/react-router";
import { useState } from "react";
import {Disc3} from "lucide-react";
import {Button, Card, CardContent, CardHeader, CardTitle} from "../components/ui";
import {signInWithSpotify} from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const connectSpotify = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithSpotify();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Spotify could not be connected.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Link to="/" className="transition hover:text-foreground">
              ← Back
            </Link>
          </div>
          <CardTitle className="text-center text-2xl">Connect Spotify</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Your connection lasts one hour and is stored only in encrypted cookies.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {error ? (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            ) : null}
            <Button
              className="w-full"
              effect="glow"
              onClick={connectSpotify}
              disabled={loading}
            >
              <Disc3 className="h-4 w-4" />
              {loading ? "Connecting…" : "Continue with Spotify"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              No Roadtrip account or password is created.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
