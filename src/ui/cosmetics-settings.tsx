import { useState } from "react";
import { COSMETIC_SLOTS, type CosmeticsState } from "../../shared/cosmetics";
import { api, invalidateAll, useApi, useAuth } from "../lib";
import { Button } from "../kit";
import { Async, Section, useAction } from "./base";
import { CosmeticAvatar } from "./cosmetics";
import { Username } from "./username";

export default function CosmeticsSettings() {
  const q = useApi<CosmeticsState>("/me/cosmetics");
  const [slot, setSlot] = useState<string>("accessory");
  const { me, refresh } = useAuth();
  const act = useAction();
  const save = (body: object) =>
    act.run(async () => {
      await api("/me/cosmetics", { method: "PATCH", body });
      invalidateAll();
      q.reload();
      refresh();
    });
  return (
    <Section title="Cosmetics">
      <Async q={q}>
        {(d) => (
          <div className="form">
            <div
              className="cos-preview profile-theme"
              data-cos-motion={d.showCosmetics ? "on" : "off"}
              data-header-fx={d.equipped.find((e) => e.slot === "header_bg")?.id}
            >
              <CosmeticAvatar
                name={me!.username}
                image={me!.image}
                size={96}
                appearance={{ cosmetics: d.equipped, showCosmetics: d.showCosmetics }}
              />
              <div className="hero-name">
                <Username user={{ ...me!, cosmetics: d.equipped }} />
              </div>
            </div>
            <Button
              type="button"
              kind="btn ghost"
              aria-pressed={d.showCosmetics}
              disabled={act.busy}
              onClick={() => save({ showCosmetics: !d.showCosmetics })}
            >
              Show cosmetics: {d.showCosmetics ? "on" : "off"}
            </Button>
            <p className="muted small">Turning this off stops animated effects. Static decorations stay visible.</p>
            <div className="cos-slot-picker">
              <nav className="tabs sub cos-slot-tabs">
                {COSMETIC_SLOTS.map((s) => (
                  <button type="button" key={s} className={s === slot ? "active" : ""} onClick={() => setSlot(s)}>
                    {s.replaceAll("_", " ")}
                  </button>
                ))}
              </nav>
              {!d.owned.some((c) => c.slot === slot) && (
                <p className="muted">Ask an admin to get something for this slot.</p>
              )}
              {d.owned
                .filter((c) => c.slot === slot)
                .map((c) => (
                  <div key={c.id} className="cos-owned-item">
                    <Button
                      type="button"
                      kind={d.equipped.some((e) => e.id === c.id) ? "btn" : "btn ghost"}
                      aria-pressed={d.equipped.some((e) => e.id === c.id)}
                      disabled={act.busy}
                      onClick={() => save({ slot, id: c.id, color: c.colors[0] })}
                    >
                      {c.name}
                    </Button>
                    {c.colors.length > 0 && d.equipped.some((e) => e.id === c.id) && (
                      <div className="row">
                        {c.colors.map((color) => (
                          <Button
                            type="button"
                            key={color}
                            kind={
                              d.equipped.some((e) => e.id === c.id && e.options.color === color)
                                ? "btn small"
                                : "btn ghost small"
                            }
                            aria-pressed={d.equipped.some((e) => e.id === c.id && e.options.color === color)}
                            disabled={act.busy}
                            onClick={() => save({ slot, id: c.id, color })}
                          >
                            {color}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            {d.equipped.some((e) => e.slot === slot) && (
              <Button type="button" kind="btn ghost" disabled={act.busy} onClick={() => save({ slot, id: null })}>
                Remove
              </Button>
            )}
          </div>
        )}
      </Async>
      {act.note}
    </Section>
  );
}
