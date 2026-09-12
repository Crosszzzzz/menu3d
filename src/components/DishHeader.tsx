import React from 'react';
import { Dish } from '../types/dish';
import { Camera, Box, Star, Clock, Sparkles, ChefHat } from 'lucide-react';

interface DishHeaderProps {
  currentDish: Dish;
  allDishes: Dish[];
  onSelectDish: (dish: Dish) => void;
  isARMode: boolean;
  onToggleARMode: (enabled: boolean) => void;
  onOpenOrderModal: () => void;
  onOpenDishInfoModal: () => void;
}

export const DishHeader: React.FC<DishHeaderProps> = ({
  currentDish,
  allDishes,
  onSelectDish,
  isARMode,
  onToggleARMode,
  onOpenOrderModal,
  onOpenDishInfoModal,
}) => {
  return (
    <header
      id="gastronomy-navbar"
      className="absolute top-0 inset-x-0 z-20 px-4 py-3 flex flex-wrap items-center justify-between gap-3 pointer-events-none"
    >
      {/* Brand & Active Dish Name */}
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-700/60 rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-serif italic tracking-wide text-amber-300 font-bold text-base">
              AURA
            </span>
            <span className="text-stone-600">|</span>
            <span className="text-xs tracking-widest text-stone-300 uppercase font-semibold">
              WebAR Menú
            </span>
          </div>

          <div className="hidden md:block h-4 w-px bg-stone-700" />

          {/* Dish Switcher Dropdown / Pills */}
          <div className="flex items-center gap-1.5">
            {allDishes.map((dish) => {
              const isActive = dish.id === currentDish.id;
              return (
                <button
                  key={dish.id}
                  id={`dish-selector-${dish.id}`}
                  onClick={() => onSelectDish(dish)}
                  className={`text-xs px-2.5 py-1 rounded-xl transition-all font-medium ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {dish.id === 'wagyu-smash-burger' ? '🍔 Wagyu Smash' : '🍣 Salmón Kaiseki'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Dish Info Button */}
        <button
          id="open-dish-story-button"
          onClick={onOpenDishInfoModal}
          className="pointer-events-auto hidden lg:flex items-center gap-1.5 px-3 py-2 bg-stone-900/80 hover:bg-stone-800 border border-stone-700/60 backdrop-blur-md rounded-2xl text-xs text-stone-300 transition-colors shadow-lg"
          title="Ver historia culinaria y alérgenos globales"
        >
          <ChefHat size={14} className="text-amber-400" />
          <span>Ficha Culinaria</span>
        </button>
      </div>

      {/* Mode Controls: Estudio 3D ↔ Realidad Aumentada & Order Button */}
      <div className="pointer-events-auto flex items-center gap-2.5 ml-auto">
        {/* Toggle Mode Segment */}
        <div className="bg-stone-900/90 backdrop-blur-xl border border-stone-700/60 p-1 rounded-2xl shadow-2xl flex items-center gap-1">
          <button
            id="switch-mode-studio-button"
            onClick={() => onToggleARMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              !isARMode
                ? 'bg-stone-800 text-amber-300 shadow-sm border border-stone-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Box size={14} />
            <span>Estudio 3D</span>
          </button>

          <button
            id="switch-mode-webar-button"
            onClick={() => onToggleARMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isARMode
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Camera size={14} />
            <span>WebAR Cámara</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
          </button>
        </div>

        {/* Order Button with Price */}
        <button
          id="order-dish-cta-button"
          onClick={onOpenOrderModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95 border border-amber-300/40"
        >
          <span>Ordenar</span>
          <span className="bg-stone-950/20 px-1.5 py-0.5 rounded-md text-[11px]">
            {currentDish.price.toFixed(2)}{currentDish.currency}
          </span>
        </button>
      </div>
    </header>
  );
};
