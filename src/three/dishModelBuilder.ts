import * as THREE from 'three';
import { Dish } from '../types/dish';

/**
 * Creates procedural textures with canvas for organic culinary realism
 */
function createBriocheTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Radial bake gradient from rich mahogany crest to golden honey rim
  const gradient = ctx.createRadialGradient(256, 120, 20, 256, 256, 256);
  gradient.addColorStop(0, '#8c3d0b'); // Deeper toasted crest
  gradient.addColorStop(0.35, '#c96a1a'); // Warm honey brioche
  gradient.addColorStop(0.75, '#e0882e'); // Golden glazed edge
  gradient.addColorStop(1, '#a65415'); // Slightly toasted rim
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Add subtle flour speckles & micro crust pores
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const radius = Math.random() * 1.5 + 0.5;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 230, 180, 0.12)' : 'rgba(70, 25, 5, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createTruffleSauceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eddab8';
  ctx.fillRect(0, 0, 256, 256);

  // Black truffle micro-flakes
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const radius = Math.random() * 2 + 0.8;
    ctx.fillStyle = 'rgba(20, 15, 12, 0.75)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createMeatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#442016';
  ctx.fillRect(0, 0, 512, 512);

  // Charred smash crust striations & caramelized Maillard edges
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = Math.random() * 8 + 2;
    const h = Math.random() * 4 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(22, 10, 8, 0.85)' : 'rgba(120, 48, 28, 0.65)';
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createSlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c1f24';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle slate stone clefts and mineral veins
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const length = Math.random() * 50 + 10;
    ctx.strokeStyle = 'rgba(60, 68, 80, 0.15)';
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Builds the 3D visual representation of a dish
 */
export function buildDish3DModel(dish: Dish): {
  group: THREE.Group;
  ingredientMeshes: Map<string, THREE.Object3D>;
} {
  const group = new THREE.Group();
  group.name = `dish-${dish.id}`;
  const ingredientMeshes = new Map<string, THREE.Object3D>();

  if (dish.id === 'wagyu-smash-burger') {
    buildBurgerModel(dish, group, ingredientMeshes);
  } else {
    buildPokeModel(dish, group, ingredientMeshes);
  }

  return { group, ingredientMeshes };
}

/**
 * Procedural Gourmet Burger with High Visual Detail
 */
function buildBurgerModel(
  dish: Dish,
  parentGroup: THREE.Group,
  ingredientMeshes: Map<string, THREE.Object3D>
) {
  const briocheTexture = createBriocheTexture();
  const truffleTexture = createTruffleSauceTexture();
  const meatTexture = createMeatTexture();
  const slateTexture = createSlateTexture();

  // 1. Ceramic / Natural Slate Base
  const slateIng = dish.ingredients.find(i => i.id === 'ceramic-slate');
  if (slateIng) {
    const slateGroup = new THREE.Group();
    slateGroup.userData = { ingredientId: slateIng.id, name: slateIng.name };

    const slateGeo = new THREE.BoxGeometry(4.6, 0.12, 3.4);
    const slateMat = new THREE.MeshStandardMaterial({
      map: slateTexture,
      roughness: 0.85,
      metalness: 0.15,
      color: 0x22262d,
    });
    const slateMesh = new THREE.Mesh(slateGeo, slateMat);
    slateMesh.receiveShadow = true;
    slateMesh.castShadow = true;
    slateMesh.position.y = -0.06;
    slateGroup.add(slateMesh);

    // Rim bevel highlight
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x3a404c, roughness: 0.7 });
    const rimGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8);
    const rim1 = new THREE.Mesh(rimGeo, rimMat);
    rim1.rotation.x = Math.PI / 2;
    rim1.position.set(2.3, -0.06, 0);
    slateGroup.add(rim1);

    slateGroup.position.set(...slateIng.assembledPosition);
    parentGroup.add(slateGroup);
    ingredientMeshes.set(slateIng.id, slateGroup);
  }

  // 2. Bun Bottom
  const bunBottomIng = dish.ingredients.find(i => i.id === 'bun-bottom');
  if (bunBottomIng) {
    const bunBottomGroup = new THREE.Group();
    bunBottomGroup.userData = { ingredientId: bunBottomIng.id, name: bunBottomIng.name };

    // Fluffy pillowy cylinder with rounded edges
    const bunGeo = new THREE.CylinderGeometry(1.22, 1.18, 0.32, 36);
    const bunMat = new THREE.MeshStandardMaterial({
      map: briocheTexture,
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

  // 4. Wagyu Smash Patty
  const meatIng = dish.ingredients.find(i => i.id === 'meat-wagyu-patty');
  if (meatIng) {
    const meatGroup = new THREE.Group();
    meatGroup.userData = { ingredientId: meatIng.id, name: meatIng.name };

    // Smash patty with irregular lacy Maillard crispy edges
    const pattyGeo = new THREE.CylinderGeometry(1.36, 1.42, 0.34, 40);
    // Perturb vertices for jagged smash edges
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
      }
    }
    pattyGeo.computeVertexNormals();

    const meatMat = new THREE.MeshStandardMaterial({
      map: meatTexture,
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

  // 5. Melted Aged Cheddar
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

    // Square draped sheet
    const cheeseGeo = new THREE.BoxGeometry(2.45, 0.065, 2.45);
    const cheeseMesh = new THREE.Mesh(cheeseGeo, cheeseMat);
    cheeseMesh.rotation.y = Math.PI / 4; // Rotated 45 degrees so corners drip over edges
    cheeseMesh.castShadow = true;
    cheeseMesh.receiveShadow = true;
    cheeseMesh.position.y = 0.1;
    cheeseGroup.add(cheeseMesh);

    // Drooping melted corner tongues over the burger sides
    const dripAngles = [0.75, 2.35, 3.9, 5.4];
    dripAngles.forEach((angle) => {
      const dripGeo = new THREE.ConeGeometry(0.18, 0.32, 12);
      const drip = new THREE.Mesh(dripGeo, cheeseMat);
      drip.rotation.x = Math.PI;
      drip.position.set(Math.cos(angle) * 1.35, -0.05, Math.sin(angle) * 1.35);
      cheeseGroup.add(drip);
    });

    cheeseGroup.position.set(...cheeseIng.assembledPosition);
    parentGroup.add(cheeseGroup);
    ingredientMeshes.set(cheeseIng.id, cheeseGroup);
  }

  // 6. Crisp Batavia Lettuce
  const lettuceIng = dish.ingredients.find(i => i.id === 'lettuce-batavia');
  if (lettuceIng) {
    const lettuceGroup = new THREE.Group();
    lettuceGroup.userData = { ingredientId: lettuceIng.id, name: lettuceIng.name };

    // Rippled wavy disc
    const lettuceGeo = new THREE.PlaneGeometry(2.7, 2.7, 28, 28);
    const lPos = lettuceGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const u = lPos.getX(i);
      const v = lPos.getY(i);
      const r = Math.sqrt(u * u + v * v);
      // Ruffled perimeter
      const wave = Math.sin(u * 7) * Math.cos(v * 7) * 0.18 * (r / 1.35);
      lPos.setZ(i, wave);
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

  // 7. Heirloom Tomato Slice
  const tomatoIng = dish.ingredients.find(i => i.id === 'tomato-heirloom');
  if (tomatoIng) {
    const tomatoGroup = new THREE.Group();
    tomatoGroup.userData = { ingredientId: tomatoIng.id, name: tomatoIng.name };

    // Thick juicy red slab
    const tomatoGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.22, 36);
    const tomatoMat = new THREE.MeshPhysicalMaterial({
      color: 0xc92d24,
      roughness: 0.24,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    });
    const tomatoMesh = new THREE.Mesh(tomatoGeo, tomatoMat);
    tomatoMesh.castShadow = true;
    tomatoMesh.receiveShadow = true;
    tomatoMesh.position.y = 0.11;
    tomatoGroup.add(tomatoMesh);

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

    const pickleMat = new THREE.MeshStandardMaterial({
      color: 0x58812e,
      roughness: 0.35,
      metalness: 0.05,
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

  // 9. Black Truffle Sauce
  const sauceIng = dish.ingredients.find(i => i.id === 'sauce-truffle');
  if (sauceIng) {
    const sauceGroup = new THREE.Group();
    sauceGroup.userData = { ingredientId: sauceIng.id, name: sauceIng.name };

    // Glazed irregular puddle
    const sauceGeo = new THREE.CylinderGeometry(1.15, 1.25, 0.09, 32);
    const sauceMat = new THREE.MeshPhysicalMaterial({
      map: truffleTexture,
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

  // 10. Brioche Bun Top & Sesame Seeds
  const bunTopIng = dish.ingredients.find(i => i.id === 'bun-top');
  if (bunTopIng) {
    const bunTopGroup = new THREE.Group();
    bunTopGroup.userData = { ingredientId: bunTopIng.id, name: bunTopIng.name };

    // Golden glossy dome with organic curve
    const domeGeo = new THREE.SphereGeometry(1.34, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const domeMat = new THREE.MeshPhysicalMaterial({
      map: briocheTexture,
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

    // Scattered Sesame Seeds over the dome
    const seedGeo = new THREE.SphereGeometry(0.038, 8, 8);
    seedGeo.scale(1.0, 0.45, 1.8);
    const seedMat = new THREE.MeshStandardMaterial({
      color: 0xfff0cb,
      roughness: 0.4,
      metalness: 0.1,
    });

    for (let i = 0; i < 90; i++) {
      const phi = Math.random() * Math.PI * 0.38;
      const theta = Math.random() * Math.PI * 2;
      const r = 1.34;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const z = r * Math.sin(phi) * Math.sin(theta);
      const y = (r * Math.cos(phi)) * 0.65;

      const seedMesh = new THREE.Mesh(seedGeo, seedMat);
      seedMesh.position.set(x, y + 0.015, z);
      seedMesh.rotation.y = theta + Math.PI / 2;
      seedMesh.rotation.x = phi;
      bunTopGroup.add(seedMesh);
    }

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
}

/**
 * Procedural Second Dish: Poke Bowl de Salmón Teriyaki & Cerámica Raku
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
