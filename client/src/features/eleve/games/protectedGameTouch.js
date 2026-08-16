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
  const activeTouches = new Map();
  const blockedTouchIds = new Set();
  let layoutLockedUntil = 0;
  const resolve = (touch, continuousOnly = false, preferTouchedElement = false) => {
    if (!touch) return '';
    const touchedButton = touch.target?.closest?.(selector);
    if (preferTouchedElement && touchedButton && root.contains(touchedButton)) return touchedButton.dataset.gameCode || '';
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
  const release = (identifier) => { const code = activeTouches.get(identifier); if (code) onRelease?.(code); activeTouches.delete(identifier); };
  const releaseAll = () => { [...activeTouches.keys()].forEach(release); };
  const start = (event) => {
    event.preventDefault(); event.stopPropagation();
    [...(event.changedTouches || [])].forEach((touch) => {
      if (blockedTouchIds.has(touch.identifier) || performance.now() < layoutLockedUntil) return;
      release(touch.identifier);
      const code = resolve(touch, false, true);
      if (code) { activeTouches.set(touch.identifier, code); onPress?.(code); }
    });
  };
  const move = (event) => {
    event.preventDefault(); event.stopPropagation();
    [...(event.changedTouches || event.touches || [])].forEach((touch) => {
      const current = activeTouches.get(touch.identifier);
      if (!continuousCodes.includes(current)) return;
      const next = resolve(touch, true);
      if (!next || next === current) return;
      release(touch.identifier); activeTouches.set(touch.identifier, next); onPress?.(next);
    });
  };
  const end = (event) => {
    event.preventDefault(); event.stopPropagation();
    const changed = [...(event.changedTouches || [])];
    if (changed.length) changed.forEach((touch) => { release(touch.identifier); blockedTouchIds.delete(touch.identifier); });
    else releaseAll();
  };
  const resetLayout = () => {
    activeTouches.forEach((_, identifier) => blockedTouchIds.add(identifier));
    releaseAll();
    layoutLockedUntil = performance.now() + 280;
  };
  root.addEventListener('touchstart', start, options);
  root.addEventListener('touchmove', move, options);
  root.addEventListener('touchend', end, options);
  root.addEventListener('touchcancel', end, options);
  window.addEventListener('orientationchange', resetLayout);
  window.addEventListener('resize', resetLayout);
  window.addEventListener('blur', resetLayout);
  return () => {
    releaseAll();
    root.removeEventListener('touchstart', start, options);
    root.removeEventListener('touchmove', move, options);
    root.removeEventListener('touchend', end, options);
    root.removeEventListener('touchcancel', end, options);
    window.removeEventListener('orientationchange', resetLayout);
    window.removeEventListener('resize', resetLayout);
    window.removeEventListener('blur', resetLayout);
  };
}
