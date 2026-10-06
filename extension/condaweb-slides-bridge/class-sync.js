(() => {
  let lastSentClassId = '';
  let pageWrite = null;
  const sendClassToPage = (classId, className, teacherId) => {
    if (!classId || String(classId) === lastSentClassId) return;
    lastSentClassId = String(classId);
    window.postMessage({
      type: 'CONDA_EXTENSION_CLASS_SELECTED',
      detail: { classId: String(classId), className: String(className || ''), teacherId: String(teacherId || '') }
    }, window.location.origin);
  };

  const readAndSendClass = () => {
    chrome.storage.local.get(['activeClassId', 'activeClassName', 'teacherId'], (data) => {
      if (chrome.runtime.lastError) return;
      sendClassToPage(data.activeClassId, data.activeClassName, data.teacherId);
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
    const teacherId = String(message.detail?.teacherId || '');
    if (!classId) return;
    chrome.storage.local.get(['activeClassId', 'activeClassName'], (current) => {
      if (chrome.runtime.lastError) return;
      if (String(current.activeClassId || '') === classId && String(current.activeClassName || '') === className) return;
      pageWrite = { classId, at: Date.now() };
      chrome.storage.local.set({ activeClassId: classId, activeClassName: className, classSelectionOrigin: 'phone', ...(teacherId ? { teacherId } : {}) });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.activeClassId) return;
    const changedClassId = String(changes.activeClassId.newValue || '');
    if (pageWrite && pageWrite.classId === changedClassId && Date.now() - pageWrite.at < 2000) {
      pageWrite = null;
      lastSentClassId = changedClassId;
      return;
    }
    readAndSendClass();
  });
})();
