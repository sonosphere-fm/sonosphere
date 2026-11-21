import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { FeaturedSphere as Featured } from "../../../shared/home";
import type { TopAlbum } from "../../../shared/listening";
import previewAtlas from "../../assets/sphere-preview.webp";
import { Ico } from "../../icons";
import { imageUrl, qs, tagUrl } from "../../lib";

const CoverSphere = lazy(() => import("./cover-sphere"));
const topicInterval = 8_000;
const blurDuration = 280;
const columns = 4, rows = 3;

const editorialTopics = [
  { title: "Coldplay", href: `/search${qs({ q: "Coldplay", type: "artists" })}`, sleeves: [0, 7, 4, 2, 11, 3, 6, 9, 5, 8, 10, 1] },
  { title: "Christmas music", href: `/search${qs({ q: "Christmas", type: "albums" })}`, sleeves: [1, 5, 8, 2, 10, 11, 3, 7, 4, 0, 6, 9] },
  { title: "Ambient", href: `/search${qs({ q: "Ambient" })}`, sleeves: [7, 4, 2, 11, 8, 0, 5, 6, 3, 9, 1, 10] },
];

export type SphereCover = { image: HTMLImageElement; atlasIndex: number | null };
type Topic = {
  title: string;
  href: string;
  sleeves?: number[];
  covers?: SphereCover[];
};

function loadImage(url: string, signal: AbortSignal): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const settle = (result: HTMLImageElement | null) => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      image.onload = image.onerror = null;
      resolve(result);
    };
    const cancel = () => {
      settle(null);
      image.removeAttribute("src");
    };
    const timeout = setTimeout(cancel, 4500);
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener("abort", cancel, { once: true });
    image.onload = () => settle(image);
    image.onerror = () => settle(null);
    image.src = url;
  });
}

async function loadAlbums(albums: TopAlbum[], signal: AbortSignal) {
  if (albums.length < 6) return [];
  const covers = await Promise.all(albums.map(async album => {
    if (!album.image) return null;
    const image = await loadImage(`${imageUrl(album.image, "small")}&texture=1`, signal);
    return image && { image, atlasIndex: null };
  }));
  return covers.filter(cover => cover !== null);
}

function flatStyle(tile: number) {
  return {
    backgroundImage: `url("${previewAtlas}")`,
    backgroundSize: `${columns * 100}% ${rows * 100}%`,
    backgroundPosition: `${tile % columns / (columns - 1) * 100}% ${Math.floor(tile / columns) / (rows - 1) * 100}%`,
  };
}

function TopicArtwork({ topic, atlas }: { topic: Topic; atlas: HTMLImageElement | null }) {
  const [ready, setReady] = useState(false);
  const covers = useMemo(() => topic.covers ?? (atlas && topic.sleeves?.map(atlasIndex => ({ image: atlas, atlasIndex }))), [topic, atlas]);
  return (
    <div className="album-sphere-stage" data-rendered={ready || undefined} aria-hidden="true">
      {!ready && <div className="album-sphere-flat">
        {topic.covers?.[0] ? <img src={topic.covers[0].image.src} alt="" /> : <div style={flatStyle(topic.sleeves?.[0] ?? 0)} />}
      </div>}
      {covers && (
        <Suspense fallback={null}>
          <CoverSphere covers={covers} onReady={setReady} />
        </Suspense>
      )}
    </div>
  );
}

function SphereDisplay({ topics, atlas }: { topics: Topic[]; atlas: HTMLImageElement | null }) {
  const section = useRef<HTMLElement>(null);
  const [{ index, leaving }, setRotation] = useState({ index: 0, leaving: false });
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const topic = topics[index % topics.length];
  const rotating = canAnimate && visible && !hovered && !focused && !touching;
  const advance = useCallback(() => {
    setRotation(current => current.leaving ? { index: (current.index + 1) % topics.length, leaving: false } : current);
  }, [topics.length]);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCanAnimate(!motion.matches && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (section.current) observer.observe(section.current);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!rotating) {
      setRotation(current => current.leaving ? { ...current, leaving: false } : current);
      return;
    }
    const timer = setTimeout(() => {
      setRotation(current => ({ ...current, leaving: true }));
    }, topicInterval - blurDuration);
    return () => clearTimeout(timer);
  }, [rotating, index]);

  useEffect(() => {
    if (!leaving || !rotating) return;
    const fallback = setTimeout(advance, blurDuration * 2);
    return () => clearTimeout(fallback);
  }, [leaving, rotating, advance]);

  return (
    <section className="album-sphere" ref={section} aria-label="Music discovery" data-changing={leaving || undefined}
      onPointerEnter={event => { if (event.pointerType !== "touch") setHovered(true); }}
      onPointerLeave={() => { setHovered(false); setTouching(false); }}
      onPointerDown={event => { if (event.pointerType === "touch") setTouching(true); }}
      onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      <TopicArtwork topic={topic} atlas={atlas} />
      <Link className="album-sphere-topic" to={topic.href}>
        <span onTransitionEnd={event => { if (rotating && leaving && event.propertyName === "opacity") advance(); }}>
          Explore {topic.title}
        </span>
        <Ico.Right />
      </Link>
    </section>
  );
}

export function FeaturedSphere({ feature, chartAlbums }: { feature: Featured | null; chartAlbums: TopAlbum[] }) {
  const [atlas, setAtlas] = useState<HTMLImageElement | null>(null);
  const [catalogueTopics, setCatalogueTopics] = useState<Topic[]>([]);

  useEffect(() => {
    const request = new AbortController();
    void loadImage(previewAtlas, request.signal).then(image => { if (image && !request.signal.aborted) setAtlas(image); });
    return () => request.abort();
  }, []);

  useEffect(() => {
    const request = new AbortController();
    const { signal } = request;
    async function prepare() {
      const [featured, charts] = await Promise.all([
        feature ? loadAlbums(feature.albums, signal) : Promise.resolve([]),
        loadAlbums(chartAlbums, signal),
      ]);
      if (signal.aborted) return;
      const next: Topic[] = [];
      if (feature && featured.length >= 6) next.push({ title: feature.tag, href: tagUrl(feature.tag), covers: featured });
      if (charts.length >= 6) next.push({ title: "top albums", href: "/charts?kind=albums", covers: charts });
      setCatalogueTopics(next);
    }
    void prepare();
    return () => request.abort();
  }, [feature, chartAlbums]);

  return <SphereDisplay topics={[...editorialTopics, ...catalogueTopics]} atlas={atlas} />;
}
