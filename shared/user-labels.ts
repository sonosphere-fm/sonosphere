export const LABEL_ICONS = [
  "star",
  "shield",
  "heart",
  "music",
  "chat",
  "globe",
  "lightning",
  "medal",
  "translate",
  "sparkle",
] as const;
type LabelIcon = (typeof LABEL_ICONS)[number];
export type UserLabel = { id: number; text: string; icon: LabelIcon; color: string };
export type LabelDirectory = { labels: UserLabel[]; users: Record<string, number[]> };
