import { DotsSixVertical } from "@phosphor-icons/react";
import { useState, type KeyboardEvent } from "react";
import type { ProfileLink } from "../../shared/profile-links";
import { Ico } from "../icons";
import { Button, Input } from "../kit";
import { ProfileLinkIcon } from "./profile-link-icon";

const MAX_LINKS = 8;

function move(links: ProfileLink[], from: number, to: number) {
  const next = [...links];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function ProfileLinksEditor({
  links,
  onChange,
}: {
  links: ProfileLink[];
  onChange: (links: ProfileLink[]) => void;
}) {
  const [grabbed, setGrabbed] = useState<number | null>(null);
  const edit = (index: number, patch: Partial<ProfileLink>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  const nudge = (index: number) => (e: KeyboardEvent) => {
    const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : -1;
    if (to < 0 || to >= links.length) return;
    e.preventDefault();
    onChange(move(links, index, to));
    requestAnimationFrame(() => document.getElementById(`profile-link-grip-${to}`)?.focus());
  };
  return (
    <fieldset className="border-0 p-0 m-0 min-w-0 w-full grid gap-2">
      <legend className="field-label mb-2">Profile links</legend>
      {links.length > 0 && (
        <ol className="list-none m-0 p-0 grid gap-2">
          {links.map((link, index) => (
            <li
              key={index}
              draggable={grabbed !== null}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
              onDragOver={(e) => {
                if (grabbed === null) return;
                e.preventDefault();
                if (grabbed === index) return;
                onChange(move(links, grabbed, index));
                setGrabbed(index);
              }}
              onDragEnd={() => setGrabbed(null)}
              className={`profile-link-row${grabbed === index ? " is-grabbed" : ""}`}
            >
              <button
                id={`profile-link-grip-${index}`}
                type="button"
                className="profile-link-grip"
                aria-label={`Reorder link ${index + 1}. Use the up and down arrow keys to move it.`}
                onPointerDown={() => setGrabbed(index)}
                onPointerUp={() => setGrabbed(null)}
                onKeyDown={nudge(index)}
              >
                <DotsSixVertical className="ico" aria-hidden weight="bold" />
              </button>
              <ProfileLinkIcon url={link.url} />
              <div className="profile-link-label">
                <Input
                  aria-label={`Link ${index + 1} label`}
                  placeholder="Label"
                  value={link.label}
                  maxLength={60}
                  onChange={(e) => edit(index, { label: e.target.value })}
                />
              </div>
              <div className="profile-link-url">
                <Input
                  aria-label={`Link ${index + 1} URL`}
                  type="url"
                  required
                  placeholder="https://"
                  value={link.url}
                  maxLength={500}
                  onChange={(e) => edit(index, { url: e.target.value })}
                />
              </div>
              <Button
                type="button"
                kind="btn ghost small"
                aria-label={`Remove link ${index + 1}`}
                onClick={() => onChange(links.filter((_, i) => i !== index))}
              >
                <Ico.X />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <div>
        <Button
          type="button"
          kind="btn ghost small"
          disabled={links.length >= MAX_LINKS}
          onClick={() => onChange([...links, { label: "", url: "" }])}
        >
          <Ico.Plus /> Add link
        </Button>
      </div>
    </fieldset>
  );
}
