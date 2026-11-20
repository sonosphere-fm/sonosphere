import { Ico } from "../icons";
import { useRef, useState, type ReactNode } from "react";
import { Pages, Select } from "../kit";
import { Link, NavLink } from "react-router-dom";
import { imageUrl, PERIODS, useParam, userUrl, type ApiError } from "../lib";

// ---------- artwork ----------
/** A picture when there is one; otherwise a flat grey tile with a quiet glyph (a person for artists and listeners, a record for albums). */
export function Art({ image, kind = "album" }: { image?: number | null; kind?: "artist" | "album" | "user" }) {
  if (image) return <span className={`art art-${kind}`}><img src={imageUrl(image)} alt="" loading="lazy" /></span>;
  return (
    <span className={`art art-${kind} art-none`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {kind === "album"
          ? <path fillRule="evenodd" d="M50 20a30 30 0 1 0 0 60 30 30 0 0 0 0-60Zm0 21a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
          : <><circle cx="50" cy="39" r="17" /><path d="M16 100c0-21 15-34 34-34s34 13 34 34Z" /></>}
      </svg>
    </span>
  );
}

// ---------- states ----------
export const Empty = ({ children }: { children: ReactNode }) => <div className="state empty">{children}</div>;
function ErrorBox({ error }: { error: ApiError }) {
  return <div className="state error"><strong>{error.status === 404 ? "Nothing here." : "Something went wrong."}</strong> {error.message}</div>;
}

/** Renders children with the loaded data, or the error. There is no loading state: useApi keeps the previous screen up until data is in. */
export function Async<T>({ q, children }: { q: { data: T | null; error: ApiError | null; loading: boolean }; children: (data: T) => ReactNode }) {
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return null;
  return <>{children(q.data)}</>;
}
export function Section({ title, more, moreLabel = "View all", aside, foot, children }: { title: ReactNode; more?: string; moreLabel?: string; aside?: ReactNode; foot?: boolean; children: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>{more ? <Link to={more}>{title}</Link> : title}</h2>
        {aside}
        {more && !foot && <Link className="more" to={more}>{moreLabel} <Ico.Right /></Link>}
      </header>
      {children}
      {more && foot && <p className="more-link"><Link className="more" to={more}>{moreLabel} <Ico.Right /></Link></p>}
    </section>
  );
}
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{hint && <div className="stat-hint">{hint}</div>}</div>
);
export function Tabs({ items }: { items: [string, string, boolean?][] }) {
  return <nav className="tabs">{items.map(([to, label, end]) => <NavLink key={to} to={to} end={end ?? false}>{label}</NavLink>)}</nav>;
}
export function PeriodPicker({ def = "overall" }: { def?: string }) {
  const [period, setPeriod] = useParam("period", def);
  return <Select label="Time period" value={period} onChange={setPeriod} options={PERIODS} />;
}
export function Pager({ total, limit }: { total: number; limit: number }) {
  const [page, setPage] = useParam("page", "1");
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return <Pages page={Number(page)} pages={pages} onChange={p => { setPage(String(p)); window.scrollTo({ top: 0 }); }} />;
}

/** The message to show for something thrown. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Form helper: runs an async submit, shows its error / success message. */
export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState("");
  const lock = useRef(false);
  const run = async (fn: () => Promise<string | void>) => {
    if (lock.current) return; // a second click while the first is in flight is ignored, without repainting the button
    lock.current = true;
    // a request that is slow enough to notice puts a spinner in its button; a normal one never repaints it
    const slow = setTimeout(() => setBusy(true), 150);
    try { const msg = (await fn()) || ""; setError(""); setDone(msg); } catch (e) { setDone(""); setError(errorText(e)); } finally { clearTimeout(slow); lock.current = false; setBusy(false); }
  };
  const note = error ? <p className="form-error" role="alert">{error}</p> : done ? <p className="form-ok" role="status">{done}</p> : null;
  return { busy, run, note, error };
}
export const Avatar = ({ user, size = 40, plain }: { user: { username: string; image?: number | null }; size?: number; plain?: boolean }) => plain
  ? <span className="avatar" style={{ width: size, height: size }} aria-hidden><Art image={user.image} kind="user" /></span> // inside another link
  : <Link to={userUrl(user.username)} className="avatar" style={{ width: size, height: size }} aria-label={user.username}><Art image={user.image} kind="user" /></Link>;

// The wordmark: heavy italic type with a corner of a record (spindle and two grooves) spinning off the end.
export const LogoDisc = () => <svg className="wm-grooves" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round"><path d="M4 8a28 28 0 0 1 28 28" /><path d="M4 19a17 17 0 0 1 17 17" /></g><circle cx="5.5" cy="34.5" r="5.5" fill="currentColor" /></svg>;
export const Logo = () => <span className="wordmark" role="img" aria-label="spin">spin<LogoDisc /></span>;
