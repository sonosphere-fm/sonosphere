import { useEffect } from "react";

function isDarkMode() {
  const root = document.documentElement;
  const scheme = root.dataset.scheme;
  if (scheme === "dark") return true;
  if (scheme === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function currentBackground() {
  const root = document.documentElement;
  if (root.dataset.profileShell === "custom") {
    const accent = root.style.getPropertyValue("--profile-accent-raw").trim();
    if (accent) return accent;
  }
  return isDarkMode() ? "#101114" : "#2438d6";
}

function buildHref() {
  const bg = currentBackground();
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>` +
    `<circle cx='20' cy='20' r='20' fill='${bg}'/>` +
    `<g transform='translate(4.6 4.6) scale(.77)'>` +
    `<g fill='#ffcf33' stroke='#ffcf33' stroke-width='0'>` +
    `<circle cx='20' cy='20' r='11' stroke='none'/>` +
    `<ellipse cx='20' cy='20' rx='18.5' ry='7' fill='none' stroke-width='3.6' transform='rotate(-22 20 20)'/>` +
    `</g></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function Favicon() {
  useEffect(() => {
    const update = () => {
      const href = buildHref();
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      if (link.getAttribute("href") !== href) link.setAttribute("href", href);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-scheme", "data-profile-shell", "style"],
    });
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => update();
    media.addEventListener("change", onMedia);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMedia);
    };
  }, []);
  return null;
}
