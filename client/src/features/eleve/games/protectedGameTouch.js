export function protectGameSurface(root) {
  if (!root) return () => {};
  const block = (event) => event.preventDefault();
  const capture = { capture: true };
  ['contextmenu', 'selectstart', 'dragstart'].forEach((type) => root.addEventListener(type, block, capture));
  root.classList.add('protected-game-surface');
  return () => {
    ['contextmenu', 'selectstart', 'dragstart'].forEach((type) => root.removeEventListener(type, block, capture));
    root.classList.remove('protected-game-surface');
  };
}

export function protectNativeTouchZone(element) {
  if (!element) return () => {};
  const block = (event) => event.preventDefault();
  const options = { passive: false };
  element.addEventListener('touchmove', block, options);
  element.addEventListener('contextmenu', block);
  element.addEventListener('selectstart', block);
  element.addEventListener('dragstart', block);
  return () => {
    element.removeEventListener('touchmove', block, options);
    element.removeEventListener('contextmenu', block);
    element.removeEventListener('selectstart', block);
    element.removeEventListener('dragstart', block);
  };
}

export function installCoordinateTouchRouter(root, { selector = '[data-game-code]', onPress, onRelease, continuousCodes = [] } = {}) {
  if (!root) return () => {};
  const options = { passive: false };
  let active = '';
  const resolve = (touch, continuousOnly = false) => {
    if (!touch) return '';
    const buttons = [...root.querySelectorAll(selector)].filter((button) => !continuousOnly || continuousCodes.includes(button.dataset.gameCode));
    let nearest = '';
    let distance = Infinity;
    buttons.forEach((button) => {
      const rect = button.getBoundingClientRect();
      const dx = touch.clientX - (rect.left + rect.width / 2);
      const dy = touch.clientY - (rect.top + rect.height / 2);
      const nextDistance = dx * dx + dy * dy;
      if (nextDistance < distance) { distance = nextDistance; nearest = button.dataset.gameCode || ''; }
    });
    return nearest;
  };
  const release = () => { if (active) onRelease?.(active); active = ''; };
  const start = (event) => { event.preventDefault(); event.stopPropagation(); release(); active = resolve(event.changedTouches?.[0] || event.touches?.[0]); if (active) onPress?.(active); };
  const move = (event) => { event.preventDefault(); event.stopPropagation(); if (!continuousCodes.includes(active)) return; const next = resolve(event.touches?.[0], true); if (!next || next === active) return; release(); active = next; onPress?.(active); };
  const end = (event) => { event.preventDefault(); event.stopPropagation(); release(); };
  root.addEventListener('touchstart', start, options);
  root.addEventListener('touchmove', move, options);
  root.addEventListener('touchend', end, options);
  root.addEventListener('touchcancel', end, options);
  return () => {
    release();
    root.removeEventListener('touchstart', start, options);
    root.removeEventListener('touchmove', move, options);
    root.removeEventListener('touchend', end, options);
    root.removeEventListener('touchcancel', end, options);
  };
}
