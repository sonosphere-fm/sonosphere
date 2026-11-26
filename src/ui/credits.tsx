import { Link } from "react-router-dom";
import { artistUrl, qs, useApi } from "../lib";
import { t } from "../i18n";
import { Section } from "./base";
import type { ArtistCredit, Credits as CreditsData } from "../../shared/credits";

type Person = { mbid: string; name: string; roles: string[]; notes: string[] };

const add = (list: string[], v: string) => v && !list.includes(v) && list.push(v);

function byPerson(items: ArtistCredit[]) {
  const people = new Map<string, Person>();
  for (const c of items) {
    const p = people.get(c.mbid) ?? { mbid: c.mbid, name: c.name, roles: [], notes: [] };
    people.set(c.mbid, p);
    add(p.roles, c.role);
    for (const a of c.attributes) add(p.notes, a);
    const [from, to] = [c.begin.slice(0, 4), c.end.slice(0, 4)];
    add(p.notes, from === to ? from : [from, to].filter(Boolean).join("–"));
  }
  return [...people.values()];
}

export function Credits({
  kind,
  artist,
  title = "",
}: {
  kind: "artist" | "album" | "track";
  artist: string;
  title?: string;
}) {
  const q = useApi<CreditsData>(`/credits${qs({ kind, artist, title })}`);
  if (!q.data?.items.length) return null;
  return (
    <Section title={t("credits.credits")}>
      <ul className="credits">
        {byPerson(q.data.items).map((p) => (
          <li key={p.mbid}>
            <Link to={artistUrl(p.name)}>{p.name}</Link>
            <span>{p.roles.join(", ")}</span>
            {p.notes.length > 0 && <span>{p.notes.join(", ")}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
