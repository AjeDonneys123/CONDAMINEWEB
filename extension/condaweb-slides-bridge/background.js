async function injectIntoSlidesTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: 'https://docs.google.com/presentation/*' });
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    await chrome.scripting.insertCSS({
                        target: { tabId: tab.id },
                        files: ['overlay.css']
                    });
                } catch (_) {}
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                } catch (_) {}
            }
        }
    } catch (e) {
        console.warn('[CondaWeb Bridge] Erreur auto-injection:', e);
    }
}

// Initialisation et auto-injection dès l'installation ou la recharge
chrome.runtime.onInstalled.addListener(() => {
    console.log('[CondaWeb Bridge] Extension installée/rechargée avec succès');
    chrome.storage.local.get(['condaServerUrl', 'activeClassId'], (res) => {
        if (!res.condaServerUrl) {
            chrome.storage.local.set({ condaServerUrl: 'http://localhost:3000' });
        }
    });
    // Injecte immédiatement dans tous les onglets Google Slides déjà ouverts !
    injectIntoSlidesTabs();
});

// Auto-injection lors de la navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.google.com/presentation/')) {
        chrome.scripting.insertCSS({ target: { tabId }, files: ['overlay.css'] }).catch(() => {});
        chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});
    }
});

// Proxy sécurisé pour contourner les blocages CORS et Mixed Content de Google Slides
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CONFIG') {
        chrome.storage.local.get(['condaServerUrl', 'activeClassId', 'activeClassName'], (data) => {
            sendResponse(data);
        });
        return true;
    }

    if (request.type === 'SET_ACTIVE_CLASS') {
        chrome.storage.local.set({
            activeClassId: request.classId,
            activeClassName: request.className
        }, () => {
            sendResponse({ ok: true });
        });
        return true;
    }

    if (request.type === 'PROXY_FETCH') {
        chrome.storage.local.get(['condaServerUrl'], async (data) => {
            const serverUrl = (data.condaServerUrl || 'http://localhost:3000').replace(/\/$/, '');
            const fullUrl = `${serverUrl}${request.path}`;
            try {
                const response = await fetch(fullUrl, {
                    method: request.method || 'GET',
                    headers: { 'Content-Type': 'application/json', ...(request.headers || {}) },
                    body: request.body ? JSON.stringify(request.body) : undefined
                });
                const responseData = await response.json().catch(() => ({}));
                sendResponse({ ok: response.ok, status: response.status, data: responseData });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        });
        return true; // Keep channel open for async response
    }

    return false;
});
