import { expect, test } from "bun:test";
import { moveCropDrag, type CropDrag } from "./crop-drag";

const gesture = (id = 1, x = 0): CropDrag => ({
  id,
  last: { x: 100, y: 100 },
  offset: { x, y: 0 },
  frameWidth: 200,
  limit: { x: 0.5, y: 0.5 },
});

test("consecutive drags continue from the previous crop position", () => {
  let position = { x: 0, y: 0 };
  for (let id = 1; id <= 4; id++) {
    const drag = gesture(id, position.x);
    position = moveCropDrag(drag, id, { x: 120, y: 100 })!;
    expect(position.x).toBeCloseTo(id * 0.1);
  }
});

test("reversing immediately after dragging past a boundary moves the crop", () => {
  const drag = gesture();
  expect(moveCropDrag(drag, 1, { x: 400, y: 100 })!.x).toBe(0.5);
  expect(moveCropDrag(drag, 1, { x: 380, y: 100 })!.x).toBeCloseTo(0.4);
});

test("a different pointer cannot change the active gesture", () => {
  const drag = gesture();
  expect(moveCropDrag(drag, 2, { x: 500, y: 500 })).toBeNull();
  expect(drag.last).toEqual({ x: 100, y: 100 });
  expect(moveCropDrag(drag, 1, { x: 120, y: 140 })).toEqual({ x: 0.1, y: 0.2 });
});

test("locked axes stay covered while dragging outside the frame", () => {
  const drag = gesture();
  drag.limit.y = 0;
  expect(moveCropDrag(drag, 1, { x: -1000, y: 1000 })).toEqual({ x: -0.5, y: 0 });
});
