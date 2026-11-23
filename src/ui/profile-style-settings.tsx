import { useState } from "react";
import { USERNAME_FONTS, type UsernameFont } from "../../shared/username-fonts";
import { ColorPicker } from "../colorpicker";
import { Button, Select } from "../kit";
import { imageUrl, useAuth } from "../lib";
import { imageAccents } from "./image-accent";
import { Avatar } from "./base";
import { FONT_PREVIEW_HEIGHT, FONT_PREVIEW_TOP, FONT_PREVIEWS } from "./font-previews";
import { profileAccentStyle } from "./profile-accent";
import { Username } from "./username";

type StyleDraft = { usernameFont: UsernameFont; profileAccent: string | null; profileAccentEnd: string | null };
type Mode = "default" | "solid" | "gradient";

const MODES: [Mode, string][] = [
  ["default", "Site default"],
  ["solid", "Solid accent"],
  ["gradient", "Gradient"],
];
const FONT_OPTIONS = USERNAME_FONTS.map((entry): [string, string] => [entry.id, entry.label]);

function FontName(id: string, label: string) {
  const preview = FONT_PREVIEWS[id];
  if (!preview) return label;
  return (
    <svg
      className="font-preview"
      viewBox={`0 ${FONT_PREVIEW_TOP} ${preview.width} ${FONT_PREVIEW_HEIGHT}`}
      role="img"
      aria-label={label}
    >
      <path d={preview.d} fill="currentColor" />
    </svg>
  );
}

function ColorField({
  label,
  value,
  onChange,
  second = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  second?: boolean;
}) {
  const { me } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = async (image: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const colors = await imageAccents(imageUrl(image));
      onChange(colors[second ? 1 : 0]);
    } catch {
      setError("Could not read the picture. Try again or choose a color manually.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="style-field">
      <span>{label}</span>
      <ColorPicker label={label} value={value} onChange={onChange} />
      <div className="flex flex-wrap gap-3">
        {me?.image && (
          <Button type="button" kind="link small" disabled={busy} onClick={() => pick(me.image!)}>
            From avatar
          </Button>
        )}
        {me?.banner && (
          <Button type="button" kind="link small" disabled={busy} onClick={() => pick(me.banner!)}>
            From banner
          </Button>
        )}
        {busy && (
          <span className="muted small" role="status">
            Picking color…
          </span>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProfileStyleSettings({
  value,
  onChange,
  disabled,
}: {
  value: StyleDraft;
  onChange: (value: Partial<StyleDraft>) => void;
  disabled: boolean;
}) {
  const { me } = useAuth();
  const mode: Mode = value.profileAccent === null ? "default" : value.profileAccentEnd === null ? "solid" : "gradient";
  const [lastStart, setLastStart] = useState(value.profileAccent ?? "#2438d6");
  const [lastEnd, setLastEnd] = useState(value.profileAccentEnd ?? "#b43688");
  const start = value.profileAccent ?? lastStart;
  const end = value.profileAccentEnd ?? lastEnd;
  const setMode = (next: Mode) =>
    onChange({ profileAccent: next === "default" ? null : start, profileAccentEnd: next === "gradient" ? end : null });
  const setStart = (color: string) => {
    setLastStart(color);
    onChange({ profileAccent: color });
  };
  const setEnd = (color: string) => {
    setLastEnd(color);
    onChange({ profileAccentEnd: color });
  };
  const custom = mode !== "default";
  const appearance = { profileAccent: custom ? start : null, profileAccentEnd: mode === "gradient" ? end : null };

  return (
    <fieldset className="style-settings" disabled={disabled}>
      <div
        className="profile-theme style-preview"
        data-profile-accent={custom ? "custom" : undefined}
        style={custom ? profileAccentStyle(appearance) : undefined}
        aria-label="Profile preview"
      >
        <Avatar user={me!} size={72} plain />
        <div className="grow">
          <Username className="style-preview-name" user={me!} font={value.usernameFont} />
          <div className="bar">
            <span style={{ width: "72%" }} />
            <b>120 scrobbles</b>
          </div>
        </div>
      </div>
      <div className="row style-fields">
        <label>
          Username font
          <Select
            label="Username font"
            value={value.usernameFont}
            onChange={(font) => onChange({ usernameFont: font as UsernameFont })}
            options={FONT_OPTIONS}
            render={FontName}
          />
        </label>
        <div className="style-field">
          <span>Color style</span>
          <div className="theme-pick" role="group" aria-label="Profile color style">
            {MODES.map(([key, name]) => (
              <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {mode !== "default" && (
        <div className="row style-fields">
          <ColorField label="Accent" value={start} onChange={setStart} />
          {mode === "gradient" && <ColorField label="Second color" value={end} onChange={setEnd} second />}
        </div>
      )}
    </fieldset>
  );
}
