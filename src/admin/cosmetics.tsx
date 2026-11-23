import { useEffect, useState, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { api, useApi } from "../lib";
import { Async, Section, useAction } from "../ui/base";
import { COSMETIC_SLOTS, type CosmeticSlot, type Cosmetic, type CosmeticsState } from "../../shared/cosmetics";

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  accessory: "Accessories",
  frame: "Frames",
  name_fx: "Username effects",
  page_fx: "Page effects",
  scrobble_fx: "Scrobble effects",
};

type Result = {
  catalog: Cosmetic[];
  user: { id: number; username: string } | null;
  state: CosmeticsState | null;
};
export function CosmeticsAdmin() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const q = useApi<Result>(`/admin/cosmetics?name=${encodeURIComponent(name)}`);
  const act = useAction();
  useEffect(() => {
    if (!q.data) return;
    setIds(q.data.state?.owned.map((c) => c.id) ?? []);
  }, [q.data]);
  function searchUser(e: FormEvent) {
    e.preventDefault();
    setName(search.trim());
  }
  const ownedIds = q.data?.state?.owned.map((c) => c.id) ?? [];
  const changed = ids.length !== ownedIds.length || ids.some((id) => !ownedIds.includes(id));
  const apply = () =>
    act.run(async () => {
      if (!q.data?.user) return;
      await api("/admin/cosmetics", {
        body: {
          username: q.data.user.username,
          ids,
          action: "apply",
          note,
        },
      });
      q.reload();
      return "Cosmetics updated.";
    });
  return (
    <Section title="Cosmetics">
      <form className="flex flex-wrap items-end gap-2.5" onSubmit={searchUser}>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
          Find user
          <Input value={search} disabled={act.busy} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button kind="btn" type="submit" disabled={act.busy}>
          Search
        </Button>
      </form>
      <Async q={q}>
        {(d) =>
          d.user && (
            <>
              <div className="form">
                <div className="w-full min-w-0 grid gap-5">
                  {COSMETIC_SLOTS.map((slot) => (
                    <fieldset key={slot} className="m-0 min-w-0 border-0 p-0">
                      <legend className="mb-2 p-0 font-semibold text-site-ink">{SLOT_LABELS[slot]}</legend>
                      <div className="cos-catalog w-full">
                        {d.catalog
                          .filter((c) => c.slot === slot)
                          .map((c) => (
                            <Button
                              key={c.id}
                              type="button"
                              kind={ids.includes(c.id) ? "btn" : "btn ghost"}
                              aria-pressed={ids.includes(c.id)}
                              disabled={act.busy}
                              onClick={() =>
                                setIds((v) => (v.includes(c.id) ? v.filter((id) => id !== c.id) : [...v, c.id]))
                              }
                            >
                              {ids.includes(c.id) && <span aria-hidden="true">✓ </span>}
                              {c.name}
                            </Button>
                          ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <label>
                  Note
                  <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="row">
                  <Button kind="btn" type="button" disabled={act.busy || !changed} onClick={apply}>
                    Apply
                  </Button>
                </div>
                {act.note}
              </div>
            </>
          )
        }
      </Async>
    </Section>
  );
}
