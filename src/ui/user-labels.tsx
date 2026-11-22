import { Suspense, type CSSProperties } from "react";
import {
  Star,
  ShieldCheck,
  Heart,
  MusicNotes,
  ChatCircle,
  Globe,
  Lightning,
  Medal,
  Translate,
  Sparkle,
} from "@phosphor-icons/react";
import { useApi } from "../lib";
import type { LabelDirectory, UserLabel } from "../../shared/user-labels";

const icons = {
  star: Star,
  shield: ShieldCheck,
  heart: Heart,
  music: MusicNotes,
  chat: ChatCircle,
  globe: Globe,
  lightning: Lightning,
  medal: Medal,
  translate: Translate,
  sparkle: Sparkle,
};
const badge =
  "inline-flex items-center gap-[5px] max-w-full px-1.5 py-0.5 border " +
  "border-[color:color-mix(in_srgb,var(--label-color)_50%,transparent)] " +
  "bg-[color:color-mix(in_srgb,var(--label-color)_14%,var(--bg))] " +
  "text-[color:color-mix(in_srgb,var(--label-color)_65%,var(--ink))] " +
  "font-site font-bold text-[11px] leading-[1.4] tracking-[.025em] align-middle wrap-anywhere";

export function UserLabelBadge({ label }: { label: UserLabel }) {
  const Icon = icons[label.icon] ?? Star;
  return (
    <span className={badge} style={{ "--label-color": label.color } as CSSProperties}>
      <Icon className="flex-none" size={13} weight="fill" aria-hidden />
      <span>{label.text}</span>
    </span>
  );
}
function Labels({ name, all }: { name: string; all?: boolean }) {
  const { data } = useApi<LabelDirectory>("/user-labels");
  const ids = data?.users[name.toLowerCase()] ?? [];
  const labels = (all ? ids : ids.slice(0, 1))
    .map((id) => data?.labels.find((label) => label.id === id))
    .filter((label): label is UserLabel => !!label);
  if (!labels.length) return null;
  return (
    <span className="user-labels">
      {labels.map((label) => (
        <UserLabelBadge key={label.id} label={label} />
      ))}
    </span>
  );
}
export function UserLabels(props: { name: string; all?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Labels {...props} />
    </Suspense>
  );
}
