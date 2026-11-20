(() => {
  if (window.__condaCaptureLoaded) return;
  window.__condaCaptureLoaded = true;

  const toast = (text, error = false) => {
    const node = document.createElement('div');
    node.textContent = text;
    Object.assign(node.style, {
      position: 'fixed', right: '22px', top: '22px', zIndex: '2147483647',
      padding: '12px 16px', borderRadius: '12px', color: '#fff',
      background: error ? '#b91c1c' : '#0f766e', font: '700 14px system-ui',
      boxShadow: '0 10px 30px rgba(15,23,42,.3)'
    });
    document.documentElement.appendChild(node);
    setTimeout(() => node.remove(), 2600);
  };

  const startSelection = (mode = 'save') => {
    if (document.getElementById('conda-capture-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'conda-capture-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', cursor: 'crosshair',
      background: 'rgba(15,23,42,.28)', userSelect: 'none'
    });
    const hint = document.createElement('div');
    hint.textContent = 'Faites glisser pour sélectionner la zone · Échap pour annuler';
    Object.assign(hint.style, {
      position: 'fixed', left: '50%', top: '18px', transform: 'translateX(-50%)',
      padding: '10px 14px', borderRadius: '10px', background: '#111827', color: '#fff',
      font: '700 13px system-ui', pointerEvents: 'none'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed', display: 'none', border: '2px solid #38bdf8',
      background: 'rgba(255,255,255,.08)', boxShadow: '0 0 0 9999px rgba(15,23,42,.38)',
      pointerEvents: 'none'
    });
    overlay.append(hint, box);
    document.documentElement.appendChild(overlay);

    let startX = 0; let startY = 0; let selecting = false;
    const cleanup = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
    const onKey = (event) => { if (event.key === 'Escape') cleanup(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', (event) => {
      selecting = true; startX = event.clientX; startY = event.clientY;
      box.style.display = 'block';
    });
    overlay.addEventListener('mousemove', (event) => {
      if (!selecting) return;
      const left = Math.min(startX, event.clientX); const top = Math.min(startY, event.clientY);
      Object.assign(box.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.abs(event.clientX - startX)}px`, height: `${Math.abs(event.clientY - startY)}px`
      });
    });
    overlay.addEventListener('mouseup', (event) => {
      if (!selecting) return;
      const rect = {
        left: Math.min(startX, event.clientX), top: Math.min(startY, event.clientY),
        width: Math.abs(event.clientX - startX), height: Math.abs(event.clientY - startY),
        viewportWidth: window.innerWidth, viewportHeight: window.innerHeight
      };
      cleanup();
      if (rect.width < 8 || rect.height < 8) return;
      setTimeout(() => chrome.runtime.sendMessage({ type: 'CONDA_CAPTURE_RECT', rect, mode }), 80);
    });
  };

  const cropScreenshot = ({ dataUrl, rect, mode = 'save' }) => {
    const image = new Image();
    image.onload = () => {
      const scaleX = image.naturalWidth / rect.viewportWidth;
      const scaleY = image.naturalHeight / rect.viewportHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(rect.width * scaleX);
      canvas.height = Math.round(rect.height * scaleY);
      canvas.getContext('2d').drawImage(
        image, rect.left * scaleX, rect.top * scaleY, rect.width * scaleX, rect.height * scaleY,
        0, 0, canvas.width, canvas.height
      );
      if (mode === 'clipboard') {
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast('Capture copiée. Collez-la avec Ctrl/⌘ + V.');
          } catch (_) {
            toast('Chrome a refusé le presse-papiers. Réessayez sur une page web normale.', true);
          }
        }, 'image/png');
        return;
      }
      chrome.runtime.sendMessage({ type: 'CONDA_CAPTURE_SAVE', dataUrl: canvas.toDataURL('image/png') });
    };
    image.src = dataUrl;
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'CONDA_CAPTURE_START') startSelection(message.mode || 'save');
    if (message?.type === 'CONDA_CAPTURE_IMAGE') cropScreenshot(message);
    if (message?.type === 'CONDA_CAPTURE_STATUS') toast(message.text, message.error);
  });
})();
