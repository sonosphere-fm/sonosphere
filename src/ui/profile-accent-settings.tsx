import { useState } from "react";
import { isProfileAccent } from "../../shared/profile-accent";
import { Input, Select } from "../kit";
import { useAuth } from "../lib";
import { Section } from "./base";
import { profileAccentStyle } from "./profile-accent";
import { Username } from "./username";

type AccentDraft = { profileAccent: string | null; profileAccentEnd: string | null };

export function ProfileAccentSettings({
  value,
  onChange,
  disabled,
}: {
  value: AccentDraft;
  onChange: (value: AccentDraft) => void;
  disabled?: boolean;
}) {
  const { me } = useAuth();
  const mode = value.profileAccent === null ? "default" : value.profileAccentEnd === null ? "solid" : "gradient";
  const [lastStart, setLastStart] = useState(value.profileAccent ?? "#2438d6");
  const [lastEnd, setLastEnd] = useState(value.profileAccentEnd ?? "#b43688");
  const start = value.profileAccent ?? lastStart;
  const end = value.profileAccentEnd ?? lastEnd;
  const setMode = (next: string) =>
    onChange({ profileAccent: next === "default" ? null : start, profileAccentEnd: next === "gradient" ? end : null });
  const setStart = (color: string) => {
    setLastStart(color);
    onChange({ ...value, profileAccent: color });
  };
  const setEnd = (color: string) => {
    setLastEnd(color);
    onChange({ ...value, profileAccentEnd: color });
  };
  const valid = mode === "default" || (isProfileAccent(start) && (mode !== "gradient" || isProfileAccent(end)));
  const appearance = {
    profileAccent: mode === "default" ? null : start,
    profileAccentEnd: mode === "gradient" ? end : null,
  };
  const colorField = (label: string, value: string, set: (value: string) => void) => (
    <div className="accent-color-field">
      <label>
        {label}
        <Input
          required
          pattern="#[0-9a-fA-F]{6}"
          value={value}
          onChange={(event) => set(event.target.value)}
          aria-label={`${label} hex`}
        />
      </label>
      <input
        type="color"
        aria-label={`${label} picker`}
        value={isProfileAccent(value) ? value : "#2438d6"}
        onChange={(event) => set(event.target.value)}
      />
    </div>
  );
  return (
    <Section title="Profile colors">
      <div className="form">
        <fieldset disabled={disabled} className="accent-fields">
          <label>
            Color style
            <Select
              label="Profile color style"
              value={mode}
              onChange={setMode}
              options={[
                ["default", "Site default"],
                ["solid", "Solid accent"],
                ["gradient", "Gradient"],
              ]}
            />
          </label>
          {mode !== "default" && colorField("Accent", start, setStart)}
          {mode === "gradient" && colorField("Second color", end, setEnd)}
        </fieldset>
        {!valid && (
          <p className="form-error" role="alert">
            Enter six-digit hex colors, like #2438d6.
          </p>
        )}
        <div
          className="profile-theme accent-preview"
          data-profile-accent={valid && mode !== "default" ? "custom" : undefined}
          style={valid ? profileAccentStyle(appearance) : undefined}
          aria-label="Profile color preview"
        >
          <div className="accent-preview-heading">
            <Username user={me!} />
          </div>
          <div className="section-head">
            <h3>Top music</h3>
            <span className="accent-preview-link">Library</span>
          </div>
          <div className="bar">
            <span style={{ width: "75%" }} />
            <b>120 scrobbles</b>
          </div>
          <span className="accent-preview-action">Follow</span>
        </div>
      </div>
    </Section>
  );
}
