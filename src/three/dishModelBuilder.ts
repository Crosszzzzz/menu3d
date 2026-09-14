import * as THREE from 'three';
import { Dish } from '../types/dish';
import {
  SCAN_SLOTS,
  ScanSlot,
  IngredientLoadStatus,
  loadIngredient,
  getScanSlot,
  disposeGroup,
  collectLiveTextures,
} from './assetLoader';

/**
 * Photorealistic procedural PBR pipeline (zero binary assets).
 *
 * Every food layer renders from a 1024 canvas albedo plus derived normal
 * (Sobel height-to-normal), roughness-variance, and AO maps produced by
 * one shared `makePBRSet()` helper. Presentation props (ceramic plate,
 * wood table) are tagged `userData.isStaticProp` and bypass all food
 * logic (exploded lerp, levitation, raycast, pins, exclusion, auto-fit).
 */

export interface PBRSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  aoMap: THREE.CanvasTexture;
}

export interface PBRSetOptions {
  /** Canvas resolution (default 1024). */
  size?: number;
  /** Sobel normal strength (design range 1.5-2.5 per layer). */
  normalStrength?: number;
  /** Base roughness 0..1 the variance blotches modulate around. */
  roughBase?: number;
  /** Roughness variance amplitude 0..1 (breaks the plastic look). */
  roughVariance?: number;
  /** AO cavity darkening amplitude 0..1. */
  aoStrength?: number;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return [canvas, canvas.getContext('2d')!];
}

function toTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Sobel height-to-normal: reuses albedo luminance as height, zero extra art.
 * Strength 1.5-2.5 keeps bun/patty relief readable without crunchy edges.
 */
export function heightToNormal(source: HTMLCanvasElement, strength = 2.0): HTMLCanvasElement {
  const size = source.width;
  const src = source.getContext('2d')!.getImageData(0, 0, size, size);
  const [out, outCtx] = makeCanvas(size);
  const dst = outCtx.createImageData(size, size);
  const lum = (x: number, y: number): number => {
    const cx = Math.min(size - 1, Math.max(0, x));
    const cy = Math.min(size - 1, Math.max(0, y));
    const i = (cy * size + cx) * 4;
    return (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = lum(x - 1, y - 1);
      const l = lum(x - 1, y);
      const bl = lum(x - 1, y + 1);
      const tr = lum(x + 1, y - 1);
      const r = lum(x + 1, y);
      const br = lum(x + 1, y + 1);
      const t = lum(x, y - 1);
      const b = lum(x, y + 1);
      const dx = (tr + 2 * r + br - tl - 2 * l - bl) * strength;
      const dy = (bl + 2 * b + br - tl - 2 * t - tr) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      dst.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      dst.data[i + 2] = inv * 255;
      dst.data[i + 3] = 255;
    }
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
}

/**
 * Builds a full PBR map set from one albedo painter. Roughness gets blotch
 * variance around roughBase (no uniform gloss = no plastic look); AO gets
 * cavity speckles. Canvases are reused per material family.
 */
export function makePBRSet(
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  opts: PBRSetOptions = {}
): PBRSet {
  const size = opts.size ?? 1024;
  const normalStrength = opts.normalStrength ?? 2.0;
  const roughBase = opts.roughBase ?? 0.5;
  const roughVariance = opts.roughVariance ?? 0.25;
  const aoStrength = opts.aoStrength ?? 0.35;

  const [albedo, actx] = makeCanvas(size);
  paint(actx, size);

  // Roughness: mid-gray base + soft blotches for highlight breakup.
  const [rough, rctx] = makeCanvas(size);
  const base = Math.round(roughBase * 255);
  rctx.fillStyle = `rgb(${base},${base},${base})`;
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i++) {
    const v = Math.round(
      Math.min(255, Math.max(0, base + (Math.random() - 0.5) * 2 * roughVariance * 255))
    );
    rctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    rctx.beginPath();
    rctx.arc(Math.random() * size, Math.random() * size, 4 + Math.random() * 26, 0, Math.PI * 2);
    rctx.fill();
  }

  // AO: near-white base with cavity speckle darkening.
  const [ao, aoctx] = makeCanvas(size);
  aoctx.fillStyle = '#f2f2f2';
  aoctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const dark = Math.round(242 - Math.random() * aoStrength * 120);
    aoctx.fillStyle = `rgba(${dark},${dark},${dark},0.55)`;
    aoctx.beginPath();
    aoctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 5, 0, Math.PI * 2);
    aoctx.fill();
  }

  return {
    map: toTexture(albedo, true),
    normalMap: toTexture(heightToNormal(albedo, normalStrength), false),
    roughnessMap: toTexture(rough, false),
    aoMap: toTexture(ao, false),
  };
}

// ---------------------------------------------------------------------------
// 1024 albedo painters (brioche / meat / truffle upgraded, wood grain added)
// ---------------------------------------------------------------------------

