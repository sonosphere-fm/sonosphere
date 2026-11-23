import {
  AppleLogo,
  DiscordLogo,
  GithubLogo,
  Globe,
  Heart,
  InstagramLogo,
  LastfmLogo,
  Link,
  LinktreeLogo,
  MusicNotes,
  SoundcloudLogo,
  SpotifyLogo,
  Star,
  TiktokLogo,
  TwitchLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import type { ProfileLinkIcon as IconName } from "../../shared/profile-links";

const ICONS = {
  link: Link,
  globe: Globe,
  discord: DiscordLogo,
  spotify: SpotifyLogo,
  lastfm: LastfmLogo,
  soundcloud: SoundcloudLogo,
  youtube: YoutubeLogo,
  apple: AppleLogo,
  instagram: InstagramLogo,
  tiktok: TiktokLogo,
  twitch: TwitchLogo,
  github: GithubLogo,
  linktree: LinktreeLogo,
  music: MusicNotes,
  heart: Heart,
  star: Star,
};

export function ProfileLinkIcon({ icon = "link" }: { icon?: IconName }) {
  if (icon === "bandcamp") {
    return (
      <svg className="ico shrink-0" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 18.75 7.5 5.25H24l-7.5 13.5Z" />
      </svg>
    );
  }
  const Icon = ICONS[icon] ?? Link;
  return <Icon className="ico shrink-0" aria-hidden="true" weight="fill" />;
}
