import { Link } from "react-router-dom";
import { TITLES, useTitle } from "../lib";
import { Empty } from "../ui/base";
import { t, tx } from "../i18n";

export function NotFound() {
  useTitle(TITLES.notFound);
  return (
    <div className="wrap page">
      <Empty>
        <strong>{t("common.pageNotFound")}</strong>{" "}
        {tx("common.notFoundHint", { charts: <Link to="/charts">{t("common.notFoundCharts")}</Link> })}
      </Empty>
    </div>
  );
}