function paintBrioche(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 512; // painters authored at 512, scaled to canvas size
  const gradient = ctx.createRadialGradient(s / 2, s * 0.235, 20 * c, s / 2, s / 2, s / 2);
  gradient.addColorStop(0, '#8c3d0b'); // Deeper toasted crest
  gradient.addColorStop(0.35, '#c96a1a'); // Warm honey brioche
  gradient.addColorStop(0.75, '#e0882e'); // Golden glazed edge
  gradient.addColorStop(1, '#a65415'); // Slightly toasted rim
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, s, s);

  // Flour speckles & micro crust pores (denser at 1024 for close-ups)
  for (let i = 0; i < 1600; i++) {
    const radius = (Math.random() * 1.5 + 0.5) * c;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 230, 180, 0.12)' : 'rgba(70, 25, 5, 0.08)';
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Toasted crackle streaks for dome highlight breakup
  for (let i = 0; i < 220; i++) {
    ctx.strokeStyle =
      Math.random() > 0.5 ? 'rgba(60, 22, 4, 0.10)' : 'rgba(255, 214, 150, 0.08)';
    ctx.lineWidth = (Math.random() * 2 + 0.5) * c;
    const x = Math.random() * s;
    const y = Math.random() * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 60 * c, y + (Math.random() - 0.5) * 60 * c);
    ctx.stroke();
  }
}

function paintTruffleSauce(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 256;
  ctx.fillStyle = '#eddab8';
  ctx.fillRect(0, 0, s, s);

  // Emulsion swirl sheen
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = 'rgba(255, 250, 235, 0.10)';
    ctx.lineWidth = (2 + Math.random() * 5) * c;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, Math.random() * s * 0.5, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2 + 1.2);
    ctx.stroke();
  }
  // Black truffle micro-flakes
  for (let i = 0; i < 1100; i++) {
    const radius = (Math.random() * 2 + 0.8) * c;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.75)';
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintMeat(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 512;
  ctx.fillStyle = '#442016';
  ctx.fillRect(0, 0, s, s);

  // Charred smash crust striations & caramelized Maillard edges
  for (let i = 0; i < 2000; i++) {
    const w = (Math.random() * 8 + 2) * c;
    const h = (Math.random() * 4 + 1) * c;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(22, 10, 8, 0.85)' : 'rgba(120, 48, 28, 0.65)';
    ctx.fillRect(Math.random() * s, Math.random() * s, w, h);
  }
  // Rendered-fat glints and juice pockets
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(214, 138, 80, 0.20)' : 'rgba(12, 5, 4, 0.35)';
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, (Math.random() * 2.4 + 0.6) * c, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintWoodGrain(ctx: CanvasRenderingContext2D, s: number): void {
  // Warm oak base with long consistent grain direction (horizontal)
  const gradient = ctx.createLinearGradient(0, 0, 0, s);
  gradient.addColorStop(0, '#8a5a30');
  gradient.addColorStop(0.5, '#96683a');
  gradient.addColorStop(1, '#7d5028');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, s, s);

  // Long grain streaks
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * s;
    ctx.strokeStyle =
      Math.random() > 0.45 ? 'rgba(52, 30, 12, 0.22)' : 'rgba(214, 164, 110, 0.14)';
    ctx.lineWidth = Math.random() * 2.2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    for (let x = 0; x <= s; x += s / 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (Math.random() - 0.5) * 4);
    }
    ctx.stroke();
  }
  // Knots
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * s;
    const y = Math.random() * s;
    for (let r = 12; r > 1; r -= 2.5) {
      ctx.strokeStyle = 'rgba(48, 26, 10, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** Soft neutral glaze for ceramic: near-white so the material color reads. */
function paintCeramicGlaze(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 500; i++) {
    const v = 240 + Math.round(Math.random() * 15);
    ctx.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Builds the 3D visual representation of a dish.
 *
 * Burger path: returns sync TEMP procedural stand-ins for the 5 scan slots
 * (clamped to the SCAN_SLOTS anchor table) and kicks 5 lazy per-ingredient
 * GLB loads that swap in place on resolve. Group identity stays stable so
 * exploded lerp, raycast, pins, exclusion, AR scale, and auto-fit never
 * change. Poke path is untouched (fully synchronous, no scans).
 */
export interface BuildDishOptions {
  onStatus?: (ingredientId: string, status: IngredientLoadStatus, error?: string) => void;
}

/** Generation token: dish switch / cleanup cancels stale in-flight swaps. */
let scanGeneration = 0;

/** Cancel pending scanned swaps (dish switch or unmount). */
export function cancelScannedLoads(): void {
  scanGeneration += 1;
}

export function buildDish3DModel(
  dish: Dish,
  opts?: BuildDishOptions
): {
  group: THREE.Group;
  ingredientMeshes: Map<string, THREE.Object3D>;
} {
  const group = new THREE.Group();
  group.name = `dish-${dish.id}`;
  const ingredientMeshes = new Map<string, THREE.Object3D>();

  if (dish.id === 'wagyu-smash-burger') {
    buildBurgerModel(dish, group, ingredientMeshes, opts);
  } else {
    buildPokeModel(dish, group, ingredientMeshes);
  }

  return { group, ingredientMeshes };
}

/** Marks a presentation prop as static (excluded from all food logic). */
function tagStaticProp(obj: THREE.Object3D): void {
  obj.userData.isStaticProp = true;
}

/**
 * Lathe-turned glazed ceramic plate, ~=26cm (dia 6.4u).
 * Profile (units): (0,0)->(2.0,0)->(2.6,0.12)->(3.2,0.28).
 */
export function buildPlate(): THREE.Group {
  const plateGroup = new THREE.Group();
  plateGroup.name = 'prop-ceramic-plate';

  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0.0),
    new THREE.Vector2(1.0, 0.0),
    new THREE.Vector2(2.0, 0.0),
    new THREE.Vector2(2.3, 0.03),
    new THREE.Vector2(2.6, 0.12),
    new THREE.Vector2(2.95, 0.2),
    new THREE.Vector2(3.2, 0.28),
  ];
  const plateGeo = new THREE.LatheGeometry(profile, 72);
  const glaze = makePBRSet(paintCeramicGlaze, {
    size: 1024,
    normalStrength: 1.5,
    roughBase: 0.2,
    roughVariance: 0.08,
    aoStrength: 0.15,
  });
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5f2ec,
    map: glaze.map,
    normalMap: glaze.normalMap,
    roughnessMap: glaze.roughnessMap,
    aoMap: glaze.aoMap,
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.castShadow = true;
  plateMesh.receiveShadow = true;
  plateGroup.add(plateMesh);

  // Foot ring underneath so the plate never z-fights the table
  const footGeo = new THREE.TorusGeometry(1.1, 0.06, 10, 48);
  const foot = new THREE.Mesh(footGeo, plateMat);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = -0.05;
  plateGroup.add(foot);

  tagStaticProp(plateGroup);
  return plateGroup;
}

