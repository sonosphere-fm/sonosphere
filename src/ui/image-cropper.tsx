import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "../kit";
import { moveCropDrag, type CropDrag, type Point } from "./crop-drag";

type Source = { url: string; width: number; height: number };
const center: Point = { x: 0, y: 0 };

export function ImageCropper({ file, kind, onClose, onSave }: {
  file: File; kind: "avatar" | "banner"; onClose: () => void; onSave: (image: Blob) => Promise<void>;
}) {
  const banner = kind === "banner";
  const aspect = banner ? 4 : 1;
  const [source, setSource] = useState<Source | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>(center);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const drag = useRef<CropDrag | null>(null);
  const currentOffset = useRef<Point>(center);
  const setPosition = (p: Point) => {
    currentOffset.current = p;
    setOffset(p);
  };

  // Listen for the entire gesture, including moves/releases outside the frame.
  // Pointer refs are updated synchronously, independent of React render timing.
  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      if (e.pointerType === "mouse" && !(e.buttons & 1)) { end(); return; }
      if (e.cancelable) e.preventDefault();
      const p = moveCropDrag(d, e.pointerId, { x: e.clientX, y: e.clientY });
      if (p) { currentOffset.current = p; setOffset(p); }
    };
    const end = (e?: globalThis.PointerEvent) => {
      if (!drag.current || (e && e.pointerId !== drag.current.id)) return;
      drag.current = null;
      setDragging(false);
    };
    const blur = () => end();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", blur);
    return () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      if (image.naturalWidth * image.naturalHeight > 40_000_000) {
        setError("This image is too large. Choose one under 40 megapixels.");
      } else setSource({ url, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => { if (active) setError("This picture couldn't be opened. Try a PNG, JPEG or WebP image."); };
    if (file.size > 8_000_000) setError("Choose an image smaller than 8 MB.");
    else image.src = url;
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  const width = source ? (rotation % 180 ? source.height : source.width) : 1;
  const height = source ? (rotation % 180 ? source.width : source.height) : 1;
  // Coordinates use a frame width of one, independent of the viewport size.
  const scale = Math.max(1 / width, 1 / aspect / height) * zoom;
  const bound = (p: Point, z = zoom): Point => {
    const s = Math.max(1 / width, 1 / aspect / height) * z;
    const x = Math.max(0, (width * s - 1) / 2);
    const y = Math.max(0, (height * s - 1 / aspect) / 2);
    return { x: Math.max(-x, Math.min(x, p.x)), y: Math.max(-y, Math.min(y, p.y)) };
  };
  const changeZoom = (z: number) => { setZoom(z); setPosition(bound(currentOffset.current, z)); };
  const reset = () => { setRotation(0); setZoom(1); setPosition(center); };
  const save = async () => {
    if (!source || busy) return;
    setBusy(true);
    setError("");
    try {
      const image = new Image();
      image.src = source.url;
      await image.decode();
      const edge = Math.max(1, Math.min(banner ? 1200 : 800, Math.floor(1 / scale)));
      const canvas = document.createElement("canvas");
      canvas.width = edge;
      canvas.height = Math.max(1, Math.round(edge / aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't prepare the picture.");
      ctx.translate(edge / 2 + offset.x * edge, canvas.height / 2 + offset.y * edge);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(image, -source.width * scale * edge / 2, -source.height * scale * edge / 2, source.width * scale * edge, source.height * scale * edge);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Couldn't export this picture.")), "image/webp", .92));
      await onSave(blob);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return <Modal title={banner ? "Crop your banner" : "Crop your picture"} width={720} onClose={() => { if (!busy) onClose(); }}>
    <div className="image-cropper" aria-busy={busy}>
      <div className={`crop-workspace ${banner ? "is-banner" : "is-avatar"} ${dragging ? "is-dragging" : ""}`}>
        <div className="crop-frame" style={{ aspectRatio: aspect }} tabIndex={source && !busy ? 0 : -1}
          role="group" aria-label="Image framing. Drag to reposition or use arrow keys. Hold Shift for larger steps."
          onKeyDown={e => {
            if (!source || busy || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();
            const step = e.shiftKey ? .05 : .01;
            const p = currentOffset.current;
            setPosition(bound({ x: p.x + (e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0), y: p.y + (e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0) }));
          }}
          onPointerDown={e => {
            if (!source || busy || e.button !== 0 || drag.current) return;
            e.preventDefault();
            e.currentTarget.focus({ preventScroll: true });
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId, last: { x: e.clientX, y: e.clientY }, offset: currentOffset.current,
              frameWidth: e.currentTarget.getBoundingClientRect().width,
              limit: { x: Math.max(0, (width * scale - 1) / 2), y: Math.max(0, (height * scale - 1 / aspect) / 2) },
            };
            setDragging(true);
          }} onPointerUp={e => {
            if (drag.current?.id !== e.pointerId) return;
            drag.current = null;
            setDragging(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          }} onDragStart={e => e.preventDefault()}>
          {source ? <img className="crop-photo" src={source.url} draggable={false} alt=""
            style={{ width: `${source.width * scale * 100}%`, height: `${source.height * scale * aspect * 100}%`, left: `${50 + offset.x * 100}%`, top: `${50 + offset.y * aspect * 100}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
            : <span className="crop-loading">{error ? "Choose another picture to continue" : "Opening your picture…"}</span>}
          <div className="crop-guides" aria-hidden="true"><i /><i /><i /><i /></div>
          {!banner && <div className="crop-circle" aria-hidden="true" />}
        </div>
      </div>
      <div className="crop-controls">
        <label className="crop-zoom"><span>Zoom <output>{Math.round(zoom * 100)}%</output></span><input type="range" min="1" max="4" step=".01" value={zoom} disabled={!source || busy} onChange={e => changeZoom(Number(e.target.value))} /></label>
        <div className="crop-tools"><button type="button" disabled={!source || busy} onClick={() => { setRotation(r => (r + 90) % 360); setPosition(center); setZoom(1); }} aria-label="Rotate picture 90 degrees clockwise">↻ <span>Rotate</span></button><button type="button" disabled={!source || busy} onClick={reset}>Reset</button></div>
      </div>
      {file.type === "image/gif" && <p className="crop-hint">Animated images are saved as a still image.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="crop-footer"><Button kind="btn ghost" type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button kind="btn" type="button" disabled={!source} loading={busy} onClick={save}>{banner ? "Save banner" : "Save picture"}</Button></div>
    </div>
  </Modal>;
}
