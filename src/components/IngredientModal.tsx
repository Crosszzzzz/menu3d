import React, { useEffect, useRef, useState } from 'react';
import { Ingredient, Dish } from '../types/dish';
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Sparkles, Scale, Flame, ShieldAlert, Award, Compass } from 'lucide-react';
import { setCardResizing } from '../utils/resizeGuard';

/** Bottom-sheet drag range (dvh). Defaults: peek 42dvh / expanded 70dvh. */
export const SHEET_MIN_DVH = 28;
export const SHEET_MAX_DVH = 85;
const SHEET_PEEK_DVH = 42;
const SHEET_EXPANDED_DVH = 70;
/** Above this height the sheet counts as "expanded" for legacy boolean wiring. */
const SHEET_EXPANDED_THRESHOLD_DVH = 56;

interface IngredientModalProps {
  ingredient: Ingredient | null;
  dish: Dish;
  onClose: () => void;
  onSelectIngredient: (ingredient: Ingredient) => void;
  onReassemble: () => void;
  isExcluded: boolean;
  onToggleExclude: (id: string) => void;
  /** Notifies parent when peek (false, 42dvh) <-> expanded (true, 70dvh) changes so the 3D canvas can re-frame. */
  onExpandChange?: (expanded: boolean) => void;
  /** Continuous height report (visible fraction 0..1) so WebARCanvas auto-frame follows the drag live. */
  onHeightChange?: (visibleFraction: number) => void;
}

