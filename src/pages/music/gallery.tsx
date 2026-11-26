import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { t } from "../../i18n";
import { api, date, imageUrl, qs, useApi, useAuth, userUrl } from "../../lib";
import { Async, Empty, Section, useAction } from "../../ui/base";
import { ImageWithFallback } from "../../ui/image";
import { Shoutbox } from "../../ui/shoutbox";
import { useConfirm } from "../../kit";
import { Ico } from "../../icons";
import { UploadImage } from "./shared";
import type { GalleryImage, GalleryList, GalleryVote } from "../../../shared/images";

type Kind = "artist" | "album";
type Props = { type: Kind; id: number; name: string; base: string; onChanged: () => void };

export function ImageGallery({ type, id, name, base, onChanged }: Props) {
  const q = useApi<GalleryList>(`/gallery${qs({ type, id })}`);
  const { me } = useAuth();
  const { image: shown } = useParams();
  const refresh = () => {
    q.reload();
    onChanged();
  };
  const apply = (list: GalleryList) => {
    q.setData(list);
    onChanged();
  };

  return (
    <Async q={q}>
      {(g) => {
        if (shown) {
          const item = g.items.find((it) => it.image === shown);
          return item ? (
            <GalleryPhoto
              item={item}
              items={g.items}
              type={type}
              id={id}
              name={name}
              base={base}
              onApply={apply}
              onDone={refresh}
            />
          ) : (
            <section className="section">
              <Empty>{t("common.nothingHere")}</Empty>
              <p className="gallery-back">
                <Link to={`${base}/+images`}>{t("music.images")}</Link>
              </p>
            </section>
          );
        }
        return (
          <section className="section">
            <header className="section-head gallery-head">
              <h2>{t("music.images")}</h2>
              {me && <UploadImage type={type} id={id} onDone={refresh} />}
            </header>
            {g.items.length ? (
              <ul className="image-gallery">
                {g.items.map((item) => (
                  <GalleryItem key={item.id} item={item} name={name} base={base} onApply={apply} />
                ))}
              </ul>
            ) : (
              <Empty>{t("common.nothingHere")}</Empty>
            )}
          </section>
        );
      }}
    </Async>
  );
}

function useGalleryActions(
  item: GalleryImage,
  name: string,
  onApply: (list: GalleryList) => void,
  afterRemove?: () => void
) {
  const { me } = useAuth();
  const act = useAction();
  const confirm = useConfirm();
  const canRemove = !!me && (item.uploaderId === me.id || me.role !== "user");

  const vote = (value: 1 | -1) =>
    act.run(async () => {
      const next: GalleryVote = item.mine === value ? 0 : value;
      onApply(await api<GalleryList>("/gallery/vote", { body: { entryId: item.id, value: next } }));
    });

  const remove = () =>
    confirm.ask({
      title: t("music.removeImageTitle"),
      body: t("music.removeImageBody", { name }),
      action: t("music.removeImageAction"),
      danger: true,
      run: async () => {
        onApply(await api<GalleryList>(`/gallery/${item.id}`, { method: "DELETE" }));
        afterRemove?.();
      },
    });

  return { me, act, canRemove, vote, remove, dialog: confirm.dialog };
}

function VoteButtons({
  item,
  busy,
  canVote,
  counts,
  onVote,
}: {
  item: GalleryImage;
  busy: boolean;
  canVote: boolean;
  counts?: boolean;
  onVote: (value: 1 | -1) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="gallery-vote"
        aria-label={t("music.voteUp")}
        aria-pressed={item.mine === 1}
        disabled={!canVote || busy}
        onClick={() => onVote(1)}
      >
        <Ico.ThumbsUp on={item.mine === 1} />
        {counts && <span className="gallery-vote-count">{item.up}</span>}
      </button>
      {!counts && <span className="gallery-score">{item.score}</span>}
      <button
        type="button"
        className="gallery-vote"
        aria-label={t("music.voteDown")}
        aria-pressed={item.mine === -1}
        disabled={!canVote || busy}
        onClick={() => onVote(-1)}
      >
        {counts && <span className="gallery-vote-count">{item.down}</span>}
        <Ico.ThumbsDown on={item.mine === -1} />
      </button>
    </>
  );
}

