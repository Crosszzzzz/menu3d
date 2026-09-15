import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Scanned-burger GLB pipeline (Approach A: per-ingredient scans).
 *
 * Until the 5 photogrammetry scans land in `public/models/`, the burger path
 * renders TEMP procedural stand-ins clamped to the anchor table below, so the
 * pipeline, statuses, anchors, and interactions stay verifiable. Stand-ins
 * are NOT final visuals — the final-visuals verdict stays BLOCKED until the
 * scans land (see spec sdd/scanned-burger-glb).
 *
 * `dishes.ts` stays UNTOUCHED: SCAN_SLOTS maps drop-zone files to the real
 * ingredient ids (which differ from the proposal shorthand).
 */

/** Per-ingredient load state surfaced to WebARCanvas via `onStatus`. */
export type IngredientLoadStatus = 'standin' | 'loading' | 'ready' | 'error';

export interface ScanSlot {
  /** Real ingredient id from dishes.ts (stable Group identity). */
  ingredientId: string;
  /** Drop-zone file under SCAN_BASE_PATH (served static, never bundled). */
  file: string;
  /** Target horizontal diameter in scene units (1u = 0.04m). */
  targetDiameter: number;
  /** Force DoubleSide (thin zero-thickness sheets only). */
  doubleSide?: boolean;
}

/** Static drop-zone base. GLBs are fetched, never imported/bundled. */
export const SCAN_BASE_PATH = '/models/';

/** Acceptance caps: scans above these are rejected before touching the scene. */
export const MAX_SCAN_BYTES = 3 * 1024 * 1024; // 3MB
export const MAX_SCAN_TRIANGLES = 100_000; // 100k tris (decimated)

/** Five-ingredient scale and anchor table (tolerance +/-5% after swap). */
export const SCAN_SLOTS: ScanSlot[] = [
  { ingredientId: 'bun-bottom', file: 'bun-bottom.glb', targetDiameter: 2.4 },
  { ingredientId: 'meat-wagyu-patty', file: 'patty.glb', targetDiameter: 2.8 },
  { ingredientId: 'lettuce-batavia', file: 'lettuce.glb', targetDiameter: 2.7, doubleSide: true },
  { ingredientId: 'tomato-heirloom', file: 'tomato-slice.glb', targetDiameter: 2.4 },
  { ingredientId: 'bun-top', file: 'bun-top.glb', targetDiameter: 2.4 },
];

/** Scan lighting clamp: scans carry baked light, never re-plasticize. */
export const MAX_SCAN_ENV_INTENSITY = 0.5;

export function getScanUrl(slot: ScanSlot): string {
  return `${SCAN_BASE_PATH}${slot.file}`;
}

export function getScanSlot(ingredientId: string): ScanSlot | undefined {
  return SCAN_SLOTS.find((s) => s.ingredientId === ingredientId);
}

// ---------------------------------------------------------------------------
// Shared GLTFLoader singleton (one instance for the <=5 in-flight slot loads)
// ---------------------------------------------------------------------------

let sharedLoader: GLTFLoader | null = null;

export function getSharedLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader();
  return sharedLoader;
}

// ---------------------------------------------------------------------------
// Cap validation (probes run BEFORE anything touches the scene)
// ---------------------------------------------------------------------------

export class ScanCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanCapError';
  }
}

/** Byte-cap probe: rejects oversized payloads with rescan guidance. */
export function validateByteCap(byteLength: number, file: string): void {
  if (byteLength > MAX_SCAN_BYTES) {
    const mb = (byteLength / (1024 * 1024)).toFixed(1);
    throw new ScanCapError(
      `${file} is ${mb}MB (cap 3MB). Decimate and re-export under 3MB before dropping it into public/models/.`
    );
  }
}

/** Count triangles across all meshes under root (pure scene-graph math). */
export function countTriangles(root: THREE.Object3D): number {
  let tris = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geo) return;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const index = geo.getIndex();
    tris += index ? index.count / 3 : pos.count / 3;
  });
  return Math.floor(tris);
}

/** Tri-cap probe: rejects undecimated scans with rescan guidance. */
export function validateTriCap(triangles: number, file: string): void {
  if (triangles > MAX_SCAN_TRIANGLES) {
    throw new ScanCapError(
      `${file} has ~${triangles.toLocaleString('en-US')} triangles (cap 100k). Decimate in your scan tool and re-export before retrying.`
    );
  }
}

// ---------------------------------------------------------------------------
// Normalization: Y-up, XZ-centered, uniformly scaled to target diameter,
// base sitting at local y=0. The parent Group keeps the dishes.ts assembled
// position, so exploded lerp / raycast / pins / exclusion / auto-fit are
// unaffected by the swap.
// ---------------------------------------------------------------------------

