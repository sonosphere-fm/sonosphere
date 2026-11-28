import { createCanvas } from "@napi-rs/canvas";
import { acceptLanguage, RTL, type Locale } from "../shared/i18n/core";
import { xml } from "./feeds/xml";

const offlineText: Record<Locale, [string, string]> = {
  en: ["You're offline", "Reconnect to use Sonosphere, then try again."],
  es: ["Sin conexión", "Conéctate para usar Sonosphere y vuelve a intentarlo."],
  de: ["Du bist offline", "Verbinde dich mit dem Internet und versuche es erneut."],
  ro: ["Ești offline", "Reconectează-te pentru a folosi Sonosphere și încearcă din nou."],
  lv: ["Nav savienojuma", "Atjauno savienojumu, lai lietotu Sonosphere, un mēģini vēlreiz."],
  fr: ["Tu es hors ligne", "Reconnecte-toi pour utiliser Sonosphere, puis réessaie."],
  ja: ["オフラインです", "接続を回復してから、もう一度お試しください。"],
  ko: ["오프라인 상태입니다", "Sonosphere를 사용하려면 연결한 후 다시 시도하세요."],
  pt: ["Você está offline", "Reconecte-se para usar o Sonosphere e tente novamente."],
  pl: ["Jesteś offline", "Połącz się z internetem, aby używać Sonosphere, i spróbuj ponownie."],
  ru: ["Нет подключения", "Подключитесь к интернету и попробуйте снова."],
  it: ["Sei offline", "Riconnettiti per usare Sonosphere e riprova."],
  id: ["Kamu sedang offline", "Hubungkan kembali untuk menggunakan Sonosphere, lalu coba lagi."],
  tr: ["Çevrimdışısın", "Sonosphere'ı kullanmak için yeniden bağlanıp tekrar dene."],
  sv: ["Du är offline", "Anslut igen för att använda Sonosphere och försök på nytt."],
  uk: ["Немає з’єднання", "Підключіться до інтернету та спробуйте знову."],
  he: ["אין חיבור לרשת", "התחברו מחדש כדי להשתמש ב־Sonosphere ונסו שוב."],
  ar: ["أنت غير متصل", "أعد الاتصال لاستخدام Sonosphere ثم حاول مجددًا."],
  "zh-Hans": ["你已离线", "重新连接网络后再使用 Sonosphere。"],
};

const manifest = await Bun.file(
  new URL(
    process.env.NODE_ENV === "production" ? "../dist/manifest.webmanifest" : "../src/manifest.webmanifest",
    import.meta.url
  )
).text();

const icons = new Map<string, Uint8Array<ArrayBuffer>>();
function icon(size: number, maskable = false): Uint8Array<ArrayBuffer> {
  const key = `${size}:${maskable}`;
  const cached = icons.get(key);
  if (cached) return cached;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2438d6";
  ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.scale((size / 40) * (maskable ? 0.68 : 0.77), (size / 40) * (maskable ? 0.68 : 0.77));
  ctx.fillStyle = "#ffcf33";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = "#ffcf33";
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18.5, 7, (-22 * Math.PI) / 180, 0, 2 * Math.PI);
  ctx.stroke();
  const png = new Uint8Array(canvas.toBuffer("image/png"));
  icons.set(key, png);
  return png;
}

async function offline(req: Request): Promise<Response> {
  const locale = acceptLanguage(req.headers.get("accept-language"));
  const [title, message] = offlineText[locale];
  const { default: common } = await import(`../shared/i18n/${locale}/common.ts`);
  const html = `<!doctype html>
<html lang="${locale}" dir="${RTL.has(locale) ? "rtl" : "ltr"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#2438d6"><title>${xml(title)} | Sonosphere</title>
<style>:root{color-scheme:light dark;font-family:system-ui,sans-serif;background:light-dark(#f6f2e9,#0c0f27);color:light-dark(#161616,#f6f2e9)}body{margin:0}header{padding:1rem 1.5rem;background:#2438d6;color:#ffcf33;font-weight:700}main{max-width:36rem;margin:12vh auto;padding:1.5rem}h1{font-size:2rem;letter-spacing:-.03em}p{line-height:1.6}button{font:inherit;border:0;padding:.75rem 1.25rem;background:#2438d6;color:white;cursor:pointer}button:focus-visible{outline:3px solid light-dark(#161616,#ffcf33);outline-offset:4px}</style>
</head><body><header>Sonosphere</header><main><h1>${xml(title)}</h1><p>${xml(message)}</p>
<button type="button" onclick="location.reload()">${xml(common.tryAgain)}</button></main></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Accept-Language",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

export const pwaRoutes = {
  "/manifest.webmanifest": () =>
    new Response(manifest, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } }),
  "/sw.js": () =>
    new Response(
      Bun.file(new URL(process.env.NODE_ENV === "production" ? "../dist/sw.js" : "../src/sw.js", import.meta.url)),
      {
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
          "Service-Worker-Allowed": "/",
        },
      }
    ),
  "/offline": offline,
  "/pwa/icon-192.png": () =>
    new Response(icon(192), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } }),
  "/pwa/icon-512.png": () =>
    new Response(icon(512), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } }),
  "/pwa/maskable-512.png": () =>
    new Response(icon(512, true), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    }),
};
