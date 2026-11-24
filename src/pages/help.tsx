import { Link } from "react-router-dom";
import { helpDocs } from "../../shared/docs";
import { t } from "../i18n";
import { TITLES, useTitle } from "../lib";
import { DocBody, Inline } from "./developers";

export function Help() {
  const doc = helpDocs(window.location.origin);
  useTitle(TITLES.help);
  return (
    <div className="wrap page docs-page">
      <h1 className="page-title">{t(doc.title)}</h1>
      <div className="cols">
        <div className="main prose docs">
          <DocBody blocks={doc.body} />
        </div>
        <aside className="side">
          <h3>{t("dev.onThisPage")}</h3>
          <ul className="plain">
            {doc.body.map(
              (block) =>
                "h2" in block &&
                block.id && (
                  <li key={block.id}>
                    <a href={`#${block.id}`}>
                      <Inline span={block.h2} />
                    </a>
                  </li>
                )
            )}
          </ul>
          <h3>{t("dev.developers")}</h3>
          <ul className="plain">
            <li>
              <Link to="/developers">{t("dev.apiDocumentation")}</Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