/** Wood table surface: 16x16 procedural oak plane at y -0.15, matte finish. */
export function buildWoodTable(): THREE.Group {
  const tableGroup = new THREE.Group();
  tableGroup.name = 'prop-wood-table';

  const wood = makePBRSet(paintWoodGrain, {
    size: 1024,
    normalStrength: 1.5,
    roughBase: 0.7,
    roughVariance: 0.18,
    aoStrength: 0.25,
  });
  const tableMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    normalMap: wood.normalMap,
    roughnessMap: wood.roughnessMap,
    aoMap: wood.aoMap,
    roughness: 0.7,
    metalness: 0.0,
  });
  const tableGeo = new THREE.PlaneGeometry(16, 16);
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.rotation.x = -Math.PI / 2;
  tableMesh.position.y = -0.15;
  tableMesh.receiveShadow = true;
  tableGroup.add(tableMesh);

  tagStaticProp(tableGroup);
  return tableGroup;
}

/**
 * Procedural Gourmet Burger with High Visual Detail
 */
function buildBurgerModel(
  dish: Dish,
  parentGroup: THREE.Group,
  ingredientMeshes: Map<string, THREE.Object3D>,
  opts?: BuildDishOptions
) {
  const brioche = makePBRSet(paintBrioche, {
    size: 1024,
    normalStrength: 2.2,
    roughBase: 0.5,
    roughVariance: 0.28,
    aoStrength: 0.35,
  });
  const truffle = makePBRSet(paintTruffleSauce, {
    size: 1024,
    normalStrength: 1.8,
    roughBase: 0.18,
    roughVariance: 0.12,
    aoStrength: 0.2,
  });
  const meat = makePBRSet(paintMeat, {
    size: 1024,
    normalStrength: 2.5,
    roughBase: 0.62,
    roughVariance: 0.3,
    aoStrength: 0.4,
  });

  // 1. Ceramic Plate (replaces the slate base; registered under the
  // ceramic-slate ingredient id so all 11 layers still resolve). Tagged
  // static: explode/pins/raycast/exclusion/auto-fit guards skip it.
  const slateIng = dish.ingredients.find(i => i.id === 'ceramic-slate');
  if (slateIng) {
    const plateGroup = buildPlate();
    plateGroup.userData = {
      ...plateGroup.userData,
      ingredientId: slateIng.id,
      name: slateIng.name,
    };
    plateGroup.position.set(...slateIng.assembledPosition);
    parentGroup.add(plateGroup);
    ingredientMeshes.set(slateIng.id, plateGroup);

    // Wood table: static child, no ingredient id (never food logic).
    const table = buildWoodTable();
    parentGroup.add(table);
  }

  // 2. Bun Bottom
  const bunBottomIng = dish.ingredients.find(i => i.id === 'bun-bottom');
  if (bunBottomIng) {
    const bunBottomGroup = new THREE.Group();
    bunBottomGroup.userData = { ingredientId: bunBottomIng.id, name: bunBottomIng.name };

    // Fluffy pillowy cylinder with rounded edges
    const bunGeo = new THREE.CylinderGeometry(1.22, 1.18, 0.32, 36);
    const bunMat = new THREE.MeshStandardMaterial({
      map: brioche.map,
      normalMap: brioche.normalMap,
      roughnessMap: brioche.roughnessMap,
      aoMap: brioche.aoMap,
      roughness: 0.65,
      metalness: 0.05,
      color: 0xd88029,
    });
    const bunMesh = new THREE.Mesh(bunGeo, bunMat);
    bunMesh.castShadow = true;
    bunMesh.receiveShadow = true;
    bunMesh.position.y = 0.16;
    bunBottomGroup.add(bunMesh);

    // Toasted interior face with butter gloss
    const interiorGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.02, 36);
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0xf5d399,
      roughness: 0.45,
      metalness: 0.1,
    });
    const interiorMesh = new THREE.Mesh(interiorGeo, interiorMat);
    interiorMesh.position.y = 0.325;
    bunBottomGroup.add(interiorMesh);

    bunBottomGroup.position.set(...bunBottomIng.assembledPosition);
    parentGroup.add(bunBottomGroup);
    ingredientMeshes.set(bunBottomIng.id, bunBottomGroup);
  }

  // 3. Caramelized Onion
  const onionIng = dish.ingredients.find(i => i.id === 'onion-caramelized');
  if (onionIng) {
    const onionGroup = new THREE.Group();
    onionGroup.userData = { ingredientId: onionIng.id, name: onionIng.name };

    const onionMat = new THREE.MeshStandardMaterial({
      color: 0x6e2e1c,
      roughness: 0.28,
      metalness: 0.15,
    });

    // Multiple tangled glazed onion ring strands
    for (let i = 0; i < 9; i++) {
      const radius = 0.35 + (i % 4) * 0.22;
      const tubeRadius = 0.045 + Math.random() * 0.02;
      const torusGeo = new THREE.TorusGeometry(radius, tubeRadius, 8, 24, Math.PI * (1.2 + Math.random() * 0.6));
      const strand = new THREE.Mesh(torusGeo, onionMat);
      strand.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.25;
      strand.rotation.z = Math.random() * Math.PI * 2;
      strand.position.set(
        (Math.random() - 0.5) * 0.55,
        0.05 + (i * 0.015),
        (Math.random() - 0.5) * 0.55
      );
      strand.castShadow = true;
      onionGroup.add(strand);
    }

    onionGroup.position.set(...onionIng.assembledPosition);
    parentGroup.add(onionGroup);
    ingredientMeshes.set(onionIng.id, onionGroup);
  }

  // 4. Wagyu Smash Patty (edge displacement: irregular lacy Maillard crust)
  const meatIng = dish.ingredients.find(i => i.id === 'meat-wagyu-patty');
  if (meatIng) {
    const meatGroup = new THREE.Group();
    meatGroup.userData = { ingredientId: meatIng.id, name: meatIng.name };

    // Smash patty with irregular lacy Maillard crispy edges
    const pattyGeo = new THREE.CylinderGeometry(1.36, 1.42, 0.34, 48);
    // Perturb vertices for jagged smash edges (radial + vertical crust)
    const posAttr = pattyGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const dist = Math.sqrt(x * x + z * z);
      if (dist > 1.0) {
        const noise = (Math.sin(x * 12) + Math.cos(z * 14)) * 0.075;
        posAttr.setX(i, x + x * noise);
        posAttr.setZ(i, z + z * noise);
        // Crispy vertical crust undulation
        posAttr.setY(i, y + Math.sin(x * 18 + z * 15) * 0.02);
      }
    }
    pattyGeo.computeVertexNormals();

    const meatMat = new THREE.MeshStandardMaterial({
      map: meat.map,
      normalMap: meat.normalMap,
      roughnessMap: meat.roughnessMap,
      aoMap: meat.aoMap,
      roughness: 0.72,
      metalness: 0.1,
      color: 0x5a291a,
    });
    const pattyMesh = new THREE.Mesh(pattyGeo, meatMat);
    pattyMesh.castShadow = true;
    pattyMesh.receiveShadow = true;
    pattyMesh.position.y = 0.17;
    meatGroup.add(pattyMesh);

    meatGroup.position.set(...meatIng.assembledPosition);
    parentGroup.add(meatGroup);
    ingredientMeshes.set(meatIng.id, meatGroup);
  }

  // 5. Melted Aged Cheddar (draped sheet + sagging drip tongues)
  const cheeseIng = dish.ingredients.find(i => i.id === 'cheddar-melt');
  if (cheeseIng) {
    const cheeseGroup = new THREE.Group();
    cheeseGroup.userData = { ingredientId: cheeseIng.id, name: cheeseIng.name };

    const cheeseMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      roughness: 0.28,
      metalness: 0.05,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
    });

    // Square draped sheet with sagging center (melt slump over the patty)
    const cheeseGeo = new THREE.BoxGeometry(2.45, 0.065, 2.45, 12, 1, 12);
    const cPos = cheeseGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const x = cPos.getX(i);
      const z = cPos.getZ(i);
      const r = Math.sqrt(x * x + z * z);
      // Slump toward the patty, lift slightly at the corners
      cPos.setY(i, cPos.getY(i) - Math.max(0, 0.09 - r * 0.05) + Math.max(0, r - 1.1) * 0.03);
    }
    cheeseGeo.computeVertexNormals();
    const cheeseMesh = new THREE.Mesh(cheeseGeo, cheeseMat);
    cheeseMesh.rotation.y = Math.PI / 4; // Rotated 45 degrees so corners drip over edges
    cheeseMesh.castShadow = true;
    cheeseMesh.receiveShadow = true;
    cheeseMesh.position.y = 0.1;
    cheeseGroup.add(cheeseMesh);

    // Drooping melted corner tongues over the burger sides
    const dripAngles = [0.75, 2.35, 3.9, 5.4];
    dripAngles.forEach((angle, idx) => {
      const len = 0.34 + (idx % 2) * 0.12;
      const dripGeo = new THREE.ConeGeometry(0.17, len, 12);
      const dripPos = dripGeo.attributes.position;
      // Taper wobble so drips read as viscous, not machined cones
      for (let i = 0; i < dripPos.count; i++) {
        const dx = dripPos.getX(i);
        dripPos.setX(i, dx + Math.sin(dripPos.getY(i) * 9 + idx) * 0.02);
      }
      dripGeo.computeVertexNormals();
      const drip = new THREE.Mesh(dripGeo, cheeseMat);
      drip.rotation.x = Math.PI;
      drip.rotation.z = (Math.random() - 0.5) * 0.15;
      drip.position.set(Math.cos(angle) * 1.38, -0.06, Math.sin(angle) * 1.38);
      drip.castShadow = true;
      cheeseGroup.add(drip);
    });

    cheeseGroup.position.set(...cheeseIng.assembledPosition);
    parentGroup.add(cheeseGroup);
    ingredientMeshes.set(cheeseIng.id, cheeseGroup);
  }

  // 6. Crisp Batavia Lettuce (ruffled perimeter + cupped center)
  const lettuceIng = dish.ingredients.find(i => i.id === 'lettuce-batavia');
  if (lettuceIng) {
    const lettuceGroup = new THREE.Group();
    lettuceGroup.userData = { ingredientId: lettuceIng.id, name: lettuceIng.name };

    // Rippled wavy disc
    const lettuceGeo = new THREE.PlaneGeometry(2.7, 2.7, 32, 32);
    const lPos = lettuceGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const u = lPos.getX(i);
      const v = lPos.getY(i);
      const r = Math.sqrt(u * u + v * v);
      // Ruffled perimeter, stronger toward the edge
      const edge = Math.min(1, r / 1.35);
      const wave =
        Math.sin(u * 7) * Math.cos(v * 7) * 0.18 * edge +
        Math.sin(u * 13 + 1.7) * Math.cos(v * 11 + 0.6) * 0.07 * edge * edge;
      // Gentle cup so the leaf cradles the tomato
      const cup = -0.1 * (1 - edge * edge);
      lPos.setZ(i, wave + cup);
    }
    lettuceGeo.computeVertexNormals();

    const lettuceMat = new THREE.MeshStandardMaterial({
      color: 0x48b63e,
      roughness: 0.42,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const lettuceMesh = new THREE.Mesh(lettuceGeo, lettuceMat);
    lettuceMesh.rotation.x = -Math.PI / 2;
    lettuceMesh.castShadow = true;
    lettuceMesh.receiveShadow = true;
    lettuceGroup.add(lettuceMesh);

    lettuceGroup.position.set(...lettuceIng.assembledPosition);
    parentGroup.add(lettuceGroup);
    ingredientMeshes.set(lettuceIng.id, lettuceGroup);
  }

  // 7. Heirloom Tomato Slice (juicy gloss: clearcoat + low roughness)
  const tomatoIng = dish.ingredients.find(i => i.id === 'tomato-heirloom');
  if (tomatoIng) {
    const tomatoGroup = new THREE.Group();
    tomatoGroup.userData = { ingredientId: tomatoIng.id, name: tomatoIng.name };

    // Thick juicy red slab
    const tomatoGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.22, 36);
    const tomatoMat = new THREE.MeshPhysicalMaterial({
      color: 0xc92d24,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const tomatoMesh = new THREE.Mesh(tomatoGeo, tomatoMat);
    tomatoMesh.castShadow = true;
    tomatoMesh.receiveShadow = true;
    tomatoMesh.position.y = 0.11;
    tomatoGroup.add(tomatoMesh);

    // Juicy top glaze film
    const glazeGeo = new THREE.CylinderGeometry(1.18, 1.18, 0.015, 36);
    const glazeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0564a,
      roughness: 0.05,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.55,
    });
    const glazeMesh = new THREE.Mesh(glazeGeo, glazeMat);
    glazeMesh.position.y = 0.225;
    tomatoGroup.add(glazeMesh);

    // Inner pulp seeds ring
    const pulpMat = new THREE.MeshStandardMaterial({ color: 0x8a1b14, roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const seedGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12);
      const seedMesh = new THREE.Mesh(seedGeo, pulpMat);
      const angle = (i / 6) * Math.PI * 2;
      seedMesh.position.set(Math.cos(angle) * 0.65, 0.225, Math.sin(angle) * 0.65);
      tomatoGroup.add(seedMesh);
    }

    tomatoGroup.position.set(...tomatoIng.assembledPosition);
    parentGroup.add(tomatoGroup);
    ingredientMeshes.set(tomatoIng.id, tomatoGroup);
  }

  // 8. Pickles
  const pickleIng = dish.ingredients.find(i => i.id === 'pickles');
  if (pickleIng) {
    const pickleGroup = new THREE.Group();
    pickleGroup.userData = { ingredientId: pickleIng.id, name: pickleIng.name };

    const pickleMat = new THREE.MeshPhysicalMaterial({
      color: 0x58812e,
      roughness: 0.22,
      metalness: 0.0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
    });
    const dillMat = new THREE.MeshStandardMaterial({ color: 0x2e4714, roughness: 0.7 });

    // 3 pickle discs arranged in triangle
    const picklePositions: [number, number][] = [
      [0.45, 0.3],
      [-0.48, 0.35],
      [0.05, -0.5],
    ];

    picklePositions.forEach(([px, pz], idx) => {
      const discGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.09, 24);
      const disc = new THREE.Mesh(discGeo, pickleMat);
      disc.position.set(px, 0.045, pz);
      disc.rotation.y = idx * 1.2;
      disc.rotation.x = (Math.random() - 0.5) * 0.1;
      disc.castShadow = true;
      pickleGroup.add(disc);

      // Dill specks
      const speckGeo = new THREE.SphereGeometry(0.025, 4, 4);
      const speck = new THREE.Mesh(speckGeo, dillMat);
      speck.position.set(px + 0.1, 0.095, pz + 0.08);
      pickleGroup.add(speck);
    });

    pickleGroup.position.set(...pickleIng.assembledPosition);
    parentGroup.add(pickleGroup);
    ingredientMeshes.set(pickleIng.id, pickleGroup);
  }

  // 9. Black Truffle Sauce (glossy emulsion: clearcoat + derived PBR)
  const sauceIng = dish.ingredients.find(i => i.id === 'sauce-truffle');
  if (sauceIng) {
    const sauceGroup = new THREE.Group();
    sauceGroup.userData = { ingredientId: sauceIng.id, name: sauceIng.name };

    // Glazed irregular puddle
    const sauceGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.09, 32);
    const sauceMat = new THREE.MeshPhysicalMaterial({
      map: truffle.map,
      normalMap: truffle.normalMap,
      roughnessMap: truffle.roughnessMap,
      aoMap: truffle.aoMap,
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      color: 0xebd9b7,
    });
    const sauceMesh = new THREE.Mesh(sauceGeo, sauceMat);
    sauceMesh.castShadow = true;
    sauceMesh.position.y = 0.045;
    sauceGroup.add(sauceMesh);

    sauceGroup.position.set(...sauceIng.assembledPosition);
    parentGroup.add(sauceGroup);
    ingredientMeshes.set(sauceIng.id, sauceGroup);
  }

  // 10. Brioche Bun Top & Sesame Seeds (InstancedMesh, count 90, same dome math)
  const bunTopIng = dish.ingredients.find(i => i.id === 'bun-top');
  if (bunTopIng) {
    const bunTopGroup = new THREE.Group();
    bunTopGroup.userData = { ingredientId: bunTopIng.id, name: bunTopIng.name };

    // Golden glossy dome with organic curve
    const domeGeo = new THREE.SphereGeometry(1.34, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const domeMat = new THREE.MeshPhysicalMaterial({
      map: brioche.map,
      normalMap: brioche.normalMap,
      roughnessMap: brioche.roughnessMap,
      aoMap: brioche.aoMap,
      roughness: 0.38,
      metalness: 0.08,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
      color: 0xd67a24,
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.scale.set(1.0, 0.65, 1.0);
    domeMesh.castShadow = true;
    domeMesh.receiveShadow = true;
    bunTopGroup.add(domeMesh);

    // Flat bottom of the top bun
    const bottomCapGeo = new THREE.CircleGeometry(1.3, 36);
    const bottomCapMat = new THREE.MeshStandardMaterial({
      color: 0xf3d29a,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const bottomCap = new THREE.Mesh(bottomCapGeo, bottomCapMat);
    bottomCap.rotation.x = Math.PI / 2;
    bottomCap.position.y = 0.02;
    bunTopGroup.add(bottomCap);

    // Scattered Sesame Seeds over the dome: ONE draw call via InstancedMesh
    const seedGeo = new THREE.SphereGeometry(0.038, 8, 8);
    seedGeo.scale(1.0, 0.45, 1.8);
    const seedMat = new THREE.MeshStandardMaterial({
      color: 0xfff0cb,
      roughness: 0.4,
      metalness: 0.1,
    });
    const SEED_COUNT = 90;
    const seeds = new THREE.InstancedMesh(seedGeo, seedMat, SEED_COUNT);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < SEED_COUNT; i++) {
      const phi = Math.random() * Math.PI * 0.38;
      const theta = Math.random() * Math.PI * 2;
      const r = 1.34;
      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.65 + 0.015,
        r * Math.sin(phi) * Math.sin(theta)
      );
      dummy.rotation.set(phi, theta + Math.PI / 2, 0);
      dummy.updateMatrix();
      seeds.setMatrixAt(i, dummy.matrix);
    }
    seeds.instanceMatrix.needsUpdate = true;
    seeds.castShadow = true;
    bunTopGroup.add(seeds);

    bunTopGroup.position.set(...bunTopIng.assembledPosition);
    parentGroup.add(bunTopGroup);
    ingredientMeshes.set(bunTopIng.id, bunTopGroup);
  }

  // 11. Rustic French Fries Garnish & Cone
  const friesIng = dish.ingredients.find(i => i.id === 'french-fries');
  if (friesIng) {
    const friesGroup = new THREE.Group();
    friesGroup.userData = { ingredientId: friesIng.id, name: friesIng.name };

    // Metallic serving mini basket
    const basketMat = new THREE.MeshStandardMaterial({
      color: 0x444b58,
      roughness: 0.35,
      metalness: 0.8,
    });
    const basketGeo = new THREE.CylinderGeometry(0.65, 0.45, 0.7, 16, 1, true);
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.position.y = 0.35;
    basket.castShadow = true;
    friesGroup.add(basket);

    // Base of basket
    const baseBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), basketMat);
    baseBasket.position.y = 0.02;
    friesGroup.add(baseBasket);

    // Hand-cut rustic fries (golden brown bastones)
    const fryMat = new THREE.MeshStandardMaterial({
      color: 0xdeb346,
      roughness: 0.52,
      metalness: 0.05,
    });
    const frySkinMat = new THREE.MeshStandardMaterial({
      color: 0x936322,
      roughness: 0.75,
    });

    for (let i = 0; i < 22; i++) {
      const fryGeo = new THREE.BoxGeometry(0.12, 0.85 + Math.random() * 0.35, 0.12);
      const isSkin = Math.random() > 0.65;
      const fryMesh = new THREE.Mesh(fryGeo, isSkin ? frySkinMat : fryMat);
      fryMesh.position.set(
        (Math.random() - 0.5) * 0.6,
        0.5 + Math.random() * 0.25,
        (Math.random() - 0.5) * 0.6
      );
      fryMesh.rotation.set(
        (Math.random() - 0.5) * 0.45,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.45
      );
      fryMesh.castShadow = true;
      friesGroup.add(fryMesh);
    }

    // Sprig of rosemary
    const rosemaryMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.6 });
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6);
    const stem = new THREE.Mesh(stemGeo, rosemaryMat);
    stem.position.set(0.1, 0.85, 0.1);
    stem.rotation.z = 0.4;
    friesGroup.add(stem);

    friesGroup.position.set(...friesIng.assembledPosition);
    parentGroup.add(friesGroup);
    ingredientMeshes.set(friesIng.id, friesGroup);
  }

  // TEMP stand-ins: clamp the 5 scan-slot groups to the exact SCAN_SLOTS
  // anchor table so the pipeline is verifiable before scans land. The other
  // 6 layers (cheese, onion, pickles, sauce, fries, plate/table) stay
  // procedural and untouched. Stand-ins are NOT final visuals.
  for (const slot of SCAN_SLOTS) {
    const standin = ingredientMeshes.get(slot.ingredientId);
    if (standin) {
      clampStandinToDiameter(standin as THREE.Group, slot.targetDiameter);
      standin.userData.isScanStandin = true;
    }
  }

  kickScannedSwaps(dish, ingredientMeshes, opts?.onStatus);
}

