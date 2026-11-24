import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { COSMETIC_SLOTS, type CosmeticSlot, type CosmeticsState } from "../../shared/cosmetics";
import { t, type MessageKey } from "../i18n";
import { api, invalidateAll, useApi, useAuth } from "../lib";
import { Button } from "../kit";
import { Async, Section, useAction } from "./base";
import { COSMETIC_COLORS, CosmeticAvatar } from "./cosmetics";
import { ProfileCosmetics } from "./profile-cosmetics";
import { Username } from "./username";

type Equipped = CosmeticsState["equipped"][number];
type View = { equipped: Equipped[]; showCosmetics: boolean };
type Patch = { slot: string; id: string | null; color?: string } | { showCosmetics: boolean };

const SLOTS: readonly string[] = COSMETIC_SLOTS;
const SLOT_LABELS = {
  accessory: "settings.slotAccessory",
  frame: "settings.slotFrame",
  name_fx: "settings.slotNameFx",
  page_fx: "settings.slotPageFx",
  scrobble_fx: "settings.slotScrobbleFx",
} as const satisfies Record<CosmeticSlot, MessageKey>;

/** What the preview should look like once the server accepts the patch. */
function applyPatch(view: View, patch: Patch): View {
  if ("showCosmetics" in patch) return { ...view, showCosmetics: patch.showCosmetics };
  const rest = view.equipped.filter((e) => e.slot !== patch.slot);
  if (!patch.id) return { ...view, equipped: rest };
  const next = {
    slot: patch.slot,
    id: patch.id,
    options: patch.color ? { color: patch.color } : {},
  } as Equipped;
  return { ...view, equipped: [...rest, next] };
}

function Editor({ d, reload }: { d: CosmeticsState; reload: () => unknown }) {
  const { me, refresh } = useAuth();
  const act = useAction();
  const [slot, setSlot] = useState("accessory");
  const [local, setLocal] = useState<View | null>(null);
  useEffect(() => setLocal(null), [d]);
  const view: View = local ?? {
    equipped: d.equipped,
    showCosmetics: d.showCosmetics,
  };
  const appearance = {
    cosmetics: view.equipped,
    showCosmetics: view.showCosmetics,
  };

  const save = (patch: Patch) => {
    setLocal(applyPatch(view, patch));
    act.run(async () => {
      try {
        await api("/me/cosmetics", { method: "PATCH", body: patch });
        invalidateAll();
        reload();
        refresh();
      } catch (e) {
        setLocal(null);
        throw e;
      }
    });
  };

  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = SLOTS[(SLOTS.indexOf(slot) + step + SLOTS.length) % SLOTS.length];
    setSlot(next);
    document.getElementById(`cos-tab-${next}`)?.focus();
  };

  const owned = d.owned.filter((c) => c.slot === slot);
  const current = view.equipped.find((e) => e.slot === slot);

  return (
    <div className="form cos-settings">
      <div className="cos-preview profile-theme">
        <CosmeticAvatar name={me!.username} image={me!.image} size={96} appearance={appearance} />
        <div className="hero-name">
          <Username user={{ ...me!, cosmetics: view.equipped }} />
        </div>
        <ProfileCosmetics user={appearance} contained />
      </div>

      <div className="cos-master">
        <Button
          type="button"
          kind="btn ghost"
          aria-pressed={view.showCosmetics}
          disabled={act.busy}
          onClick={() => save({ showCosmetics: !view.showCosmetics })}
        >
          {view.showCosmetics ? t("settings.showCosmeticsOn") : t("settings.showCosmeticsOff")}
        </Button>
        <p className="muted small">{t("settings.showCosmeticsHint")}</p>
      </div>

      <div className="cos-slot-picker">
        <nav
          className="tabs sub cos-slot-tabs"
          role="tablist"
          aria-label={t("settings.cosmeticSlots")}
          onKeyDown={onTabKey}
        >
          {SLOTS.map((s) => {
            const count = d.owned.filter((c) => c.slot === s).length;
            return (
              <button
                type="button"
                role="tab"
                id={`cos-tab-${s}`}
                key={s}
                aria-selected={s === slot}
                aria-controls="cos-panel"
                tabIndex={s === slot ? 0 : -1}
                className={s === slot ? "active" : ""}
                data-equipped={view.equipped.some((e) => e.slot === s) ? "" : undefined}
                onClick={() => setSlot(s)}
              >
                {t(SLOT_LABELS[s as CosmeticSlot])}
                {count > 0 && <span className="cos-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div id="cos-panel" role="tabpanel" aria-labelledby={`cos-tab-${slot}`} className="cos-panel">
          {owned.length === 0 && <p className="muted">{t("settings.cosmeticSlotEmpty")}</p>}
          {owned.map((c) => {
            const eq = view.equipped.find((e) => e.id === c.id);
            return (
              <div key={c.id} className="cos-owned-item" data-equipped={eq ? "" : undefined}>
                <Button
                  type="button"
                  kind={eq ? "btn" : "btn ghost"}
                  aria-pressed={!!eq}
                  disabled={act.busy}
                  onClick={() => !eq && save({ slot, id: c.id, color: c.colors[0] })}
                >
                  {c.name}
                </Button>
                {eq && c.colors.length > 0 && (
                  <div
                    className="cos-swatches"
                    role="group"
                    aria-label={t("settings.cosmeticColour", { name: c.name })}
                  >
                    {c.colors.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className="cos-swatch"
                        style={
                          {
                            "--swatch": COSMETIC_COLORS[color] ?? "#888",
                          } as CSSProperties
                        }
                        aria-label={color}
                        title={color}
                        aria-pressed={eq.options.color === color}
                        disabled={act.busy}
                        onClick={() => save({ slot, id: c.id, color })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {current && (
            <Button type="button" kind="btn ghost" disabled={act.busy} onClick={() => save({ slot, id: null })}>
              {t("settings.remove")}
            </Button>
          )}
        </div>
      </div>
      {act.note}
    </div>
  );
}

export default function CosmeticsSettings() {
  const q = useApi<CosmeticsState>("/me/cosmetics");
  return (
    <Section title={t("settings.cosmetics")}>
      <Async q={q}>{(d) => <Editor d={d} reload={q.reload} />}</Async>
    </Section>
  );
}
