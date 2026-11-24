import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { periodOptions, titleOptions } from "../../charts/constants";
import { settingsLines } from "../../charts/options";
import { t } from "../../i18n";
import { Ico } from "../../icons";
import { Button, Input, Select } from "../../kit";
import { api, TITLES, useAuth, useTitle } from "../../lib";
import { Section } from "../../ui/base";
import {
  CHART_MAX_SIDE,
  type ChartPeriod,
  type ChartReply,
  type ChartRequest,
  type ChartTitles,
} from "../../../shared/charts";

type Form = {
  username: string;
  kind: "albums" | "artists";
  period: ChartPeriod;
  width: string;
  height: string;
  titles: ChartTitles;
  skip: boolean;
  rainbow: boolean;
  sfw: boolean;
  hideSingles: boolean;
  releaseFilter: string;
  filteredArtist: string;
  genres: string;
  censorArtists: string;
  censorAlbums: string;
};

const INITIAL: Form = {
  username: "",
  kind: "albums",
  period: "weekly",
  width: "3",
  height: "3",
  titles: "titles",
  skip: false,
  rainbow: false,
  sfw: false,
  hideSingles: false,
  releaseFilter: "",
  filteredArtist: "",
  genres: "",
  censorArtists: "",
  censorAlbums: "",
};

type Chart = { url: string; name: string; width: number; height: number; count: number; description: string };

function shortage(reply: Exclude<ChartReply, { status: "Ok" }>, req: ChartRequest): string {
  const params = {
    amount: reply.amount,
    needed: req.width * req.height,
    extra: reply.extra,
    size: `${req.width}x${req.height}`,
  };
  return {
    Hidden: t("music.chartHidden"),
    NotEnough: t("music.chartNotEnough", params),
    NotEnoughReleaseYear: t("music.chartNotEnoughYear", params),
    NotEnoughReleaseDecade: t("music.chartNotEnoughDecade", params),
    NotEnoughNonSingles: t("music.chartNotEnoughNonSingles", params),
  }[reply.status];
}

function describe(reply: Extract<ChartReply, { status: "Ok" }>): string {
  return reply.names
    .map(({ artist, album }, index) =>
      album
        ? t("music.chartDescAlbum", { rank: index + 1, album, artist })
        : t("music.chartDescArtist", { rank: index + 1, artist })
    )
    .join("");
}

function jpegUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
}

function gridSize(value: string) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(CHART_MAX_SIDE, Math.max(1, n)) : 1;
}

function Fold({ title, open, children }: { title: string; open: boolean; children: ReactNode }) {
  const [initial] = useState(open);
  return (
    <details className="chart-fold" open={initial}>
      <summary>
        {title}
        <Ico.ChevDown />
      </summary>
      {children}
    </details>
  );
}

