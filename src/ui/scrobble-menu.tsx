import { ContextMenu } from "@astryxdesign/core/ContextMenu";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Ico } from "../icons";
import { Button, Input, Modal, Select, useConfirm } from "../kit";
import { api, dateTime, invalidateAll, refreshListening, useApi, useAuth, userUrl } from "../lib";
import { useAction } from "./base";
import { t, tx } from "../i18n";
import type { Ok } from "../../shared/auth";
import type { EditScope, RecentTrack, ScopeCounts, ScrobbleEdited } from "../../shared/listening";

type Scope = "one" | EditScope;
const toScope = (v: string): Scope => (v === "track" || v === "album" || v === "artist" ? v : "one");

export function ScrobbleMenu({ row, onSelect }: { row: RecentTrack; onSelect?: () => void }) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const confirm = useConfirm();
  if (me?.username !== row.user) return null;

  const changed = () => refreshListening(row.user);
  const remove = () =>
    confirm.ask({
      title: t("player.deleteScrobbleConfirm"),
      body: tx("player.deleteScrobbleBody", {
        title: <b>{row.title}</b>,
        artist: row.artist,
        date: dateTime(row.playedAt),
      }),
      action: t("player.deleteScrobble"),
      danger: true,
      run: async () => {
        await api<Ok>(`/scrobble/${row.id}`, { method: "DELETE" });
        changed();
      },
    });

  const menuItems = (
    <>
      <DropdownMenuItem
        className="scrobble-menu-item"
        icon={<Ico.Edit />}
        label={<span className="small">{t("player.editScrobble")}</span>}
        onClick={() => setEditing(true)}
      />
      <DropdownMenuItem
        className="scrobble-menu-item"
        icon={<Ico.Check />}
        label={<span className="small">{t("player.selectScrobble")}</span>}
        onClick={() => {
          if (onSelect) onSelect();
          else navigate(`${userUrl(row.user)}/library`, { state: { selectedScrobble: row.id } });
        }}
      />
      <DropdownMenuItem
        className="scrobble-menu-item scrobble-menu-delete"
        icon={<Ico.Delete />}
        label={<span className="small">{t("player.deleteScrobble")}</span>}
        variant="destructive"
        onClick={remove}
      />
    </>
  );

  return (
    <>
      <DropdownMenu
        placement="below"
        alignment="end"
        hasChevron={false}
        menuWidth={176}
        isMenuOpen={menuOpen}
        onOpenChange={setMenuOpen}
        button={{
          label: t("player.scrobbleActions", { title: row.title }),
          variant: "ghost",
          size: "sm",
          type: "button",
          className: "bare scrobble-menu-trigger",
          children: <Ico.More />,
        }}
      >
        {menuItems}
      </DropdownMenu>
      <ContextMenu
        triggerAs="span"
        data-scrobble-context-trigger=""
        className="astryx-dropdown-menu"
        label={t("player.scrobbleActions", { title: row.title })}
        menuWidth={176}
        menuContent={menuItems}
        onOpenChange={(open) => {
          if (open) setMenuOpen(false);
        }}
      >
        {null}
      </ContextMenu>
      {editing && <EditScrobble row={row} onClose={() => setEditing(false)} onSaved={changed} />}
      {confirm.dialog}
    </>
  );
}

function EditScrobble({ row, onClose, onSaved }: { row: RecentTrack; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ artist: row.artist, track: row.title, album: row.album || "" });
  const [scope, setScope] = useState<Scope>("one");
  const act = useAction();
  const counts = useApi<ScopeCounts>(`/scrobble/${row.id}/scope`).data;

  const field = (k: keyof typeof f, label: string) => (
    <label>
      {label}
      <Input
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        required={k !== "album"}
        maxLength={255}
      />
    </label>
  );

  // The wider the correction, the fewer fields it can sensibly change.
  const options: [string, string][] = [["one", t("player.scopeOne")]];
  if ((counts?.track ?? 0) > 1) options.push(["track", t("player.scopeTrack", { count: counts?.track ?? 0 })]);
  if ((counts?.album ?? 0) > 1) options.push(["album", t("player.scopeAlbum", { count: counts?.album ?? 0 })]);
  if ((counts?.artist ?? 0) > 1) options.push(["artist", t("player.scopeArtist", { count: counts?.artist ?? 0 })]);
  const n = scope === "one" ? 1 : (counts?.[scope] ?? 1);

  const save = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<ScrobbleEdited>(`/scrobble/${row.id}`, {
        method: "PATCH",
        body: scope === "one" ? f : { ...f, scope },
      });
      if (scope !== "one") invalidateAll();
      onSaved();
      onClose();
    });
  };

  return (
    <Modal title={t("player.editScrobble")} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {options.length > 1 && (
          <label>
            {t("player.applyTo")}
            <Select
              label={t("player.applyTo")}
              value={scope}
              onChange={(v) => setScope(toScope(v))}
              options={options}
            />
          </label>
        )}
        {(scope === "one" || scope === "track") && field("track", t("player.track"))}
        {field("artist", t("player.artist"))}
        {scope !== "artist" && field("album", t("player.album"))}
        {scope === "artist" && <p className="muted small">{t("player.scopeArtistNote", { artist: row.artist })}</p>}
        {scope === "album" && (
          <p className="muted small">
            {row.album ? t("player.scopeAlbumNote", { album: row.album }) : t("player.scopeThisAlbumNote")}
          </p>
        )}
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {n > 1 ? t("player.updateScrobbles", { count: n }) : t("player.save")}
        </Button>
      </form>
    </Modal>
  );
}
