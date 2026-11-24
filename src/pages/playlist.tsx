import { useState, type FormEvent } from "react";
import { t, tx } from "../i18n";
import { Button, Input, Textarea, useConfirm } from "../kit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, dur, useApi, userUrl, useTitle } from "../lib";
import { Art, Async, Empty, useAction } from "../ui/base";
import { TrackList } from "../ui/lists";
import { PlayButton } from "../player";
import { Hero } from "./music/shared";
import type { PlaylistOk, PlaylistPage as PlaylistData } from "../../shared/playlists";

export function PlaylistPage() {
  const id = useParams().id;
  const q = useApi<PlaylistData>(`/playlist/${id}`);
  const nav = useNavigate();
  const [edit, setEdit] = useState<{ title: string; description: string } | null>(null);
  const [add, setAdd] = useState({ artist: "", track: "" });
  const act = useAction();
  const c = useConfirm();
  useTitle(q.data?.title);

  const askDelete = (p: PlaylistData) =>
    c.ask({
      title: t("music.deletePlaylistTitle"),
      body: t("music.deletePlaylistBody", { title: p.title }),
      action: t("music.deletePlaylist"),
      danger: true,
      run: () =>
        api<PlaylistOk>(`/playlist/${id}`, { method: "DELETE" }).then(() => nav(`${userUrl(p.owner)}/playlists`)),
    });

  const saveDetails = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<PlaylistOk>(`/playlist/${id}`, { method: "PATCH", body: edit });
      setEdit(null);
      q.reload();
    });
  };

  const addTrack = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<PlaylistOk>(`/playlist/${id}/tracks`, { body: add });
      setAdd({ artist: add.artist, track: "" });
      q.reload();
    });
  };

  const removeEntry = (entryId: number) =>
    api<PlaylistOk>(`/playlist/${id}/tracks/${entryId}`, { method: "DELETE" }).then(q.reload);

  return (
    <Async q={q}>
      {(p) => {
        const length = dur(p.tracks.reduce((s, track) => s + track.duration, 0)) || "0:00";
        const sub = (
          <>
            {tx("music.playlistBy", {
              owner: (
                <Link to={userUrl(p.owner)}>
                  <Username name={p.owner} />
                </Link>
              ),
            })}{" "}
            · {t("music.trackCount", { count: p.tracks.length })} · {length}
          </>
        );
        const actions = (
          <>
            <PlayButton queue={p.tracks} label={t("music.playPlaylist")} />
            {p.mine && (
              <>
                <Button kind="btn ghost" onClick={() => setEdit({ title: p.title, description: p.description })}>
                  {t("music.editDetails")}
                </Button>
                <Button kind="btn ghost" onClick={() => askDelete(p)}>
                  {t("music.delete")}
                </Button>
              </>
            )}
          </>
        );
        return (
          <>
            {c.dialog}
            <Hero
              art={<Art image={p.tracks[0]?.image} />}
              kicker={t("music.playlist")}
              title={p.title}
              sub={sub}
              actions={actions}
            >
              {p.description && <p className="prose">{p.description}</p>}
            </Hero>
            <div className="wrap page">
              {edit && (
                <form className="form card" onSubmit={saveDetails}>
                  <label>
                    {t("music.title")}
                    <Input
                      value={edit.title}
                      onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t("music.description")}
                    <Textarea
                      rows={3}
                      value={edit.description}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                      maxLength={500}
                    />
                  </label>
                  {act.note}
                  <div className="row">
                    <Button kind="btn" loading={act.busy}>
                      {t("music.save")}
                    </Button>
                    <Button type="button" kind="btn ghost" onClick={() => setEdit(null)}>
                      {t("music.cancel")}
                    </Button>
                  </div>
                </form>
              )}
              {p.tracks.length ? (
                <TrackList
                  items={p.tracks.map((track, i) => ({ ...track, position: i + 1 }))}
                  numbered
                  showDuration
                  actions={
                    p.mine
                      ? (r) =>
                          r._np ? null : (
                            <Button kind="link small" onClick={() => removeEntry(r.entryId)}>
                              {t("music.remove")}
                            </Button>
                          )
                      : undefined
                  }
                />
              ) : (
                <Empty>{p.mine ? t("music.playlistEmptyMine") : t("music.playlistEmpty")}</Empty>
              )}
              {p.mine && (
                <form className="inline-form" onSubmit={addTrack}>
                  <Input
                    value={add.artist}
                    onChange={(e) => setAdd({ ...add, artist: e.target.value })}
                    placeholder={t("music.artist")}
                    aria-label={t("music.artist")}
                    required
                  />
                  <Input
                    value={add.track}
                    onChange={(e) => setAdd({ ...add, track: e.target.value })}
                    placeholder={t("music.track")}
                    aria-label={t("music.track")}
                    required
                  />
                  <Button kind="btn" loading={act.busy}>
                    {t("music.addTrack")}
                  </Button>
                  {!edit && act.note}
                </form>
              )}
            </div>
          </>
        );
      }}
    </Async>
  );
}
import { Username } from "../ui/username";
