import React, { useRef, useState } from 'react';
import { setCardResizing } from '../utils/resizeGuard';

interface VerticalPanSliderProps {
  value: number; // lookAt Y offset, -2..+2 (min = producto arriba, max = producto abajo)
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const DEFAULT_MIN = -2.0;
const DEFAULT_MAX = 2.0;
const DEFAULT_STEP = 0.1;

export const VerticalPanSlider: React.FC<VerticalPanSliderProps> = ({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  step = DEFAULT_STEP,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ pointerId: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const clamped = clamp(value);
  const ratio = (clamped - min) / (max - min); // 0 = arriba (producto arriba), 1 = abajo

  const valueFromClientY = (clientY: number): number => {
    const el = trackRef.current;
    if (!el) return clamped;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return clamped;
    const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return clamp(min + t * (max - min));
  };

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    draggingRef.current = { pointerId: e.pointerId };
    setIsDragging(true);
    setCardResizing(true);
    onChange(valueFromClientY(e.clientY));
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    onChange(valueFromClientY(e.clientY));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    draggingRef.current = null;
    setIsDragging(false);
    setCardResizing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const big = e.shiftKey ? step * 5 : step;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      // Arriba en pantalla = producto arriba = offset lookAt hacia abajo.
      e.preventDefault();
      e.stopPropagation();
      onChange(clamp(clamped - big));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      onChange(clamp(clamped + big));
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      onChange(max);
    } else if (e.key === '0' || e.key.toLowerCase() === 'c') {
      // Atajo rápido: centrar.
      e.preventDefault();
      e.stopPropagation();
      onChange(0);
    }
  };

  const valuetext =
    Math.abs(clamped) < 0.05
      ? 'Producto centrado'
      : clamped < 0
        ? `Producto desplazado hacia arriba (${Math.abs(clamped).toFixed(1)})`
        : `Producto desplazado hacia abajo (${clamped.toFixed(1)})`;

  return (
    <div
      id="vertical-pan-slider"
      className="fixed right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-[44px] h-[190px] select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Desplazar producto arriba o abajo"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(clamped * 100) / 100}
        aria-valuetext={valuetext}
        aria-orientation="vertical"
        title="Desplazar producto (doble clic para centrar)"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onChange(0);
        }}
        className="vertical-pan-track relative flex items-center justify-center h-[160px] w-[44px] cursor-ns-resize rounded-full focus-visible:outline-2 focus-visible:outline-amber-500"
        style={{ touchAction: 'none' }}
      >
        {/* Hairline track */}
        <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] rounded-full bg-white/15" />
        {/* Center detent (0) */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 w-[10px] h-[2px] rounded-full bg-white/25"
          style={{ top: '50%' }}
        />
        {/* Thumb */}
        <span
          aria-hidden="true"
          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform ${
            isDragging ? 'scale-110' : ''
          }`}
          style={{
            top: `${ratio * 100}%`,
            width: 18,
            height: 18,
            background: '#f59e0b',
            borderColor: '#fde68a',
            borderWidth: 2,
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)',
            touchAction: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};
