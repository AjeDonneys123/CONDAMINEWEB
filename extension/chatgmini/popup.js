const statusEl = document.getElementById('status');

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('conda-capture', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('settings');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const setDirectory = async (handle) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const request = db.transaction('settings', 'readwrite').objectStore('settings').put(handle, 'directory');
    request.onsuccess = resolve; request.onerror = () => reject(request.error);
  });
  await chrome.storage.local.set({ condaCaptureFolderName: handle.name });
};

chrome.storage.local.get('condaCaptureFolderName', ({ condaCaptureFolderName }) => {
  if (condaCaptureFolderName) statusEl.textContent = `Dossier : ${condaCaptureFolderName}`;
});

document.getElementById('folder').addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await setDirectory(handle);
    statusEl.textContent = `Dossier : ${handle.name}`;
  } catch (error) {
    if (error?.name !== 'AbortError') statusEl.textContent = 'Impossible de mémoriser ce dossier.';
  }
});

document.getElementById('capture').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CONDA_CAPTURE_BEGIN' });
  window.close();
});
