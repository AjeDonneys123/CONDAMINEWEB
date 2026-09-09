// CondaWeb Slides Bridge - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const DEFAULT_CONDA_SERVER_URL = 'https://condaweb.vercel.app';
    const serverInput = document.getElementById('server-url');
    const classSelect = document.getElementById('class-select');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-alert-btn');
    const statusSpan = document.getElementById('conn-status');
    const pronoteSelect = document.getElementById('pronote-export-select');
    const pronoteStatus = document.getElementById('pronote-export-status');
    const pronoteImportBtn = document.getElementById('pronote-import-btn');
    let currentServerUrl = DEFAULT_CONDA_SERVER_URL;
    let pronoteExports = [];

    const setPronoteStatus = (message = '', kind = '') => {
        if (!pronoteStatus) return;
        pronoteStatus.textContent = message;
        pronoteStatus.className = `pronote-export-status ${kind}`.trim();
    };

    const loadPronoteExports = async (classId) => {
        const className = classSelect.options[classSelect.selectedIndex]?.text || 'cette classe';
        pronoteExports = [];
        setPronoteStatus(`Recherche des lots pour ${className}…`);
        while (pronoteSelect.firstChild) pronoteSelect.removeChild(pronoteSelect.firstChild);
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'Chargement des lots…';
        pronoteSelect.appendChild(empty);
        if (!classId) {
            empty.textContent = 'Choisissez une classe';
            setPronoteStatus('Choisissez la même classe que celle du contrôle préparé.', 'error');
            return;
        }
        try {
            const res = await fetch(`${currentServerUrl}/api/controls/pronote/ready?classId=${encodeURIComponent(classId)}`);
            if (!res.ok) throw new Error(`Serveur ${res.status} : lot non accessible`);
            pronoteExports = await res.json();
            while (pronoteSelect.firstChild) pronoteSelect.removeChild(pronoteSelect.firstChild);
            if (!pronoteExports.length) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'Aucun lot préparé pour cette classe';
                pronoteSelect.appendChild(option);
                setPronoteStatus(`Aucun lot pour ${className}. Vérifiez la classe et le serveur CondaWeb.`, 'error');
                return;
            }
            pronoteExports.forEach((entry, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = `${entry.export?.title || entry.title} · ${entry.export?.rows?.length || 0} notes`;
                pronoteSelect.appendChild(option);
            });
            setPronoteStatus(`${pronoteExports.length} lot(s) prêt(s) pour ${className}.`, 'ready');
        } catch (error) {
            empty.textContent = 'Lots Pronote indisponibles';
            setPronoteStatus(`${error.message}. Vérifiez que ce serveur contient le lot préparé.`, 'error');
            console.warn('[CondaWeb Bridge] import Pronote', { server: currentServerUrl, classId, className, message: error.message });
        }
    };

    // Charge la configuration stockée
    chrome.storage.local.get(['condaServerUrl', 'serverConfiguredByUser', 'activeClassId', 'activeClassName'], async (data) => {
        const storedServer = String(data.condaServerUrl || '').replace(/\/$/, '');
        const oldAutomaticLocalServer = /^(?:http:\/\/)?(?:localhost|127\.0\.0\.1):(?:3000|5173)$/i.test(storedServer);
        const currentServer = (!storedServer || (!data.serverConfiguredByUser && oldAutomaticLocalServer))
            ? DEFAULT_CONDA_SERVER_URL
            : storedServer;
        serverInput.value = currentServer;
        currentServerUrl = currentServer;
        if (currentServer !== storedServer) chrome.storage.local.set({ condaServerUrl: currentServer });

        try {
            // /api/auth/config is the stable public configuration endpoint.
            // /api/learning/classes is interpreted as a learning-module id.
            const res = await fetch(`${currentServer}/api/auth/config`);
            if (res.ok) {
                const payload = await res.json();
                const classes = Array.isArray(payload) ? payload : (payload.classrooms || []);
                while (classSelect.firstChild) classSelect.removeChild(classSelect.firstChild);
                if (Array.isArray(classes) && classes.length > 0) {
                    classes.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c._id || c.id;
                        opt.textContent = c.name || c.title || 'Classe';
                        if ((c._id || c.id) === data.activeClassId) opt.selected = true;
                        classSelect.appendChild(opt);
                    });
                    statusSpan.textContent = '';
                    const dot = document.createElement('span');
                    dot.className = 'status-dot';
                    statusSpan.appendChild(dot);
                    statusSpan.appendChild(document.createTextNode('Connecté'));
                    void loadPronoteExports(classSelect.value);
                } else {
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'Aucune classe trouvée';
                    classSelect.appendChild(opt);
                }
            } else {
                throw new Error('Erreur API');
            }
        } catch (e) {
            statusSpan.textContent = '';
            const dot = document.createElement('span');
            dot.className = 'status-dot';
            dot.style.background = '#ef4444';
            statusSpan.appendChild(dot);
            statusSpan.appendChild(document.createTextNode('Hors ligne'));

            while (classSelect.firstChild) classSelect.removeChild(classSelect.firstChild);
            const opt = document.createElement('option');
            opt.value = data.activeClassId || 'default';
            opt.textContent = data.activeClassName || 'Classe par défaut (Locale)';
            classSelect.appendChild(opt);
        }
    });

    // Enregistrement des paramètres
    saveBtn.addEventListener('click', () => {
        const condaServerUrl = serverInput.value.trim();
        const activeClassId = classSelect.value;
        const activeClassName = classSelect.options[classSelect.selectedIndex]?.text || '';

        chrome.storage.local.set({ condaServerUrl, activeClassId, activeClassName, serverConfiguredByUser: true }, () => {
            currentServerUrl = condaServerUrl.replace(/\/$/, '');
            void loadPronoteExports(activeClassId);
            saveBtn.textContent = '✓ Enregistré !';
            setTimeout(() => { saveBtn.textContent = '💾 Enregistrer les réglages'; }, 1500);
        });
    });

    classSelect.addEventListener('change', () => {
        const activeClassId = classSelect.value;
        const activeClassName = classSelect.options[classSelect.selectedIndex]?.text || '';
        chrome.storage.local.set({ activeClassId, activeClassName });
        void loadPronoteExports(activeClassId);
    });

    pronoteImportBtn.addEventListener('click', async () => {
        const selected = pronoteExports[Number(pronoteSelect.value)];
        if (!selected?.export) {
            alert('Préparez d’abord le lot depuis CondaWeb, dans Contrôles et contestations.');
            return;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url || /^chrome:\/\//.test(tab.url) || tab.url.includes('docs.google.com/presentation')) {
            alert('Ouvrez Pronote sur la grille du devoir, puis relancez cet import.');
            return;
        }
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['pronote-import.js'] });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (payload) => window.CondaWebPronoteImport?.open(payload),
                args: [selected.export]
            });
            window.close();
        } catch (error) {
            console.error('[CondaWeb Bridge] injection Pronote impossible', error);
            alert('Impossible d’ouvrir l’aperçu sur cette page Pronote. Ouvrez la grille de saisie des notes et réessayez.');
        }
    });

    // Test d'alerte sur Google Slides
    testBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('docs.google.com/presentation')) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const root = document.getElementById('condaweb-overlay-root');
                    if (root) {
                        let stack = root.querySelector('.conda-alerts-stack');
                        if (!stack) {
                            stack = document.createElement('div');
                            stack.className = 'conda-alerts-stack';
                            root.appendChild(stack);
                        }
                        const toast = document.createElement('div');
                        toast.className = 'conda-alert-toast warning';

                        const icon = document.createElement('div');
                        icon.className = 'conda-alert-icon';
                        icon.textContent = '⚠️';
                        toast.appendChild(icon);

                        const body = document.createElement('div');
                        body.className = 'conda-alert-body';

                        const title = document.createElement('strong');
                        title.textContent = 'TEST D\'AVERTISSEMENT ÉLÈVE';
                        body.appendChild(title);

                        const sub = document.createElement('span');
                        sub.textContent = 'Avertissement bavardage — Lucas';
                        body.appendChild(sub);

                        toast.appendChild(body);
                        stack.appendChild(toast);
                        setTimeout(() => toast.remove(), 4500);
                    } else {
                        alert("Ouvrez une présentation Google Slides pour voir le calque CondaWeb !");
                    }
                }
            });
        } else {
            alert("Ouvrez un onglet Google Slides pour voir l'alerte de démonstration !");
        }
    });
});
