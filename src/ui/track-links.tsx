import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { useState } from "react";
import type { TrackLinks as Links } from "../../shared/catalog";
import { t } from "../i18n";
import { Ico } from "../icons";
import { api, qs } from "../lib";
import { BrandIcon } from "./profile-link-icon";

const services = [
  ["spotify", "Spotify", "spotify", "#1ed760"],
  ["appleMusic", "Apple Music", "apple", "#fa243c"],
  ["tidal", "TIDAL", "tidal", undefined],
  ["youtube", "YouTube", "youtube", "#ff0033"],
] as const;

const found = new Map<string, Promise<Links>>();
function linksFor(artist: string, title: string) {
  const key = `${artist}\n${title}`;
  let p = found.get(key);
  if (!p) {
    p = api<Links>(`/track/links${qs({ artist, track: title })}`);
    p.catch(() => found.delete(key));
    found.set(key, p);
  }
  return p;
}

export function OpenIn({ artist, title }: { artist: string; title: string }) {
  const [result, setResult] = useState<Links | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => {
    setFailed(false);
    linksFor(artist, title).then(setResult, () => setFailed(true));
  };
  const open = (isOpen: boolean) => {
    if (isOpen && !result) load();
  };
  const external = { target: "_blank", rel: "noopener noreferrer" } as const;
  const listed = result ? services.filter(([key]) => result[key]) : [];
  const button = {
    label: t("music.openIn"),
    variant: "secondary",
    className: "btn ghost sq",
    children: <Ico.External />,
  } as const;
  return (
    <DropdownMenu
      placement="below"
      alignment="start"
      hasChevron={false}
      menuWidth={200}
      button={button}
      onOpenChange={open}
    >
      {failed ? (
        <DropdownMenuItem label={t("music.tryAgain")} hasCloseOnSelect={false} onClick={load} />
      ) : !result ? (
        <DropdownMenuItem label={t("music.findingLinks")} isDisabled />
      ) : (
        listed.map(([key, name, brand, color]) => (
          <DropdownMenuItem
            key={key}
            icon={<BrandIcon brand={brand} color={color} />}
            label={name}
            href={result[key]}
            {...external}
          />
        ))
      )}
      {result && !listed.length && <DropdownMenuItem label={t("music.noLinks")} isDisabled />}
      {result && !result.youtube && (
        <DropdownMenuItem
          icon={<BrandIcon brand="youtube" color="#ff0033" />}
          label={t("music.searchYouTube")}
          href={`https://www.youtube.com/results${qs({ search_query: `${artist} ${title}` })}`}
          {...external}
        />
      )}
    </DropdownMenu>
  );
}
