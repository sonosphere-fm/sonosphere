import { useEffect, useRef } from "react";
import {
  AmbientLight, BufferGeometry, DirectionalLight, Float32BufferAttribute, Group, Mesh, MeshPhongMaterial,
  PerspectiveCamera, Quaternion, Raycaster, Scene, SRGBColorSpace, Texture, Vector2, Vector3, WebGLRenderer,
} from "three";
import type { SphereCover } from "./featured-sphere";

type Tile = { mesh: Mesh; normal: Vector3 };

const previewOrder = [0, 6, 2, 9, 5, 11, 3, 8, 10, 4, 7, 1];
const forward = new Vector3(0, 0, 1);
const vertical = new Vector3(0, 1, 0);
const cellsPerSide = 5;
const columns = 10;
const cornerRadius = .16;
const gutter = .022;
const curvature = 2.25;
const idleSpeed = 2 * Math.PI / 90_000;

const faces = [
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
] as const;

const cellCenters = Array.from({ length: cellsPerSide }, (_, i) => (2 * i + 1) / cellsPerSide - 1);
const panels = faces.flatMap((face, faceIndex) => {
  const [normal, right, up] = face.map(axis => new Vector3(...axis));
  return cellCenters.flatMap((y, row) => cellCenters.map((x, column) => {
    const center = normal.clone().addScaledVector(right, x).addScaledVector(up, y);
    const coverSlot = faceIndex * 5 + row * cellsPerSide + column;
    return { center, right, up, coverSlot, normal: center.clone().normalize() };
  }));
});

// Sample each corner arc by angle so its curve stays smooth at the edges of the tile.
const straight = 1 - cornerRadius;
const arcSegments = 6;
const straightSegments = 6;
const arc = Array.from({ length: arcSegments }, (_, i) => {
  const angle = (i + 1) * Math.PI / (2 * arcSegments);
  return { y: straight + cornerRadius * Math.sin(angle), edge: straight + cornerRadius * Math.cos(angle) };
});
const rows = [
  ...arc.map(({ y, edge }) => ({ y: -y, edge })).reverse(),
  ...Array.from({ length: straightSegments + 1 }, (_, i) => ({ y: (2 * i / straightSegments - 1) * straight, edge: 1 })),
  ...arc,
];

