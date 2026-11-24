import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Button } from "../kit";
import { albumUrl, artistUrl, trackUrl } from "../lib";
import { DetailsDialog, RenameDialog, TracklistDialog, type EditTarget } from "./catalogue";
import { useRole } from "./common";
import { t } from "./i18n";

export { ready } from "./i18n";

type Kind = "artist" | "album" | "track";
export type AdminEdit = "details" | "rename";

function pageUrl(kind: Kind, name: string, artist: string | null) {
  if (kind === "artist") return artistUrl(name);
  if (kind === "album") return albumUrl(artist!, name);
  return trackUrl(artist!, name);
}

export function AdminItems({ pick }: { pick: (edit: AdminEdit) => void }) {
  if (useRole() !== "admin") return null;
  return (
    <>
      <DropdownMenuItem label={t("admin.editDetails")} onClick={() => pick("details")} />
      <DropdownMenuItem label={t("admin.rename")} onClick={() => pick("rename")} />
    </>
  );
}

type DialogProps = { kind: Kind; item: EditTarget; edit: AdminEdit; close: () => void; onDone: () => void };

export function AdminDialog({ kind, item, edit, close, onDone }: DialogProps) {
  const nav = useNavigate();
  const saved = () => {
    close();
    onDone();
  };
  const renamed = (_msg: string, name: string) => {
    close();
    nav(pageUrl(kind, name, item.artist), { replace: true });
  };
  if (edit === "details") return <DetailsDialog kind={kind} item={item} close={close} done={saved} />;
  return <RenameDialog kind={kind} item={item} close={close} done={renamed} />;
}

export function TracklistTool({ item, onDone }: { item: EditTarget; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (useRole() !== "admin") return null;
  const saved = () => {
    setOpen(false);
    onDone();
  };
  return (
    <>
      <Button kind="link small" type="button" onClick={() => setOpen(true)}>
        {t("admin.edit")}
      </Button>
      {open && <TracklistDialog item={item} close={() => setOpen(false)} done={saved} />}
    </>
  );
}
