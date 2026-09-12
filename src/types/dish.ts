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
}

export interface Dish {
  id: string;
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