export function ChartMaker() {
  const { me } = useAuth();
  const [form, setForm] = useState<Form>(INITIAL);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [chart, setChart] = useState<Chart | null>(null);
  useTitle(TITLES.chartMaker);

  useEffect(() => {
    if (me?.username && !usernameTouched) setForm((f) => ({ ...f, username: me.username }));
  }, [me?.username, usernameTouched]);

  useEffect(() => {
    if (!chart) return;
    return () => URL.revokeObjectURL(chart.url);
  }, [chart]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const fail = (message: string) => {
    setError(true);
    setStatus(message);
  };

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const width = Number(form.width);
    const height = Number(form.height);
    const sides = [width, height];
    if (!form.username.trim()) return fail(t("music.chartEnterUsername"));
    if (!sides.every((n) => Number.isInteger(n) && n >= 1 && n <= CHART_MAX_SIDE)) {
      return fail(t("music.chartWholeNumbers"));
    }

    const req: ChartRequest = {
      username: form.username.trim(),
      kind: form.kind,
      period: form.period,
      width,
      height,
      titles: form.titles,
      skip: form.skip,
      rainbow: form.rainbow,
      sfw: form.sfw,
      hideSingles: form.hideSingles,
      releaseFilter: form.releaseFilter,
      artist: form.filteredArtist,
      genres: form.genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      censorArtists: form.censorArtists,
      censorAlbums: form.censorAlbums,
    };

    setBusy(true);
    setError(false);
    setStatus(t("music.chartDrawing"));
    try {
      const reply = await api<ChartReply>("/charts", { body: req });
      if (reply.status !== "Ok") return fail(shortage(reply, req));
      setLines(settingsLines(req));
      setChart({
        url: jpegUrl(reply.image),
        name: `${req.kind === "artists" ? "artist" : "album"}-chart-${width}w-${height}h-${req.period}-${req.username}.jpg`,
        width: reply.width,
        height: reply.height,
        count: reply.drawn,
        description: describe(reply),
      });
      setStatus(t("music.chartDone", { count: reply.drawn, width: reply.width, height: reply.height }));
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : t("music.chartFailed"));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!chart) return;
    const link = document.createElement("a");
    link.href = chart.url;
    link.download = chart.name;
    link.click();
  }

  const cols = gridSize(form.width);
  const rows = gridSize(form.height);

  return (
    <div className="wrap page">
      <h1 className="page-title">{t("music.chartMaker")}</h1>
      <form className="chart-maker" onSubmit={generate}>
        <div className="cm-bar">
          <label className="cm-user">
            {t("music.chartUsername")}
            <Input
              value={form.username}
              onChange={(e) => {
                setUsernameTouched(true);
                set("username", e.target.value);
              }}
              maxLength={64}
              required
            />
          </label>
          <label>
            {t("music.chartType")}
            <Select
              label={t("music.chartType")}
              value={form.kind}
              onChange={(v) => set("kind", v as Form["kind"])}
              options={[
                ["albums", t("music.albums")],
                ["artists", t("music.artists")],
              ]}
            />
          </label>
          <label>
            {t("music.chartPeriod")}
            <Select
              label={t("music.chartPeriod")}
              value={form.period}
              onChange={(v) => set("period", v as ChartPeriod)}
              options={periodOptions()}
            />
          </label>
          <label className="cm-num">
            {t("music.chartColumns")}
            <Input type="number" min="1" max="15" value={form.width} onChange={(e) => set("width", e.target.value)} />
          </label>
          <label className="cm-num">
            {t("music.chartRows")}
            <Input type="number" min="1" max="15" value={form.height} onChange={(e) => set("height", e.target.value)} />
          </label>
          <label>
            {t("music.chartTitles")}
            <Select
              label={t("music.chartTitles")}
              value={form.titles}
              onChange={(v) => set("titles", v as Form["titles"])}
              options={titleOptions()}
            />
          </label>
          <Button type="submit" loading={busy} disabled={busy}>
            {t("music.chartMake")}
          </Button>
        </div>

        <div className="cm-body">
          <div className="cm-stage">
            {status && (
              <p className={error ? "form-error" : "text-site-muted"} role={error ? "alert" : "status"}>
                {status}
              </p>
            )}
            <div className="cm-canvas">
              {chart ? (
                <img src={chart.url} width={chart.width} height={chart.height} alt={t("music.chartGenerated")} />
              ) : (
                <div className="cm-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden>
                  {Array.from({ length: cols * rows }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
              )}
            </div>
            {!chart && <p className="text-site-muted">{t("music.chartPlaceholder")}</p>}
            {chart && (
              <div className="cm-meta">
                <p>{t("music.chartSize", { count: chart.count, width: chart.width, height: chart.height })}</p>
                {lines.length > 0 && (
                  <ul>
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <details>
                  <summary>{t("music.chartImageDescription")}</summary>
                  <p className="[overflow-wrap:anywhere]">{chart.description}</p>
                </details>
              </div>
            )}
          </div>

          <aside className="cm-side">
            <Button type="button" kind="btn ghost" onClick={download} disabled={busy || !chart}>
              {t("music.chartDownload")}
            </Button>
            <Section title={t("music.chartOptions")} sub>
              <div className="grid gap-3">
                <label className="check">
                  <Input type="checkbox" checked={form.skip} onChange={(e) => set("skip", e.target.checked)} />{" "}
                  {t("music.chartSkipNoArt")}
                </label>
                <label className="check">
                  <Input type="checkbox" checked={form.rainbow} onChange={(e) => set("rainbow", e.target.checked)} />{" "}
                  {t("music.chartRainbow")}
                </label>
                <label className="check">
                  <Input type="checkbox" checked={form.sfw} onChange={(e) => set("sfw", e.target.checked)} />{" "}
                  {t("music.chartSkipNsfw")}
                </label>
                <label className="check">
                  <Input
                    type="checkbox"
                    checked={form.hideSingles}
                    onChange={(e) => set("hideSingles", e.target.checked)}
                  />{" "}
                  {t("music.chartHideSingles")}
                </label>
              </div>
            </Section>
            <Fold title={t("music.chartFilters")} open={!!(form.releaseFilter || form.filteredArtist || form.genres)}>
              <div className="grid gap-3">
                <label>
                  {t("music.chartReleaseFilter")}
                  <Input
                    value={form.releaseFilter}
                    onChange={(e) => set("releaseFilter", e.target.value)}
                    placeholder={t("music.chartReleasePlaceholder")}
                  />
                </label>
                <label>
                  {t("music.chartArtist")}
                  <Input value={form.filteredArtist} onChange={(e) => set("filteredArtist", e.target.value)} />
                </label>
                <label>
                  {t("music.chartGenres")}
                  <Input
                    value={form.genres}
                    onChange={(e) => set("genres", e.target.value)}
                    placeholder={t("music.chartGenresPlaceholder")}
                  />
                </label>
              </div>
            </Fold>
            <Fold title={t("music.chartCensorList")} open={!!(form.censorArtists || form.censorAlbums)}>
              <div className="grid gap-3">
                <label>
                  {t("music.chartCensorArtists")}
                  <Input value={form.censorArtists} onChange={(e) => set("censorArtists", e.target.value)} />
                </label>
                <label>
                  {t("music.chartCensorAlbums")}
                  <Input value={form.censorAlbums} onChange={(e) => set("censorAlbums", e.target.value)} />
                </label>
                <p className="text-site-muted text-[13px]">{t("music.chartCensorHint")}</p>
              </div>
            </Fold>
          </aside>
        </div>
      </form>
    </div>
  );
}
