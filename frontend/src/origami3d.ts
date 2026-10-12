/**
 * Static 3D FOLD mesh viewer (Three.js).
 * Renders vertices/faces/edges as stored — no physics fold simulation.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import earcut from "earcut";

export type FoldObject = {
  vertices_coords?: number[][];
  edges_vertices?: number[][];
  edges_assignment?: string[];
  faces_vertices?: number[][];
  faces_edges?: number[][];
  frame_classes?: string[];
  file_classes?: string[];
  frame_title?: string;
  file_title?: string;
  file_frames?: FoldObject[];
  [key: string]: unknown;
};

export type Origami3dHandle = {
  setActive: (active: boolean) => void;
  setFrameIndex: (index: number) => void;
  frameCount: number;
  dispose: () => void;
};

/** Resolve root + file_frames with FOLD inheritance (mirrors backend collect_fold_frames). */
export function collectFoldFrames(fold: FoldObject | null | undefined): FoldObject[] {
  if (!fold || typeof fold !== "object") return [];
  const root: FoldObject = { ...fold };
  delete root.file_frames;
  const children = Array.isArray(fold.file_frames) ? fold.file_frames : [];
  const raw: FoldObject[] = [root, ...children.map((c) => (c && typeof c === "object" ? c : {}))];
  const resolved: FoldObject[] = [];
  for (let i = 0; i < raw.length; i++) {
    const fr = raw[i]!;
    const inherit = fr.frame_inherit !== false;
    if (i === 0 || !inherit) {
      resolved.push({ ...fr });
      continue;
    }
    let parentIdx = Number(fr.frame_parent ?? 0);
    if (!Number.isFinite(parentIdx) || parentIdx < 0 || parentIdx >= i) parentIdx = 0;
    const base: FoldObject = { ...(resolved[parentIdx] || resolved[0]!) };
    delete base.file_frames;
    for (const [k, v] of Object.entries(fr)) {
      if (k === "frame_parent" || k === "frame_inherit") continue;
      base[k] = v;
    }
    resolved.push(base);
  }
  return resolved;
}

const EDGE_COLORS: Record<string, number> = {
  B: 0x1a1a1a,
  M: 0xc0392b,
  V: 0x2471a3,
  U: 0x7f8c8d,
  F: 0x27ae60,
  C: 0x8e44ad,
  J: 0xbdc3c7,
};

function asVec3(c: number[] | undefined): THREE.Vector3 {
  if (!c || c.length < 2) return new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(Number(c[0]) || 0, Number(c[1]) || 0, Number(c[2]) || 0);
}

function isMostlyFlat(coords: number[][]): boolean {
  if (!coords.length) return true;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of coords) {
    const z = c && c.length > 2 ? Number(c[2]) || 0 : 0;
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const span = maxZ - minZ;
  // Compare to XY extent so tiny numeric noise doesn't count as 3D.
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const c of coords) {
    const x = Number(c?.[0]) || 0;
    const y = Number(c?.[1]) || 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const xy = Math.max(maxX - minX, maxY - minY, 1e-9);
  return span / xy < 1e-4;
}

function triangulateFace(coords: THREE.Vector3[], face: number[]): number[] {
  if (face.length < 3) return [];
  if (face.length === 3) return [...face];
  if (face.length === 4) {
    // Split quad on shorter diagonal.
    const a = coords[face[0]];
    const b = coords[face[1]];
    const c = coords[face[2]];
    const d = coords[face[3]];
    if (!a || !b || !c || !d) return [];
    const d02 = a.distanceToSquared(c);
    const d13 = b.distanceToSquared(d);
    return d02 <= d13
      ? [face[0], face[1], face[2], face[0], face[2], face[3]]
      : [face[0], face[1], face[3], face[1], face[2], face[3]];
  }
  // Project polygon to a best-fit plane for earcut (2D).
  const pts = face.map((i) => coords[i]).filter(Boolean) as THREE.Vector3[];
  if (pts.length < 3) return [];
  const normal = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    normal.x += (p.y - q.y) * (p.z + q.z);
    normal.y += (p.z - q.z) * (p.x + q.x);
    normal.z += (p.x - q.x) * (p.y + q.y);
  }
  if (normal.lengthSq() < 1e-12) normal.set(0, 0, 1);
  else normal.normalize();
  const tmp = Math.abs(normal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(normal, tmp).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const origin = pts[0]!;
  const flat: number[] = [];
  for (const p of pts) {
    const d = new THREE.Vector3().subVectors(p, origin);
    flat.push(d.dot(u), d.dot(v));
  }
  const tris = earcut(flat);
  const out: number[] = [];
  for (const ti of tris) out.push(face[ti]!);
  return out;
}

