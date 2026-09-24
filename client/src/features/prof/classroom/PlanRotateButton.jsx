import React, { useEffect, useRef, useState } from 'react';

export default function PlanRotateButton({ storageKey }) {
  const buttonRef = useRef(null);
  const [rotated, setRotated] = useState(() => {
    try { return window.localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });

  useEffect(() => {
    try { setRotated(window.localStorage.getItem(storageKey) === 'true'); } catch { setRotated(false); }
  }, [storageKey]);

  useEffect(() => {
    const root = buttonRef.current?.closest('.classroom-wrapper');
    if (root) root.dataset.planRotated = rotated ? 'true' : 'false';
  }, [rotated]);

  const toggleRotation = () => {
    const next = !rotated;
    try { window.localStorage.setItem(storageKey, String(next)); } catch { /* La rotation reste active pour cette session. */ }
    setRotated(next);
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className="plan-rotate-btn"
      aria-pressed={rotated}
      title="Pivoter le plan de 180° ; les noms restent lisibles"
      onClick={toggleRotation}
    >↻ {rotated ? 'REDRESSER' : 'ROTATE'}</button>
  );
}