/**
 * Uniformly scale a TEMP stand-in group so its horizontal diameter matches
 * the scan anchor table (tolerance +/-5% after swap). Applied before the
 * group position is anchored, so the dishes.ts anchor is preserved.
 */
function clampStandinToDiameter(group: THREE.Group, targetDiameter: number): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const current = Math.max(size.x, size.z);
  if (current > 1e-6) {
    group.scale.multiplyScalar(targetDiameter / current);
  }
  group.updateMatrixWorld(true);
}

/**
 * Swap one scanned GLB into its stable Group (in-place child replacement).
 * Group identity, position anchor, and userData survive, so exploded lerp,
 * raycast select, pins, exclusion, AR scale, and auto-fit keep working.
 * One failure never blocks the other slots; the stand-in stays + onStatus
 * reports the error for retry.
 */
function swapScannedIntoSlot(
  slot: ScanSlot,
  dish: Dish,
  ingredientMeshes: Map<string, THREE.Object3D>,
  generation: number,
  onStatus?: BuildDishOptions['onStatus']
): void {
  const target = ingredientMeshes.get(slot.ingredientId);
  if (!target) return;
  onStatus?.(slot.ingredientId, 'loading');
  loadIngredient(slot, generation).then(
    (scanned) => {
      if (generation !== scanGeneration) {
        disposeGroup(scanned);
        return;
      }
      const current = ingredientMeshes.get(slot.ingredientId);
      if (!current) {
        disposeGroup(scanned);
        return;
      }
      // Protect PBR canvas textures still shared with sibling procedural
      // layers (e.g. brioche set used by both buns).
      const live = [...ingredientMeshes.values()].filter((g) => g !== current);
      const liveTextures = collectLiveTextures(live);
      for (const child of [...current.children]) {
        current.remove(child);
        disposeGroup(child, liveTextures);
      }
      (current as THREE.Group).scale.set(1, 1, 1);
      for (const child of [...scanned.children]) {
        current.add(child);
      }
      current.userData.isScanStandin = false;
      const ing = dish.ingredients.find((i) => i.id === slot.ingredientId);
      if (ing) current.position.set(...ing.assembledPosition);
      onStatus?.(slot.ingredientId, 'ready');
    },
    (err: unknown) => {
      if (generation !== scanGeneration) return;
      onStatus?.(
        slot.ingredientId,
        'error',
        err instanceof Error ? err.message : String(err)
      );
    }
  );
}

