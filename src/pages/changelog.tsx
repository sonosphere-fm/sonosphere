import type { Changelog as ChangelogData } from "../../shared/changelog";
import { Button } from "../kit";
import { date, qs, useApi, useAuth, useParam, useTitle } from "../lib";
import { Markdown } from "../md";
import { Async, Empty, Pager } from "../ui/base";

export function Changelog() {
  useTitle("Changelog");
  const [page] = useParam("page", "1");
  const q = useApi<ChangelogData>(`/changelog${qs({ page })}`);
  const admin = useAuth().me?.role === "admin";

  return (
    <div className="wrap page">
      <div className="max-w-[800px]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="page-title mb-0">Changelog</h1>
          {admin && (
            <Button kind="btn" href="/admin/changelog/new">
              New post
            </Button>
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
                      <article key={post.id} id={`post-${post.id}`} className="border-b border-site-line py-7">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <h2 className="m-0 text-[26px] font-site-display font-bold [overflow-wrap:anywhere]">
                            {post.title}
                          </h2>
                          {admin && (
                            <Button kind="btn ghost small" href={`/admin/changelog/${post.id}/edit`}>
                              Edit
                            </Button>
                          )}
                        </div>
                        <p className="text-[13px] text-site-muted mt-2 mb-5">
                          <time dateTime={new Date(post.createdAt * 1000).toISOString()}>{date(post.createdAt)}</time>
                          {" · "}
                          {post.author}
                        </p>
                        <Markdown text={post.body} className="prose max-w-[68ch] [overflow-wrap:anywhere]" />
                      </article>
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
