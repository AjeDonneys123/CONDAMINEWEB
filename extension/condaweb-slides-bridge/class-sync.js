(() => {
  const sendClassToPage = (classId, className) => {
    if (!classId) return;
    window.postMessage({
      type: 'CONDA_EXTENSION_CLASS_SELECTED',
      detail: { classId: String(classId), className: String(className || '') }
    }, window.location.origin);
  };

  const readAndSendClass = () => {
    chrome.storage.local.get(['activeClassId', 'activeClassName'], (data) => {
      if (chrome.runtime.lastError) return;
      sendClassToPage(data.activeClassId, data.activeClassName);
    });
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (message?.type === 'CONDAWEB_CLASS_SYNC_REQUEST') {
      readAndSendClass();
      return;
    }
    if (message?.type !== 'CONDAWEB_CLASS_SELECTED') return;
    const classId = String(message.detail?.classId || '');
    const className = String(message.detail?.className || '');
    if (!classId) return;
    chrome.storage.local.set({ activeClassId: classId, activeClassName: className });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || (!changes.activeClassId && !changes.activeClassName)) return;
    readAndSendClass();
  });
})();
