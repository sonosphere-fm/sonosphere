import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function PageMetadata() {
  const { pathname, search } = useLocation();
  // Only search queries belong in the metadata request. Auth and settings URLs
  // can carry credentials or transient state in their query strings.
  const query = new URLSearchParams(search).get("q");
  const path = pathname.replace(/\/+$/, "").toLowerCase() === "/search" && query
    ? `${pathname}?${new URLSearchParams({ q: query })}` : pathname;
  const previous = useRef(path);
  useEffect(() => {
    if (previous.current === path || process.env.NODE_ENV !== "production") return;
    previous.current = path;
    const controller = new AbortController();
    document.head.querySelectorAll("[data-seo]").forEach(node => node.remove());
    fetch(`/page-metadata?${new URLSearchParams({ path })}`, { signal: controller.signal })
      .then(response => response.ok ? response.text() : "")
      .then(html => {
        if (!html || controller.signal.aborted) return;
        const head = new DOMParser().parseFromString(html, "text/html").head;
        const title = head.querySelector("title")?.textContent;
        if (title) document.title = title;
        head.querySelectorAll("meta[data-seo], link[data-seo], script[type='application/ld+json'][data-seo]")
          .forEach(node => document.head.append(node));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [path]);
  return null;
}
