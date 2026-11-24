import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { type Block, developerDocs, interpolate, isNested, type Item, METHODS, type Span } from "../../shared/docs";
import { t } from "../i18n";
import { Arrow } from "../icons";
import { TITLES, useTitle } from "../lib";

export function Inline({ span }: { span: Span }): ReactNode {
  if (typeof span === "string") return span;
  if (Array.isArray(span)) return span.map((part, i) => <Inline key={i} span={part} />);
  if ("t" in span) return <Inline span={interpolate(t(span.t), span.with)} />;
  if ("code" in span) return <code>{span.code}</code>;
  if ("b" in span)
    return (
      <b>
        <Inline span={span.b} />
      </b>
    );
  if ("to" in span)
    return (
      <Link to={span.to}>
        <Inline span={span.label} />
      </Link>
    );
  if ("href" in span)
    return (
      <a href={span.href}>
        <Inline span={span.label} />
      </a>
    );
  return <Arrow say=", " />;
}

function ListItem({ item }: { item: Item }) {
  if (!isNested(item))
    return (
      <li>
        <Inline span={item} />
      </li>
    );
  return (
    <li>
      <Inline span={item.text} />
      <ul>
        {item.list.map((child, i) => (
          <ListItem key={i} item={child} />
        ))}
      </ul>
    </li>
  );
}

function DocBlock({ block }: { block: Block }) {
  if ("h2" in block)
    return (
      <h2 id={block.id}>
        <Inline span={block.h2} />
      </h2>
    );
  if ("p" in block)
    return (
      <p className={block.note ? "note" : undefined}>
        <Inline span={block.p} />
      </p>
    );
  if ("pre" in block) return <pre>{block.pre}</pre>;
  const items = ("ul" in block ? block.ul : block.ol).map((item, i) => <ListItem key={i} item={item} />);
  return "ul" in block ? <ul>{items}</ul> : <ol>{items}</ol>;
}

export function DocBody({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, i) => <DocBlock key={i} block={block} />);
}

export function Developers() {
  const doc = developerDocs(window.location.origin);
  useTitle(TITLES.developers);
  return (
    <div className="wrap page docs-page">
      <h1 className="page-title">{t(doc.title)}</h1>
      <div className="cols">
        <div className="main prose docs">
          <DocBody blocks={doc.body} />
        </div>
        <aside className="side">
          <h3>{t("dev.otherApis")}</h3>
          <ul className="plain">
            <li>
              <a href="#listenbrainz">{t("dev.otherApisLb")}</a>
            </li>
            <li>
              <a href="#public-now-playing">{t("dev.otherApisNp")}</a>
            </li>
          </ul>
          <h3>{t("dev.methods")}</h3>
          {METHODS.map(([group, list]) => (
            <div key={group} className="methods">
              <h4>{t(group)}</h4>
              <ul className="plain">
                {list.map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
