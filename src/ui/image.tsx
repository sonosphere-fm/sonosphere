import { useState, type ReactNode } from "react";

type ImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  loading?: "lazy" | "eager";
  onLoad?: (img: HTMLImageElement) => void;
};

export function ImageWithFallback(props: ImageProps) {
  // A new URL gets fresh state and cannot inherit errors from the previous image.
  return <ImageState key={props.src} {...props} />;
}

function ImageState({
  src,
  alt,
  className = "",
  fallback = null,
  errorFallback = fallback,
  loading = "lazy",
  onLoad,
}: ImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");
  return (
    <span className={`image-frame ${className}`} data-state={state}>
      {state !== "loaded" && (state === "error" ? errorFallback : fallback)}
      {src && state !== "error" && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          aria-hidden={state !== "loaded"}
          onLoad={(e) => {
            const ok = e.currentTarget.naturalWidth > 0;
            setState(ok ? "loaded" : "error");
            if (ok) onLoad?.(e.currentTarget);
          }}
          onError={() => setState("error")}
        />
      )}
    </span>
  );
}
