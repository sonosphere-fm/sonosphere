import type { Changelog as ChangelogData } from "../../shared/changelog";
import { t } from "../i18n";
import { Button } from "../kit";
import { qs, TITLES, useApi, useAuth, useParam, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { ChangelogArticle } from "../ui/changelog-post";

export function Changelog() {
  useTitle(TITLES.changelog);
  const [page] = useParam("page", "1");
  const q = useApi<ChangelogData>(`/changelog${qs({ page })}`);
  const admin = useAuth().me?.role === "admin";

  return (
    <div className="wrap page">
      <div className="mx-auto max-w-[68ch]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="page-title mb-0">{t("dev.changelogHeading")}</h1>
          {admin && (
            <div className="row">
              <Button kind="btn ghost" href="/admin/changelog">
                {t("dev.changelogManage")}
              </Button>
              <Button kind="btn" href="/admin/changelog/new">
                {t("dev.changelogNew")}
              </Button>
            </div>
          )}
        </div>
        {q.error ? (
          <div role="alert">
            <p>{q.error.message}</p>
            <Button kind="btn ghost" onClick={q.reload}>
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : (
          <Async q={q}>
            {(data) => (
              <>
                {data.items.length ? (
                  <div className="border-t border-site-line">
                    {data.items.map((post) => (
                      <ChangelogArticle
                        key={post.id}
                        post={post}
                        actions={
                          admin && (
                            <Button kind="btn ghost small" href={`/admin/changelog/${post.id}/edit`}>
                              {t("dev.changelogEdit")}
                            </Button>
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>{t("dev.changelogEmpty")}</Empty>
                )}
                <Pager total={data.total} limit={data.limit} />
              </>
            )}
          </Async>
        )}
      </div>
    </div>
  );
}
