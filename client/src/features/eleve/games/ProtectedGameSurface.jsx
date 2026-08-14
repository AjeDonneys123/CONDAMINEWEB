import React, { useEffect, useRef } from 'react';
import './ProtectedGameSurface.css';

const BLOCKED_EVENTS = ['contextmenu', 'selectstart', 'dragstart', 'copy', 'cut', 'dblclick'];

export default function ProtectedGameSurface({ children, className = '' }) {
  const surfaceRef = useRef(null);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const clearSelection = () => {
      try { document.getSelection()?.removeAllRanges(); } catch (_) {}
    };
    const block = (event) => {
      event.preventDefault();
      clearSelection();
    };
    const capture = { capture: true };
    const touch = { capture: true, passive: true };
    BLOCKED_EVENTS.forEach((type) => surface.addEventListener(type, block, capture));
    surface.addEventListener('touchstart', clearSelection, touch);
    surface.addEventListener('touchend', clearSelection, touch);
    surface.querySelectorAll('img, canvas').forEach((node) => node.setAttribute('draggable', 'false'));
    return () => {
      BLOCKED_EVENTS.forEach((type) => surface.removeEventListener(type, block, capture));
      surface.removeEventListener('touchstart', clearSelection, touch);
      surface.removeEventListener('touchend', clearSelection, touch);
      clearSelection();
    };
  }, []);

  return <div ref={surfaceRef} className={`protected-game-surface ${className}`.trim()}>{children}</div>;
}
