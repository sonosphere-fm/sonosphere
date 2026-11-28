import { useState } from "react";
import type { ListeningInvestigation, ListeningPair, ListeningPlay } from "../../shared/listening-evidence";
import { Button, Input } from "../kit";
import { dateTime, qs, useApi } from "../lib";
import { Async } from "../ui/base";
import { t } from "./i18n";

function Play({ play }: { play: ListeningPlay }) {
  return (
    <div>
      <time dateTime={new Date(play.at * 1000).toISOString()}>
        {new Date(play.at * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC")}
      </time>
      <div>
        <b>{play.title}</b> · {play.artistName}
      </div>
      {play.albumTitle && <div className="muted">{play.albumTitle}</div>}
      <div className="small">{t("admin.listeningSource", { source: play.source })}</div>
    </div>
  );
}

function Pairs({ pairs }: { pairs: ListeningPair[] }) {
  return (
    <div className="listening-pairs">
      {pairs.slice(0, 100).map((p) => (
        <div className="listening-pair" key={`${p.previous.id}:${p.current.id}`}>
          <Play play={p.previous} />
          <Play play={p.current} />
          <div className="small">
            <b>{t("admin.listeningGap", { gap: p.gap, minimum: p.minimum })}</b>
            <div>
              {p.previous.duration && p.previous.duration > 0
                ? t("admin.listeningDuration", { seconds: p.previous.duration })
                : t("admin.listeningUnknownDuration")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const localDate = (at: number) => {
  const d = new Date(at * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function RangeForm({
  from,
  to,
  onSearch,
}: {
  from: number;
  to: number;
  onSearch: (range: { from: number; to: number }) => void;
}) {
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        onSearch({
          from: Math.floor(new Date(String(fields.get("from"))).getTime() / 1000),
          to: Math.floor(new Date(String(fields.get("to"))).getTime() / 1000),
        });
      }}
    >
      <label>
        {t("admin.listeningFrom")}
        <Input name="from" type="datetime-local" required defaultValue={localDate(from)} />
      </label>
      <label>
        {t("admin.listeningTo")}
        <Input name="to" type="datetime-local" required defaultValue={localDate(to)} />
      </label>
      <Button kind="btn ghost small" type="submit">
        {t("admin.search")}
      </Button>
    </form>
  );
}

function Investigation({ id }: { id: number }) {
  const [range, setRange] = useState<{ from?: number; to?: number }>({});
  const q = useApi<ListeningInvestigation>(`/admin/reports/${id}/listening${qs(range)}`);
  return (
    <Async q={q}>
      {(d) => (
        <div className="listening-investigation">
          <p>{t("admin.listeningCaution")}</p>
          <p className="small">{t("admin.listeningRule")}</p>
          {d.captured ? (
            <>
              <h3>{t("admin.listeningCaptured")}</h3>
              <p>
                {dateTime(d.captured.from)} · {dateTime(d.captured.to)}
              </p>
              <p className="small">
                {t("admin.listeningScore", {
                  count: d.captured.count,
                  points: d.captured.points,
                  weight: d.captured.weight,
                  score: Math.round(d.captured.score),
                  at: dateTime(d.captured.capturedAt),
                })}
              </p>
              <p className="small">{t("admin.listeningSample")}</p>
              <Pairs pairs={d.captured.pairs} />
            </>
          ) : (
            <p>{t("admin.listeningLegacy")}</p>
          )}
          <h3>{t("admin.listeningReconstruct")}</h3>
          <p className="small">{t("admin.listeningRangeHelp")}</p>
          <RangeForm key={`${d.from}:${d.to}`} from={d.from} to={d.to} onSearch={setRange} />
          {d.pairs.length ? <Pairs pairs={d.pairs} /> : <p>{t("admin.listeningNone")}</p>}
          {d.pairs.length > 100 && <p className="small">{t("admin.listeningLimit")}</p>}
        </div>
      )}
    </Async>
  );
}

export function ListeningInvestigationView({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <Button kind="btn ghost small" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t("admin.listeningInspect")}
      </Button>
      {open && <Investigation id={id} />}
    </section>
  );
}
