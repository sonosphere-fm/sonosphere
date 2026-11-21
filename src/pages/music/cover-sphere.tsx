import { useEffect, useRef } from "react";
import {
  AmbientLight, BufferGeometry, DirectionalLight, Euler, Float32BufferAttribute, Group, Mesh, MeshPhongMaterial,
  PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Texture, Vector3, WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const vertical = new Vector3(0, 1, 0);
const cellsPerSide = 5;
const columns = 10;
const cornerRadius = .16;
const gutter = .022;
const curvature = 2.25;
const idleSpeed = 2 * Math.PI / 90_000;
const maxSpeed = idleSpeed * 120;
const friction = 900;

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
    return { center, right, up, coverSlot };
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

function tileGeometry({ center, right, up }: typeof panels[number], image: HTMLImageElement) {
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
      uv.push(.5 + (s - .5) * cropX, .5 + (t - .5) * cropY);
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
  covers: HTMLImageElement[];
  onReady: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const replaceCovers = useRef<((covers: HTMLImageElement[]) => void) | null>(null);

  useEffect(() => {
    const surface = canvas.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: surface, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    const scene = new Scene();
    const group = new Group();
    scene.add(group, new AmbientLight(0xffffff, 1.18));
    const keyLight = new DirectionalLight(0xfff4e6, 1.7);
    keyLight.position.set(-2, 3, 4);
    const rimLight = new DirectionalLight(0xc6b4ff, .85);
    rimLight.position.set(4, 1, -2);
    scene.add(keyLight, rimLight);
    const camera = new PerspectiveCamera(31, 1, .1, 15);
    camera.position.z = 4.1;
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

    let meshes: Mesh[] = [];
    const tilt = new Quaternion().setFromEuler(new Euler(-.26, -.35, -.12));
    const spin = new Quaternion();
    let angle = 0, velocity = idleSpeed;
    let animation = 0, disposed = false, ready = false, visible = false, previousFrame = 0;
    let drag: { id: number; x: number; y: number; moving: boolean; angle: number; at: number; last: number } | null = null;

    // one mesh per picture, so the whole sphere takes a draw call or two rather than one per tile
    replaceCovers.current = next => {
      group.clear();
      for (const mesh of meshes) mesh.geometry.dispose();
      const images = new Set(next);
      for (const [image, material] of materials) {
        if (images.has(image)) continue;
        material.map?.dispose();
        material.dispose();
        materials.delete(image);
      }
      const byImage = new Map<HTMLImageElement, BufferGeometry[]>();
      for (const panel of panels) {
        const image = next[panel.coverSlot % next.length]!;
        const parts = byImage.get(image) ?? [];
        parts.push(tileGeometry(panel, image));
        byImage.set(image, parts);
      }
      meshes = [...byImage].map(([image, parts]) => {
        const mesh = new Mesh(mergeGeometries(parts), material(image));
        for (const part of parts) part.dispose();
        group.add(mesh);
        return mesh;
      });
      schedule();
    };

    const spinning = () => visible && !document.hidden && !reduced.matches;

    function draw(now: number) {
      animation = 0;
      if (disposed || !meshes.length || renderer.getContext().isContextLost()) return;
      const step = previousFrame ? Math.min(now - previousFrame, 50) : 0;
      if (!drag && spinning()) {
        // a fling eases back to the idle pace in the direction it was thrown, and never stops
        const target = Math.sign(velocity || 1) * idleSpeed;
        velocity += (target - velocity) * (1 - Math.exp(-step / friction));
        angle += velocity * step;
      }
      group.quaternion.copy(spin.setFromAxisAngle(vertical, angle)).multiply(tilt);
      previousFrame = now;
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady(true);
      }
      if (spinning()) schedule();
      else previousFrame = 0;
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

    function resize() {
      const width = surface.clientWidth, height = surface.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moving: false, angle, at: performance.now(), last: angle };
    };

    const move = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moving) {
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return;
        drag.moving = true;
        surface.setPointerCapture(e.pointerId);
        surface.dataset.dragging = "";
      }
      angle = drag.angle + dx * 3.2 / Math.min(surface.clientWidth, surface.clientHeight);
      const at = performance.now();
      if (at > drag.at) velocity = velocity * .5 + (angle - drag.last) / (at - drag.at) * .5;
      drag.at = at;
      drag.last = angle;
      schedule();
    };

    const stop = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      // held still before letting go: no fling
      if (performance.now() - drag.at > 80) velocity = Math.sign(velocity || 1) * idleSpeed;
      velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity));
      drag = null;
      delete surface.dataset.dragging;
      updateMotion();
    };
    const contextLost = () => onReady(false);

    surface.addEventListener("pointerdown", start);
    surface.addEventListener("pointermove", move);
    surface.addEventListener("pointerup", stop);
    surface.addEventListener("pointercancel", stop);
    surface.addEventListener("lostpointercapture", stop);
    surface.addEventListener("webglcontextlost", contextLost);

    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      visibility.disconnect();
      replaceCovers.current = null;
      document.removeEventListener("visibilitychange", updateMotion);
      reduced.removeEventListener("change", updateMotion);
      surface.removeEventListener("pointerdown", start);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", stop);
      surface.removeEventListener("pointercancel", stop);
      surface.removeEventListener("lostpointercapture", stop);
      surface.removeEventListener("webglcontextlost", contextLost);
      for (const mesh of meshes) mesh.geometry.dispose();
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