export const IngredientModal: React.FC<IngredientModalProps> = ({
  ingredient,
  dish,
  onClose,
  onSelectIngredient,
  onReassemble,
  isExcluded,
  onToggleExclude,
  onExpandChange,
  onHeightChange,
}) => {
  // Compact peek on mobile so the sheet + canvas coexist: collapsed ~42dvh
  // leaves the top ~30%+ of a 360-390px viewport visible for product context.
  // Desktop (sm+) keeps the floating card behaviour via sm:max-h.
  const [isExpanded, setIsExpanded] = useState(false);
  // User-dragged height (dvh). Null = snap default from isExpanded.
  // Kept while the sheet is open (even across ingredient switches);
  // cleared on close so reopen restores the peek default.
  const [sheetDvh, setSheetDvh] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean; pointerId: number } | null>(null);
  const heightRef = useRef(onHeightChange);
  heightRef.current = onHeightChange;

  const effectiveDvh = sheetDvh ?? (isExpanded ? SHEET_EXPANDED_DVH : SHEET_PEEK_DVH);

  // Reset to compact peek only when the sheet closes (ingredient -> null).
  // Switching ingredients keeps the last dragged height (session persist).
  const ingredientId = ingredient?.id;
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const open = ingredientId != null;
    if (!open && wasOpenRef.current) {
      setSheetDvh(null);
      setIsExpanded(false);
    }
    wasOpenRef.current = open;
  }, [ingredientId]);

  // Report peek/expanded to parent for canvas auto-framing (42dvh vs 70dvh).
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  // Report continuous height for live framing.
  useEffect(() => {
    if (ingredientId != null) {
      heightRef.current?.(1 - effectiveDvh / 100);
    }
  }, [effectiveDvh, ingredientId]);

  // Esc closes the sheet from anywhere inside it (keyboard a11y).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (ingredientId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ingredientId]);

  const clampDvh = (v: number) => Math.max(SHEET_MIN_DVH, Math.min(SHEET_MAX_DVH, v));

  const applyDvh = (dvh: number) => {
    const clamped = clampDvh(dvh);
    setSheetDvh(clamped);
    setIsExpanded(clamped > SHEET_EXPANDED_THRESHOLD_DVH);
    heightRef.current?.(1 - clamped / 100);
  };

  const viewportH = () =>
    (typeof window !== 'undefined' && window.visualViewport?.height) ||
    (typeof window !== 'undefined' && window.innerHeight) ||
    800;

  const beginSheetDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only the handle starts a resize — inner scroll never fights.
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore capture failures */
    }
    dragRef.current = { startY: e.clientY, startH: effectiveDvh, moved: false, pointerId: e.pointerId };
    setIsDragging(true);
    setCardResizing(true);
  };

  const moveSheetDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    if (Math.abs(e.clientY - d.startY) > 3) d.moved = true;
    // Drag up grows the sheet; grab offset tracked so there is no jump.
    const deltaDvh = ((d.startY - e.clientY) / viewportH()) * 100;
    applyDvh(d.startH + deltaDvh);
  };

  const endSheetDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragRef.current = null;
    setIsDragging(false);
    setCardResizing(false);
    // Tap (no drag) on the handle keeps the legacy toggle affordance.
    if (!d.moved) {
      setSheetDvh(null);
      setIsExpanded((v) => !v);
    }
    // On release the dragged position is kept (session persist).
  };

  const handleSheetKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      applyDvh(effectiveDvh + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      applyDvh(effectiveDvh - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      applyDvh(SHEET_MIN_DVH);
    } else if (e.key === 'End') {
      e.preventDefault();
      applyDvh(SHEET_MAX_DVH);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

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
      className="absolute z-30 inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:left-auto sm:w-full sm:max-w-md transition-all transform animate-in slide-in-from-bottom duration-300 pointer-events-auto"
    >
      <div
        className={`bg-stone-900/95 rounded-3xl sm:rounded-3xl border border-stone-700/60 shadow-2xl backdrop-blur-xl text-stone-100 border-t-amber-500/30 flex flex-col overflow-hidden sheet-height-anim ${sheetDvh == null ? (isExpanded ? 'max-h-[70dvh]' : 'max-h-[42dvh]') : ''} sm:max-h-[85vh]`}
        style={sheetDvh != null ? { maxHeight: `${sheetDvh}dvh`, transition: isDragging ? 'none' : undefined } : undefined}
      >
        {/* Drag handle (top edge, mobile): drag to resize 28–85dvh, tap toggles, arrows resize. */}
        <div
          role="slider"
          tabIndex={0}
          data-resize-handle="sheet-top"
          aria-label="Arrastrar para ajustar tamaño"
          aria-valuemin={SHEET_MIN_DVH}
          aria-valuemax={SHEET_MAX_DVH}
          aria-valuenow={Math.round(effectiveDvh)}
          aria-valuetext={`Ficha al ${Math.round(effectiveDvh)} por ciento de la pantalla`}
          aria-orientation="vertical"
          onPointerDown={beginSheetDrag}
          onPointerMove={moveSheetDrag}
          onPointerUp={endSheetDrag}
          onPointerCancel={endSheetDrag}
          onKeyDown={handleSheetKeyDown}
          className="pt-2 pb-1 px-8 flex justify-center items-center shrink-0 min-h-[44px] cursor-ns-resize touch-none select-none focus-visible:outline-2 focus-visible:outline-amber-500 focus-visible:outline-offset-[-2px] rounded-t-3xl sm:hidden"
        >
          <span className="w-10 h-1.5 rounded-full bg-stone-600" aria-hidden="true" />
        </div>

        {/* Scrollable content: text selectable, vertical pan allowed so the
            locked page + touch-none canvas never trap sheet scrolling */}
        <div className="overlay-panel overflow-y-auto custom-scrollbar select-text px-5 sm:px-6 pb-3 min-h-0">
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

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Expand/collapse toggle (mobile only; desktop keeps floating card) */}
              <button
                id="toggle-sheet-size-button"
                onClick={() => {
                  setSheetDvh(null);
                  setIsExpanded((v) => !v);
                }}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Compactar ficha' : 'Ampliar ficha'}
                title={isExpanded ? 'Compactar ficha' : 'Ampliar ficha'}
                className="sm:hidden min-h-[44px] min-w-[44px] p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors flex items-center justify-center"
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button
                id="close-ingredient-card"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] p-2 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors flex items-center justify-center"
                title="Cerrar ficha"
                aria-label="Cerrar ficha"
              >
                <X size={18} />
              </button>
            </div>
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
              className={`min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                isExcluded
                  ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
                  : 'bg-stone-700 hover:bg-stone-600 text-stone-200'
              }`}
            >
              {isExcluded ? '+ Reincorporar' : '✕ Quitar de mi plato'}
            </button>
          </div>
        )}

        {/* Footer controls: Step layers & Reensamblar button (pinned, safe-area padded) */}
        </div>
        <div className="shrink-0 px-5 sm:px-6 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-stone-800 flex items-center justify-between gap-2 bg-stone-900/95">
          <div className="flex items-center gap-1.5">
            <button
              id="prev-layer-button"
              onClick={handlePrev}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors flex items-center justify-center gap-1 text-xs"
              title="Capa anterior"
              aria-label="Capa anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              id="next-layer-button"
              onClick={handleNext}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors flex items-center justify-center gap-1 text-xs"
              title="Capa siguiente"
              aria-label="Capa siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            id="reassemble-from-card-button"
            onClick={onReassemble}
            className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <span>Reensamblar Plato</span>
            <span>🍔</span>
          </button>
        </div>

      </div>
    </div>
  );
};
