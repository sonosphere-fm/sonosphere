import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Sphere } from "../../../shared/home";
import type { TopAlbum } from "../../../shared/listening";
import { Ico } from "../../icons";
import { imageUrl, tagUrl } from "../../lib";

const CoverSphere = lazy(() => import("./cover-sphere"));
const topicInterval = 8_000;
const blurDuration = 280;

type Topic = { title: string; href: string; covers: HTMLImageElement[] };

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
  const covers = await Promise.all(albums.map(album =>
    album.image ? loadImage(`${imageUrl(album.image, "small")}&texture=1`, signal) : null));
  return covers.filter(cover => cover !== null);
}

function TopicArtwork({ topic }: { topic: Topic | undefined }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="album-sphere-stage" data-rendered={ready || undefined} aria-hidden="true">
      {!ready && topic && <div className="album-sphere-flat"><img src={topic.covers[0]!.src} alt="" /></div>}
      {topic && (
        <Suspense fallback={null}>
          <CoverSphere covers={topic.covers} onReady={setReady} />
        </Suspense>
      )}
    </div>
  );
}

function SphereDisplay({ topics }: { topics: Topic[] }) {
  const section = useRef<HTMLElement>(null);
  const [{ index, leaving }, setRotation] = useState({ index: 0, leaving: false });
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [canAnimate, setCanAnimate] = useState(false);
  const topic = topics.length ? topics[index % topics.length] : undefined;
  const rotating = topics.length > 1 && canAnimate && visible && !hovered && !focused && !touching;
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
      <TopicArtwork topic={topic} />
      {topic && (
        <Link className="album-sphere-topic" to={topic.href}>
          <span onTransitionEnd={event => { if (rotating && leaving && event.propertyName === "opacity") advance(); }}>
            Explore {topic.title}
          </span>
          <Ico.Right />
        </Link>
      )}
    </section>
  );
}

export function FeaturedSphere({ spheres }: { spheres: Sphere[] }) {
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    const request = new AbortController();
    const { signal } = request;
    setTopics([]);
    spheres.forEach(async sphere => {
      const covers = await loadAlbums(sphere.albums, signal);
      if (signal.aborted || covers.length < 6) return;
      const topic = {
        title: sphere.tag ?? "top albums",
        href: sphere.tag ? tagUrl(sphere.tag) : "/charts?kind=albums",
        covers,
      };
      setTopics(current => [...current, topic]);
    });
    return () => request.abort();
  }, [spheres]);

  return <SphereDisplay topics={topics} />;
}
