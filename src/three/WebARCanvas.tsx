import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Dish, Ingredient } from '../types/dish';
import { buildDish3DModel } from './dishModelBuilder';

interface WebARCanvasProps {
  dish: Dish;
  explosionProgress: number; // 0.0 to 1.0
  selectedIngredientId: string | null;
  onSelectIngredient: (ingredient: Ingredient | null) => void;
  isARMode: boolean;
  show3DPins: boolean;
  onToggleARMode: (enabled: boolean) => void;
  excludedIngredientIds?: string[];
  /** True while the ingredient bottom-sheet is open (selected ingredient). */
  sheetOpen?: boolean;
  /** True while a centered modal (story / order) is open. */
  modalOpen?: boolean;
  /** Fraction of canvas height still visible for 3D (0..1). 0.58 = 42dvh peek, 0.30 = 70dvh expanded, 1.0 = closed. */
  visibleHeightFraction?: number;
}

interface ProjectedPin {
  id: string;
  name: string;
  categoryLabel: string;
  icon: string;
  x: number;
  y: number;
  visible: boolean;
}

export const WebARCanvas: React.FC<WebARCanvasProps> = ({
  dish,
  explosionProgress,
  selectedIngredientId,
  onSelectIngredient,
  isARMode,
  show3DPins,
  onToggleARMode,
  excludedIngredientIds = [],
  sheetOpen = false,
  modalOpen = false,
  visibleHeightFraction = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const dishGroupRef = useRef<THREE.Group | null>(null);
  const ingredientMeshesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const studioFloorRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);

  // Interaction & Camera tracking state
  // Gesture contract (see header docs):
  // - rotate: single pointer drag that STARTED on burger/ingredient only
  // - zoom: two-finger pinch or wheel only
  // - tap (<300ms, <8px, no pinch): raycast select/deselect
  // - background single-drag: no-op
  // Zoom range: min 2.2 keeps close-up detail; max 15.5 frames the full
  // exploded stack (y 2.6 to -1.8, fries x 2.2) plus pedestal with margin
  // on 360px portrait (vertical fit ~11.9, visible ~6.9 at max; horizontal
  // ~5.9) and desktop. Verified: at 15.5, H_fit=11.9 covers the 5.0 stack
  // in the top 58% (needs ~12.1) and W_fit~5.95 covers the ~5.65 wide
  // pedestal+fries with ~2% side crop worst-case — acceptable margin.
  const MIN_RADIUS = 2.2;
  const MAX_RADIUS = 15.5;
  const MIN_PHI = 0.2;
  const MAX_PHI = Math.PI / 2 - 0.05;
  const ROT_SPEED = 0.0065;
  // Scaled proportionally to the wider 2.2-15.5 range (width 13.3 vs 10.8
  // for 2.2-13 => x1.23): pinch 0.018->0.022, wheel 0.0045->0.0055 so
  // traversing the full range takes a similar gesture distance as before.
  const PINCH_FACTOR = 0.022;
  const WHEEL_FACTOR = 0.0055;
  const TAP_MAX_MS = 300;
  const TAP_MAX_PX = 8;

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const lastSinglePosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedOnBurgerRef = useRef<boolean>(false);
  const pinchPrevDistRef = useRef<number | null>(null);
  const didPinchRef = useRef<boolean>(false);
  const isInteractingRef = useRef(false);
  const targetCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 2.4, 4.8));
  const targetCamLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.4, 0));
  const currentCamLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.4, 0));

  // Spherical orbit values (BASE radius user-controlled; framing boost additive)
  const sphericalRef = useRef({ radius: 5.2, theta: 0.7, phi: 1.15 });

  // Sheet/modal auto-framing (additive so user pinch always wins):
  // - base radius/theta/phi in sphericalRef are NEVER touched by framing or resize.
  // - boost (+shiftY) lerps to target on open/f-change, to 0 on close.
  // - effectiveRadius = clamp(base + boost); effectiveLookAt = baseLookAt + shiftY.
  // - userTouchedSinceAuto lets close restore logic respect manual pinch.
  const framingRef = useRef({
    boost: 0,
    boostTarget: 0,
    shiftY: 0,
    shiftYTarget: 0,
    preOpenBaseRadius: null as number | null,
    userTouchedSinceAuto: false,
  });
  const prevFramingOpenRef = useRef(false);

  // 2D Projected spatial pins
  const [projectedPins, setProjectedPins] = useState<ProjectedPin[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPlacingOnSurface, setIsPlacingOnSurface] = useState<boolean>(true);
  const [isARPlaced, setIsARPlaced] = useState<boolean>(false);
  const [arScale, setArScale] = useState<number>(1.0);

  // Video stream state
  const streamRef = useRef<MediaStream | null>(null);

  // Setup Camera Video Stream for WebAR
  useEffect(() => {
    let active = true;

    async function initCamera() {
      if (!isARMode) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setCameraError(null);
        return;
      }

      try {
        setCameraError(null);
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsPlacingOnSurface(true);
      } catch (err) {
        console.warn('Camera access could not be acquired:', err);
        setCameraError('No se pudo acceder a la cámara trasera. Mostrando simulación de entorno AR.');
      }
    }

    initCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isARMode]);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 2.4, 4.8);
    camera.lookAt(0, 0.4, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // Lighting Setup - Gastronomic Studio Atmosphere
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.95);
    scene.add(ambientLight);

    // Key Light with soft shadow casting
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(3.5, 6.0, 3.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 16;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Warm Rim light for appetizing highlights on meat and glaze
    const rimLight = new THREE.DirectionalLight(0xfbbf24, 1.3);
    rimLight.position.set(-4.0, 3.5, -3.5);
    scene.add(rimLight);

    // Front soft fill light
    const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.65);
    fillLight.position.set(0, 1.5, 4.5);
    scene.add(fillLight);

    // AR Shadow Catcher Plane (invisible surface that catches real-time shadows onto physical table)
    const shadowPlaneGeo = new THREE.PlaneGeometry(12, 12);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.38 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.01;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
    shadowPlaneRef.current = shadowPlane;

    // Studio Mode Luxury Floor Pedestal
    const studioFloor = new THREE.Group();
    const pedestalGeo = new THREE.CylinderGeometry(2.8, 3.1, 0.15, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x14171d,
      roughness: 0.75,
      metalness: 0.3,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.position.y = -0.075;
    pedestalMesh.receiveShadow = true;
    studioFloor.add(pedestalMesh);

    // Subtle golden rim ring on pedestal
    const ringGeo = new THREE.TorusGeometry(2.8, 0.02, 8, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3,
      metalness: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.001;
    studioFloor.add(ringMesh);

    // Circular grid markings
    const gridHelper = new THREE.PolarGridHelper(3.8, 12, 4, 32, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.08;
    studioFloor.add(gridHelper);

    scene.add(studioFloor);
    studioFloorRef.current = studioFloor;

    // AR Placement Reticle (for targeting table surface before anchoring)
    const reticleGroup = new THREE.Group();
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 0.95, 32),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    reticleRing.rotation.x = -Math.PI / 2;
    reticleGroup.add(reticleRing);

    const reticleCenter = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 16),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    reticleCenter.rotation.x = -Math.PI / 2;
    reticleGroup.add(reticleCenter);
    reticleGroup.position.y = 0.01;
    reticleGroup.visible = false;
    scene.add(reticleGroup);
    reticleRef.current = reticleGroup as unknown as THREE.Mesh;

    // Resize / orientation handler (DPR cap kept at 2).
    // CONTRACT: orientation/resize/visualViewport must NEVER change current
    // radius/theta/phi — only aspect + renderer size. sphericalRef and
    // framing boost/shift are intentionally untouched here.
    // Listens to window resize + orientationchange + visualViewport so
    // mobile rotation and browser-chrome show/hide keep the canvas fitted.
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      rendererRef.current.setSize(w, h);
    };
    // orientationchange fires before layout settles: re-fit on next frames too.
    const handleOrientation = () => {
      handleResize();
      requestAnimationFrame(() => handleResize());
      window.setTimeout(() => handleResize(), 150);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);
    // visualViewport fires on mobile URL-bar collapse / keyboard; cheap re-fit.
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', handleResize);
    // screen.orientation change (newer mobile browsers) — same preserve-zoom fit.
    let orientationObj: ScreenOrientation | null = null;
    let handleScreenOrientation: (() => void) | null = null;
    try {
      const so = (window.screen as unknown as { orientation?: ScreenOrientation })?.orientation;
      if (so && typeof so.addEventListener === 'function') {
        orientationObj = so;
        handleScreenOrientation = () => handleOrientation();
        so.addEventListener('change', handleScreenOrientation);
      }
    } catch {
      // Older browsers: orientationchange listener above already covers rotation.
    }

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Sheet/modal framing: additive boost/shift lerped toward targets.
      // Base radius (sphericalRef) is user-owned; effective adds boost.
      const fr = framingRef.current;
      fr.boost += (fr.boostTarget - fr.boost) * 0.08;
      if (Math.abs(fr.boostTarget - fr.boost) < 0.001) fr.boost = fr.boostTarget;
      fr.shiftY += (fr.shiftYTarget - fr.shiftY) * 0.08;
      if (Math.abs(fr.shiftYTarget - fr.shiftY) < 0.001) fr.shiftY = fr.shiftYTarget;

      // Smooth camera interpolation towards spherical target
      const s = sphericalRef.current;
      const effectiveRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, s.radius + fr.boost));
      const effectiveLookAtY = targetCamLookAtRef.current.y + fr.shiftY;
      const effectiveLookAtX = targetCamLookAtRef.current.x;
      const effectiveLookAtZ = targetCamLookAtRef.current.z;
      const targetX = effectiveLookAtX + effectiveRadius * Math.sin(s.phi) * Math.sin(s.theta);
      const targetY = effectiveLookAtY + effectiveRadius * Math.cos(s.phi);
      const targetZ = effectiveLookAtZ + effectiveRadius * Math.sin(s.phi) * Math.cos(s.theta);

      targetCamPosRef.current.set(targetX, targetY, targetZ);

      if (cameraRef.current) {
        cameraRef.current.position.lerp(targetCamPosRef.current, 0.08);
        currentCamLookAtRef.current.lerp(
          new THREE.Vector3(effectiveLookAtX, effectiveLookAtY, effectiveLookAtZ),
          0.08
        );
        cameraRef.current.lookAt(currentCamLookAtRef.current);
      }

      // Reticle pulse animation in AR mode
      if (reticleRef.current && reticleRef.current.visible) {
        const pulse = 1 + Math.sin(elapsedTime * 4) * 0.08;
        reticleRef.current.scale.set(pulse, 1, pulse);
      }

      // Subtle levitation breath on exploded layers to give physical floating feel
      if (dishGroupRef.current && explosionProgress > 0.05) {
        ingredientMeshesRef.current.forEach((obj, id) => {
          const ing = dish.ingredients.find(i => i.id === id);
          if (ing && ing.explodedPosition) {
            const floatOffset = Math.sin(elapsedTime * 2.2 + ing.layerOrder * 0.7) * 0.02 * explosionProgress;
            // Only add subtle y wobble
            const targetY = ing.assembledPosition[1] + (ing.explodedPosition[1] - ing.assembledPosition[1]) * explosionProgress;
            obj.position.y = targetY + floatOffset;
          }
        });
      }

      // Render
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Update 2D screen projected pins
      if (show3DPins && cameraRef.current && containerRef.current && explosionProgress > 0.25) {
        const pins: ProjectedPin[] = [];
        const rect = containerRef.current.getBoundingClientRect();

        ingredientMeshesRef.current.forEach((obj, id) => {
          const ing = dish.ingredients.find(i => i.id === id);
          if (!ing || excludedIngredientIds.includes(id) || id === 'ceramic-slate') return;

          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          // Lift pin position slightly above the object
          worldPos.y += 0.2;

          const screenPos = worldPos.clone().project(cameraRef.current!);
          // Check if within frustum
          const visible = screenPos.z < 1.0;
          const x = (screenPos.x * 0.5 + 0.5) * rect.width;
          const y = (-screenPos.y * 0.5 + 0.5) * rect.height;

          pins.push({
            id: ing.id,
            name: ing.name,
            categoryLabel: ing.categoryLabel,
            icon: ing.icon,
            x,
            y,
            visible,
          });
        });

        setProjectedPins(pins);
      } else {
        setProjectedPins([]);
      }
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      if (vv) vv.removeEventListener('resize', handleResize);
      if (orientationObj && handleScreenOrientation) {
        try {
          orientationObj.removeEventListener('change', handleScreenOrientation);
        } catch {
          // Ignore cleanup failures on older browsers.
        }
      }
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, [dish.id]);

  // Update Dish 3D Model when dish changes or exclusions change
  useEffect(() => {
    if (!sceneRef.current) return;

    if (dishGroupRef.current) {
      sceneRef.current.remove(dishGroupRef.current);
      dishGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    }

    const { group, ingredientMeshes } = buildDish3DModel(dish);
    dishGroupRef.current = group;
    ingredientMeshesRef.current = ingredientMeshes;
    sceneRef.current.add(group);
  }, [dish]);

  // Update Visibility of Excluded Ingredients (e.g. "Sin pepinillo" customizer)
  useEffect(() => {
    ingredientMeshesRef.current.forEach((mesh, id) => {
      const isExcluded = excludedIngredientIds.includes(id);
      mesh.visible = !isExcluded;
    });
  }, [excludedIngredientIds]);

  // Update Studio vs. AR Floor visibility
  useEffect(() => {
    if (studioFloorRef.current) {
      studioFloorRef.current.visible = !isARMode;
    }
    if (shadowPlaneRef.current) {
      shadowPlaneRef.current.visible = true; // Still catches shadows in both
    }
    if (reticleRef.current) {
      reticleRef.current.visible = isARMode && isPlacingOnSurface;
    }
  }, [isARMode, isPlacingOnSurface]);

  // Update Exploded Positions Interpolation
  useEffect(() => {
    dish.ingredients.forEach((ing) => {
      const mesh = ingredientMeshesRef.current.get(ing.id);
      if (!mesh) return;

      const [ax, ay, az] = ing.assembledPosition;
      const [ex, ey, ez] = ing.explodedPosition;

      // Position lerp
      mesh.position.x = ax + (ex - ax) * explosionProgress;
      mesh.position.y = ay + (ey - ay) * explosionProgress;
      mesh.position.z = az + (ez - az) * explosionProgress;

      // Slight rotation flare when exploded to showcase interior faces
      if (explosionProgress > 0.01) {
        if (ing.id === 'bun-top') {
          mesh.rotation.x = -0.15 * explosionProgress;
          mesh.rotation.z = 0.1 * explosionProgress;
        } else if (ing.id === 'tomato-heirloom') {
          mesh.rotation.x = 0.12 * explosionProgress;
        } else if (ing.id === 'french-fries') {
          mesh.rotation.y = 0.25 * explosionProgress;
        }
      } else {
        mesh.rotation.set(0, 0, 0);
      }
    });
  }, [explosionProgress, dish]);

  // Focus Camera lookAt on Selected Ingredient or reset to global.
  // NOTE: radius is deliberately NOT touched here (it used to reset on every
  // explosionProgress tick, fighting user pinch and causing zoom jumps).
  // Radius ownership: init 5.2/4.6, user pinch/wheel, dish/AR reset below,
  // and sheet/modal framing boost (additive, see framing effect).
  useEffect(() => {
    if (!selectedIngredientId) {
      targetCamLookAtRef.current.set(0, 0.4, 0);
      return;
    }

    const selectedIng = dish.ingredients.find(i => i.id === selectedIngredientId);
    if (!selectedIng) return;

    // Calculate current position of the ingredient based on explosion progress
    const [ax, ay, az] = selectedIng.assembledPosition;
    const [ex, ey, ez] = selectedIng.explodedPosition;
    const curY = ay + (ey - ay) * explosionProgress;
    const curX = ax + (ex - ax) * explosionProgress;
    const curZ = az + (ez - az) * explosionProgress;

    targetCamLookAtRef.current.set(curX, curY + 0.1, curZ);
  }, [selectedIngredientId, explosionProgress, dish]);

  // Reset base overview distance on dish switch / AR toggle.
  // Skipped while a sheet/modal is open so auto-framing + user pinch win;
  // the framing effect restores naturally (boost -> 0) on close.
  useEffect(() => {
    if (sheetOpen || modalOpen) return;
    // Only reset when nothing is selected (overview); ingredient focus keeps
    // the user's current distance so tapping layers never jumps zoom.
    if (selectedIngredientId) return;
    sphericalRef.current.radius = isARMode ? 4.6 : 5.2;
  }, [dish.id, isARMode, sheetOpen, modalOpen, selectedIngredientId]);

  // Sheet/modal auto-framing: shift lookAt down (burger up on screen) +
  // auto dolly-out so the full burger fits the remaining visible space above
  // the peek sheet / around centered modals. Additive boost => user pinch
  // after auto-frame always wins (we never overwrite sphericalRef.radius).
  // Restore on close = lerp boost/shift back to 0 (base untouched).
  useEffect(() => {
    const framingOpen = Boolean(sheetOpen || modalOpen);
    const wasOpen = prevFramingOpenRef.current;
    const fr = framingRef.current;

    if (!framingOpen) {
      fr.boostTarget = 0;
      fr.shiftYTarget = 0;
      fr.preOpenBaseRadius = null;
      fr.userTouchedSinceAuto = false;
      prevFramingOpenRef.current = false;
      return;
    }

    // Newly opened: snapshot base once so later pinch doesn't move the goalpost.
    if (!wasOpen) {
      fr.preOpenBaseRadius = sphericalRef.current.radius;
      fr.userTouchedSinceAuto = false;
    }
    const preOpenBase = fr.preOpenBaseRadius ?? sphericalRef.current.radius;

    const containerW = containerRef.current?.clientWidth || window.innerWidth;
    const containerH = containerRef.current?.clientHeight || window.innerHeight;
    const aspect = containerW > 0 && containerH > 0 ? containerW / containerH : 0.5;
    const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(42 / 2)); // 42° vertical FOV
    const FIT_PER_D = 2 * FOV_TAN; // world units of vertical fit per unit distance (~0.7677)

    // Sheet fraction: 0.58 peek (42dvh), 0.30 expanded (70dvh). Desktop side
    // cards barely cover height, so dampen the height loss on wide screens.
    const rawSheetF = Math.max(0.2, Math.min(1, visibleHeightFraction || 1));
    const sheetF = aspect >= 1 && sheetOpen ? 1 - (1 - rawSheetF) * 0.25 : rawSheetF;
    // Centered modals dim the canvas: scale down + shift up so the burger
    // peeks in the visible rim instead of hiding fully behind the card.
    const MODAL_F = 0.6;

    let fEff = 1;
    if (sheetOpen && modalOpen) fEff = Math.min(sheetF, MODAL_F);
    else if (sheetOpen) fEff = sheetF;
    else if (modalOpen) fEff = MODAL_F;

    if (modalOpen && !sheetOpen) {
      // Modest context dolly + upward shift for centered cards.
      const modalNeed = 8.5;
      fr.boostTarget = Math.max(0, Math.min(MAX_RADIUS - preOpenBase, modalNeed - preOpenBase));
      fr.shiftYTarget = -0.7;
      prevFramingOpenRef.current = true;
      return;
    }

    // Full-burger fit in the visible top strip (exploded worst case):
    // height 2.6..-1.8 = 4.4 + 0.6 margin = 5.0 (+8% lens margin),
    // width pedestal 5.6 + fries overhang ~0.5 = ~6.1 (+8%).
    const H_OBJ = 5.0 * 1.08;
    const W_OBJ = 6.1 * 1.08;
    const needH = H_OBJ / (FIT_PER_D * fEff);
    const needW = aspect > 0 ? W_OBJ / (FIT_PER_D * aspect) : needH;
    const required = Math.max(needH, needW);
    const clampedRequired = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, required));
    fr.boostTarget = Math.max(0, Math.min(MAX_RADIUS - preOpenBase, clampedRequired - preOpenBase));

    // Shift the lookAt down so the burger sits centered in the visible top
    // strip (visible center is (1-f)/2 above full center). Factor 0.85 leaves
    // room for the header; clamped so close-ups never fly off-screen.
    const effectiveD = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, preOpenBase + fr.boostTarget));
    const visibleFitH = FIT_PER_D * effectiveD;
    const offsetUp = ((1 - fEff) / 2) * visibleFitH * 0.85;
    fr.shiftYTarget = Math.max(-2.0, Math.min(0, -offsetUp));

    prevFramingOpenRef.current = true;
  }, [sheetOpen, modalOpen, visibleHeightFraction, dish.id]);

  // ---- Gesture helpers (hit-test + clamp) ----
  const clampRadius = (v: number) => Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, v));

  // Returns true when the pointer lands on the burger / an ingredient mesh.
  // Background / empty space returns false. Used on pointerdown to decide
  // whether a subsequent single-pointer drag may rotate.
  const hitTestsBurger = (clientX: number, clientY: number): boolean => {
    if (!containerRef.current || !cameraRef.current || !dishGroupRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const intersects = raycaster.intersectObjects(dishGroupRef.current.children, true);
    return intersects.length > 0;
  };

  const getActivePinchDist = (): number | null => {
    const pts: Array<{ x: number; y: number }> = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  // Wheel = zoom only. Attached as a native non-passive listener so
  // preventDefault reliably stops page scroll (page is locked anyway).
  // User wheel always wins over sheet auto-framing (boost is additive).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (ev: WheelEvent) => {
      ev.preventDefault();
      // Normalize deltaMode (Firefox line scroll) to pixels.
      const deltaY = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
      sphericalRef.current.radius = clampRadius(
        sphericalRef.current.radius + deltaY * WHEEL_FACTOR
      );
      if (sheetOpen || modalOpen) framingRef.current.userTouchedSinceAuto = true;
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [sheetOpen, modalOpen]);

  // Unified Pointer Events gesture state machine:
  // - 1 pointer starting on burger -> drag rotates; starting on background -> no-op
  // - 2 pointers -> pinch zooms (smooth, clamped, no jump on 2nd finger landing)
  // - tap (short + small move + no pinch) -> raycast select (never zooms)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Let overlay buttons (spatial pins, AR anchor) handle their own press:
    // a pointer starting on a <button> must not start rotate/pinch/tap.
    if ((e.target as HTMLElement).closest?.('button')) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore capture failures (e.g. mouse already released).
    }

    if (activePointersRef.current.size === 1) {
      // Fresh single-pointer gesture: hit-test once at touchdown.
      dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      lastSinglePosRef.current = { x: e.clientX, y: e.clientY };
      dragStartedOnBurgerRef.current = hitTestsBurger(e.clientX, e.clientY);
      isInteractingRef.current = true;
      didPinchRef.current = false;
      pinchPrevDistRef.current = null;
    } else if (activePointersRef.current.size === 2) {
      // Second finger landed: enter pinch mode with zero initial delta (no jump).
      didPinchRef.current = true;
      pinchPrevDistRef.current = getActivePinchDist();
      lastSinglePosRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Hover cursor for mouse when no button is pressed.
    if (!activePointersRef.current.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        if (containerRef.current && cameraRef.current && dishGroupRef.current) {
          containerRef.current.style.cursor = hitTestsBurger(e.clientX, e.clientY)
            ? 'pointer'
            : 'grab';
        }
      }
      return;
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch zoom takes over whenever two pointers are down.
    // User pinch always wins over sheet auto-framing (boost is additive,
    // never overwritten here).
    if (activePointersRef.current.size >= 2) {
      const dist = getActivePinchDist();
      if (dist !== null) {
        if (pinchPrevDistRef.current !== null) {
          const delta = dist - pinchPrevDistRef.current;
          sphericalRef.current.radius = clampRadius(
            sphericalRef.current.radius - delta * PINCH_FACTOR
          );
          framingRef.current.userTouchedSinceAuto = true;
        }
        pinchPrevDistRef.current = dist;
      }
      return;
    }

    // Single-pointer drag: rotate ONLY if the gesture started on the burger.
    // Background drags are an intentional no-op (no rotate, no zoom).
    if (!isInteractingRef.current || !lastSinglePosRef.current) return;
    const last = lastSinglePosRef.current;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    lastSinglePosRef.current = { x: e.clientX, y: e.clientY };

    if (!dragStartedOnBurgerRef.current) return;

    sphericalRef.current.theta -= dx * ROT_SPEED;
    sphericalRef.current.phi = Math.max(
      MIN_PHI,
      Math.min(MAX_PHI, sphericalRef.current.phi - dy * ROT_SPEED)
    );
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasPinch = didPinchRef.current;
    const hadPointer = activePointersRef.current.has(e.pointerId);
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size === 0) {
      // Gesture fully ended: tap-select only when it was a short, small,
      // non-pinch single-pointer touch.
      if (hadPointer && !wasPinch && isInteractingRef.current) {
        const elapsed = Date.now() - dragStartRef.current.time;
        const moveDist = Math.hypot(
          e.clientX - dragStartRef.current.x,
          e.clientY - dragStartRef.current.y
        );
        if (elapsed < TAP_MAX_MS && moveDist < TAP_MAX_PX) {
          performClickRaycast(e.clientX, e.clientY);
        }
      }
      isInteractingRef.current = false;
      lastSinglePosRef.current = null;
      dragStartedOnBurgerRef.current = false;
      pinchPrevDistRef.current = null;
      didPinchRef.current = false;
    } else if (activePointersRef.current.size === 1) {
      // Pinch ended but one finger remains: park it so it does NOT
      // suddenly start rotating or count as a tap. A fresh pointerdown
      // is required for the next rotate.
      const remaining = Array.from(activePointersRef.current.values())[0] as
        | { x: number; y: number }
        | undefined;
      if (remaining) {
        lastSinglePosRef.current = { x: remaining.x, y: remaining.y };
        dragStartRef.current = { x: remaining.x, y: remaining.y, time: Date.now() };
      }
      dragStartedOnBurgerRef.current = false;
      pinchPrevDistRef.current = null;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endPointer(e);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endPointer(e);
  };

  const performClickRaycast = (clientX: number, clientY: number) => {
    if (!containerRef.current || !cameraRef.current || !dishGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(dishGroupRef.current.children, true);

    if (intersects.length > 0) {
      // Walk up the parent hierarchy to locate user data ingredientId
      let current: THREE.Object3D | null = intersects[0].object;
      let foundId: string | null = null;

      while (current && current !== dishGroupRef.current) {
        if (current.userData && current.userData.ingredientId) {
          foundId = current.userData.ingredientId;
          break;
        }
        current = current.parent;
      }

      if (foundId) {
        const matched = dish.ingredients.find(i => i.id === foundId);
        if (matched) {
          onSelectIngredient(matched);
          return;
        }
      }
    }

    // Tapping background or empty space deselects ingredient
    onSelectIngredient(null);
  };

  // Handle AR Surface Anchor Lock
  const handleAnchorARPlate = () => {
    setIsPlacingOnSurface(false);
    setIsARPlaced(true);
  };

  const handleResetARAnchor = () => {
    setIsPlacingOnSurface(true);
    setIsARPlaced(false);
  };

  return (
    <div
      ref={containerRef}
      id="webar-3d-viewport"
      className="relative w-full h-full select-none overflow-hidden touch-none"
      style={{ touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Video Stream for WebAR Camera Passthrough */}
      {isARMode && (
        <video
          ref={videoRef}
          id="webar-camera-video"
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none filter brightness-95 contrast-105"
        />
      )}

      {/* Camera error / fallback notification banner */}
      {isARMode && cameraError && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 bg-amber-950/90 border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-xl text-xs w-[calc(100%-1rem)] max-w-sm text-center shadow-2xl backdrop-blur-md top-[calc(env(safe-area-inset-top)+64px)] sm:top-20">
          <p className="font-semibold mb-1">Cámara WebAR</p>
          <p className="text-amber-300/80">{cameraError}</p>
        </div>
      )}

      {/* WebGL 3D Canvas */}
      <canvas
        ref={canvasRef}
        id="gastronomy-webgl-canvas"
        className="absolute inset-0 w-full h-full z-10 block touch-none"
        style={{ touchAction: 'none' }}
      />

      {/* 3D Spatial Floating Pins (HUD Overlay) */}
      {show3DPins && explosionProgress > 0.25 && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
          {projectedPins.map((pin) => {
            if (!pin.visible) return null;
            const isSelected = pin.id === selectedIngredientId;

            return (
              <button
                key={pin.id}
                id={`spatial-pin-${pin.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const ing = dish.ingredients.find(i => i.id === pin.id);
                  if (ing) onSelectIngredient(ing);
                }}
                style={{
                  transform: `translate(${pin.x}px, ${pin.y}px) translate(-50%, -50%)`,
                }}
                className={`pointer-events-auto absolute transition-all duration-200 group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-lg border ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 border-amber-300 scale-110 shadow-amber-500/30'
                    : 'bg-stone-900/85 hover:bg-stone-800 text-stone-200 border-white/15 hover:border-amber-500/50 hover:scale-105'
                }`}
              >
                <span className="text-sm">{pin.icon}</span>
                <span className="truncate max-w-[110px] sm:max-w-[140px]">{pin.name}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-stone-950 animate-ping' : 'bg-amber-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* AR Surface Targeting & Placement Bar */}
      {isARMode && isPlacingOnSurface && (
        <div className="absolute inset-x-2 sm:inset-x-auto bottom-[calc(6rem+env(safe-area-inset-bottom))] sm:bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-[calc(100%-1rem)] sm:w-auto">
          <div className="bg-stone-900/90 backdrop-blur-md border border-amber-500/30 px-4 py-2 rounded-full text-xs text-amber-200 shadow-xl flex items-center gap-2 whitespace-nowrap max-w-full overflow-hidden text-ellipsis">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="truncate">Apunta la cámara a tu mesa o mantel</span>
          </div>
          <button
            id="anchor-plate-button"
            onClick={handleAnchorARPlate}
            className="min-h-[44px] px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-semibold text-sm rounded-full shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 flex items-center gap-2 border border-amber-300/40"
          >
            <span>Fijar Plato en Superficie</span>
            <span className="text-base">📍</span>
          </button>
        </div>
      )}

      {/* AR Relocate button if already anchored */}
      {isARMode && !isPlacingOnSurface && (
        <button
          id="reanchor-ar-button"
          onClick={handleResetARAnchor}
          className="absolute z-20 min-h-[44px] px-3 py-2 bg-stone-900/80 hover:bg-stone-800 border border-white/15 backdrop-blur-md rounded-xl text-xs text-stone-300 transition-all flex items-center gap-1.5 top-[calc(env(safe-area-inset-top)+64px)] right-2 sm:top-20 sm:right-4"
        >
          <span>Mover a otra mesa</span>
          <span className="text-amber-400">↻</span>
        </button>
      )}

      {/* Quick Camera Hint helper */}
      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 bg-stone-900/70 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-lg text-[11px] text-stone-400">
        <span>Arrastra la hamburguesa para rotar 360°</span>
        <span>•</span>
        <span>Rueda o pellizca para zoom</span>
        <span>•</span>
        <span className="text-amber-400">Toca capas para inspeccionar</span>
      </div>
    </div>
  );
};
