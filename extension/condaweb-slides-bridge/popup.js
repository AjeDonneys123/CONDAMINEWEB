// CondaWeb Slides Bridge - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const serverInput = document.getElementById('server-url');
    const classSelect = document.getElementById('class-select');
    const saveBtn = document.getElementById('save-btn');
    const testBtn = document.getElementById('test-alert-btn');
    const statusSpan = document.getElementById('conn-status');

    // Charge la configuration stockée
    chrome.storage.local.get(['condaServerUrl', 'activeClassId', 'activeClassName'], async (data) => {
        if (data.condaServerUrl) serverInput.value = data.condaServerUrl;
        const currentServer = (data.condaServerUrl || 'http://localhost:3000').replace(/\/$/, '');

        try {
            const res = await fetch(`${currentServer}/api/learning/classes`);
            if (res.ok) {
                const classes = await res.json();
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

        chrome.storage.local.set({ condaServerUrl, activeClassId, activeClassName }, () => {
            saveBtn.textContent = '✓ Enregistré !';
            setTimeout(() => { saveBtn.textContent = '💾 Enregistrer les réglages'; }, 1500);
        });
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