export function normalizeScan(root: THREE.Object3D, targetDiameter: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontal = Math.max(size.x, size.z);
  if (horizontal > 1e-6) {
    const scale = targetDiameter / horizontal;
    root.scale.multiplyScalar(scale);
  }
  // Re-measure after scaling, then bake XZ-center + minY=0 into children so
  // the parent Group origin stays at the dishes.ts anchor. Offsets are
  // measured in world space but children live in the scaled local space,
  // so divide by the uniform scale before shifting.
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const scaledCenter = scaled.getCenter(new THREE.Vector3());
  const s = root.scale.x !== 0 ? root.scale.x : 1;
  const dx = scaledCenter.x / s;
  const dz = scaledCenter.z / s;
  const minY = scaled.min.y / s;
  for (const child of [...root.children]) {
    child.position.x -= dx;
    child.position.z -= dz;
    child.position.y -= minY;
  }
  root.updateMatrixWorld(true);
}

/** Clamp scan materials to the scene env budget (never re-plasticize). */
export function clampScanMaterials(root: THREE.Object3D, doubleSide: boolean): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const std = mat as THREE.MeshStandardMaterial;
      if (typeof std.envMapIntensity === 'number') {
        std.envMapIntensity = Math.min(std.envMapIntensity, MAX_SCAN_ENV_INTENSITY);
      } else {
        (std as THREE.MeshStandardMaterial).envMapIntensity = MAX_SCAN_ENV_INTENSITY;
      }
      if (doubleSide) std.side = THREE.DoubleSide;
      std.needsUpdate = true;
    }
  });
}

// ---------------------------------------------------------------------------
// Loader entry: fetch bytes -> byte-cap probe -> parse -> tri-cap probe ->
// normalize + clamp. Rejects never touch the scene (caller keeps stand-in).
// ---------------------------------------------------------------------------

export async function loadIngredient(slot: ScanSlot, _generation: number): Promise<THREE.Group> {
  const url = getScanUrl(slot);
  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`${slot.file} not found (HTTP ${res.status}). Drop the scan into public/models/ or retry.`);
    }
    buffer = await res.arrayBuffer();
  } catch (err) {
    if (err instanceof ScanCapError || (err instanceof Error && /HTTP \d/.test(err.message))) throw err;
    throw new Error(`Could not fetch ${slot.file}: ${(err as Error).message}. Check public/models/ and retry.`);
  }

  validateByteCap(buffer.byteLength, slot.file);

  const loader = getSharedLoader();
  let parsed: { scene: THREE.Object3D };
  try {
    parsed = await loader.parseAsync(buffer, SCAN_BASE_PATH);
  } catch (err) {
    throw new Error(`${slot.file} could not be parsed as GLB: ${(err as Error).message}. Re-export the scan and retry.`);
  }

  const tris = countTriangles(parsed.scene);
  validateTriCap(tris, slot.file);

  normalizeScan(parsed.scene, slot.targetDiameter);
  clampScanMaterials(parsed.scene, slot.doubleSide === true);

  const group = new THREE.Group();
  group.name = slot.ingredientId;
  // normalizeScan bakes XZ-center + minY=0 into the children but leaves the
  // uniform fit scale on the parsed root. Reparenting the children straight
  // into a fresh scale-1 group would silently drop that scale (a meter-scale
  // photogrammetry scan would render ~10x tiny next to procedural props), so
  // the children stay under an inner holder that carries the fitted scale.
  // Callers move `group.children` (the holder) and the fit survives every
  // swap path (first landing, retry, per-ingredient slots).
  const fitted = new THREE.Group();
  fitted.name = `${slot.ingredientId}-scan-fit`;
  fitted.scale.copy(parsed.scene.scale);
  for (const child of [...parsed.scene.children]) {
    fitted.add(child);
  }
  group.add(fitted);
  return group;
}

// ---------------------------------------------------------------------------
// Disposal: geometries + materials + textures of replaced groups. No object
// URLs are created by this pipeline (fetch + parseAsync), so there is
// nothing to revoke; the builder cleanup keeps a revoke stub for future
// blob-URL sources.
// ---------------------------------------------------------------------------

export function disposeGroup(root: THREE.Object3D | null | undefined, keepTextures?: Set<THREE.Texture>): void {
  if (!root) return;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    geo?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const withMaps = mat as THREE.MeshStandardMaterial & Record<string, unknown>;
      for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'envMap'] as const) {
        const tex = withMaps[key] as THREE.Texture | undefined;
        if (tex && typeof tex.dispose === 'function' && !keepTextures?.has(tex)) tex.dispose();
      }
      mat.dispose();
    }
  });
}

/** Collect textures still referenced by live groups (protects shared PBR sets). */
export function collectLiveTextures(roots: Iterable<THREE.Object3D>): Set<THREE.Texture> {
  const live = new Set<THREE.Texture>();
  for (const root of roots) {
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const withMaps = mat as THREE.MeshStandardMaterial & Record<string, unknown>;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'envMap'] as const) {
          const tex = withMaps[key] as THREE.Texture | undefined;
          if (tex) live.add(tex);
        }
      }
    });
  }
  return live;
}
