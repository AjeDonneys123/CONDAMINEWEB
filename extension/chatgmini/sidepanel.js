const statusEl = document.getElementById('status');
const responseEl = document.getElementById('response');
const openBtn = document.getElementById('openGemini');
const refreshBtn = document.getElementById('refreshState');

function renderState(state) {
  const readyLine = state?.geminiReady ? 'Gemini prêt: oui' : 'Gemini prêt: non';
  const tabLine = state?.geminiTabId ? `Gemini tabId: ${state.geminiTabId}` : 'Gemini tabId: aucun';
  const lastStatus = state?.lastStatus || 'Aucun statut récent.';
  statusEl.textContent = [readyLine, tabLine, '', lastStatus].join('\n');
  responseEl.textContent = state?.lastResponse || "Aucune reponse capturee pour l'instant.";
}

function loadState() {
  chrome.runtime.sendMessage({ type: 'CHATGMINI_PANEL_STATE' }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      statusEl.textContent = `Extension indisponible: ${runtimeError.message}`;
      return;
    }
    renderState(response || {});
  });
}

openBtn?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CHATGMINI_OPEN_GEMINI', blocked: false }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      statusEl.textContent = `Extension indisponible: ${runtimeError.message}`;
      return;
    }
    if (response?.blocked) {
      statusEl.textContent = "Ouverture bloquee: sortir du plein ecran sur la page avant.";
      return;
    }
    loadState();
  });
});

refreshBtn?.addEventListener('click', loadState);
void loadState();