function tileGeometry({ center, right, up }: typeof panels[number], { image, atlasIndex }: SphereCover) {
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = [];
  const vector = new Vector3();
  const surfaceNormal = new Vector3();
  const halfTile = (1 - gutter) / cellsPerSide;
  const cropX = Math.min(1, image.naturalHeight / image.naturalWidth);
  const cropY = Math.min(1, image.naturalWidth / image.naturalHeight);

  for (const [row, { y: localY, edge }] of rows.entries()) {
    for (let column = 0; column <= columns; column++) {
      const localX = (column / columns * 2 - 1) * edge;
      const s = (localX + 1) / 2, t = (localY + 1) / 2;
      // Each tile stays within its own cube cell, even as we round the assembled surface along radial rays.
      vector.copy(center).addScaledVector(right, localX * halfTile).addScaledVector(up, localY * halfTile);
      const x = Math.abs(vector.x), y = Math.abs(vector.y), z = Math.abs(vector.z);
      surfaceNormal.set(
        vector.x * x ** (curvature - 2), vector.y * y ** (curvature - 2), vector.z * z ** (curvature - 2),
      ).normalize();
      vector.multiplyScalar(.97 / (x ** curvature + y ** curvature + z ** curvature) ** (1 / curvature));
      positions.push(vector.x, vector.y, vector.z);
      normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      if (atlasIndex === null) uv.push(.5 + (s - .5) * cropX, .5 + (t - .5) * cropY);
      else uv.push((atlasIndex % 4 + .018 + .964 * s) / 4, (2 - Math.floor(atlasIndex / 4) + .018 + .964 * t) / 3);
      if (column < columns && row < rows.length - 1) {
        const i = row * (columns + 1) + column;
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

export default function CoverSphere({ covers, onReady }: {
  covers: SphereCover[];
  onReady: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const replaceCovers = useRef<((covers: SphereCover[]) => void) | null>(null);

  useEffect(() => {
    const surface = canvas.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: surface, alpha: true, antialias: true });
    } catch {
      return;
    }

    const scene = new Scene();
    const group = new Group();
    group.rotation.set(-.26, -.35, -.12);
    scene.add(group, new AmbientLight(0xffffff, 1.18));
    const keyLight = new DirectionalLight(0xfff4e6, 1.7);
    keyLight.position.set(-2, 3, 4);
    const rimLight = new DirectionalLight(0xc6b4ff, .85);
    rimLight.position.set(4, 1, -2);
    scene.add(keyLight, rimLight);
    const camera = new PerspectiveCamera(31, 1, .1, 15);
    camera.position.z = 4.1;
    const ray = new Raycaster();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const materials = new Map<HTMLImageElement, MeshPhongMaterial>();

    function material(image: HTMLImageElement) {
      const existing = materials.get(image);
      if (existing) return existing;
      const map = new Texture(image);
      map.colorSpace = SRGBColorSpace;
      map.needsUpdate = true;
      const value = new MeshPhongMaterial({ map, specular: 0x383343, shininess: 20 });
      materials.set(image, value);
      return value;
    }

    let tiles: Tile[] = [];
    let meshes: Mesh[] = [];
    const correction = new Quaternion(), pose = new Quaternion();
    const vector = new Vector3();
    const section = surface.closest<HTMLElement>(".album-sphere");
    let animation = 0, aim: Quaternion | null = null, disposed = false, ready = false;
    let visible = false, hovering = false, focused = false, previousFrame = 0, resumeTimer = 0;
    let drag: { id: number; x: number; y: number; moving: boolean; start: Quaternion } | null = null;

    replaceCovers.current = next => {
      group.clear();
      for (const tile of tiles) tile.mesh.geometry.dispose();
      const images = new Set(next.map(cover => cover.image));
      for (const [image, material] of materials) {
        if (images.has(image)) continue;
        material.map?.dispose();
        material.dispose();
        materials.delete(image);
      }
      tiles = panels.map(panel => {
        const slot = panel.coverSlot % next.length;
        const cover = next[next.length === previewOrder.length ? previewOrder[slot] : slot];
        const mesh = new Mesh(tileGeometry(panel, cover), material(cover.image));
        group.add(mesh);
        return { mesh, normal: panel.normal };
      });
      meshes = tiles.map(tile => tile.mesh);
      previousFrame = 0;
      schedule();
    };

    function canRotate() {
      return visible && !document.hidden && !reduced.matches && !hovering && !focused && !drag && !resumeTimer
        && !section?.hasAttribute("data-changing");
    }

    function holdRotation() {
      window.clearTimeout(resumeTimer);
      previousFrame = 0;
      resumeTimer = window.setTimeout(() => { resumeTimer = 0; schedule(); }, 4500);
    }

    function draw(now: number) {
      animation = 0;
      if (disposed || !tiles.length || renderer.getContext().isContextLost()) return;
      const rotating = canRotate();
      if (rotating && !aim && previousFrame && now - previousFrame < 31) {
        schedule();
        return;
      }
      if (aim) {
        if (group.quaternion.angleTo(aim) < .008 || reduced.matches) {
          group.quaternion.copy(aim);
          aim = null;
        } else group.quaternion.slerp(aim, .22);
      } else if (rotating && previousFrame) {
        correction.setFromAxisAngle(vertical, Math.min(now - previousFrame, 50) * idleSpeed);
        group.quaternion.premultiply(correction);
      }
      previousFrame = rotating ? now : 0;
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady(true);
      }
      if (aim || rotating) schedule();
    }

    function schedule() {
      if (!animation && !disposed) animation = requestAnimationFrame(draw);
    }

    const updateMotion = () => { previousFrame = 0; schedule(); };
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateMotion();
    });
    visibility.observe(surface);
    document.addEventListener("visibilitychange", updateMotion);
    reduced.addEventListener("change", updateMotion);

    function focus(tile: Tile) {
      holdRotation();
      const direction = vector.copy(tile.normal).applyQuaternion(group.quaternion);
      aim = pose.setFromUnitVectors(direction, forward).multiply(group.quaternion).clone();
      schedule();
    }

    function resize() {
      const width = surface.clientWidth, height = surface.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      schedule();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();
    const start = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      aim = null;
      holdRotation();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moving: false, start: group.quaternion.clone() };
    };

    const move = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moving) {
        const horizontal = e.pointerType === "touch";
        if (horizontal ? Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) : Math.hypot(dx, dy) < 8) return;
        drag.moving = true;
        surface.setPointerCapture(e.pointerId);
        surface.dataset.dragging = "";
      }
      const scale = 3.2 / Math.min(surface.clientWidth, surface.clientHeight);
      pose.setFromAxisAngle(vector.set(0, 1, 0), dx * scale);
      correction.setFromAxisAngle(vector.set(1, 0, 0), dy * scale);
      group.quaternion.copy(drag.start).premultiply(pose).premultiply(correction);
      if (!reduced.matches) schedule();
    };

    const stop = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      delete surface.dataset.dragging;
      holdRotation();
    };

    const release = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      const { x, y, moving } = drag;
      stop(e);
      if (moving) {
        schedule();
        return;
      }
      if (Math.hypot(e.clientX - x, e.clientY - y) >= 8) return;
      const bounds = surface.getBoundingClientRect();
      camera.updateMatrixWorld();
      group.updateMatrixWorld(true);
      ray.setFromCamera(new Vector2((e.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (e.clientY - bounds.top) / bounds.height * 2), camera);
      const hit = ray.intersectObjects(meshes, false)[0]?.object;
      const tile = tiles.find(tile => tile.mesh === hit);
      if (tile) focus(tile);
    };
    const cancel = (e: PointerEvent) => {
      if (drag?.id === e.pointerId && drag.moving) {
        group.quaternion.copy(drag.start);
        schedule();
      }
      stop(e);
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      hovering = true;
      updateMotion();
    };
    const leave = (e: PointerEvent) => {
      if (!surface.hasPointerCapture(e.pointerId)) cancel(e);
      hovering = false;
      updateMotion();
    };
    const updateFocus = (target: EventTarget | null) => {
      focused = target instanceof HTMLElement && !!section?.contains(target);
      updateMotion();
    };
    const focusIn = (event: FocusEvent) => updateFocus(event.target);
    const focusOut = (event: FocusEvent) => updateFocus(event.relatedTarget);
    const contextLost = () => {
      onReady(false);
    };

    surface.addEventListener("pointerdown", start);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", release);
    surface.addEventListener("pointerenter", enter);
    surface.addEventListener("pointerleave", leave);
    surface.addEventListener("pointercancel", cancel);
    surface.addEventListener("lostpointercapture", cancel);
    surface.addEventListener("webglcontextlost", contextLost);
    section?.addEventListener("focusin", focusIn);
    section?.addEventListener("focusout", focusOut);
    updateFocus(document.activeElement);

    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      visibility.disconnect();
      replaceCovers.current = null;
      window.clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", updateMotion);
      reduced.removeEventListener("change", updateMotion);
      surface.removeEventListener("pointerdown", start);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", release);
      surface.removeEventListener("pointerenter", enter);
      surface.removeEventListener("pointerleave", leave);
      surface.removeEventListener("pointercancel", cancel);
      surface.removeEventListener("lostpointercapture", cancel);
      surface.removeEventListener("webglcontextlost", contextLost);
      section?.removeEventListener("focusin", focusIn);
      section?.removeEventListener("focusout", focusOut);
      for (const tile of tiles) tile.mesh.geometry.dispose();
      for (const material of materials.values()) {
        material.map?.dispose();
        material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [onReady]);

  useEffect(() => { replaceCovers.current?.(covers); }, [covers]);

  return <canvas className="cover-sphere-canvas" ref={canvas} aria-hidden="true" />;
}
