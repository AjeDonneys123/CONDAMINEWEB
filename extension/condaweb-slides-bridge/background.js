// The extension is distributed to classroom computers: its safe default must
// always be the deployed application, never the developer's localhost.
const DEFAULT_CONDA_SERVER_URL = 'https://condaweb.vercel.app';

function isLegacyLocalServer(url) {
    return /^(?:http:\/\/)?(?:localhost|127\.0\.0\.1):(?:3000|5173)$/i.test(String(url || '').replace(/\/$/, ''));
}

async function resolveCondaServerUrl(data = {}) {
    const stored = String(data.condaServerUrl || '').replace(/\/$/, '');
    if (stored && data.serverConfiguredByUser) {
        return stored;
    }
    // Fast probe to detect if local CondaWeb instance is active
    try {
        const localCheck = await fetch('http://localhost:3000/api/check-deploy', {
            signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(350) : undefined
        });
        if (localCheck.ok) return 'http://localhost:3000';
    } catch (_) {}
    try {
        const local5173Check = await fetch('http://localhost:5173/api/check-deploy', {
            signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(350) : undefined
        });
        if (local5173Check.ok) return 'http://localhost:5173';
    } catch (_) {}
    if (stored) return stored;
    return DEFAULT_CONDA_SERVER_URL;
}

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

async function injectIntoSlidesTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab?.url?.includes('docs.google.com/presentation/')) return;
        await chrome.scripting.insertCSS({ target: { tabId }, files: ['overlay.css'] }).catch(() => {});
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        console.info('[CondaWeb Bridge] script vérifié dans l’onglet Slides', { tabId });
    } catch (error) {
        console.warn('[CondaWeb Bridge] injection Slides impossible', { tabId, message: error?.message || String(error) });
    }
}

// Initialisation et auto-injection dès l'installation ou la recharge
chrome.runtime.onInstalled.addListener(() => {
    console.log('[CondaWeb Bridge] Extension installée/rechargée avec succès');
    chrome.storage.local.get(['condaServerUrl', 'serverConfiguredByUser'], (res) => {
        const current = String(res.condaServerUrl || '').replace(/\/$/, '');
        // New installs must talk to the deployed CondaWeb API.  Migrate only
        // the old automatic localhost default; a teacher who deliberately
        // saved a local server in the popup keeps that choice.
        if (!current || (!res.serverConfiguredByUser && isLegacyLocalServer(current))) {
            chrome.storage.local.set({ condaServerUrl: DEFAULT_CONDA_SERVER_URL });
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

// A Chrome extension reload invalidates the old content-script context in
// already open Slides tabs. Re-inject on tab activation so the current bridge
// replaces it even when the tab itself was not reloaded.
chrome.tabs.onActivated.addListener(({ tabId }) => {
    void injectIntoSlidesTab(tabId);
});

function readExtensionStorage(keys) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(keys, (data) => {
                const error = chrome.runtime.lastError;
                if (error) reject(error);
                else resolve(data || {});
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function proxyCondaRequest(request) {
    let serverUrl = '';
    try {
        const data = await readExtensionStorage(['condaServerUrl', 'serverConfiguredByUser']);
        serverUrl = await resolveCondaServerUrl(data);
        // Persist the automatic repair, so all subsequent calls use the same
        // production endpoint even after the service worker is restarted.
        if (serverUrl !== String(data.condaServerUrl || '').replace(/\/$/, '')) {
            chrome.storage.local.set({ condaServerUrl: serverUrl });
        }
        const path = String(request?.path || '');
        if (!path.startsWith('/api/')) throw new Error('Chemin CondaWeb refusé');
        const fullUrl = `${serverUrl}${path}`;
        console.info('[CondaWeb Bridge proxy] requête', { requestId: request?.requestId, method: request?.method || 'GET', fullUrl });
        const response = await fetch(fullUrl, {
            method: request.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(request.headers || {}) },
            body: request.body ? JSON.stringify(request.body) : undefined,
            cache: 'no-store'
        });
        const responseData = await response.json().catch(() => ({}));
        console.info('[CondaWeb Bridge proxy] réponse', { requestId: request?.requestId, status: response.status, ok: response.ok });
        return { ok: response.ok, status: response.status, data: responseData, error: responseData?.error || '' };
    } catch (error) {
        console.warn('[CondaWeb Bridge proxy] échec', {
            requestId: request?.requestId,
            path: request?.path,
            serverUrl: typeof serverUrl === 'string' ? serverUrl : undefined,
            message: error?.message || String(error)
        });
        return { ok: false, status: 0, error: error?.message || String(error) };
    }
}

// Persistent ports keep each content-script request associated with a live
// service-worker connection. This avoids the one-shot response channel being
// closed while Chrome wakes or suspends the worker.
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'condaweb-api-proxy-v1') return;
    console.info('[CondaWeb Bridge proxy] port connecté');
    port.onMessage.addListener((request) => {
        if (request?.type !== 'PROXY_FETCH') return;
        void proxyCondaRequest(request).then((result) => {
            try { port.postMessage({ requestId: request.requestId, ...result }); }
            catch (error) { console.warn('[CondaWeb Bridge proxy] réponse port impossible', error?.message || String(error)); }
        });
    });
    port.onDisconnect.addListener(() => console.info('[CondaWeb Bridge proxy] port déconnecté'));
});

// Compatibility channel for an older content script that may still be open
// before the new bridge replaces it.
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
        void proxyCondaRequest(request).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
        return true; // Keep channel open for async response
    }

    return false;
});
