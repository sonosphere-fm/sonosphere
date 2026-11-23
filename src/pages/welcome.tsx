import { useState } from "react";
import { Button } from "../kit";
import { TITLES, useAuth, useTitle } from "../lib";

type Step = "start" | "lastfm" | "new" | "connect";

export function Welcome() {
  const { me } = useAuth();
  const [step, setStep] = useState<Step>("start");
  useTitle(TITLES.welcome);

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Welcome to Sonosphere, {me?.username}!</h1>
      <div className="onboard">
        {step === "start" && (
          <>
            <h2>Have you used Last.fm before?</h2>
            <p>Sonosphere keeps track of the music you listen to. Tell us where you're starting from.</p>
            <div className="row">
              <Button kind="btn" onClick={() => setStep("lastfm")}>
                Yes, I have an account
              </Button>
              <Button kind="btn ghost" onClick={() => setStep("new")}>
                No, I'm new to this
              </Button>
            </div>
          </>
        )}
        {step === "lastfm" && (
          <>
            <h2>Bring your scrobbles with you</h2>
            <p>
              Import your Last.fm history and your profile, charts and recommendations fill in from everything you've
              played there. Your Last.fm account stays as it is.
            </p>
            <div className="row">
              <Button kind="btn" href="/import">
                Import from Last.fm
              </Button>
              <Button kind="btn ghost" onClick={() => setStep("connect")}>
                Skip for now
              </Button>
            </div>
          </>
        )}
        {step === "new" && (
          <>
            <h2>What's a scrobble?</h2>
            <p>
              A scrobble is a record of one song you played: the track, the artist and when you listened. Connect the
              apps you listen with and every song is scrobbled to your profile on its own.
            </p>
            <p>
              Over time your scrobbles build charts of your top artists, albums and tracks, and they shape your
              recommendations and soundalikes: the listeners whose taste is closest to yours.
            </p>
            <div className="row">
              <Button kind="btn" onClick={() => setStep("connect")}>
                Next
              </Button>
            </div>
          </>
        )}
        {step === "connect" && (
          <>
            <h2>Connect a player</h2>
            <p>
              Connect a player so every song you play from now on is scrobbled. Spotify, desktop players and phone apps
              all work.
            </p>
            <div className="row">
              <Button kind="btn" href="/settings/applications">
                Connect a player
              </Button>
              <Button kind="btn ghost" href="/">
                Go to your home page
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