function GalleryItem({
  item,
  name,
  base,
  onApply,
}: {
  item: GalleryImage;
  name: string;
  base: string;
  onApply: (list: GalleryList) => void;
}) {
  const { me, act, canRemove, vote, remove, dialog } = useGalleryActions(item, name, onApply);

  return (
    <>
      <li className="gallery-item">
        <Link className="gallery-tile" to={`${base}/+images/${item.image}`} aria-label={t("music.viewImage")}>
          <ImageWithFallback src={imageUrl(item.image, "small")} alt="" className="gallery-thumb" />
          {item.main && <span className="gallery-main">{t("music.mainImage")}</span>}
        </Link>
        <div className="gallery-votes">
          <VoteButtons item={item} busy={act.busy} canVote={!!me} onVote={vote} />
          {canRemove && (
            <button
              type="button"
              className="gallery-remove"
              aria-label={t("music.removeImage")}
              title={t("music.removeImage")}
              onClick={remove}
            >
              <Ico.Delete />
            </button>
          )}
        </div>
        <p className="gallery-meta">
          {item.uploader ? (
            <Link to={userUrl(item.uploader)}>{t("music.uploadedBy", { name: item.uploader })}</Link>
          ) : (
            <time dateTime={new Date(item.createdAt * 1000).toISOString()}>{date(item.createdAt)}</time>
          )}
        </p>
        {act.note}
      </li>
      {createPortal(dialog, document.body)}
    </>
  );
}

function GalleryPhoto({
  item,
  items,
  type,
  id,
  name,
  base,
  onApply,
  onDone,
}: {
  item: GalleryImage;
  items: GalleryImage[];
  type: Kind;
  id: number;
  name: string;
  base: string;
  onApply: (list: GalleryList) => void;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  const { me, act, canRemove, vote, remove, dialog } = useGalleryActions(item, name, onApply, () =>
    navigate(`${base}/+images`)
  );
  const at = items.findIndex((it) => it.id === item.id);
  const prev = at > 0 ? items[at - 1] : null;
  const next = at >= 0 && at < items.length - 1 ? items[at + 1] : null;

  return (
    <section className="section gallery-photo">
      <header className="section-head gallery-head">
        <h2>
          <Link to={`${base}/+images`}>{t("music.images")}</Link>
        </h2>
        <span className="photo-count">
          {at + 1} / {items.length}
        </span>
        {me && <UploadImage type={type} id={id} onDone={onDone} />}
      </header>
      <div className="photo-stage">
        <div className="photo-backdrop" style={{ backgroundImage: `url(${imageUrl(item.image, "small")})` }} />
        {prev && (
          <Link className="photo-nav photo-prev" to={`${base}/+images/${prev.image}`} aria-label={t("music.previous")}>
            <Ico.ChevLeft />
          </Link>
        )}
        <ImageWithFallback className="photo-full" src={imageUrl(item.image)} alt={name} loading="eager" />
        {next && (
          <Link className="photo-nav photo-next" to={`${base}/+images/${next.image}`} aria-label={t("music.next")}>
            <Ico.Chevron />
          </Link>
        )}
      </div>
      <div className="photo-bar">
        <p className="photo-meta">
          {item.main && <span className="gallery-main-open">{t("music.mainImage")}</span>}
          {item.uploader && <Link to={userUrl(item.uploader)}>{t("music.uploadedBy", { name: item.uploader })}</Link>}
          <time dateTime={new Date(item.createdAt * 1000).toISOString()}>{date(item.createdAt)}</time>
        </p>
        <div className="photo-votes">
          <VoteButtons item={item} busy={act.busy} canVote={!!me} counts onVote={vote} />
          {canRemove && (
            <button
              type="button"
              className="gallery-remove"
              aria-label={t("music.removeImage")}
              title={t("music.removeImage")}
              onClick={remove}
            >
              <Ico.Delete />
            </button>
          )}
        </div>
      </div>
      {act.note}
      {items.length > 1 && (
        <ul className="photo-thumbs">
          {items.map((it, n) => (
            <li key={it.id}>
              <Link
                className="photo-thumb"
                to={`${base}/+images/${it.image}`}
                aria-current={it.id === item.id ? "page" : undefined}
                aria-label={`${n + 1} / ${items.length}`}
              >
                <ImageWithFallback className="photo-thumb-img" src={imageUrl(it.image, "small")} alt="" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Section title={t("music.wall")}>
        <Shoutbox key={item.id} type="image" id={item.id} limit={10} word="comment" />
      </Section>
      {createPortal(dialog, document.body)}
    </section>
  );
}
