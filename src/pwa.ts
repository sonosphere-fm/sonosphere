export function registerPwa() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
