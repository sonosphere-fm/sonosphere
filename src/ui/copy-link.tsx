import { useState } from "react";
import { Ico } from "../icons";
import { Button } from "../kit";
import { copyText } from "../lib";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <Button kind="btn ghost" type="button" onClick={copy} title={url}>
      <Ico.Link /> {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