function buildFoldGroup(fold: FoldObject): {
  group: THREE.Group;
  flat: boolean;
  faceCount: number;
  edgeCount: number;
} {
  const rawCoords = fold.vertices_coords || [];
  if (!rawCoords.length) throw new Error("FOLD file has no vertices_coords");

  const coords = rawCoords.map((c) => asVec3(c));
  const flat = isMostlyFlat(rawCoords);
  const faces = (fold.faces_vertices || []).filter((f) => Array.isArray(f) && f.length >= 3);
  const edges = fold.edges_vertices || [];
  const assigns = fold.edges_assignment || [];

  const group = new THREE.Group();

  // Faces
  if (faces.length) {
    const positions: number[] = [];
    const indices: number[] = [];
    for (const c of coords) positions.push(c.x, c.y, c.z);
    for (const face of faces) {
      const tris = triangulateFace(coords, face.map((i) => Number(i)));
      for (const i of tris) indices.push(i);
    }
    if (indices.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const front = new THREE.MeshPhongMaterial({
        color: 0xf4ebe0,
        flatShading: true,
        side: THREE.FrontSide,
        shininess: 12,
      });
      const back = new THREE.MeshPhongMaterial({
        color: 0xd4e6f1,
        flatShading: true,
        side: THREE.BackSide,
        shininess: 12,
      });
      const frontMesh = new THREE.Mesh(geo, front);
      const backMesh = new THREE.Mesh(geo.clone(), back);
      frontMesh.castShadow = true;
      frontMesh.receiveShadow = true;
      backMesh.receiveShadow = true;
      group.add(frontMesh);
      group.add(backMesh);
    }
  }

  // Edges by assignment
  const buckets: Record<string, number[]> = {};
  for (let i = 0; i < edges.length; i++) {
    const ev = edges[i];
    if (!ev || ev.length < 2) continue;
    const a = Number(ev[0]);
    const b = Number(ev[1]);
    if (!(a in coords) || !(b in coords)) continue;
    const key = String(assigns[i] || "U").toUpperCase().slice(0, 1) || "U";
    const bucket = buckets[key] || (buckets[key] = []);
    const pa = coords[a]!;
    const pb = coords[b]!;
    bucket.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  }
  for (const [key, pts] of Object.entries(buckets)) {
    if (!pts.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: EDGE_COLORS[key] ?? EDGE_COLORS.U,
      transparent: true,
      opacity: key === "B" ? 0.95 : 0.85,
    });
    const lines = new THREE.LineSegments(geo, mat);
    // Draw edges slightly above the surface to reduce z-fighting.
    lines.renderOrder = 1;
    group.add(lines);
  }

  // Center on origin.
  const box = new THREE.Box3().setFromObject(group);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    group.position.sub(center);
  }

  return { group, flat, faceCount: faces.length, edgeCount: edges.length };
}

function describeFold(fold: FoldObject, flat: boolean): string {
  const classes = [...(fold.frame_classes || []), ...(fold.file_classes || [])].map(String);
  const kind = classes.includes("foldedForm")
    ? "Folded form"
    : classes.includes("creasePattern")
      ? "Crease pattern"
      : flat
        ? "Flat geometry"
        : "3D geometry";
  return `${kind} · drag to orbit · scroll to zoom`;
}

export function mountOrigami3d(
  container: HTMLElement,
  fold: FoldObject,
  options: { frames?: FoldObject[]; frameIndex?: number } = {}
): Origami3dHandle {
  const frames =
    options.frames && options.frames.length
      ? options.frames
      : collectFoldFrames(fold).length
        ? collectFoldFrames(fold)
        : [fold];
  let frameIndex = Math.max(0, Math.min(frames.length - 1, options.frameIndex ?? 0));

  const width = Math.max(container.clientWidth || 480, 160);
  const height = Math.max(container.clientHeight || 360, 160);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0xf7f3ec, 1);
  container.replaceChildren(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.borderRadius = "6px";
  renderer.domElement.setAttribute("aria-label", "3D FOLD preview");

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-2, 1, -2);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 1.1;

  let active = true;
  let raf = 0;
  let disposed = false;
  let root: THREE.Object3D | null = null;

  const disposeRoot = () => {
    if (!root) return;
    scene.remove(root);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    root = null;
  };

  const fitCameraTo = (obj: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(obj);
    const sizeVec = box.getSize(new THREE.Vector3());
    const size = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1e-3);
    const dist = size * 1.8;
    camera.position.set(dist * 0.55, dist * 0.45, dist);
    camera.near = Math.max(size / 500, 0.001);
    camera.far = size * 100;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.maxDistance = size * 20;
    controls.minDistance = size * 0.05;
    controls.update();
  };

  const showFrame = (index: number, opts: { refit: boolean }) => {
    const fr = frames[index];
    if (!fr) throw new Error("No FOLD frame to display");
    const { group, flat, faceCount, edgeCount } = buildFoldGroup(fr);
    if (!faceCount && !edgeCount) {
      throw new Error("FOLD frame has no faces or edges to display");
    }
    disposeRoot();
    root = group;
    scene.add(group);
    frameIndex = index;
    container.dataset.origamiDesc = describeFold(fr, flat);
    container.dataset.origamiFrame = String(index);
    if (opts.refit) fitCameraTo(group);
  };

  showFrame(frameIndex, { refit: true });

  function resize() {
    if (disposed) return;
    const w = Math.max(container.clientWidth || 160, 120);
    const h = Math.max(container.clientHeight || 160, 120);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(container);

  const loop = () => {
    if (disposed) return;
    raf = window.requestAnimationFrame(loop);
    if (!active) return;
    controls.update();
    renderer.render(scene, camera);
  };
  raf = window.requestAnimationFrame(loop);

  return {
    frameCount: frames.length,
    setActive(next: boolean) {
      active = next;
    },
    setFrameIndex(index: number) {
      const i = Math.max(0, Math.min(frames.length - 1, index));
      if (i === frameIndex && root) return;
      showFrame(i, { refit: true });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      controls.dispose();
      disposeRoot();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
