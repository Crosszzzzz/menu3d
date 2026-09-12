import React, { useEffect, useState } from 'react';
import { Dish, Ingredient } from '../types/dish';
import { Layers, Minimize2, Maximize2, Tag, Sliders, ChevronUp, ChevronDown } from 'lucide-react';

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
  /** True while the help toast banner is visible; pushes the panel down on mobile so slots never overlap. */
  hasTopBanner?: boolean;
  /** True while the ingredient bottom-sheet is open; on mobile (<sm) the panel collapses to a floating pill so sheet + canvas coexist. */
  isSheetOpen?: boolean;
  /** Notifies parent when the expanded top panel opens/closes (mobile portrait framing). */
  onTopPanelOpenChange?: (open: boolean) => void;
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
  hasTopBanner = false,
  isSheetOpen = false,
  onTopPanelOpenChange,
}) => {
  const isExploded = explosionProgress > 0.05;
  const percentage = Math.round(explosionProgress * 100);
  // On mobile while the sheet is open, collapse to a floating pill by default.
  // The user can explicitly expand; closing the sheet resets to full panel.
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  useEffect(() => {
    if (!isSheetOpen) setMobilePanelOpen(false);
  }, [isSheetOpen]);
  const showCollapsedPill = isSheetOpen && !mobilePanelOpen;
  // Expanded full panel occludes the canvas top on mobile portrait; the
  // collapsed pill (~44px) does not. Report so WebARCanvas can shift the
  // burger down / center it in the free strip.
  const topPanelOpen = !showCollapsedPill;
  useEffect(() => {
    onTopPanelOpenChange?.(topPanelOpen);
  }, [topPanelOpen, onTopPanelOpenChange]);

  return (
    <div
      id="exploded-view-controls-panel"
      className={`absolute z-20 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-sm flex flex-col gap-2 pointer-events-none ${
        hasTopBanner
          ? 'top-[calc(env(safe-area-inset-top)+188px)] sm:top-20'
          : 'top-[calc(env(safe-area-inset-top)+64px)] sm:top-20'
      }`}
    >
      {/* Collapsed floating pill (mobile only, while sheet is open).
          Keeps the controls slot to ~44px so header / pill / sheet never
          triple-stack full height and the canvas stays visible. */}
      {showCollapsedPill && (
        <button
          id="expand-layers-panel-button"
          type="button"
          onClick={() => setMobilePanelOpen(true)}
          aria-expanded="false"
          aria-label="Mostrar controles de capas"
          className="sm:hidden pointer-events-auto self-start flex items-center gap-2 min-h-[44px] px-4 py-2.5 bg-stone-900/90 backdrop-blur-xl border border-stone-700/60 rounded-full shadow-2xl text-xs font-semibold text-amber-300 active:scale-95"
        >
          <Layers size={14} className="text-amber-400" />
          <span>Capas • {percentage}%</span>
          <ChevronUp size={14} className="text-stone-400" />
        </button>
      )}

      {/* Primary Floating Action: Explode ↔ Reassemble Toggle */}
      <div className={`pointer-events-auto overlay-panel bg-stone-900/90 backdrop-blur-xl border border-stone-700/60 rounded-2xl p-3 shadow-2xl flex-col gap-2.5 w-full sm:w-[320px] max-h-[calc(100dvh-220px)] sm:max-h-none overflow-y-auto custom-scrollbar ${showCollapsedPill ? 'hidden sm:flex' : 'flex'}`}>
        {/* Collapse back to pill (mobile only, while sheet is open) */}
        {isSheetOpen && (
          <button
            id="collapse-layers-panel-button"
            type="button"
            onClick={() => setMobilePanelOpen(false)}
            aria-expanded={mobilePanelOpen}
            aria-label="Minimizar controles de capas"
            className="sm:hidden self-end flex items-center gap-1 min-h-[44px] px-3 py-2 text-[11px] font-semibold text-stone-400 hover:text-stone-200"
          >
            <span>Minimizar</span>
            <ChevronDown size={14} />
          </button>
        )}
        <div className="flex items-center justify-between gap-2">
          <button
            id="toggle-exploded-state-button"
            onClick={isExploded ? onReassemble : onExplodeFull}
            className={`min-h-[44px] flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 ${
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
            className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              show3DPins
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-stone-800/80 hover:bg-stone-700 border-stone-700 text-stone-400'
            }`}
            title={show3DPins ? 'Ocultar etiquetas 3D' : 'Mostrar etiquetas 3D'}
            aria-pressed={show3DPins}
          >
            <Tag size={15} />
            <span className="hidden sm:inline text-[11px]">Pins</span>
          </button>
        </div>

        {/* Precision Expansion Slider (44px hit area) */}
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

          <div className="relative flex items-center min-h-[44px]">
            <input
              id="explosion-progress-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explosionProgress}
              onChange={(e) => onExplosionChange(parseFloat(e.target.value))}
              aria-label="Separación de capas"
              className="explosion-slider w-full cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-between text-[9px] text-stone-500 mt-1 uppercase font-semibold tracking-wider">
            <span>Ensamblado</span>
            <span>Desglose Total</span>
          </div>
        </div>

        {/* Quick Horizontal Layer Selector Pills */}
        <div className="pt-1.5 border-t border-stone-800/80">
          <div className="flex items-center justify-between gap-1 text-[10px] text-stone-400 mb-1.5">
            <div className="flex items-center gap-1">
              <Layers size={11} className="text-amber-400" />
              <span>Capas del Plato:</span>
            </div>
            <span className="sm:hidden text-stone-500 font-semibold">Desliza →</span>
          </div>
          <div className="chip-row-fade flex gap-1.5 overflow-x-auto pb-1 pr-6 no-scrollbar snap-x">
            {dish.ingredients
              .filter((ing) => ing.category !== 'decoracion')
              .map((ing) => {
                const isSelected = selectedIngredient?.id === ing.id;
                return (
                  <button
                    key={ing.id}
                    id={`layer-chip-${ing.id}`}
                    onClick={() => onSelectIngredient(ing)}
                    className={`snap-start shrink-0 min-h-[44px] whitespace-nowrap flex items-center gap-1 text-[11px] px-3 py-2 rounded-lg border transition-all ${
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
