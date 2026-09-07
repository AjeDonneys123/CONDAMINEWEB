// CondaWeb Slides Bridge - Content Script injecté dans Google Slides (100% Trusted Types Compliant)

(function () {
    const BRIDGE_VERSION = '1.0.6';
    // Older bridge versions stored `true` here.  Do not let that old marker
    // block an upgraded content script: it must replace the old click handler
    // without requiring the teacher to hunt for an extension reload.
    if (window.__CONDA_BRIDGE_ACTIVE__ === BRIDGE_VERSION) {
        console.log('[CondaWeb Bridge] Déjà actif sur cette page Google Slides.');
        return;
    }
    window.__CONDA_BRIDGE_ACTIVE__ = BRIDGE_VERSION;

    console.log('[CondaWeb Bridge] 🚀 Initialisation dans Google Slides...');

    let activeClassId = '';
    let activeClassName = '';
    let isConnected = false;
    let lastSeenSlideHash = '';
    let lastHandledAnimationVersion = 0;
    let lastHandledPlayVersion = 0;
    let lastHandledPauseVersion = 0;
    let overlayRoot = null;
    const displayedAlertIds = new Set();
    const replayableAlertIds = new Set();
    let lastScoreAlertSyncVersion = 0;
    let scoreAlertSyncVersionKnown = false;

    let currentClassroomState = null;
    let currentRemoteState = null;
    let syncInFlight = false;
    let manualConnectInFlight = false;
    let consecutiveSyncFailures = 0;
    let hasSuccessfulClassSync = false;

    function resolveCurrentVideo(remoteData = currentRemoteState) {
        const remote = remoteData?.remote || {};
        if (remoteData?.currentVideo) return remoteData.currentVideo;
        if (remote?.currentVideo) return remote.currentVideo;
        const slides = Array.isArray(remoteData?.videoSlides) ? remoteData.videoSlides : [];
        const requestedNumber = Math.max(1, Number(remote.slideIndex || 0) + 1);
        let slide = slides.find((item) => Number(item?.slideNumber) === requestedNumber);
        if (!slide) {
            const configured = slides.filter((item) => Array.isArray(item?.scenes)
                && item.scenes.some((scene) => Array.isArray(scene?.sequences) && scene.sequences.length));
            if (configured.length === 1) slide = configured[0];
        }
        const scenes = Array.isArray(slide?.scenes) ? slide.scenes : [];
        const scene = scenes[Math.max(0, Math.min(scenes.length - 1, Number(remote.sceneIndex || 0)))];
        const sequences = Array.isArray(scene?.sequences) ? scene.sequences : [];
        return sequences[Math.max(0, Math.min(sequences.length - 1, Number(remote.sequenceIndex || 0)))] || null;
    }

    function sendCourseCommand(action, extra = {}) {
        if (!currentCourseId) return Promise.reject(new Error('Aucun cours CondaWeb actif'));
        return callCondaApi(`/api/courses/${currentCourseId}/presentation-remote/command`, {
            method: 'POST',
            body: { action, ...extra }
        });
    }

    function reportBufferStatus(bufferPct, isReady = false) {
        if (!currentCourseId || !currentRemoteState?.remote) return Promise.resolve();
        const remote = currentRemoteState.remote;
        return callCondaApi(`/api/courses/${currentCourseId}/presentation-remote/buffer-status`, {
            method: 'POST',
            body: {
                slideIndex: Number(remote.slideIndex || 0),
                sceneIndex: Number(remote.sceneIndex || 0),
                sequenceIndex: Number(remote.sequenceIndex || 0),
                bufferPct: Math.max(0, Math.min(100, Math.round(Number(bufferPct || 0)))),
                isReady
            }
        }).catch(() => {});
    }

    // 1. Initialiser le conteneur d'overlay (avec styles en ligne forcés)
    function ensureOverlayRoot() {
        if (!overlayRoot || !document.contains(overlayRoot)) {
            overlayRoot = document.getElementById('condaweb-overlay-root');
            if (!overlayRoot) {
                overlayRoot = document.createElement('div');
                overlayRoot.id = 'condaweb-overlay-root';
                overlayRoot.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; pointer-events: none !important; z-index: 2147483647 !important; overflow: hidden !important;';
            }
            const parent = document.fullscreenElement || document.body || document.documentElement;
            if (parent && !parent.contains(overlayRoot)) {
                parent.appendChild(overlayRoot);
            }
        }
        return overlayRoot;
    }

    // Gérer le passage en plein écran (Diaporama)
    document.addEventListener('fullscreenchange', () => {
        if (overlayRoot) {
            const targetParent = document.fullscreenElement || document.body || document.documentElement;
            if (targetParent) targetParent.appendChild(overlayRoot);
        }
    });

    // 2. Appel sécurisé via le background script (contourne Mixed Content HTTPS -> HTTP localhost)
    function callCondaApi(path, options = {}) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                return reject(new Error('Extension runtime non disponible'));
            }
            chrome.runtime.sendMessage({
                type: 'PROXY_FETCH',
                path,
                method: options.method || 'GET',
                body: options.body
            }, (response) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                if (response && response.ok) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Erreur communication CondaWeb'));
                }
            });
        });
    }

    // 3. Charger la configuration stockée
    function loadConfig() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['activeClassId', 'activeClassName'], (res) => {
                if (res.activeClassId) activeClassId = res.activeClassId;
                if (res.activeClassName) activeClassName = res.activeClassName;
            });
        }
    }
    let currentCourseId = '';
    let currentCourseTitle = '';
    let hasAutoConnected = false;

    loadConfig();
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes.activeClassId) activeClassId = String(changes.activeClassId.newValue || '');
            if (changes.activeClassName) activeClassName = String(changes.activeClassName.newValue || '');
            hasAutoConnected = false;
            syncWithCondaWeb();
        });
    }

    // Récupérer les métadonnées de la présentation Google Slides
    function getSlideInfo() {
        const pathMatch = window.location.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
        const presentationId = pathMatch ? pathMatch[1] : '';
        const titleInput = document.querySelector('.docs-title-input') || document.querySelector('[aria-label="Titre de la présentation"]');
        const title = (titleInput?.value || document.title || '')
            .replace(/\s*-\s*Google\s*(Présentations|Slides|Documentos).*/i, '')
            .trim();

        const hash = window.location.hash || '';
        const hashMatch = hash.match(/#slide=id\.([a-zA-Z0-9_-]+)/);
        const slideObjectId = hashMatch ? hashMatch[1] : '';

        return { presentationId, title, slideObjectId };
    }

    // Auto-connexion intelligente : relie automatiquement le diaporama Google au bon cours CondaWeb
    async function autoConnectPresentation({ replaceClass = false } = {}) {
        const { presentationId, title, slideObjectId } = getSlideInfo();
        if (!presentationId && !title) return;

        try {
            const data = await callCondaApi('/api/courses/presentation-remote/auto-connect', {
                method: 'POST',
                body: {
                    presentationId,
                    title,
                    slideIndex: 0,
                    // A manual reconnect must not keep a stale class stored
                    // in the extension as the source of truth.
                    classHint: replaceClass ? '' : activeClassId
                }
            });
            if (data?.ok && data.courseId) {
                currentCourseId = data.courseId;
                currentCourseTitle = data.title || title;
                if ((replaceClass || !activeClassId) && data.classId) activeClassId = String(data.classId);
                if ((replaceClass || !activeClassName) && data.className) activeClassName = String(data.className);
                if (replaceClass && activeClassId && chrome?.storage?.local) {
                    chrome.storage.local.set({ activeClassId, activeClassName });
                }
                isConnected = true;
                hasAutoConnected = true;

                const displayTitle = (currentCourseTitle.length > 20 ? currentCourseTitle.slice(0, 18) + '…' : currentCourseTitle);
                renderBadge(true, `${displayTitle} (${activeClassName})`);
                console.log(`[CondaWeb Bridge] 🎯 Auto-connecté au cours : "${currentCourseTitle}" pour la classe ${activeClassName}`);
                console.log('[CondaWeb Bridge Debug]', {
                    presentationId,
                    slideObjectId,
                    courseId: data.courseId,
                    classId: data.classId,
                    remoteActive: data.remote?.active,
                    slideIndex: data.remote?.slideIndex,
                    sceneIndex: data.remote?.sceneIndex,
                    sequenceIndex: data.remote?.sequenceIndex,
                    videoSlidesCount: data.videoSlides?.length || 0
                });
            }
        } catch (e) {
            console.warn('[CondaWeb Bridge] Auto-connect en attente…', e.message);
        }
    }

    // This is the explicit action behind the badge.  It does not wait for the
    // background poll: it reconnects the presentation, verifies the class and
    // sends the current Google slide to the phone immediately.
    async function connectAndSynchronizeNow() {
        if (manualConnectInFlight) return;
        manualConnectInFlight = true;
        renderBadge(false, 'Connexion et synchronisation…');
        console.info('[CondaWeb Bridge] synchronisation manuelle demandée');
        try {
            await autoConnectPresentation({ replaceClass: true });
            if (!activeClassId) throw new Error('Aucune classe associée à cette présentation');

            const classData = await callCondaApi(`/api/classroom/bridge-state/${activeClassId}?manual=${Date.now()}`);
            currentClassroomState = classData;
            const remoteData = await callCondaApi(`/api/courses/presentation-remote/active?classId=${encodeURIComponent(activeClassId)}&manual=${Date.now()}`);
            currentRemoteState = remoteData;
            currentCourseId = String(remoteData?.courseId || currentCourseId || '');
            currentCourseTitle = String(remoteData?.title || currentCourseTitle || '');

            const { slideObjectId } = getSlideInfo();
            if (currentCourseId && slideObjectId) {
                await callCondaApi(`/api/courses/${currentCourseId}/presentation-remote/sync`, {
                    method: 'POST', body: { slideObjectId }
                });
            }
            isConnected = true;
            hasSuccessfulClassSync = true;
            consecutiveSyncFailures = 0;
            renderAllOverlays();
            console.info('[CondaWeb Bridge] synchronisation manuelle terminée', { activeClassId, currentCourseId, slideObjectId });
        } catch (error) {
            isConnected = false;
            console.error('[CondaWeb Bridge] synchronisation manuelle impossible', {
                message: error?.message || String(error), activeClassId, currentCourseId
            });
            renderBadge(false, 'Connexion impossible — clique pour réessayer');
        } finally {
            manualConnectInFlight = false;
        }
    }

    // 4. Détecter la slide courante et synchroniser avec CondaWeb
    async function checkCurrentSlide() {
        const hash = window.location.hash || '';
        if (hash !== lastSeenSlideHash) {
            lastSeenSlideHash = hash;
            const match = hash.match(/#slide=id\.([a-zA-Z0-9_-]+)/);
            const slideObjectId = match ? match[1] : '';
            const courseId = currentCourseId || currentRemoteState?.courseId;
            if (slideObjectId && courseId) {
                try {
                    await callCondaApi(`/api/courses/${courseId}/presentation-remote/sync`, {
                        method: 'POST',
                        body: { slideObjectId }
                    });
                } catch (_) {}
            }
        }
    }

    // 5. Simuler les touches clavier pour faire avancer les slides et animations depuis le téléphone
    function advanceGoogleAnimation(direction) {
        const isPrev = direction === 'previous';
        const key = isPrev ? 'ArrowLeft' : 'ArrowRight';
        const keyCode = isPrev ? 37 : 39;
        const pageKey = isPrev ? 'PageUp' : 'PageDown';
        const pageKeyCode = isPrev ? 33 : 34;
        const arrowVertKey = isPrev ? 'ArrowUp' : 'ArrowDown';
        const arrowVertCode = isPrev ? 38 : 40;

        function fireKey(k, code, codeNum) {
            const eventProps = {
                key: k,
                code: code,
                keyCode: codeNum,
                which: codeNum,
                charCode: 0,
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window
            };
            const targets = [
                document.activeElement,
                document.querySelector('.punch-viewer-container'),
                document.querySelector('.punch-full-window-overlay'),
                document.querySelector('.punch-present-iframe'),
                document.querySelector('.docs-editor-container'),
                document.querySelector('.sketchy-canvas-container'),
                document.body,
                document,
                window
            ].filter(Boolean);

            targets.forEach(t => {
                try {
                    t.dispatchEvent(new KeyboardEvent('keydown', eventProps));
                    t.dispatchEvent(new KeyboardEvent('keypress', eventProps));
                    t.dispatchEvent(new KeyboardEvent('keyup', eventProps));
                } catch (_) {}
            });
        }

        // Mode diaporama / plein écran
        fireKey(key, key, keyCode);
        fireKey(pageKey, pageKey, pageKeyCode);

        // Mode édition normal : navigation par touches et par clic vignette
        fireKey(arrowVertKey, arrowVertKey, arrowVertCode);

        try {
            const filmstrip = document.querySelector('.punch-filmstrip-scroll-container') ||
                              document.querySelector('.docs-filmstrip-scroll-container') ||
                              document.querySelector('[role="listbox"]');
            if (filmstrip) {
                const currentSelected = filmstrip.querySelector('.punch-filmstrip-thumbnail-selected') ||
                                        filmstrip.querySelector('[aria-selected="true"]');
                if (currentSelected) {
                    const target = isPrev ? currentSelected.previousElementSibling : currentSelected.nextElementSibling;
                    if (target) {
                        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        target.scrollIntoView?.({ block: 'nearest' });
                    }
                }
            }
        } catch (_) {}

        console.log(`[CondaWeb Bridge] 🎮 Télécommande action : ${direction} (${key})`);
    }

    // 6. Boucle principale de synchronisation avec CondaWeb (600ms)
    async function syncWithCondaWeb() {
        if (syncInFlight) return;
        syncInFlight = true;
        try {
        if (!hasAutoConnected) {
            await autoConnectPresentation();
        }

        checkCurrentSlide();

        if (!activeClassId) {
            try {
                const data = await callCondaApi('/api/courses/presentation-remote/active');
                if (data?.remote?.classId) {
                    activeClassId = data.remote.classId;
                    activeClassName = data.remote.className || 'Classe active';
                }
            } catch (_) {}
        }

        if (!activeClassId) {
            renderBadge(false, 'En attente de classe…');
            return;
        }

        try {
            // Récupère l'état de la classe (alertes élèves, avertissements)
            const classData = await callCondaApi(`/api/classroom/bridge-state/${activeClassId}?live=${Date.now()}`);
            const scoreAlertSyncVersion = Number(classData?.scoreAlertSyncVersion || 0);
            const replayId = String(classData?.scoreAlertReplayId || '');
            if (!scoreAlertSyncVersionKnown) {
                lastScoreAlertSyncVersion = scoreAlertSyncVersion;
                scoreAlertSyncVersionKnown = true;
            } else if (scoreAlertSyncVersion > lastScoreAlertSyncVersion) {
                // Later versions are explicit teacher requests and must replay
                // even if this alert was already rendered before.
                if (replayId) {
                    displayedAlertIds.delete(replayId);
                    replayableAlertIds.add(replayId);
                    console.info('[CondaWeb Bridge notes] rediffusion demandée', { replayId, scoreAlertSyncVersion });
                }
                lastScoreAlertSyncVersion = scoreAlertSyncVersion;
            }
            currentClassroomState = classData;
            isConnected = true;
            hasSuccessfulClassSync = true;
            consecutiveSyncFailures = 0;

            // Récupère l'état de la télécommande (vidéos, commandes)
            try {
                const remoteData = await callCondaApi(`/api/courses/presentation-remote/active?classId=${encodeURIComponent(activeClassId)}&live=${Date.now()}`);
                currentRemoteState = remoteData;
                if (remoteData?.courseId) currentCourseId = remoteData.courseId;
                if (remoteData?.title) currentCourseTitle = remoteData.title;
            } catch (_) {
                // Les outils de classe continuent sans présentation active.
            }
            // Les fonctions de l'onglet Classe ne dépendent pas d'un cours actif.
            isConnected = Boolean(classData?._id || classData?.id);

            renderAllOverlays();
            handleRemoteNavigation();

        } catch (err) {
            consecutiveSyncFailures += 1;
            if (!hasSuccessfulClassSync && consecutiveSyncFailures >= 3) {
                isConnected = false;
                renderBadge(false, 'Déconnecté de CondaWeb');
            }
        }
        } finally {
            syncInFlight = false;
        }
    }

    // Gestion des commandes de télécommande reçues du téléphone
    function handleRemoteNavigation() {
        if (!currentRemoteState?.remote) return;
        const version = Number(currentRemoteState.remote.googleAnimationVersion || 0);
        if (version > lastHandledAnimationVersion) {
            lastHandledAnimationVersion = version;
            const direction = currentRemoteState.remote.googleAnimationDirection === 'previous' ? 'previous' : 'next';
            advanceGoogleAnimation(direction);
        }
    }

    // 7. Rendu des calques visuels sans innerHTML (conforme Trusted Types de Google Docs)
    function renderAllOverlays() {
        const root = ensureOverlayRoot();
        const displayCourse = currentCourseTitle ? (currentCourseTitle.length > 20 ? currentCourseTitle.slice(0, 18) + '…' : currentCourseTitle) : '';
        const badgeText = displayCourse ? `${displayCourse} (${activeClassName || 'Actif'})` : (activeClassName || 'CondaWeb Connecté');
        renderBadge(isConnected, badgeText);
        renderAlerts(root);
        renderHourWarnings(root);
        renderVideoModal(root);
        renderClassPlanModal(root);
    }

    // Badge d'état dans l'angle bas-droite (sans innerHTML)
    function renderBadge(connected, text) {
        const root = ensureOverlayRoot();
        let badge = document.getElementById('conda-bridge-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'conda-bridge-badge';
            badge.className = 'conda-bridge-badge';
            badge.style.cssText = 'position: fixed !important; bottom: 24px !important; right: 80px !important; z-index: 2147483647 !important; pointer-events: auto !important; display: flex !important; align-items: center !important; gap: 8px !important; padding: 10px 18px !important; background: #0f172a !important; border: 2px solid #7c3aed !important; border-radius: 999px !important; color: #ffffff !important; font-size: 13px !important; font-weight: 800 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(124,58,237,0.5) !important; cursor: pointer !important; user-select: none !important;';

            const dot = document.createElement('div');
            dot.className = 'conda-bridge-dot';
            dot.style.cssText = 'width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; flex-shrink: 0;';
            badge.appendChild(dot);

            const label = document.createElement('span');
            label.className = 'conda-bridge-label';
            label.textContent = `⚡ ${text}`;
            badge.appendChild(label);
            root.appendChild(badge);
            console.log('[CondaWeb Bridge] ✅ Badge affiché à l\'écran (bas-droite).');

        } else {
            const dot = badge.querySelector('.conda-bridge-dot');
            if (dot) {
                dot.style.background = connected ? '#10b981' : '#ef4444';
                dot.style.boxShadow = connected ? '0 0 10px #10b981' : '0 0 10px #ef4444';
            }
            const label = badge.querySelector('.conda-bridge-label');
            if (label) {
                label.textContent = `⚡ ${text}`;
            }
        }
        // Set this on every render.  This deliberately overwrites the prompt
        // handler left by old bridge versions already present in the tab.
        badge.onclick = () => { void connectAndSynchronizeNow(); };
    }

    // Alertes élèves (sans innerHTML)
    function renderAlerts(root) {
        let stack = root.querySelector('.conda-alerts-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'conda-alerts-stack';
            root.appendChild(stack);
        }
        const alerts = Array.isArray(currentClassroomState?.activeScoreAlerts)
            ? [...currentClassroomState.activeScoreAlerts]
            : [];
        const fallbackMessage = String(currentClassroomState?.activeStudentBonusAlert || '').trim();
        const fallbackTime = currentClassroomState?.activeStudentBonusAlertTime;
        if (fallbackMessage && fallbackTime && !alerts.some((row) => String(row?.message || '') === fallbackMessage && String(row?.createdAt || '') === String(fallbackTime))) {
            alerts.push({ id: `bonus-${fallbackTime}`, message: fallbackMessage, createdAt: fallbackTime });
        }
        const highlightMessage = String(currentClassroomState?.activeStudentHighlight || '').trim();
        const highlightTime = currentClassroomState?.activeStudentHighlightTime;
        if (highlightMessage && highlightTime) {
            alerts.push({ id: `highlight-${highlightTime}`, message: highlightMessage, createdAt: highlightTime, type: 'highlight' });
        }
        const now = Date.now();
        alerts.forEach((alert, index) => {
            const createdAt = new Date(alert?.createdAt || 0).getTime();
            const alertId = String(alert?.id || `${createdAt}-${alert?.message || index}`);
            // A bridge poll can be delayed by Google Slides or by a slow
            // connection.  Five seconds made alerts disappear before their
            // first render.  Keep score changes readable for thirty seconds.
            const isExplicitReplay = replayableAlertIds.has(alertId);
            if (displayedAlertIds.has(alertId) || !createdAt || (!isExplicitReplay && Math.abs(now - createdAt) > 30000)) return;
            displayedAlertIds.add(alertId);
            replayableAlertIds.delete(alertId);
            const isNegative = alert.type === 'negative' || /(?:−|-|–)0[,\.]5/.test(String(alert.message || ''));
            const isWarning = !isNegative && (alert.isPenalty || ['warning', 'highlight'].includes(alert.type) || (alert.message && alert.message.toLowerCase().includes('avertissement')));
            const toast = document.createElement('div');
            toast.className = `conda-alert-toast ${isNegative ? 'negative' : (isWarning ? 'warning' : 'positive')}`;
            toast.dataset.alertId = alertId;

            const icon = document.createElement('div');
            icon.className = 'conda-alert-icon';
            icon.textContent = isNegative ? '📉' : (isWarning ? '⚠️' : '📈');
            toast.appendChild(icon);

            const body = document.createElement('div');
            body.className = 'conda-alert-body';

            const title = document.createElement('strong');
            title.textContent = alert.type === 'highlight' ? 'ÉLÈVE APPELÉ' : (isNegative ? 'NOTE EN BAISSE' : (isWarning ? 'AVERTISSEMENT' : 'NOTE EN HAUSSE'));
            body.appendChild(title);

            const sub = document.createElement('span');
            sub.textContent = alert.message || alert.studentName || '';
            body.appendChild(sub);

            toast.appendChild(body);
            stack.appendChild(toast);
            window.setTimeout(() => toast.remove(), 3000);
        });
    }

    // Liste des avertis cette heure (sans innerHTML)
    function renderHourWarnings(root) {
        const warnings = Array.isArray(currentClassroomState?.activeHourWarnings) ? currentClassroomState.activeHourWarnings : [];
        let dock = root.querySelector('.conda-hour-warnings-dock');

        if (warnings.length === 0) {
            if (dock) dock.remove();
            return;
        }

        if (!dock) {
            dock = document.createElement('div');
            dock.className = 'conda-hour-warnings-dock';
            root.appendChild(dock);
        }

        while (dock.firstChild) {
            dock.removeChild(dock.firstChild);
        }

        const title = document.createElement('div');
        title.className = 'conda-hour-warnings-title';
        title.textContent = `⚠️ Avertis cette heure (${warnings.length})`;
        dock.appendChild(title);

        const ul = document.createElement('ul');
        warnings.forEach(w => {
            const li = document.createElement('li');
            li.textContent = w.name || w.studentName || '';
            ul.appendChild(li);
        });
        dock.appendChild(ul);
    }

    // Lecteur de vidéo / animation incrusté (sans innerHTML)
    function renderVideoModal(root) {
        const remote = currentRemoteState?.remote || {};
        const isVisible = remote.animationVisible === true;
        const isPlaying = remote.animationPlaying === true;
        const currentVideo = resolveCurrentVideo();
        let modal = root.querySelector('.conda-video-modal');

        if (!currentVideo) {
            if (modal) {
                const media = modal.querySelector('video, audio, iframe');
                try { media?.pause?.(); } catch (_) {}
                if (media?.tagName === 'IFRAME') media.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                modal.remove();
            }
            return;
        }

        const videoKey = String(currentVideo.id || currentVideo.url || `${currentVideo.name || ''}:${currentVideo.startSec || 0}:${currentVideo.endSec || 0}`);
        const mustBuild = !modal || modal.dataset.videoKey !== videoKey;
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'conda-video-modal';
            root.appendChild(modal);
        }
        // Garder le média monté et préchargé même quand l'animation est cachée.
        // Le téléphone reçoit ainsi l'état prêt avant le premier appui sur Lecture.
        modal.style.display = isVisible ? 'flex' : 'none';
        if (mustBuild) {
            modal.dataset.videoKey = videoKey;
            delete modal.dataset.finished;
            while (modal.firstChild) modal.removeChild(modal.firstChild);
            const isYoutube = currentVideo.sourceType === 'youtube' || /youtu(?:\.be|be\.com)/i.test(String(currentVideo.url || ''));
            const isAudio = String(currentVideo.sourceType || '').toLowerCase() === 'audio'
                || String(currentVideo.mimeType || '').toLowerCase().startsWith('audio/')
                || /\.(mp3|m4a|aac|wav|ogg|oga|flac)(?:[?#].*)?$/i.test(String(currentVideo.url || ''));
            const header = document.createElement('div');
            header.className = 'conda-video-modal-header';
            const title = document.createElement('span');
            title.textContent = `${isAudio ? '🎵' : '🎬'} ${currentVideo.title || currentVideo.name || 'Animation CondaWeb'}`;
            header.appendChild(title);
            const closeBtn = document.createElement('button');
            closeBtn.className = 'conda-video-modal-close';
            closeBtn.type = 'button';
            closeBtn.textContent = '×';
            closeBtn.onclick = () => {
                modal.remove();
                sendCourseCommand('animation_hide').catch(() => {});
            };
            header.appendChild(closeBtn);
            modal.appendChild(header);

            if (isYoutube) {
                let id = '';
                try {
                    const url = new URL(currentVideo.url);
                    id = url.hostname.includes('youtu.be') ? url.pathname.slice(1) : (url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || '');
                } catch (_) {}
                const start = Math.max(0, Math.floor(Number(currentVideo.startSec || 0)));
                const end = Math.max(0, Math.floor(Number(currentVideo.endSec || 0)));
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1&controls=0&rel=0&playsinline=1&autoplay=${isPlaying ? 1 : 0}&start=${start}${end ? `&end=${end}` : ''}`;
                iframe.allow = 'autoplay; fullscreen';
                iframe.style.cssText = 'flex: 1; width: 100%; height: calc(100% - 40px); border: none;';
                iframe.addEventListener('load', () => {
                    reportBufferStatus(100, true);
                    iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoKey }), '*');
                    if (!isPlaying) {
                        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
                    }
                }, { once: true });
                modal.appendChild(iframe);
            } else {
                const media = document.createElement(isAudio ? 'audio' : 'video');
                media.src = currentVideo.url;
                media.autoplay = isPlaying;
                media.controls = false;
                media.preload = 'auto';
                if (!isAudio) media.playsInline = true;
                media.style.cssText = 'flex: 1; width: 100%; height: calc(100% - 40px); border: none; object-fit: contain;';
                media.addEventListener('loadedmetadata', () => {
                    media.currentTime = Math.max(0, Number(currentVideo.startSec || 0));
                    reportBufferStatus(25, false);
                });
                media.addEventListener('canplay', () => reportBufferStatus(70, true), { once: true });
                media.addEventListener('canplaythrough', () => reportBufferStatus(100, true), { once: true });
                media.addEventListener('timeupdate', () => {
                    const end = Math.max(0, Number(currentVideo.endSec || 0));
                    if (end > 0 && media.currentTime >= end && modal.dataset.finished !== '1') {
                        modal.dataset.finished = '1';
                        media.pause();
                        sendCourseCommand('sequence_finished', { closeAfterSequence: currentVideo.closeAfterSequence === true }).catch(() => {});
                    }
                });
                media.addEventListener('ended', () => {
                    if (modal.dataset.finished === '1') return;
                    modal.dataset.finished = '1';
                    sendCourseCommand('sequence_finished', { closeAfterSequence: currentVideo.closeAfterSequence === true }).catch(() => {});
                });
                modal.appendChild(media);
            }
        }

        const media = modal.querySelector('video, audio, iframe');
        if (media?.tagName === 'IFRAME') {
            const playVersion = Number(remote.playVersion || 0);
            const pauseVersion = Number(remote.pauseVersion || 0);
            if (isVisible && isPlaying && playVersion > lastHandledPlayVersion) {
                lastHandledPlayVersion = playVersion;
                media.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
            } else if (!isPlaying && pauseVersion > lastHandledPauseVersion) {
                lastHandledPauseVersion = pauseVersion;
                media.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
            }
        } else if (media) {
            if (isVisible && isPlaying && media.paused) media.play().catch(() => {});
            if ((!isVisible || !isPlaying) && !media.paused) media.pause();
        }
    }

    // L'API iframe YouTube publie son état par postMessage. Une fin de lecture
    // doit avancer d'une seule séquence, puis rester en pause jusqu'à la prochaine commande.
    window.addEventListener('message', (event) => {
        let payload = event.data;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch (_) { return; }
        }
        if (!payload || typeof payload !== 'object') return;
        const modal = ensureOverlayRoot().querySelector('.conda-video-modal');
        const iframe = modal?.querySelector('iframe');
        if (!iframe || event.source !== iframe.contentWindow) return;
        const playerState = payload.event === 'onStateChange'
            ? Number(payload.info)
            : Number(payload.info?.playerState);
        if (playerState !== 0 || modal.dataset.finished === '1') return;
        modal.dataset.finished = '1';
        const currentVideo = resolveCurrentVideo();
        sendCourseCommand('sequence_finished', {
            closeAfterSequence: currentVideo?.closeAfterSequence === true
        }).catch(() => {});
    });

    // Plan de classe miroir (sans innerHTML)
    function renderClassPlanModal(root) {
        const hasClassPlanState = currentClassroomState && Object.prototype.hasOwnProperty.call(currentClassroomState, 'classPlanVisible');
        const isPlanVisible = hasClassPlanState
            ? currentClassroomState.classPlanVisible === true
            : currentRemoteState?.remote?.classPlanVisible === true;
        let modal = root.querySelector('.conda-class-plan-modal');

        if (!isPlanVisible) {
            if (modal) modal.remove();
            return;
        }

        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'conda-class-plan-modal';
            root.appendChild(modal);
        }

        while (modal.firstChild) {
            modal.removeChild(modal.firstChild);
        }

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

        const title = document.createElement('h2');
        title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 900; color: #38bdf8;';
        title.textContent = '🗺️ PLAN DE CLASSE — VUE ÉLÈVES (MIROIR)';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Fermer (✕)';
        closeBtn.style.cssText = 'background: #1e293b; border: 1px solid #475569; color: #fff; border-radius: 8px; padding: 4px 12px; cursor: pointer; font-weight: 800;';
        closeBtn.onclick = () => {
            modal.remove();
            callCondaApi('/api/courses/presentation-remote/hide-plan', {
                method: 'POST',
                body: { classId: activeClassId }
            }).catch(() => {});
        };
        header.appendChild(closeBtn);
        modal.appendChild(header);

        const boardBar = document.createElement('div');
        boardBar.style.cssText = 'text-align: center; padding: 12px; background: rgba(0,0,0,0.4); border-radius: 10px; margin-bottom: 20px; font-weight: 800; color: #94a3b8;';
        boardBar.textContent = '⬛ TABLEAU ET BUREAU DU PROFESSEUR (DEVANT) ⬛';
        modal.appendChild(boardBar);

        const cols = Math.max(1, Number(currentClassroomState?.layout?.cols || 6));
        const planStudents = Array.isArray(currentClassroomState?.planStudents) ? currentClassroomState.planStudents : [];
        const highestSeatRow = planStudents.reduce((max, student) => Math.max(max, Number(student?.seatY) + 1 || 0), 0);
        const rows = Math.max(1, Number(currentClassroomState?.layout?.rows || 5), highestSeatRow);
        const grid = document.createElement('div');
        grid.style.cssText = `display: grid; grid-template-columns: repeat(${cols}, minmax(0, 1fr)); grid-template-rows: repeat(${rows}, minmax(70px, 1fr)); gap: 10px;`;
        modal.appendChild(grid);

        if (activeClassId) {
            const students = planStudents;
            while (grid.firstChild) grid.removeChild(grid.firstChild);
            students.filter((student) => student?.seatX !== null && student?.seatY !== null
                && Number.isFinite(Number(student.seatX)) && Number.isFinite(Number(student.seatY))).forEach(s => {
                const card = document.createElement('div');
                const seatX = Math.max(0, Math.min(cols - 1, Number(s.seatX)));
                const seatY = Math.max(0, Math.min(rows - 1, Number(s.seatY)));
                card.style.cssText = `grid-column: ${cols - seatX}; grid-row: ${rows - seatY}; padding: 10px; background: #fff; border: 2px solid #cbd5e1; border-radius: 10px; text-align: center; display: flex; flex-direction: column; justify-content: center; min-width: 0;`;
                            
                const sName = document.createElement('strong');
                sName.style.cssText = 'display: block; font-size: clamp(11px, 1.35vw, 20px); line-height: 1.1; color: #0f172a; overflow: hidden; text-overflow: ellipsis;';
                sName.textContent = String(s.nickname || s.firstName || '').trim();
                card.appendChild(sName);

                const initial = document.createElement('span');
                initial.style.cssText = 'font-size: clamp(9px, .8vw, 13px); color: #64748b; font-weight: 800;';
                initial.textContent = `${String(s.lastName || '').slice(0, 1)}.`;
                card.appendChild(initial);

                grid.appendChild(card);
            });
        }
    }

    // Démarrage immédiat
    function init() {
        console.log('[CondaWeb Bridge] ⚡ init() appelé...');
        ensureOverlayRoot();
        renderBadge(false, 'Connexion à CondaWeb…');
        syncWithCondaWeb();
    }

    // Observer pour ré-attacher si Google Slides supprime ou modifie l'arbre DOM
    const domObserver = new MutationObserver(() => {
        const root = document.getElementById('condaweb-overlay-root');
        if (!root || !document.contains(root)) {
            console.log('[CondaWeb Bridge] Restauration du calque d\'overlay détaché...');
            ensureOverlayRoot();
            renderBadge(isConnected, activeClassName || 'CondaWeb Connecté');
        }
    });

    try {
        domObserver.observe(document.documentElement, { childList: true, subtree: false });
        if (document.body) {
            domObserver.observe(document.body, { childList: true, subtree: false });
        }
    } catch (_) {}

    // Lancement immédiat et écoute des états
    init();
    // Two requests are made per cycle.  A 800 ms timer made those requests
    // pile up on a real classroom connection; the manual badge remains
    // instant and score alerts now persist long enough for this 2s heartbeat.
    setInterval(syncWithCondaWeb, 2000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        window.addEventListener('load', init);
    }
})();
