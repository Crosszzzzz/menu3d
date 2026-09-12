import React from 'react';
import { Ingredient, Dish } from '../types/dish';
import { X, ChevronLeft, ChevronRight, Sparkles, Scale, Flame, ShieldAlert, Award, Compass } from 'lucide-react';

interface IngredientModalProps {
  ingredient: Ingredient | null;
  dish: Dish;
  onClose: () => void;
  onSelectIngredient: (ingredient: Ingredient) => void;
  onReassemble: () => void;
  isExcluded: boolean;
  onToggleExclude: (id: string) => void;
}

export const IngredientModal: React.FC<IngredientModalProps> = ({
  ingredient,
  dish,
  onClose,
  onSelectIngredient,
  onReassemble,
  isExcluded,
  onToggleExclude,
}) => {
  if (!ingredient) return null;

  // Filter out non-food decorations for previous/next stepping
  const foodIngredients = dish.ingredients.filter(i => i.category !== 'decoracion');
  const currentIndex = foodIngredients.findIndex(i => i.id === ingredient.id);

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectIngredient(foodIngredients[currentIndex - 1]);
    } else {
      onSelectIngredient(foodIngredients[foodIngredients.length - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < foodIngredients.length - 1) {
      onSelectIngredient(foodIngredients[currentIndex + 1]);
    } else {
      onSelectIngredient(foodIngredients[0]);
    }
  };

  return (
    <div
      id="ingredient-detail-overlay"
      className="absolute bottom-0 inset-x-0 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-30 transition-all transform animate-in slide-in-from-bottom duration-300 pointer-events-auto"
    >
      <div className="bg-stone-900/95 sm:rounded-3xl rounded-t-3xl border border-stone-700/60 shadow-2xl backdrop-blur-xl p-5 sm:p-6 text-stone-100 max-h-[85vh] overflow-y-auto custom-scrollbar border-t-amber-500/30">
        
        {/* Header bar: Layer badge & close button */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xl p-2 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
              {ingredient.icon}
            </span>
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-stone-800 text-amber-400 border border-amber-500/20">
                {ingredient.categoryLabel}
              </span>
              <h3 className="text-lg font-bold text-white leading-tight mt-0.5">
                {ingredient.name}
              </h3>
            </div>
          </div>

          <button
            id="close-ingredient-card"
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
            title="Cerrar ficha"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Highlights Bar: Gramaje, Calorías, Capa */}
        <div className="grid grid-cols-3 gap-2 my-3.5">
          <div className="bg-stone-800/60 border border-stone-700/40 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-stone-400 text-xs mb-0.5">
              <Scale size={13} className="text-amber-400" />
              <span>Gramaje</span>
            </div>
            <span className="text-sm font-bold text-amber-200">{ingredient.weight}</span>
          </div>

          <div className="bg-stone-800/60 border border-stone-700/40 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-stone-400 text-xs mb-0.5">
              <Flame size={13} className="text-orange-400" />
              <span>Aporte</span>
            </div>
            <span className="text-sm font-bold text-orange-200">{ingredient.nutrition.calories} kcal</span>
          </div>

          <div className="bg-stone-800/60 border border-stone-700/40 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1 text-stone-400 text-xs mb-0.5">
              <Sparkles size={13} className="text-yellow-400" />
              <span>Capa 3D</span>
            </div>
            <span className="text-sm font-bold text-yellow-200">Nivel #{ingredient.layerOrder}</span>
          </div>
        </div>

        {/* Origen & Trazabilidad */}
        <div className="mb-3.5 bg-stone-800/40 rounded-2xl p-3 border border-stone-700/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
            <Compass size={14} />
            <span>Origen & Trazabilidad</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            {ingredient.origin}
          </p>
        </div>

        {/* Proceso Culinario & Preparación */}
        <div className="mb-3.5 bg-stone-800/40 rounded-2xl p-3 border border-stone-700/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
            <Award size={14} />
            <span>Técnica Culinaria & Maillard</span>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            {ingredient.preparation}
          </p>
          {ingredient.chefTips && (
            <div className="mt-2 pt-2 border-t border-stone-700/40 text-[11px] text-amber-200/90 italic flex items-start gap-1.5">
              <span className="font-semibold not-italic">Nota del Chef:</span>
              <span>"{ingredient.chefTips}"</span>
            </div>
          )}
        </div>

        {/* Alérgenos e Intolerancias */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 mb-2">
            <ShieldAlert size={14} className="text-amber-400" />
            <span>Alérgenos e Intolerancias</span>
          </div>
          {ingredient.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {ingredient.allergens.map((alg) => (
                <span
                  key={alg.id}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${alg.badgeColor}`}
                >
                  <span>{alg.icon}</span>
                  <span>{alg.name}</span>
                  <span className="text-[10px] opacity-75">
                    ({alg.type === 'contains' ? 'Contiene' : 'Trazas'})
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-xl inline-block">
              ✓ Libre de alérgenos principales identificados
            </p>
          )}
        </div>

        {/* Macros nutricionales */}
        <div className="mb-4 bg-stone-950/40 p-3 rounded-2xl border border-stone-800">
          <span className="text-[11px] text-stone-400 font-medium block mb-1.5">
            Composición nutricional:
          </span>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-stone-400 block text-[10px]">Proteínas</span>
              <span className="font-bold text-amber-300">{ingredient.nutrition.protein}g</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Carbohidratos</span>
              <span className="font-bold text-amber-300">{ingredient.nutrition.carbs}g</span>
            </div>
            <div>
              <span className="text-stone-400 block text-[10px]">Grasas</span>
              <span className="font-bold text-amber-300">{ingredient.nutrition.fats}g</span>
            </div>
          </div>
        </div>

        {/* Customization Toggle if allowed (e.g. "Sin pepinillo") */}
        {ingredient.isCustomizable && (
          <div className="mb-4 pt-1 flex items-center justify-between bg-stone-800/40 px-3 py-2 rounded-xl border border-stone-700/50">
            <div className="text-xs">
              <span className="font-medium text-stone-200">Personalizar pedido</span>
              <p className="text-[11px] text-stone-400">
                {isExcluded ? 'Ingrediente removido del plato' : 'Incluido en la receta'}
              </p>
            </div>
            <button
              id={`toggle-exclude-${ingredient.id}`}
              onClick={() => onToggleExclude(ingredient.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                isExcluded
                  ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                  : 'bg-stone-700 hover:bg-stone-600 text-stone-200'
              }`}
            >
              {isExcluded ? '+ Reincorporar' : '✕ Quitar de mi plato'}
            </button>
          </div>
        )}

        {/* Footer controls: Step layers & Reensamblar button */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              id="prev-layer-button"
              onClick={handlePrev}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors flex items-center gap-1 text-xs"
              title="Capa anterior"
            >
              <ChevronLeft size={16} />
              <span className="hidden xs:inline">Anterior</span>
            </button>
            <button
              id="next-layer-button"
              onClick={handleNext}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors flex items-center gap-1 text-xs"
              title="Capa siguiente"
            >
              <span className="hidden xs:inline">Siguiente</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            id="reassemble-from-card-button"
            onClick={onReassemble}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Reensamblar Plato</span>
            <span>🍔</span>
          </button>
        </div>

      </div>
    </div>
  );
};
