import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../kit";
import { albumUrl, artistUrl, trackUrl } from "../lib";
import { DetailsDialog, RenameDialog, TracklistDialog, type EditTarget } from "./catalogue";
import { useRole } from "./common";

type Kind = "artist" | "album" | "track";
type Props = { kind: Kind; item: EditTarget; onDone: () => void };

function pageUrl(kind: Kind, name: string, artist: string | null) {
  if (kind === "artist") return artistUrl(name);
  if (kind === "album") return albumUrl(artist!, name);
  return trackUrl(artist!, name);
}

export function AdminTools({ kind, item, onDone }: Props) {
  const [open, setOpen] = useState<"details" | "rename" | null>(null);
  const nav = useNavigate();
  if (useRole() !== "admin") return null;
  const close = () => setOpen(null);
  const saved = () => {
    close();
    onDone();
  };
  const renamed = (_msg: string, name: string) => {
    close();
    nav(pageUrl(kind, name, item.artist), { replace: true });
  };
  return (
    <>
      <Button kind="btn ghost" type="button" onClick={() => setOpen("details")}>
        Edit details
      </Button>
      <Button kind="btn ghost" type="button" onClick={() => setOpen("rename")}>
        Rename
      </Button>
      {open === "details" && <DetailsDialog kind={kind} item={item} close={close} done={saved} />}
      {open === "rename" && <RenameDialog kind={kind} item={item} close={close} done={renamed} />}
    </>
  );
}

export function TracklistTool({ item, onDone }: Omit<Props, "kind">) {
  const [open, setOpen] = useState(false);
  if (useRole() !== "admin") return null;
  const saved = () => {
    setOpen(false);
    onDone();
  };
  return (
    <>
      <Button kind="link small" type="button" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open && <TracklistDialog item={item} close={() => setOpen(false)} done={saved} />}
    </>
  );
}
