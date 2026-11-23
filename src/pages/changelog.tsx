import type { Changelog as ChangelogData } from "../../shared/changelog";
import { Button } from "../kit";
import { qs, useApi, useAuth, useParam, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { ChangelogArticle } from "../ui/changelog-post";

export function Changelog() {
  useTitle("Changelog");
  const [page] = useParam("page", "1");
  const q = useApi<ChangelogData>(`/changelog${qs({ page })}`);
  const admin = useAuth().me?.role === "admin";

  return (
    <div className="wrap page">
      <div className="mx-auto max-w-[68ch]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="page-title mb-0">Changelog</h1>
          {admin && (
            <div className="row">
              <Button kind="btn ghost" href="/admin/changelog">
                Manage posts
              </Button>
              <Button kind="btn" href="/admin/changelog/new">
                New post
              </Button>
            </div>
          )}
        </div>
        {q.error ? (
          <div role="alert">
            <p>{q.error.message}</p>
            <Button kind="btn ghost" onClick={q.reload}>
              Try again
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
                              Edit
                            </Button>
                          )
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty>No changelog posts yet.</Empty>
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
