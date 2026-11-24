import { useEffect, useState } from "react";
import { Ico } from "../icons";
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
  user: { id: number; username: string };
  state: CosmeticsState;
};
export function CosmeticsAdmin({ name }: { name: string }) {
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const q = useApi<Result>(`/admin/cosmetics?name=${encodeURIComponent(name)}`);
  const act = useAction();
  useEffect(() => {
    if (!q.data) return;
    setIds(q.data.state.owned.map((c) => c.id));
  }, [q.data]);
  const ownedIds = q.data?.state.owned.map((c) => c.id) ?? [];
  const changed = ids.length !== ownedIds.length || ids.some((id) => !ownedIds.includes(id));
  const apply = () =>
    act.run(async () => {
      await api("/admin/cosmetics", {
        body: {
          username: name,
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
      <Async q={q}>
        {(d) => (
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
                          {ids.includes(c.id) && <Ico.Check />}
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
        )}
      </Async>
    </Section>
  );
}
