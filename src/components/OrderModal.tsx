import React, { useState } from 'react';
import { Dish, Ingredient } from '../types/dish';
import { X, Check, Utensils, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
import confetti from 'canvas-confetti';

interface OrderModalProps {
  dish: Dish;
  isOpen: boolean;
  onClose: () => void;
  excludedIngredientIds: string[];
  onToggleExclude: (id: string) => void;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  dish,
  isOpen,
  onClose,
  excludedIngredientIds,
  onToggleExclude,
}) => {
  const [tableNumber, setTableNumber] = useState<string>('Mesa 04 (Salón Principal)');
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [orderSent, setOrderSent] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calculate live weight and calories based on active ingredients
  const activeIngredients = dish.ingredients.filter(
    (i) => !excludedIngredientIds.includes(i.id) && i.category !== 'decoracion'
  );
  const currentTotalCalories = activeIngredients.reduce((sum, i) => sum + i.nutrition.calories, 0);
  const currentTotalGrams = activeIngredients.reduce((sum, i) => sum + i.grams, 0);

  const handleConfirmOrder = () => {
    setOrderSent(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#d97706', '#fbbf24', '#ffffff'],
    });

    setTimeout(() => {
      // Reset after a brief moment if desired
    }, 4000);
  };

  const handleResetModal = () => {
    setOrderSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="order-customizer-modal-card"
        className="bg-stone-900 border border-stone-700 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 shadow-2xl text-stone-100"
      >
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400">
              <ShoppingBag size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">Comanda Digital</h2>
              <p className="text-xs text-stone-400">Personalización del plato 3D para cocina</p>
            </div>
          </div>
          <button
            id="close-order-modal-button"
            onClick={handleResetModal}
            className="p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {orderSent ? (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-4">
              <Check size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">¡Comanda Recibida en Cocina!</h3>
            <p className="text-xs text-stone-400 max-w-sm mb-4">
              El {dish.chefName} y su brigada han comenzado la preparación de tu {dish.name} con las capas seleccionadas.
            </p>
            <div className="bg-stone-800/60 p-4 rounded-2xl border border-stone-700/50 w-full max-w-sm mb-6 text-left text-xs">
              <div className="flex justify-between py-1 border-b border-stone-700/40">
                <span className="text-stone-400">Destino:</span>
                <span className="font-semibold text-amber-300">{tableNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-stone-700/40">
                <span className="text-stone-400">Tiempo estimado:</span>
                <span className="font-semibold text-stone-200">{dish.prepTimeMinutes} minutos</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-stone-400">Total a abonar:</span>
                <span className="font-bold text-amber-400 text-sm">{dish.price.toFixed(2)}{dish.currency}</span>
              </div>
            </div>
            <button
              id="finish-order-modal-button"
              onClick={handleResetModal}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all"
            >
              Seguir explorando en WebAR
            </button>
          </div>
        ) : (
          <>
            {/* Dish quick banner */}
            <div className="my-4 p-3 bg-stone-800/50 rounded-2xl border border-stone-700/50 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-amber-200">{dish.name}</h4>
                <div className="flex items-center gap-3 text-xs text-stone-400 mt-0.5">
                  <span>{currentTotalGrams}g</span>
                  <span>•</span>
                  <span>{currentTotalCalories} kcal</span>
                </div>
              </div>
              <span className="text-base font-extrabold text-white">
                {dish.price.toFixed(2)}{dish.currency}
              </span>
            </div>

            {/* Ubicación en restaurante */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Ubicación / Mesa del Comensal:
              </label>
              <select
                id="select-table-number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="Mesa 01 (Terraza Exterior)">Mesa 01 (Terraza Exterior)</option>
                <option value="Mesa 04 (Salón Principal)">Mesa 04 (Salón Principal - Escaneo WebAR)</option>
                <option value="Mesa 08 (Barra del Chef)">Mesa 08 (Barra del Chef)</option>
                <option value="Mesa 12 (Reservado)">Mesa 12 (Reservado)</option>
              </select>
            </div>

            {/* Personalización de Capas / Ingredientes */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Ajuste de Capas e Ingredientes:
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {dish.ingredients
                  .filter((i) => i.category !== 'decoracion')
                  .map((ing) => {
                    const isExcluded = excludedIngredientIds.includes(ing.id);
                    return (
                      <div
                        key={ing.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                          isExcluded
                            ? 'bg-stone-800/30 border-stone-800 opacity-60 text-stone-500'
                            : 'bg-stone-800/70 border-stone-700 text-stone-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{ing.icon}</span>
                          <span className={isExcluded ? 'line-through' : 'font-medium'}>
                            {ing.name}
                          </span>
                          <span className="text-[10px] text-stone-400">({ing.weight})</span>
                        </div>

                        {ing.isCustomizable ? (
                          <button
                            id={`order-toggle-${ing.id}`}
                            onClick={() => onToggleExclude(ing.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              isExcluded
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                            }`}
                          >
                            {isExcluded ? '+ Reincorporar' : 'Quitar'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-stone-500 italic">Esencial</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Instrucciones especiales */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Instrucciones para el Chef (alergias, punto de carne):
              </label>
              <input
                id="special-instructions-input"
                type="text"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Ej. Punto de la carne al punto más, sin sal en papas..."
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Confirm button */}
            <button
              id="confirm-order-button"
              onClick={handleConfirmOrder}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Enviar Pedido a Cocina</span>
              <span>•</span>
              <span>{dish.price.toFixed(2)}{dish.currency}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
