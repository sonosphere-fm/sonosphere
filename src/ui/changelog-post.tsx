import type { ReactNode } from "react";
import { date } from "../lib";
import { Markdown } from "../md";
import { Username } from "./username";

type Post = { id?: number; title: string; body: string; author: string; createdAt: number };

export function ChangelogArticle({ post, actions }: { post: Post; actions?: ReactNode }) {
  return (
    <article id={post.id ? `post-${post.id}` : undefined} className="border-b border-site-line py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-[26px] font-site-display font-bold [overflow-wrap:anywhere]">{post.title}</h2>
        {actions}
      </div>
      <p className="text-[13px] text-site-muted mt-2 mb-5">
        <time dateTime={new Date(post.createdAt * 1000).toISOString()}>{date(post.createdAt)}</time>
        {" · "}
        <Username name={post.author} />
      </p>
      <Markdown text={post.body} images className="prose max-w-[68ch] [overflow-wrap:anywhere]" />
    </article>
  );
}
