import { Lockup, Mark } from "./brand";
import { Ico, Spinner } from "../icons";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { Pages, Select } from "../kit";
import { Link, NavLink } from "react-router-dom";
import { imageUrl, PERIODS, useParam, userUrl, type ApiError } from "../lib";
import { ImageWithFallback } from "./image";
import { cn, avatar, formError, formOk, more as moreLink, state, stateError, tabs } from "./tw";

export function Art({ image, kind = "album" }: { image?: string | null; kind?: "artist" | "album" | "user" }) {
  return (
    <ImageWithFallback src={image ? imageUrl(image, "small") : null} alt="" className={`art art-${kind} block aspect-square bg-art-none overflow-hidden w-full [&_svg]:block [&_svg]:w-full [&_svg]:h-full [&_svg]:object-cover [&_svg]:fill-art-glyph [&_img]:block [&_img]:w-full [&_img]:h-full [&_img]:object-cover`} fallback={
      <svg viewBox="0 0 100 100" aria-hidden="true">
        {kind === "album"
          ? <path fillRule="evenodd" d="M50 20a30 30 0 1 0 0 60 30 30 0 0 0 0-60Zm0 21a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
          : <><circle cx="50" cy="39" r="17" /><path d="M16 100c0-21 15-34 34-34s34 13 34 34Z" /></>}
      </svg>
    } />
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <div className={cn(state, "mpage:bg-transparent mpage:pt-1 mpage:px-0 mpage:pb-0 mpage:text-left mpage:text-[15px]")} >{children}</div>;
function ErrorBox({ error }: { error: ApiError }) {
  return <div className={cn(state, stateError)}><strong>{error.status === 404 ? "Nothing here." : "Something went wrong."}</strong> {error.message}</div>;
}

export function Async<T>({ q, children }: { q: { data: T | null; error: ApiError | null; loading: boolean }; children: (data: T) => ReactNode }) {
  if (q.error) return <ErrorBox error={q.error} />;
  if (!q.data) return null;
  return <>{children(q.data)}</>;
}
export function Section({ title, more, moreLabel = "View all", aside, foot, children }: { title: ReactNode; more?: string; moreLabel?: string; aside?: ReactNode; foot?: boolean; children: ReactNode }) {
  return (
    <section className="section mb-[34px] lg:side:last:mb-0 [.mpage_.main>&]:mb-0 [.mpage_.main>&]:pb-[34px] [.mpage_.main>&]:last:pb-0" data-more-head={more && !foot ? "" : undefined}>
      <header className="section-head flex items-baseline gap-3 mb-3.5 mpage:items-center mpage:mb-4">
        <h2 className="flex-1 text-[22px] font-bold tracking-[-.015em] side:text-[17px] mpage:text-[24px] mpage:flex-none mpage:side:text-[20px] max-md:mpage:text-[20px] [&_a]:text-inherit">{more ? <Link to={more}>{title}</Link> : title}</h2>
        {aside}
        {more && !foot && <Link className={cn(moreLink, "coarse:inline-block coarse:py-2.5 coarse:my-[-10px]")} to={more}>{moreLabel} <Ico.Right /></Link>}
      </header>
      {children}
      {more && foot && <p className="more-link text-right mt-3 mb-0"><Link className={cn(moreLink, "font-normal")} to={more}>{moreLabel} <Ico.Right /></Link></p>}
    </section>
  );
}
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div>
    <div className="stat-label text-[11px] font-medium uppercase tracking-[.08em] text-muted hero:text-muted">{label}</div>
    <div className="stat-value text-[24px] font-bold leading-[1.2] [&_a]:text-ink [&_a:hover]:text-link tracking-[-.02em] font-display max-sm:text-[20px] max-sm:hero:text-[19px] hero:[&_a]:text-ink hero:[&_a:hover]:text-link">{value}</div>
    {hint && <div className="stat-hint text-[13px] text-ink-2 hero:text-muted">{hint}</div>}
  </div>
);
export function Tabs({ items }: { items: [string, string, boolean?][] }) {
  return <nav className={tabs}>{items.map(([to, label, end]) => <NavLink key={to} to={to} end={end ?? false}>{label}</NavLink>)}</nav>;
}
export function PeriodPicker({ def = "overall" }: { def?: string }) {
  const [period, setPeriod] = useParam("period", def);
  return <Select label="Time period" value={period} onChange={setPeriod} options={PERIODS} />;
}
export function Pager({ total, limit }: { total: number; limit: number }) {
  const [page, setPage] = useParam("page", "1");
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  const go = (p: number) => {
    setPage(String(p));
    window.scrollTo({ top: 0 });
  };
  return <Pages page={Number(page)} pages={pages} onChange={go} />;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const lock = useRef(false);
  const run = async (fn: () => Promise<string | void>) => {
    if (lock.current) return;
    lock.current = true;
    // only a request slow enough to notice puts a spinner in its button
    const slow = setTimeout(() => setBusy(true), 150);
    try {
      const msg = (await fn()) || "";
      setError("");
      setDone(msg);
    } catch (e) {
      setDone("");
      setError(errorText(e));
    } finally {
      clearTimeout(slow);
      lock.current = false;
      setBusy(false);
    }
  };
  let note: ReactNode = null;
  if (error) note = <p className={formError} role="alert">{error}</p>;
  else if (done) note = <p className={formOk} role="status">{done}</p>;
  return { busy, run, note, error };
}
export const Avatar = ({ user, size = 40, plain, className }: { user: { username: string; image?: string | null }; size?: number; plain?: boolean; className?: string }) => {
  const cls = cn(avatar, className);
  return plain
    ? <span className={cls} style={{ width: size, height: size }} aria-hidden><Art image={user.image} kind="user" /></span>
    : <Link to={userUrl(user.username)} className={cls} style={{ width: size, height: size }} aria-label={user.username}><Art image={user.image} kind="user" /></Link>;
};

/** The wordmark; on small phones the header (marked `site-header`) shows just the round mark. */
export const Logo = () => (
  <span className="inline-flex items-center text-[34px] leading-none max-[521px]:text-[30px] [.site-footer_&]:text-[24px]" role="img" aria-label="sonosphere">
    <Lockup className="[.site-header_&]:max-xs:hidden" />
    <Mark className="hidden [.site-header_&]:max-xs:block" />
  </span>
);
export const Pane = ({ children }: { children: ReactNode }) => <Suspense fallback={<Spinner page />}>{children}</Suspense>;
