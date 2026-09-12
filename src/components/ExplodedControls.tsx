import React from 'react';
import { Dish, Ingredient } from '../types/dish';
import { Layers, Minimize2, Maximize2, Tag, Sliders } from 'lucide-react';

interface ExplodedControlsProps {
  dish: Dish;
  explosionProgress: number; // 0.0 to 1.0
  onExplosionChange: (value: number) => void;
  onReassemble: () => void;
  onExplodeFull: () => void;
  selectedIngredient: Ingredient | null;
  onSelectIngredient: (ingredient: Ingredient) => void;
  show3DPins: boolean;
  onToggle3DPins: () => void;
}

export const ExplodedControls: React.FC<ExplodedControlsProps> = ({
  dish,
  explosionProgress,
  onExplosionChange,
  onReassemble,
  onExplodeFull,
  selectedIngredient,
  onSelectIngredient,
  show3DPins,
  onToggle3DPins,
}) => {
  const isExploded = explosionProgress > 0.05;
  const percentage = Math.round(explosionProgress * 100);

  return (
    <div
      id="exploded-view-controls-panel"
      className="absolute top-20 left-4 z-20 max-w-xs sm:max-w-sm flex flex-col gap-2 pointer-events-none"
    >
      {/* Primary Floating Action: Explode ↔ Reassemble Toggle */}
      <div className="pointer-events-auto bg-stone-900/90 backdrop-blur-xl border border-stone-700/60 rounded-2xl p-3 shadow-2xl flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            id="toggle-exploded-state-button"
            onClick={isExploded ? onReassemble : onExplodeFull}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
              isExploded
                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-500/25'
            }`}
          >
            {isExploded ? (
              <>
                <Minimize2 size={15} />
                <span>Reensamblar Plato</span>
              </>
            ) : (
              <>
                <Maximize2 size={15} />
                <span>Desglosar Capas 3D</span>
              </>
            )}
          </button>

          {/* 3D Pins toggle */}
          <button
            id="toggle-3d-pins-button"
            onClick={onToggle3DPins}
            className={`p-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              show3DPins
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-400'
            }`}
            title={show3DPins ? 'Ocultar etiquetas 3D' : 'Mostrar etiquetas 3D'}
          >
            <Tag size={15} />
            <span className="hidden sm:inline text-[11px]">Pins</span>
          </button>
        </div>

        {/* Precision Expansion Slider */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-300 mb-1.5">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Sliders size={12} />
              <span>Separación de Capas</span>
            </div>
            <span className="font-mono text-amber-300 bg-stone-800 px-2 py-0.5 rounded-md border border-stone-700 text-[10px]">
              {percentage}%
            </span>
          </div>

          <div className="relative flex items-center">
            <input
              id="explosion-progress-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explosionProgress}
              onChange={(e) => onExplosionChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-between text-[9px] text-stone-500 mt-1 uppercase font-semibold tracking-wider">
            <span>Ensamblado</span>
            <span>Desglose Total</span>
          </div>
        </div>

        {/* Quick Horizontal Layer Selector Pills */}
        <div className="pt-1.5 border-t border-stone-800/80">
          <div className="flex items-center gap-1 text-[10px] text-stone-400 mb-1.5">
            <Layers size={11} className="text-amber-400" />
            <span>Capas del Plato:</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {dish.ingredients
              .filter((ing) => ing.category !== 'decoracion')
              .map((ing) => {
                const isSelected = selectedIngredient?.id === ing.id;
                return (
                  <button
                    key={ing.id}
                    id={`layer-chip-${ing.id}`}
                    onClick={() => onSelectIngredient(ing)}
                    className={`whitespace-nowrap flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 font-bold border-amber-300'
                        : 'bg-stone-800/70 hover:bg-stone-700/80 text-stone-300 border-stone-700/50'
                    }`}
                  >
                    <span>{ing.icon}</span>
                    <span className="truncate max-w-[80px]">{ing.name.split(' ')[0]}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
