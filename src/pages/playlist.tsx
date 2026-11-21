import { useState } from "react";
import { Button, Input, Textarea, useConfirm } from "../kit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, dur, plural, useApi, userUrl, useTitle } from "../lib";
import { Art, Async, Empty, useAction } from "../ui/base";
import { TrackList } from "../ui/lists";
import { PlayButton } from "../player";
import { Hero } from "./music/shared";
import type { PlaylistOk, PlaylistPage as PlaylistData } from "../../shared/playlists";

// ---------- playlist ----------
export function PlaylistPage() {
  const id = useParams().id, q = useApi<PlaylistData>(`/playlist/${id}`), nav = useNavigate();
  const [edit, setEdit] = useState<{ title: string; description: string } | null>(null), [add, setAdd] = useState({ artist: "", track: "" });
  const act = useAction(), c = useConfirm();
  useTitle(q.data?.title);
  return (
    <Async q={q}>{p => (
      <>
        {c.dialog}
        <Hero art={<Art image={p.tracks[0]?.image} />} kicker="Playlist" title={p.title} sub={<>by <Link to={userUrl(p.owner)}>{p.owner}</Link> · {plural(p.tracks.length, "track")} · {dur(p.tracks.reduce((s, t) => s + (t.duration || 0), 0)) || "0:00"}</>}
          actions={<><PlayButton queue={p.tracks} label="Play playlist" />{p.mine && <><Button kind="btn ghost" onClick={() => setEdit({ title: p.title, description: p.description })}>Edit details</Button>
            <Button kind="btn ghost" onClick={() => c.ask({ title: "Delete this playlist?", body: `“${p.title}” will be gone for good.`, action: "Delete playlist", danger: true, run: () => api<PlaylistOk>(`/playlist/${id}`, { method: "DELETE" }).then(() => nav(`${userUrl(p.owner)}/playlists`)) })}>Delete</Button></>}</>}>
          {p.description && <p className="prose">{p.description}</p>}
        </Hero>
        <div className="wrap page">
          {edit && (
            <form className="form card" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<PlaylistOk>(`/playlist/${id}`, { method: "PATCH", body: edit }); setEdit(null); q.reload(); }); }}>
              <label>Title<Input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} required maxLength={100} /></label>
              <label>Description<Textarea rows={3} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} maxLength={500} /></label>
              {act.note}<div className="row"><Button kind="btn" loading={act.busy}>Save</Button><Button type="button" kind="btn ghost" onClick={() => setEdit(null)}>Cancel</Button></div>
            </form>
          )}
          {p.tracks.length ? <TrackList items={p.tracks.map((t, i) => ({ ...t, position: i + 1 }))} numbered showDuration
            actions={p.mine ? r => r._np ? null : <Button kind="link small" onClick={() => api<PlaylistOk>(`/playlist/${id}/tracks/${r.entryId}`, { method: "DELETE" }).then(q.reload)}>Remove</Button> : undefined} />
            : <Empty>This playlist is empty.{p.mine && " Add tracks below, or use “+ Playlist” on any track page."}</Empty>}
          {p.mine && (
            <form className="inline-form" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<PlaylistOk>(`/playlist/${id}/tracks`, { body: add }); setAdd({ artist: add.artist, track: "" }); q.reload(); }); }}>
              <Input value={add.artist} onChange={e => setAdd({ ...add, artist: e.target.value })} placeholder="Artist" aria-label="Artist" required />
              <Input value={add.track} onChange={e => setAdd({ ...add, track: e.target.value })} placeholder="Track" aria-label="Track" required />
              <Button kind="btn" loading={act.busy}>Add track</Button>{!edit && act.note}
            </form>
          )}
        </div>
      </>
    )}</Async>
  );
}
