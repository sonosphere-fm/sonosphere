import { USERNAME_FONTS, type UsernameFont } from "../../shared/username-fonts";
import { Select } from "../kit";
import { useAuth } from "../lib";
import { Section } from "./base";
import { Username } from "./username";

export function UsernameFontSettings({
  value: font,
  onChange,
  disabled,
}: {
  value: UsernameFont;
  onChange: (font: UsernameFont) => void;
  disabled?: boolean;
}) {
  const { me } = useAuth();
  return (
    <Section title="Username font">
      <div className="form">
        <fieldset disabled={disabled} className="border-0 p-0 m-0 min-w-0">
          <Select
            label="Font"
            value={font}
            onChange={(value) => onChange(value as UsernameFont)}
            options={USERNAME_FONTS.map((entry) => [entry.id, entry.label])}
          />
        </fieldset>
        <p className="text-2xl" aria-label="Username preview">
          <Username user={me!} font={font} />
        </p>
      </div>
    </Section>
  );
}
