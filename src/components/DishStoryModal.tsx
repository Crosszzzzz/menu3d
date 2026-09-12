import React from 'react';
import { Dish, AllergenInfo } from '../types/dish';
import { X, ChefHat, Wine, ShieldCheck, Flame, Scale, Clock, Sparkles } from 'lucide-react';

interface DishStoryModalProps {
  dish: Dish;
  isOpen: boolean;
  onClose: () => void;
}

export const DishStoryModal: React.FC<DishStoryModalProps> = ({ dish, isOpen, onClose }) => {
  if (!isOpen) return null;

  // Aggregate all unique allergens
  const allAllergens: AllergenInfo[] = Array.from(
    new Map<string, AllergenInfo>(
      dish.ingredients.flatMap(i => i.allergens).map(a => [a.id, a] as [string, AllergenInfo])
    ).values()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="dish-story-modal-card"
        className="bg-stone-900 border border-stone-700 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 shadow-2xl text-stone-100"
      >
        <div className="flex items-start justify-between pb-4 border-b border-stone-800">
          <div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 inline-block mb-2">
              {dish.difficultyBadge}
            </span>
            <h2 className="text-2xl font-serif italic text-white font-bold">
              {dish.name}
            </h2>
            <p className="text-xs text-stone-400 mt-1">{dish.subtitle}</p>
          </div>
          <button
            id="close-dish-story-modal"
            onClick={onClose}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Chef & Story */}
        <div className="my-5 bg-stone-800/40 p-4 rounded-2xl border border-stone-700/50">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs mb-2">
            <ChefHat size={16} />
            <span>Filosofía del Chef • {dish.chefName}</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            {dish.description}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="bg-stone-800/60 p-3 rounded-2xl text-center border border-stone-700/40">
            <Clock size={16} className="mx-auto text-amber-400 mb-1" />
            <span className="text-[10px] text-stone-400 block">Tiempo Cocción</span>
            <span className="text-sm font-bold text-stone-100">{dish.prepTimeMinutes} min</span>
          </div>
          <div className="bg-stone-800/60 p-3 rounded-2xl text-center border border-stone-700/40">
            <Scale size={16} className="mx-auto text-amber-400 mb-1" />
            <span className="text-[10px] text-stone-400 block">Peso Total</span>
            <span className="text-sm font-bold text-stone-100">{dish.totalWeight}</span>
          </div>
          <div className="bg-stone-800/60 p-3 rounded-2xl text-center border border-stone-700/40">
            <Flame size={16} className="mx-auto text-orange-400 mb-1" />
            <span className="text-[10px] text-stone-400 block">Energía</span>
            <span className="text-sm font-bold text-stone-100">{dish.totalCalories} kcal</span>
          </div>
        </div>

        {/* Sommelier Pairing */}
        <div className="mb-5 bg-amber-950/20 border border-amber-500/30 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-1">
            <Wine size={16} />
            <span>Maridaje Recomendado</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {dish.pairingRecommendation}
          </p>
        </div>

        {/* Complete Allergen Matrix */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-stone-300 text-xs font-semibold mb-2.5">
            <ShieldCheck size={16} className="text-amber-400" />
            <span>Matriz de Alérgenos Registrados</span>
          </div>
          {allAllergens.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {allAllergens.map((alg) => (
                <div
                  key={alg.id}
                  className="flex items-center gap-2 p-2.5 bg-stone-800/50 rounded-xl border border-stone-700/50 text-xs"
                >
                  <span className="text-base">{alg.icon}</span>
                  <div>
                    <span className="font-medium text-stone-200 block">{alg.name}</span>
                    <span className="text-[10px] text-amber-400/90">
                      {alg.type === 'contains' ? 'Ingrediente activo' : 'Posibles trazas'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400">Sin alérgenos declarados.</p>
          )}
        </div>

        <button
          id="close-dish-story-footer-button"
          onClick={onClose}
          className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs rounded-xl transition-colors"
        >
          Volver a la experiencia 3D
        </button>
      </div>
    </div>
  );
};
