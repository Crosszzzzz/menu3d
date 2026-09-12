import React, { useState, useRef, useEffect } from 'react';
import { DISHES_DATA } from './data/dishes';
import { Dish, Ingredient } from './types/dish';
import { WebARCanvas } from './three/WebARCanvas';
import { IngredientModal } from './components/IngredientModal';
import { ExplodedControls } from './components/ExplodedControls';
import { VerticalPanSlider } from './components/VerticalPanSlider';
import { DishHeader } from './components/DishHeader';
import { DishStoryModal } from './components/DishStoryModal';
import { OrderModal } from './components/OrderModal';
import { RotateCcw, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [currentDish, setCurrentDish] = useState<Dish>(DISHES_DATA[0]);
  const [explosionProgress, setExplosionProgress] = useState<number>(0.0);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [isARMode, setIsARMode] = useState<boolean>(false);
  const [show3DPins, setShow3DPins] = useState<boolean>(true);
  const [excludedIngredientIds, setExcludedIngredientIds] = useState<string[]>([]);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [showHelpToast, setShowHelpToast] = useState<boolean>(true);
  // Sheet peek (false = 42dvh) vs expanded (true = 70dvh) for canvas framing.
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  // Continuous drag overrides (session state only): visible fraction for the
  // bottom sheet (1 - sheetDvh/100) and top fraction for the layers panel.
  // Null = snap defaults. Cleared on close/reset to restore peek/top-expanded.
  const [sheetVisibleOverride, setSheetVisibleOverride] = useState<number | null>(null);
  const [topHeightOverride, setTopHeightOverride] = useState<number | null>(null);
  // Top layers card open state (mobile portrait). Reported by ExplodedControls:
  // true = expanded panel visible (~40-50% viewport height), false = collapsed pill.
  const [isTopPanelOpen, setIsTopPanelOpen] = useState<boolean>(true);
  // Manual vertical pan (lookAt Y offset, -2..+2, default 0). Additive with
  // the canvas auto shift; slider stays visible while sheets are open.
  const [panYOffset, setPanYOffset] = useState<number>(0);

  // Animation frame ref for smooth explosion tweening
  const animFrameRef = useRef<number | null>(null);

  // Smooth tween for explosion progress
  const tweenExplosion = (targetVal: number, durationMs: number = 650) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startVal = explosionProgress;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - t, 3);
      const val = startVal + (targetVal - startVal) * ease;
      setExplosionProgress(val);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setExplosionProgress(targetVal);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  const handleExplodeFull = () => {
    tweenExplosion(1.0, 750);
  };

  const handleReassemble = () => {
    tweenExplosion(0.0, 750);
    setSelectedIngredient(null);
  };

  const handleSelectIngredient = (ingredient: Ingredient | null) => {
    setSelectedIngredient(ingredient);
    if (!ingredient) {
      setIsSheetExpanded(false);
      setSheetVisibleOverride(null);
    }
    // If not exploded yet and an ingredient is selected, gently separate layers to show context
    if (ingredient && explosionProgress < 0.4) {
      tweenExplosion(0.75, 600);
    }
  };

  const handleSelectDish = (dish: Dish) => {
    setCurrentDish(dish);
    setSelectedIngredient(null);
    setExplosionProgress(0.0);
    setExcludedIngredientIds([]);
    setSheetVisibleOverride(null);
    setTopHeightOverride(null);
    setPanYOffset(0);
  };

  const handleToggleExclude = (ingredientId: string) => {
    setExcludedIngredientIds((prev) =>
      prev.includes(ingredientId)
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId]
    );
  };

  // Close toast after 7s
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHelpToast(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main
      id="webar-gastronomy-app"
      className="relative w-screen h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-[#0c0e12] font-sans text-stone-100 flex flex-col"
    >
      {/* 3D Gastronomic Viewport / WebAR Camera Passthrough */}
      <div className="relative flex-1 w-full h-full min-h-0">
        <WebARCanvas
          dish={currentDish}
          explosionProgress={explosionProgress}
          selectedIngredientId={selectedIngredient ? selectedIngredient.id : null}
          onSelectIngredient={handleSelectIngredient}
          isARMode={isARMode}
          show3DPins={show3DPins}
          onToggleARMode={setIsARMode}
          excludedIngredientIds={excludedIngredientIds}
          sheetOpen={selectedIngredient !== null}
          modalOpen={isStoryModalOpen || isOrderModalOpen}
          visibleHeightFraction={
            selectedIngredient !== null
              ? (sheetVisibleOverride ?? (isSheetExpanded ? 0.3 : 0.58))
              : 1.0
          }
          topPanelOpen={isTopPanelOpen}
          topHeightFraction={
            isTopPanelOpen
              ? (topHeightOverride ?? (0.42 + (showHelpToast && selectedIngredient === null ? 0.12 : 0)))
              : 0
          }
          panYOffset={panYOffset}
        />

        {/* Top Header & Mode Bar (compact on mobile while sheet is open) */}
        <DishHeader
          currentDish={currentDish}
          allDishes={DISHES_DATA}
          onSelectDish={handleSelectDish}
          isARMode={isARMode}
          onToggleARMode={setIsARMode}
          onOpenOrderModal={() => setIsOrderModalOpen(true)}
          onOpenDishInfoModal={() => setIsStoryModalOpen(true)}
          compact={selectedIngredient !== null}
        />

        {/* Exploded View Controls (Toggle, Slider, Layer Pills) */}
        <ExplodedControls
          dish={currentDish}
          explosionProgress={explosionProgress}
          onExplosionChange={setExplosionProgress}
          onReassemble={handleReassemble}
          onExplodeFull={handleExplodeFull}
          selectedIngredient={selectedIngredient}
          onSelectIngredient={handleSelectIngredient}
          show3DPins={show3DPins}
          onToggle3DPins={() => setShow3DPins(!show3DPins)}
          hasTopBanner={showHelpToast && selectedIngredient === null}
          isSheetOpen={selectedIngredient !== null}
          onTopPanelOpenChange={setIsTopPanelOpen}
          onTopHeightChange={setTopHeightOverride}
        />

        {/* Desplazamiento vertical manual: visible siempre salvo modales a
            pantalla completa; se mantiene con fichas abiertas (ahí más falta). */}
        {!(isStoryModalOpen || isOrderModalOpen) && (
          <VerticalPanSlider value={panYOffset} onChange={setPanYOffset} />
        )}

        {/* Ingredient Detail Modal (UI Overlay when selected) */}
        <IngredientModal
          ingredient={selectedIngredient}
          dish={currentDish}
          onClose={() => handleSelectIngredient(null)}
          onSelectIngredient={(ing) => setSelectedIngredient(ing)}
          onReassemble={handleReassemble}
          isExcluded={selectedIngredient ? excludedIngredientIds.includes(selectedIngredient.id) : false}
          onToggleExclude={handleToggleExclude}
          onExpandChange={setIsSheetExpanded}
          onHeightChange={setSheetVisibleOverride}
        />

        {/* Floating Quick Action: Reassemble pill if exploded & card closed */}
        {explosionProgress > 0.1 && !selectedIngredient && (
          <div className="absolute inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 pointer-events-none flex justify-center px-4">
            <button
              id="floating-reassemble-pill"
              onClick={handleReassemble}
              className="pointer-events-auto min-h-[44px] flex items-center gap-2 px-5 py-2.5 bg-stone-900/90 hover:bg-stone-800 text-amber-300 font-bold text-xs rounded-full border border-amber-500/40 shadow-2xl backdrop-blur-md transition-all active:scale-95"
            >
              <RotateCcw size={14} className="text-amber-400" />
              <span>Reensamblar Plato Completo</span>
            </button>
          </div>
        )}

        {/* First-time interaction hint toast (hidden while sheet is open so header / controls / sheet / toast never stack full height on mobile) */}
        {showHelpToast && !selectedIngredient && (
          <div className="absolute z-30 pointer-events-auto inset-x-2 top-[calc(env(safe-area-inset-top)+60px)] sm:inset-x-auto sm:right-4 sm:top-20 sm:max-w-xs bg-stone-900/95 border border-amber-500/30 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <Layers size={14} />
                <span>Explora la Anatomía Culinaria</span>
              </div>
              <button
                id="dismiss-help-toast"
                onClick={() => setShowHelpToast(false)}
                aria-label="Cerrar ayuda"
                className="min-h-[44px] min-w-[44px] -m-2 p-2 flex items-center justify-center text-stone-400 hover:text-stone-200 text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed mb-2">
              Pulsa <strong>"Desglosar Capas 3D"</strong> o haz clic directamente sobre la hamburguesa para separar sus ingredientes en el espacio.
            </p>
            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
              <CheckCircle2 size={12} />
              <span>WebAR con proyección sobre tu mesa disponible</span>
            </div>
          </div>
        )}
      </div>

      {/* Dish Story & Allergen Matrix Modal */}
      <DishStoryModal
        dish={currentDish}
        isOpen={isStoryModalOpen}
        onClose={() => setIsStoryModalOpen(false)}
      />

      {/* Order & Customization Modal */}
      <OrderModal
        dish={currentDish}
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        excludedIngredientIds={excludedIngredientIds}
        onToggleExclude={handleToggleExclude}
      />
    </main>
  );
}
