import { Suspense, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ChangelogCommits, ChangelogPost, ChangelogSaved, ChangelogText } from "../../shared/changelog";
import { Button, Input } from "../kit";
import { api, invalidateAll, useApi, useTitle } from "../lib";
import { Markdown, MdEditor } from "../md";
import { Async, Empty, useAction } from "../ui/base";

function RecentCommits() {
  const q = useApi<ChangelogCommits>("/admin/changelog/commits");
  if (q.error)
    return (
      <div role="alert">
        <p>{q.error.message}</p>
        <Button kind="btn ghost small" onClick={q.reload}>
          Try again
        </Button>
      </div>
    );
  return (
    <Async q={q}>
      {({ items }) =>
        items.length ? (
          <ol className="list-none m-0 p-0">
            {items.map((commit) => (
              <li key={commit.hash} className="py-3 border-b border-site-line [overflow-wrap:anywhere]">
                <p className="m-0 font-semibold">{commit.subject}</p>
                <p className="m-0 mt-1 text-[13px] text-site-muted">
                  {commit.author} ·{" "}
                  <time dateTime={commit.committedAt}>{new Date(commit.committedAt).toLocaleDateString("en-GB")}</time>
                </p>
                <div className="flex flex-wrap gap-3 items-baseline mt-1 text-[13px] tabular-nums">
                  <code title={commit.hash}>{commit.hash.slice(0, 7)}</code>
                  <span className="text-site-ok" aria-label={`${commit.additions} lines added`}>
                    +{commit.additions}
                  </span>
                  <span className="text-site-bad" aria-label={`${commit.deletions} lines removed`}>
                    −{commit.deletions}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>No commits available.</Empty>
        )
      }
    </Async>
  );
}

function Editor({ post }: { post?: ChangelogPost }) {
  const [text, setText] = useState<ChangelogText>(() => ({ title: post?.title ?? "", body: post?.body ?? "" }));
  const [preview, setPreview] = useState(false);
  const action = useAction();
  const nav = useNavigate();
  const save = (event: FormEvent) => {
    event.preventDefault();
    action.run(async () => {
      const saved = await api<ChangelogSaved>(post ? `/admin/changelog/${post.id}` : "/admin/changelog", {
        method: post ? "PATCH" : "POST",
        body: text,
      });
      invalidateAll();
      nav(`/changelog#post-${saved.id}`);
    });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-10 max-[1100px]:grid-cols-1">
      <form className="form min-w-0" onSubmit={save}>
        <fieldset disabled={action.busy} className="border-0 p-0 m-0 min-w-0 grid gap-5">
          <label>
            Title
            <Input
              required
              maxLength={120}
              value={text.title}
              onChange={(e) => setText({ ...text, title: e.target.value })}
            />
          </label>
          <div className="field-block">
            <div className="flex justify-between items-center gap-3 mb-2">
              <span className="field-label">Post</span>
              <Button type="button" kind="btn ghost small" aria-pressed={preview} onClick={() => setPreview(!preview)}>
                {preview ? "Write" : "Preview"}
              </Button>
            </div>
            {preview ? (
              <div className="min-h-[300px] border border-site-line p-4">
                <Markdown text={text.body} />
              </div>
            ) : (
              <MdEditor
                label="Post"
                rows={18}
                maxLength={20000}
                value={text.body}
                onChange={(body) => setText((current) => ({ ...current, body }))}
              />
            )}
          </div>
          {action.note}
          <div className="row">
            <Button type="submit" kind="btn" loading={action.busy}>
              {post ? "Save changes" : "Publish"}
            </Button>
            <Button kind="btn ghost" href="/changelog">
              Cancel
            </Button>
          </div>
        </fieldset>
      </form>
      <aside className="min-w-0 self-start sticky top-5 flex flex-col max-h-[calc(100dvh-220px)] border border-site-line bg-site-panel max-[1100px]:static max-[1100px]:max-h-[65dvh]">
        <h3
          id="recent-commits-heading"
          className="m-0 px-4 py-3 border-b border-site-line text-[20px] font-site-display"
        >
          Recent commits
        </h3>
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="recent-commits-heading"
          className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-3"
        >
          <Suspense
            fallback={
              <p role="status" className="text-site-muted">
                Loading commits…
              </p>
            }
          >
            <RecentCommits />
          </Suspense>
        </div>
      </aside>
    </div>
  );
}

export function ChangelogEditor() {
  const { id } = useParams();
  useTitle(id ? "Edit changelog post" : "New changelog post");
  const q = useApi<ChangelogPost>(id ? `/admin/changelog/${id}` : null);
  return (
    <section>
      <h2 className="m-0 mb-6 text-[26px] font-site-display">{id ? "Edit changelog post" : "New changelog post"}</h2>
      {q.error ? (
        <div role="alert">
          <p>{q.error.message}</p>
          <Button kind="btn ghost" onClick={q.reload}>
            Try again
          </Button>
        </div>
      ) : id ? (
        <Async q={q}>{(post) => <Editor key={post.id} post={post} />}</Async>
      ) : (
        <Editor key="new" />
      )}
    </section>
  );
}
