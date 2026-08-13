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
