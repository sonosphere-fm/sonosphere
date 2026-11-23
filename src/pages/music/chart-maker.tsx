import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHART, PERIOD_OPTIONS, TITLE_OPTIONS, type PeriodKey } from "../../charts/constants";
import { SonoChartsClient } from "../../charts/data";
import { MetadataClient } from "../../charts/metadata";
import { ChartSettings, type MakerOptions } from "../../charts/options";
import { buildChartData, type ChartDataResult, type ChartDataStatus } from "../../charts/pipeline";
import { renderChart } from "../../charts/renderer";
import { Button, Input, Select } from "../../kit";
import { TITLES, useAuth, useTitle } from "../../lib";
import { Section } from "../../ui/base";

type Form = {
  username: string;
  kind: "albums" | "artists";
  period: PeriodKey;
  width: string;
  height: string;
  titles: "titles" | "plays" | "none";
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

type Drawn = { width: number; height: number; count: number };

function statusMessage(result: ChartDataResult, settings: ChartSettings): string {
  const size = `${settings.width}x${settings.height}`;
  const messages: Record<Exclude<ChartDataStatus, "Ok">, string> = {
    TooManyImages: `A chart can hold at most ${CHART.MAX_IMAGES} images (15x15).`,
    Hidden: "This user keeps their listening charts private.",
    NotEnough: `Not enough items (found ${result.amount}, need ${settings.imagesNeeded}). Try another period or fewer skipped items; about ${result.extra} extra items were requested.`,
    NotEnoughReleaseYear: `Only ${result.amount} releases match that year — ${settings.imagesNeeded} are needed for a ${size} chart.`,
    NotEnoughReleaseDecade: `Only ${result.amount} releases match that decade — ${settings.imagesNeeded} are needed for a ${size} chart.`,
    NotEnoughNonSingles: `Only ${result.amount} non-single releases were found — ${settings.imagesNeeded} are needed for a ${size} chart.`,
  };
  return messages[result.status as Exclude<ChartDataStatus, "Ok">];
}

/** fmbot's chart generator, using Sonosphere's own listening and catalogue APIs. */
export function ChartMaker() {
  const { me } = useAuth();
  const [form, setForm] = useState<Form>(INITIAL);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useTitle(TITLES.chartMaker);

  useEffect(() => {
    if (me?.username && !usernameTouched) setForm((f) => ({ ...f, username: me.username }));
  }, [me?.username, usernameTouched]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const username = form.username.trim();
    const width = Number(form.width);
    const height = Number(form.height);
    if (!username) {
      setError(true);
      setStatus("Enter a Sonosphere username.");
      return;
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      setError(true);
      setStatus("Columns and rows must be whole numbers of at least 1.");
      return;
    }
    if (width * height > CHART.MAX_IMAGES) {
      setError(true);
      setStatus(`A chart can hold at most ${CHART.MAX_IMAGES} images (15x15).`);
      return;
    }
    if (!canvas.current) return;

    const options: MakerOptions = {
      artistChart: form.kind === "artists",
      width,
      height,
      timePeriod: form.period,
      titles: form.titles !== "none",
      plays: form.titles === "plays",
      skip: form.skip,
      rainbow: form.rainbow,
      sfw: form.sfw,
      hideSingles: form.hideSingles,
      releaseFilter: form.releaseFilter,
      filteredGenres: form.genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      filteredArtist: form.filteredArtist.trim(),
    };

    setBusy(true);
    setError(false);
    setLines([]);
    setDescription("");
    setDrawn(null);
    setStatus("Starting…");
    const report = (stage: string, detail?: string) => setStatus(detail ? `${stage} ${detail}` : stage);

    try {
      const settings = ChartSettings.fromOptions(options);
      const sono = new SonoChartsClient();
      const metadata = new MetadataClient(sono);
      metadata.setCensorList(form.censorArtists, form.censorAlbums);

      const result = await buildChartData(settings, { sono, metadata, username }, report);
      if (result.status !== "Ok") {
        setError(true);
        setStatus(statusMessage(result, settings));
        return;
      }

      setStatus("Drawing chart…");
      try {
        await document.fonts.load(`16px ${CHART.FONT_FAMILY}`);
      } catch {
        // The browser's sans-serif fallback is fine if the bundled font is unavailable.
      }
      const info = await renderChart(settings, canvas.current, report);
      setLines(settings.settingsLines());
      setDescription(settings.fileDescription);
      setDrawn({ width: canvas.current.width, height: canvas.current.height, count: info.drawn });
      setStatus(`Chart ready — ${info.drawn} items at ${canvas.current.width} × ${canvas.current.height} px.`);
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "Could not make the chart.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const image = canvas.current;
    if (!image || !drawn) return;
    const type = form.kind === "artists" ? "artist" : "album";
    const name = `${type}-chart-${form.width}w-${form.height}h-${form.period}-${form.username.trim()}.png`;
    image.toBlob((blob) => {
      if (!blob) {
        setError(true);
        setStatus("Could not export the chart as PNG.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="wrap page">
      <h1 className="page-title">Chart maker</h1>
      <div className="cols chart-maker">
        <aside className="side">
          <form onSubmit={generate}>
            <Section title="Chart">
              <div className="grid gap-3">
                <label>
                  Username
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
                  Type
                  <Select
                    label="Type"
                    value={form.kind}
                    onChange={(v) => set("kind", v as Form["kind"])}
                    options={[
                      ["albums", "Albums"],
                      ["artists", "Artists"],
                    ]}
                  />
                </label>
                <label>
                  Period
                  <Select
                    label="Period"
                    value={form.period}
                    onChange={(v) => set("period", v as PeriodKey)}
                    options={PERIOD_OPTIONS}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5">
                    Columns
                    <Input
                      type="number"
                      min="1"
                      max="15"
                      value={form.width}
                      onChange={(e) => set("width", e.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    Rows
                    <Input
                      type="number"
                      min="1"
                      max="15"
                      value={form.height}
                      onChange={(e) => set("height", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Titles
                  <Select
                    label="Titles"
                    value={form.titles}
                    onChange={(v) => set("titles", v as Form["titles"])}
                    options={TITLE_OPTIONS}
                  />
                </label>
              </div>
            </Section>

            <Section title="Options">
              <div className="grid gap-3">
                <label className="check">
                  <Input type="checkbox" checked={form.skip} onChange={(e) => set("skip", e.target.checked)} /> Skip
                  items without artwork
                </label>
                <label className="check">
                  <Input type="checkbox" checked={form.rainbow} onChange={(e) => set("rainbow", e.target.checked)} />{" "}
                  Rainbow sort by cover colour
                </label>
                <label className="check">
                  <Input type="checkbox" checked={form.sfw} onChange={(e) => set("sfw", e.target.checked)} /> Skip NSFW
                  artwork
                </label>
                <label className="check">
                  <Input
                    type="checkbox"
                    checked={form.hideSingles}
                    onChange={(e) => set("hideSingles", e.target.checked)}
                  />{" "}
                  Hide singles
                </label>
              </div>
            </Section>

            <Section title="Filters">
              <div className="grid gap-3">
                <label>
                  Release year or decade
                  <Input
                    value={form.releaseFilter}
                    onChange={(e) => set("releaseFilter", e.target.value)}
                    placeholder="1999 or 1990s"
                  />
                </label>
                <label>
                  Artist
                  <Input value={form.filteredArtist} onChange={(e) => set("filteredArtist", e.target.value)} />
                </label>
                <label>
                  Genres, comma separated
                  <Input
                    value={form.genres}
                    onChange={(e) => set("genres", e.target.value)}
                    placeholder="indie, rock"
                  />
                </label>
              </div>
            </Section>

            <Section title="Censor list">
              <div className="grid gap-3">
                <label>
                  Artists, comma separated
                  <Input value={form.censorArtists} onChange={(e) => set("censorArtists", e.target.value)} />
                </label>
                <label>
                  Albums as Artist — Album
                  <Input value={form.censorAlbums} onChange={(e) => set("censorAlbums", e.target.value)} />
                </label>
                <p className="text-site-muted text-[13px]">
                  Prefix an entry with nsfw: to hide it with Skip NSFW artwork.
                </p>
              </div>
            </Section>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={busy} disabled={busy}>
                Make chart
              </Button>
              <Button type="button" kind="btn ghost" onClick={download} disabled={busy || !drawn}>
                Download PNG
              </Button>
            </div>
          </form>
        </aside>

        <div className="main">
          <p className={error ? "form-error" : "text-site-muted"} role={error ? "alert" : "status"}>
            {status}
          </p>
          <div className="border border-site-line bg-site-panel p-5 overflow-auto">
            <canvas ref={canvas} hidden={!drawn} className="block max-w-full h-auto" aria-label="Generated chart" />
            {!drawn && <p className="text-site-muted">Your chart will appear here.</p>}
          </div>
          {lines.length > 0 && (
            <ul className="text-site-muted text-[13px] mt-3 pl-5 list-disc">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {drawn && (
            <>
              <p className="text-site-muted text-[13px] mt-3">
                {drawn.count} items · {drawn.width} × {drawn.height} px
              </p>
              <details className="text-site-muted text-[13px] mt-2">
                <summary>Image description</summary>
                <p className="[overflow-wrap:anywhere]">{description}</p>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