/** Kick the 5 lazy per-ingredient loads (burger path only, <=5 in flight). */
function kickScannedSwaps(
  dish: Dish,
  ingredientMeshes: Map<string, THREE.Object3D>,
  onStatus?: BuildDishOptions['onStatus']
): void {
  if (dish.id !== 'wagyu-smash-burger') return;
  const generation = scanGeneration;
  for (const slot of SCAN_SLOTS) {
    if (!ingredientMeshes.has(slot.ingredientId)) continue;
    swapScannedIntoSlot(slot, dish, ingredientMeshes, generation, onStatus);
  }
}

/**
 * Retry a single scan slot (re-invokes loadIngredient for that id only).
 * Used by the per-layer retry chips in WebARCanvas.
 */
export function retryScannedSlot(
  dish: Dish,
  ingredientId: string,
  ingredientMeshes: Map<string, THREE.Object3D>,
  onStatus?: BuildDishOptions['onStatus']
): void {
  const slot = getScanSlot(ingredientId);
  if (!slot || !ingredientMeshes.has(ingredientId)) return;
  swapScannedIntoSlot(slot, dish, ingredientMeshes, scanGeneration, onStatus);
}

/**
 * Procedural Second Dish: Poke Bowl de Salmón Teriyaki & Cerámica Raku
 * (Untouched by the photorealistic-burger change.)
 */
