import { useState, type FormEvent } from "react";
import { Button, Input, Textarea, useConfirm } from "../kit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, dur, plural, useApi, userUrl, useTitle } from "../lib";
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

  const askDelete = (p: PlaylistData) => c.ask({
    title: "Delete this playlist?",
    body: `“${p.title}” will be gone for good.`,
    action: "Delete playlist",
    danger: true,
    run: () => api<PlaylistOk>(`/playlist/${id}`, { method: "DELETE" }).then(() => nav(`${userUrl(p.owner)}/playlists`)),
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

  const removeEntry = (entryId: number) => api<PlaylistOk>(`/playlist/${id}/tracks/${entryId}`, { method: "DELETE" }).then(q.reload);

  return (
    <Async q={q}>{p => {
      const length = dur(p.tracks.reduce((s, t) => s + t.duration, 0)) || "0:00";
      const sub = <>by <Link to={userUrl(p.owner)}>{p.owner}</Link> · {plural(p.tracks.length, "track")} · {length}</>;
      const actions = (
        <>
          <PlayButton queue={p.tracks} label="Play playlist" />
          {p.mine && (
            <>
              <Button kind="btn ghost" onClick={() => setEdit({ title: p.title, description: p.description })}>Edit details</Button>
              <Button kind="btn ghost" onClick={() => askDelete(p)}>Delete</Button>
            </>
          )}
        </>
      );
      return (
        <>
          {c.dialog}
          <Hero art={<Art image={p.tracks[0]?.image} />} kicker="Playlist" title={p.title} sub={sub} actions={actions}>
            {p.description && <p className="prose max-w-[68ch] leading-[1.6] whitespace-pre-line [&_a]:text-link [&_a:hover]:underline">{p.description}</p>}
          </Hero>
          <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 pt-6 pb-12 max-sm:pt-[18px] max-sm:pb-8 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
            {edit && (
              <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full p-[18px] mb-4 bg-card" onSubmit={saveDetails}>
                <label>Title<Input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} required maxLength={100} /></label>
                <label>
                  Description
                  <Textarea rows={3} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} maxLength={500} />
                </label>
                {act.note}
                <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
                  <Button kind="btn" loading={act.busy}>Save</Button>
                  <Button type="button" kind="btn ghost" onClick={() => setEdit(null)}>Cancel</Button>
                </div>
              </form>
            )}
            {p.tracks.length ? (
              <TrackList
                items={p.tracks.map((t, i) => ({ ...t, position: i + 1 }))}
                numbered
                showDuration
                actions={p.mine
                  ? r => r._np ? null : <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" onClick={() => removeEntry(r.entryId)}>Remove</Button>
                  : undefined}
              />
            ) : (
              <Empty>This playlist is empty.{p.mine && " Add tracks below, or use “+ Playlist” on any track page."}</Empty>
            )}
            {p.mine && (
              <form className="inline-form flex gap-2 items-center flex-wrap my-2.5 max-sm:[&>.field]:flex-[1_1_180px] max-sm:[&>.field]:min-w-0 max-sm:[&>.astryx-text-input]:flex-[1_1_180px] max-sm:[&>.astryx-text-input]:min-w-0 max-sm:[&>div:has(>.astryx-text-input)]:flex-[1_1_180px] max-sm:[&>div:has(>.astryx-text-input)]:min-w-0 coarse:[&>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:px-4 [&>.check]:items-center [&>.check]:gap-2 [&>.check]:ml-2.5 [&>.check]:leading-6 max-[641px]:[&>.check]:ml-0 max-sm:[&>.check]:basis-full max-sm:[&>.check]:min-h-10" onSubmit={addTrack}>
                <Input value={add.artist} onChange={e => setAdd({ ...add, artist: e.target.value })} placeholder="Artist" aria-label="Artist" required />
                <Input value={add.track} onChange={e => setAdd({ ...add, track: e.target.value })} placeholder="Track" aria-label="Track" required />
                <Button kind="btn" loading={act.busy}>Add track</Button>
                {!edit && act.note}
              </form>
            )}
          </div>
        </>
      );
    }}</Async>
  );
}
