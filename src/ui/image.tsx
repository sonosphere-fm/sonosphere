import { useState, type ReactNode } from "react";
import { cn } from "./tw";

type ImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  loading?: "lazy" | "eager";
};

export function ImageWithFallback(props: ImageProps) {
  // A new URL gets fresh state and cannot inherit errors from the previous image.
  return <ImageState key={props.src} {...props} />;
}

function ImageState({ src, alt, className = "", fallback = null, errorFallback = fallback, loading = "lazy" }: ImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  return (
    <span className={cn("block relative overflow-hidden [&>img]:absolute [&>img]:inset-0 [&>img]:w-full [&>img]:h-full [&>img]:object-cover [&:not([data-state=loaded])>img]:opacity-0", className)} data-state={state}>
      {state !== "loaded" && (state === "error" ? errorFallback : fallback)}
      {src && state !== "error" && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          aria-hidden={state !== "loaded"}
          onLoad={e => setState(e.currentTarget.naturalWidth > 0 ? "loaded" : "error")}
          onError={() => setState("error")}
        />
      )}
    </span>
  );
}
