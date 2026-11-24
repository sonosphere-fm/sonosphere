import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { IMPORT_CHUNK, IMPORT_MAX, type ImportJob, type ImportRow, type ImportState } from "../../shared/imports";
import { t } from "../i18n";
import { Arrow, Ico } from "../icons";
import { Button, Input } from "../kit";
import { importLastfm } from "../lastfm-import";
import { api, imageUrl, num, TITLES, useApi, useAuth, userUrl, useTitle } from "../lib";
import { parseListenBrainzZip } from "../listenbrainz-import";
import { useAction } from "../ui/base";
import { BrandIcon } from "../ui/profile-link-icon";
import { active, parseImport, useImportJob } from "./import";

type Step = "hello" | "origin" | "import" | "scrobble" | "connect" | "done";
type Album = { id: number; title: string; artist: string; image: string | null };

const ORBIT_SIZE = { hello: 6, origin: 4, import: 10, scrobble: 3, connect: 7, done: 12 } satisfies Record<
  Step,
  number
>;

function seeded(n: number) {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const rand = seeded(42);
const STARS = Array.from({ length: 70 }, () => ({
  left: `${rand() * 100}%`,
  top: `${rand() * 100}%`,
  size: rand() > 0.85 ? 3 : 2,
  delay: `${-rand() * 6}s`,
  speed: `${3 + rand() * 4}s`,
}));

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

function useHeaderBottom() {
  const [top, setTop] = useState(58);
  useLayoutEffect(() => {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const measure = () => setTop(header.getBoundingClientRect().bottom);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(header);
    const root = document.documentElement;
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "auto";
    return () => {
      watch.disconnect();
      root.style.overflow = "";
      root.style.scrollbarGutter = "";
    };
  }, []);
  return top;
}

function Sky() {
  return (
    <div className="ob-stars" aria-hidden="true">
      {STARS.map((s, i) => (
        <i
          key={i}
          style={v({ left: s.left, top: s.top, width: s.size, height: s.size, "--d": s.delay, "--t": s.speed })}
        />
      ))}
    </div>
  );
}

function Planet() {
  return (
    <svg className="ob-planet" viewBox="-6 -6 52 52" aria-hidden="true">
      <defs>
        <clipPath id="ob-back">
          <rect x="-10" y="-10" width="60" height="30.6" />
        </clipPath>
        <clipPath id="ob-front">
          <rect x="-10" y="19.4" width="60" height="30.6" />
        </clipPath>
      </defs>
      <g className="ob-ring-tilt">
        <ellipse className="ob-ring" clipPath="url(#ob-back)" cx="20" cy="20" rx="18.5" ry="7" pathLength="1" />
      </g>
      <circle className="ob-sphere" cx="20" cy="20" r="11" />
      <g className="ob-ring-tilt">
        <ellipse className="ob-ring" clipPath="url(#ob-front)" cx="20" cy="20" rx="18.5" ry="7" pathLength="1" />
      </g>
    </svg>
  );
}

const SLOTS = 12;

function Satellites({ count }: { count: number }) {
  const { data } = useApi<{ items: Album[] }>("/charts?kind=albums&period=overall&limit=12");
  const covers = (data?.items ?? []).filter((a) => a.image).slice(0, SLOTS);
  const shown = (i: number) => i === 0 || Math.floor((i * count) / SLOTS) > Math.floor(((i - 1) * count) / SLOTS);
  return covers.map((a, i) => (
    <div key={a.id} className={shown(i) ? "ob-sat" : "ob-sat off"} style={v({ "--delay": `${(-i / SLOTS) * 36}s` })}>
      <img src={imageUrl(a.image as string, "small")} alt="" draggable={false} />
    </div>
  ));
}

function place(el: HTMLElement): Keyframe {
  const css = getComputedStyle(el);
  return { left: css.left, top: css.top, transform: css.transform };
}

function System({ step }: { step: Step }) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<Keyframe>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const now = place(el);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (last.current && !still)
      el.animate([last.current, now], { duration: 1200, easing: "cubic-bezier(0.65, 0, 0.25, 1)" });
    last.current = now;
  }, [step]);
  useEffect(() => {
    const el = box.current;
    if (!el?.parentElement) return;
    const watch = new ResizeObserver(() => {
      if (!el.getAnimations().length) last.current = place(el);
    });
    watch.observe(el.parentElement);
    return () => watch.disconnect();
  }, []);
  return (
    <div className="ob-system" ref={box} aria-hidden="true">
      <div className="ob-orbit">
        <div className="ob-plane">
          {step === "done" && (
            <div className="ob-burst">
              <i />
              <i />
              <i />
            </div>
          )}
          <Planet />
          <Suspense fallback={null}>
            <Satellites count={ORBIT_SIZE[step]} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Rise({ i, children, className = "" }: { i: number; children: ReactNode; className?: string }) {
  return (
    <div className={`ob-rise ${className}`} style={v({ "--i": i })}>
      {children}
    </div>
  );
}

function ScrobbleDemo() {
  const { data } = useApi<{ items: Album[] }>("/charts?kind=albums&period=overall&limit=12");
  const [plays, setPlays] = useState(0);
  const items = data?.items ?? [];
  if (!items.length) return null;
  const now = items[plays % items.length];
  return (
    <div className="ob-demo">
      <div className="ob-track">
        {now.image && <img src={imageUrl(now.image, "small")} alt="" />}
        <div className="ob-track-text">
          <span className="ob-eyebrow">Now playing</span>
          <b>{now.title}</b>
          <span className="ob-artist">{now.artist}</span>
          <div className="ob-bar">
            <div className="ob-fill" onAnimationIteration={() => setPlays((p) => p + 1)} />
          </div>
        </div>
      </div>
      <div className="ob-count">
        <b key={plays} className="ob-tick">
          {plays.toLocaleString()}
        </b>
        <span className="ob-eyebrow">{plays === 1 ? "scrobble" : "scrobbles"}</span>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  sub,
  to,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  to?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      {icon}
      <span className="ob-card-text">
        <b>{title}</b>
        <span className="ob-card-sub">{sub}</span>
      </span>
    </>
  );
  if (to)
    return (
      <Link className="ob-card" to={to}>
        {body}
      </Link>
    );
  return (
    <button type="button" className="ob-card" onClick={onClick}>
      {body}
      <Arrow />
    </button>
  );
}

type Transfer = { label: string; done: number; total: number };

async function readFile(file: File) {
  if (file.name.toLowerCase().endsWith(".zip")) {
    const data = await parseListenBrainzZip(await file.arrayBuffer());
    return { kind: "listenbrainz", rows: [...data.listens, ...data.feedback], empty: t("player.lbNoListens") };
  }
  const body = await file.text();
  const loved = /loved/i.test(file.name) || /"lovedtracks"/.test(body.slice(0, 2000));
  return {
    kind: loved ? "loved" : "scrobbles",
    rows: parseImport(file.name, body),
    empty: t("player.fileNothingFound"),
  };
}

function useImporter(onStart: () => void) {
  const [job, setJob] = useImportJob();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [started, setStarted] = useState(false);
  const action = useAction();
  const busy = job === undefined || active(job) || !!transfer || action.busy;

  useEffect(() => {
    if (!transfer) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [!!transfer]);

  const begin = (first: Transfer) => {
    setStarted(true);
    setTransfer(first);
    onStart();
  };

  const fromLastfm = (user: string) =>
    action.run(async () => {
      let begun = false;
      try {
        const result = await importLastfm(user, "scrobbles", new AbortController().signal, (done, total) => {
          const next = { label: "Downloading from Last.fm", done, total };
          if (begun || !total) {
            setTransfer(next);
            return;
          }
          begun = true;
          begin(next);
        });
        setJob(result.job);
      } finally {
        setTransfer(null);
      }
    });

  const fromFile = (file: File) =>
    action.run(async () => {
      const { kind, rows, empty } = await readFile(file);
      if (!rows.length) throw new Error(empty);
      if (rows.length > IMPORT_MAX) {
        throw new Error(t("player.fileTooBig", { rows: num(rows.length), max: num(IMPORT_MAX) }));
      }
      begin({ label: "Uploading", done: 0, total: rows.length });
      try {
        await upload(kind, rows);
      } finally {
        setTransfer(null);
      }
    });

  const upload = async (kind: string, rows: ImportRow[]) => {
    const { job: created } = await api<ImportState>("/import", { body: { kind, total: rows.length } });
    for (let n = 0; n * IMPORT_CHUNK < rows.length; n++) {
      const end = (n + 1) * IMPORT_CHUNK;
      await api(`/import/${created!.id}/chunk`, { body: { n, rows: rows.slice(n * IMPORT_CHUNK, end) } });
      setTransfer({ label: "Uploading", done: Math.min(end, rows.length), total: rows.length });
    }
    const result = await api<ImportState>(`/import/${created!.id}/start`, { body: {} });
    setJob(result.job);
  };

  return { job, transfer, started, busy, action, fromLastfm, fromFile };
}

function ImportStatus({
  job,
  transfer,
  error,
}: {
  job: ImportJob | null | undefined;
  transfer: Transfer | null;
  error: string;
}) {
  if (error) {
    return (
      <div className="ob-status" role="alert">
        <span className="ob-eyebrow">Import stopped</span>
        <p>{error}</p>
      </div>
    );
  }
  let label = "Import finished";
  let done = job?.accepted ?? 0;
  let total = 0;
  if (transfer) ({ label, done, total } = transfer);
  else if (job && active(job)) {
    label = job.status === "queued" ? "Waiting to import" : "Importing";
    done = job.done;
    total = job.total;
  } else if (job?.status !== "done") return null;
  const pct = total ? Math.max(2, Math.round((done / total) * 100)) : 100;
  return (
    <div className="ob-status" role="status">
      <span className="ob-eyebrow">{label}</span>
      <b>
        {num(done)}
        {total > 0 && <span> of {num(total)}</span>}
      </b>
      <div className="ob-bar">
        <div className="ob-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {transfer && <p>Keep this tab open until the upload finishes.</p>}
    </div>
  );
}

function ImportForm({
  busy,
  loading,
  onLastfm,
  onFile,
}: {
  busy: boolean;
  loading: boolean;
  onLastfm: (user: string) => void;
  onFile: (file: File) => void;
}) {
  const [user, setUser] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (user.trim()) onLastfm(user.trim());
  };
  return (
    <form className="ob-import" onSubmit={submit}>
      <span className="ob-eyebrow">From Last.fm</span>
      <div className="ob-import-row">
        <Input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Last.fm username"
          autoComplete="off"
          maxLength={31}
          disabled={busy}
        />
        <Button kind="btn" disabled={busy || !user.trim()} loading={loading}>
          Import
        </Button>
      </div>
      <span className="ob-eyebrow">Or from a file</span>
      <div className="ob-import-row">
        <p>CSV, JSON or a ListenBrainz export.</p>
        <Button kind="btn ghost" type="button" disabled={busy} onClick={() => file.current?.click()}>
          Choose file
        </Button>
        <input
          ref={file}
          type="file"
          hidden
          accept=".csv,.json,.zip,text/csv,application/json,application/zip,application/x-zip-compressed"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) onFile(picked);
          }}
        />
      </div>
    </form>
  );
}

