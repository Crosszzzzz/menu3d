export interface AllergenInfo {
  id: string;
  name: string;
  icon: string;
  type: 'contains' | 'traces' | 'optional';
  badgeColor: string;
}

export interface NutritionalInfo {
  calories: number;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
  fiber?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'pan' | 'proteina' | 'queso' | 'vegetal' | 'salsa' | 'guarnicion' | 'decoracion';
  categoryLabel: string;
  weight: string; // e.g. "180g"
  grams: number;
  origin: string;
  preparation: string;
  flavorNotes: string[];
  allergens: AllergenInfo[];
  nutrition: NutritionalInfo;
  chefTips: string;
  icon: string;
  colorHex: string;
  // Exploded view spatial offsets (relative to center assembly)
  explodedPosition: [number, number, number]; // [x, y, z]
  assembledPosition: [number, number, number];
  rotationOffset?: [number, number, number];
  layerOrder: number;
  isCustomizable: boolean;
  isExcluded?: boolean;
  /** Optional scan GLB URL (data-driven later; unused this slice). */
  modelUrl?: string;
}

export interface Dish {  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  category: string;
  price: number;
  currency: string;
  rating: number;
  reviewsCount: number;
  prepTimeMinutes: number;
  difficultyBadge: string;
  totalWeight: string;
  totalCalories: number;
  description: string;
  chefName: string;
  pairingRecommendation: string;
  dietaryTags: string[];
  ingredients: Ingredient[];
}

/**
 * Scene-units to meters calibration (burger 2.72u ~= 0.11m real diameter).
 * Scene math (camera, exploded offsets, auto-fit) stays in units; multiply
 * by METERS_PER_UNIT only when real-world scale is needed (AR placement).
 */
export const METERS_PER_UNIT = 0.04;

/**
 * Static-prop tagging contract (presentation props only, e.g. ceramic plate
 * and wood table): any Object3D with `userData.isStaticProp === true` MUST
 * be skipped by exploded-view lerp, levitation wobble, tap raycast, spatial
 * pins, exclusion toggles, and auto-fit height math. Props stay static in
 * every state. (Typed via userData at runtime; declared here for discovery.)
 */
export type StaticPropFlag = { isStaticProp?: boolean };
