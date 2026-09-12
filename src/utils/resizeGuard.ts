/**
 * Shared gesture guard: while a card resize handle is being dragged,
 * canvas rotate/pinch/zoom handlers must ignore pointer input.
 * Overlays are siblings of the canvas so most events never reach it,
 * but the flag covers overlap + synthetic bubbling edge cases.
 */
export function setCardResizing(active: boolean): void {
  try {
    (window as unknown as { __MENU3D_RESIZING?: boolean }).__MENU3D_RESIZING = active;
  } catch {
    /* non-browser / locked down: ignore */
  }
  try {
    if (typeof document !== 'undefined') {
      if (active) document.body.dataset.menu3dResizing = 'true';
      else delete document.body.dataset.menu3dResizing;
    }
  } catch {
    /* ignore */
  }
}

export function isCardResizing(): boolean {
  try {
    return Boolean(
      (window as unknown as { __MENU3D_RESIZING?: boolean }).__MENU3D_RESIZING,
    );
  } catch {
    return false;
  }
}
