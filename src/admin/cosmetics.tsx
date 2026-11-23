import { useState, type FormEvent } from "react";
import { Button, Input, Textarea } from "../kit";
import { api, useApi } from "../lib";
import { Async, Section, useAction } from "../ui/base";
import {
  COSMETIC_SLOTS,
  type Cosmetic,
  type CosmeticsState,
} from "../../shared/cosmetics";

const SLOT_LABELS = [
  "Accessories",
  "Frames",
  "Username effects",
  "Header backgrounds",
  "Page effects",
  "Scrobble effects",
];

type Result = {
  catalog: Cosmetic[];
  user: { id: number; username: string } | null;
  state: CosmeticsState | null;
};
export function CosmeticsAdmin() {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [users, setUsers] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const q = useApi<Result>(`/admin/cosmetics?name=${encodeURIComponent(name)}`);
  const act = useAction();
  function searchUser(e: FormEvent) {
    e.preventDefault();
    setName(search.trim());
    setUsers(search.trim());
  }
  const apply = (action: string) =>
    act.run(async () => {
      await api("/admin/cosmetics", {
        body: {
          users: users.split(/[\s,]+/).filter(Boolean),
          ids,
          action,
          note,
        },
      });
      q.reload();
      return action === "grant" ? "Cosmetics granted." : "Cosmetics revoked.";
    });
  return (
    <Section title="Cosmetics">
      <form className="row" onSubmit={searchUser}>
        <label>
          Find user
          <Input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button kind="btn" type="submit">
          Search
        </Button>
      </form>
      <Async q={q}>
        {(d) => (
          <>
            {d.user && (
              <p>
                {d.user.username} owns:{" "}
                {d.state?.owned.map((c) => c.name).join(", ") || "none"}.
              </p>
            )}
            <div className="form">
              <label>
                Usernames (separate with commas or spaces)
                <Textarea
                  value={users}
                  onChange={(e) => setUsers(e.target.value)}
                />
              </label>
              <div className="w-full min-w-0 grid gap-5">
                {COSMETIC_SLOTS.map((slot, index) => (
                  <fieldset key={slot} className="m-0 min-w-0 border-0 p-0">
                    <legend className="mb-2 p-0 font-semibold text-site-ink">
                      {SLOT_LABELS[index]}
                    </legend>
                    <div className="cos-catalog w-full">
                      {d.catalog
                        .filter((c) => c.slot === slot)
                        .map((c) => (
                          <Button
                            key={c.id}
                            type="button"
                            kind="btn ghost"
                            aria-pressed={ids.includes(c.id)}
                            disabled={act.busy}
                            onClick={() =>
                              setIds((v) =>
                                v.includes(c.id)
                                  ? v.filter((id) => id !== c.id)
                                  : [...v, c.id],
                              )
                            }
                          >
                            {c.name}
                          </Button>
                        ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <label>
                Note
                <Input
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="row">
                <Button
                  kind="btn"
                  type="button"
                  disabled={act.busy || !ids.length || !users.trim()}
                  onClick={() => apply("grant")}
                >
                  Grant selected
                </Button>
                <Button
                  kind="btn ghost"
                  type="button"
                  disabled={act.busy || !ids.length || !users.trim()}
                  onClick={() => apply("revoke")}
                >
                  Revoke selected
                </Button>
              </div>
              {act.note}
            </div>
          </>
        )}
      </Async>
    </Section>
  );
}
