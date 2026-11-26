import { Fragment } from "react";
import { Link } from "react-router-dom";
import { artistUrl, qs, useApi } from "../lib";
import { t } from "../i18n";
import { Section } from "./base";
import type { ArtistCredit, Credits as CreditsData } from "../../shared/credits";

type Person = { mbid: string; name: string; notes: string[] };

function byRole(items: ArtistCredit[]) {
  const roles = new Map<string, Map<string, Person>>();
  for (const c of items) {
    const people = roles.get(c.role) ?? new Map<string, Person>();
    roles.set(c.role, people);
    const person = people.get(c.mbid) ?? { mbid: c.mbid, name: c.name, notes: [] };
    people.set(c.mbid, person);
    const [from, to] = [c.begin.slice(0, 4), c.end.slice(0, 4)];
    const years = from === to ? from : [from, to].filter(Boolean).join("–");
    for (const note of [...c.attributes, years]) if (note && !person.notes.includes(note)) person.notes.push(note);
  }
  return [...roles].map(([role, people]) => ({ role, people: [...people.values()] }));
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
  const source = q.data.source && (
    <a className="more" href={q.data.source} target="_blank" rel="noreferrer">
      {t("credits.source")}
    </a>
  );
  return (
    <Section title={t("credits.credits")} aside={source}>
      <dl className="credits">
        {byRole(q.data.items).map(({ role, people }) => (
          <Fragment key={role}>
            <dt>{role}</dt>
            <dd>
              {people.map((p) => (
                <span key={p.mbid}>
                  <Link to={artistUrl(p.name)}>{p.name}</Link>
                  {p.notes.length > 0 && <span className="muted">{p.notes.join(", ")}</span>}
                </span>
              ))}
            </dd>
          </Fragment>
        ))}
      </dl>
    </Section>
  );
}
