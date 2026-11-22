import { Link } from "react-router-dom";
import { num } from "../lib";
import { Empty } from "./base";
import type { EventSummary } from "../../shared/events";
import type { EventSummary as ArtistEvent } from "../../shared/catalog";

export function EventList({ items }: { items: (EventSummary | ArtistEvent)[] }) {
  if (!items.length) return <Empty>No events found.</Empty>;
  return (
    <ul className="list-none m-0 p-0">
      {items.map(e => {
        const d = new Date(e.startsAt * 1000);
        return (
          <li key={e.id} className="flex gap-3 items-center side:items-start py-2.5 border-b border-line max-sm:flex-wrap">
            <div className="w-[50px] flex-none text-center overflow-hidden leading-none p-0 pb-1.5 rounded-none bg-card border-0">
              <span className="block text-[11px] font-medium uppercase font-sans tracking-[.06em] bg-ink text-bg px-0 py-1 mb-1.5">{d.toLocaleDateString("en-GB", { month: "short" })}</span>
              <b className="block text-[22px] font-bold font-display">{d.getDate()}</b>
              {d.getFullYear() !== new Date().getFullYear() && <span className="block text-[10px] font-semibold text-muted uppercase mt-[3px] bg-transparent p-0 tracking-normal">{d.getFullYear()}</span>}
            </div>
            <div className="flex-1 min-w-0 *:block *:overflow-hidden *:text-ellipsis">
              <Link className="font-semibold" to={`/event/${e.id}`}>{e.title}</Link>
              <span className="text-muted">{e.artists.map(a => a.name).join(", ")}</span>
              <span className="text-muted text-[13px]">{e.venue} · {e.city}{e.country ? `, ${e.country}` : ""}</span>
            </div>
            <div className="text-muted text-[13px] whitespace-nowrap text-right">
              {e.status && <span className="inline-block text-[11px] uppercase tracking-[.05em] px-1.5 py-px font-medium bg-ink text-bg">{e.status === "going" ? "Going" : "Interested"}</span>}
              <br />
              {num(e.going)} going
            </div>
          </li>
        );
      })}
    </ul>
  );
}
