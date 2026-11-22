export type Point = { x: number; y: number };
export type CropDrag = {
  id: number;
  last: Point;
  offset: Point;
  frameWidth: number;
  limit: Point;
};

/** Rebase after every move so reversing at an edge never has a dead zone. */
export function moveCropDrag(drag: CropDrag, id: number, point: Point): Point | null {
  if (drag.id !== id) return null;
  const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
  drag.offset = {
    x: clamp(drag.offset.x + (point.x - drag.last.x) / drag.frameWidth, drag.limit.x),
    y: clamp(drag.offset.y + (point.y - drag.last.y) / drag.frameWidth, drag.limit.y),
  };
  drag.last = point;
  return drag.offset;
}