const ORDER: Record<"import" | "new", Step[]> = {
  import: ["hello", "origin", "import", "connect", "done"],
  new: ["hello", "origin", "scrobble", "connect", "done"],
};

export function Onboarding() {
  const { me } = useAuth();
  useTitle(TITLES.welcome);
  const top = useHeaderBottom();
  const [step, setStep] = useState<Step>("hello");
  const [route, setRoute] = useState<"import" | "new">("new");
  const [leaving, setLeaving] = useState(false);
  const order = ORDER[route];

  const go = (next: Step) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => {
      setStep(next);
      setLeaving(false);
    }, 360);
  };

  const importer = useImporter(() => go("connect"));

  const choose = (r: "import" | "new") => {
    setRoute(r);
    go(r === "import" ? "import" : "scrobble");
  };

  let content: ReactNode = null;
  if (step === "hello")
    content = (
      <>
        <Rise i={0}>
          <h1 className="ob-title">
            Welcome to Sonosphere, <span className="ob-name">{me?.username}</span>
          </h1>
        </Rise>
        <Rise i={1}>
          <p className="ob-lede">Every song you play, mapped into a universe of your own. Let's get you set up.</p>
        </Rise>
        <Rise i={2} className="ob-actions">
          <Button kind="btn inverse ob-go" type="button" onClick={() => go("origin")}>
            Get started <Arrow />
          </Button>
        </Rise>
      </>
    );
  if (step === "origin")
    content = (
      <>
        <Rise i={0}>
          <h2 className="ob-title">Have you scrobbled before?</h2>
        </Rise>
        <div className="ob-choices">
          <Rise i={1}>
            <Card
              icon={
                <span className="ob-card-icon">
                  <Ico.Library />
                </span>
              }
              title="Yes, I have a history"
              sub="Bring years of listening with you."
              onClick={() => choose("import")}
            />
          </Rise>
          <Rise i={2}>
            <Card
              icon={
                <span className="ob-card-icon">
                  <Ico.Star />
                </span>
              }
              title="No, I'm new to this"
              sub="Start fresh. We'll show you how it works."
              onClick={() => choose("new")}
            />
          </Rise>
        </div>
      </>
    );
  if (step === "import")
    content = (
      <>
        <Rise i={0}>
          <h2 className="ob-title">Bring your whole history</h2>
        </Rise>
        <Rise i={1}>
          <p className="ob-lede">
            Every scrobble, loved track and chart comes with you, so your recommendations are smart from day one.
          </p>
        </Rise>
        <Rise i={2}>
          <ImportForm
            busy={importer.busy}
            loading={importer.action.busy}
            onLastfm={importer.fromLastfm}
            onFile={importer.fromFile}
          />
          {importer.action.note}
        </Rise>
        <Rise i={3} className="ob-actions">
          <Button kind="btn outline-invert" type="button" onClick={() => go("connect")}>
            Later
          </Button>
        </Rise>
      </>
    );
  if (step === "scrobble")
    content = (
      <>
        <Rise i={0}>
          <h2 className="ob-title">Every play leaves a trace</h2>
        </Rise>
        <Rise i={1}>
          <p className="ob-lede">
            That trace is a scrobble. They add up into your charts, your stats and recommendations that get you.
          </p>
        </Rise>
        <Rise i={2}>
          <Suspense fallback={null}>
            <ScrobbleDemo />
          </Suspense>
        </Rise>
        <Rise i={3} className="ob-actions">
          <Button kind="btn inverse ob-go" type="button" onClick={() => go("connect")}>
            Next <Arrow />
          </Button>
        </Rise>
      </>
    );
  if (step === "connect")
    content = (
      <>
        <Rise i={0}>
          <h2 className="ob-title">Connect where you listen</h2>
        </Rise>
        <div className="ob-tiles">
          <Rise i={1}>
            <Card
              icon={
                <span className="ob-card-icon spotify">
                  <BrandIcon brand="spotify" />
                </span>
              }
              title="Spotify"
              sub="One click. Scrobbles in the background."
              to="/settings/applications"
            />
          </Rise>
          <Rise i={2}>
            <Card
              icon={
                <span className="ob-card-icon">
                  <Ico.Scrobble />
                </span>
              }
              title="Any scrobbler"
              sub="Apple Music, YouTube Music, local files and any app you already use."
              to="/settings/applications"
            />
          </Rise>
        </div>
        <Rise i={3} className="ob-actions">
          <Button kind="btn inverse ob-go" type="button" onClick={() => go("done")}>
            Finish <Arrow />
          </Button>
        </Rise>
      </>
    );
  if (step === "done")
    content = (
      <>
        <Rise i={0}>
          <h2 className="ob-title">You're in orbit</h2>
        </Rise>
        <Rise i={1}>
          <p className="ob-lede">
            {importer.started
              ? "Your history keeps importing in the background and lands on your profile as it goes."
              : "Play something. Your profile fills in from the very first song."}
          </p>
        </Rise>
        <Rise i={2} className="ob-actions">
          <Button kind="btn inverse ob-go" href={me ? userUrl(me.username) : "/"}>
            Go to my profile <Arrow />
          </Button>
          <Button kind="btn outline-invert" href="/charts">
            Explore charts
          </Button>
        </Rise>
      </>
    );

  const at = order.indexOf(step);
  return (
    <div className="ob" data-step={step} style={{ top }}>
      <Sky />
      <System step={step} />
      <div className={`ob-stage${leaving ? " leaving" : ""}`} key={step}>
        <div className="ob-content">{content}</div>
      </div>
      <nav className="ob-progress" aria-label="Setup progress">
        {order.map((s, i) => (
          <span key={s} className={i === at ? "on" : i < at ? "past" : ""} />
        ))}
      </nav>
      {importer.started && step !== "import" && (
        <ImportStatus job={importer.job} transfer={importer.transfer} error={importer.action.error} />
      )}
      {step !== "done" && (
        <Link className="ob-skip" to="/">
          Skip setup
        </Link>
      )}
    </div>
  );
}