function buildPokeModel(
  dish: Dish,
  parentGroup: THREE.Group,
  ingredientMeshes: Map<string, THREE.Object3D>
) {
  // 1. Ceramic Raku Bowl
  const bowlIng = dish.ingredients.find(i => i.id === 'poke-bowl');
  if (bowlIng) {
    const bowlGroup = new THREE.Group();
    bowlGroup.userData = { ingredientId: bowlIng.id, name: bowlIng.name };

    const bowlGeo = new THREE.CylinderGeometry(1.8, 1.0, 0.95, 36, 1, false);
    const bowlMat = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.65,
      metalness: 0.2,
    });
    const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
    bowlMesh.castShadow = true;
    bowlMesh.receiveShadow = true;
    bowlMesh.position.y = 0.45;
    bowlGroup.add(bowlMesh);

    bowlGroup.position.set(...bowlIng.assembledPosition);
    parentGroup.add(bowlGroup);
    ingredientMeshes.set(bowlIng.id, bowlGroup);
  }

  // 2. Jasmine Steamed Rice
  const riceIng = dish.ingredients.find(i => i.id === 'poke-rice');
  if (riceIng) {
    const riceGroup = new THREE.Group();
    riceGroup.userData = { ingredientId: riceIng.id, name: riceIng.name };

    const riceGeo = new THREE.CylinderGeometry(1.68, 1.35, 0.45, 32);
    const riceMat = new THREE.MeshStandardMaterial({
      color: 0xf5f6f8,
      roughness: 0.75,
    });
    const riceMesh = new THREE.Mesh(riceGeo, riceMat);
    riceMesh.position.y = 0.65;
    riceMesh.receiveShadow = true;
    riceGroup.add(riceMesh);

    riceGroup.position.set(...riceIng.assembledPosition);
    parentGroup.add(riceGroup);
    ingredientMeshes.set(riceIng.id, riceGroup);
  }

  // 3. Salmon Cubes
  const salmonIng = dish.ingredients.find(i => i.id === 'poke-salmon');
  if (salmonIng) {
    const salmonGroup = new THREE.Group();
    salmonGroup.userData = { ingredientId: salmonIng.id, name: salmonIng.name };

    const salmonMat = new THREE.MeshPhysicalMaterial({
      color: 0xee6948,
      roughness: 0.25,
      metalness: 0.05,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    });

    for (let i = 0; i < 9; i++) {
      const cubeGeo = new THREE.BoxGeometry(0.38, 0.35, 0.38);
      const cube = new THREE.Mesh(cubeGeo, salmonMat);
      const angle = (i / 9) * Math.PI * 1.6;
      const r = 0.65 + (i % 2) * 0.25;
      cube.position.set(Math.cos(angle) * r, 0.85 + (i % 3) * 0.08, Math.sin(angle) * r);
      cube.rotation.set((i * 0.2), (i * 0.5), 0.1);
      cube.castShadow = true;
      salmonGroup.add(cube);
    }

    salmonGroup.position.set(...salmonIng.assembledPosition);
    parentGroup.add(salmonGroup);
    ingredientMeshes.set(salmonIng.id, salmonGroup);
  }

  // 4. Avocado Fan
  const avoIng = dish.ingredients.find(i => i.id === 'poke-avocado');
  if (avoIng) {
    const avoGroup = new THREE.Group();
    avoGroup.userData = { ingredientId: avoIng.id, name: avoIng.name };

    const avoMat = new THREE.MeshStandardMaterial({
      color: 0x86bb24,
      roughness: 0.35,
    });

    for (let i = 0; i < 6; i++) {
      const sliceGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16);
      const slice = new THREE.Mesh(sliceGeo, avoMat);
      slice.scale.set(2.2, 1.0, 0.6);
      slice.position.set(0.6 + i * 0.12, 0.88 + i * 0.02, -0.3 + i * 0.15);
      slice.rotation.set(0.3, i * 0.15, -0.4);
      slice.castShadow = true;
      avoGroup.add(slice);
    }

    avoGroup.position.set(...avoIng.assembledPosition);
    parentGroup.add(avoGroup);
    ingredientMeshes.set(avoIng.id, avoGroup);
  }

  // 5. Edamame
  const edaIng = dish.ingredients.find(i => i.id === 'poke-edamame');
  if (edaIng) {
    const edaGroup = new THREE.Group();
    edaGroup.userData = { ingredientId: edaIng.id, name: edaIng.name };

    const edaMat = new THREE.MeshStandardMaterial({
      color: 0x42b91d,
      roughness: 0.45,
    });

    for (let i = 0; i < 14; i++) {
      const podGeo = new THREE.SphereGeometry(0.09, 8, 8);
      podGeo.scale(1.2, 0.8, 1.0);
      const pod = new THREE.Mesh(edaGeo(podGeo), edaMat);
      pod.position.set(-0.6 + (Math.random() - 0.5) * 0.5, 0.88, 0.3 + (Math.random() - 0.5) * 0.4);
      pod.castShadow = true;
      edaGroup.add(pod);
    }

    edaGroup.position.set(...edaIng.assembledPosition);
    parentGroup.add(edaGroup);
    ingredientMeshes.set(edaIng.id, edaGroup);
  }
}

function edaGeo(geo: THREE.SphereGeometry) {
  return geo;
}
