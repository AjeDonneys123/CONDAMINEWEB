// CondaWeb Slides Bridge - Content Script injecté dans Google Slides (100% Trusted Types Compliant)

(function () {
  const BRIDGE_VERSION = '1.0.34';
    // Older bridge versions stored `true` here.  Do not let that old marker
    // block an upgraded content script: it must replace the old click handler
    // without requiring the teacher to hunt for an extension reload.
    if (window.__CONDA_BRIDGE_ACTIVE__ === BRIDGE_VERSION) {
        console.log('[CondaWeb Bridge] Déjà actif sur cette page Google Slides.');
        return;
    }
    // When Chrome injects an upgraded bridge into an already-open Slides tab,
    // stop every timer/listener owned by the previous version first. Without
    // this, the old script keeps sending messages to the now-invalid extension
    // context and makes the badge appear randomly disconnected.
    try { window.__CONDA_BRIDGE_SESSION__?.dispose?.(); } catch (_) {}
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
    const dismissedPersistentNoticeIds = new Set();
    let lastScoreAlertSyncVersion = 0;
    let scoreAlertSyncVersionKnown = false;
    let lastPlanSignature = '';
    let lastLiveClassroomSignature = '';
    let badgeDismissedForPage = false;

    let currentClassroomState = null;
    let currentRemoteState = null;
    let currentSlideControl = null;
    let controlMenuOpen = false;
    let controlMenuRows = [];
    let currentSlideControlDetails = null;
    let syncInFlight = false;
    let manualConnectInFlight = false;
    let consecutiveSyncFailures = 0;
  let hasSuccessfulClassSync = false;
  let lastSuccessfulClassSyncAt = 0;
  let nextAutoConnectAt = 0;
  // A presentation opened directly in Google Slides is not necessarily linked
  // to a CondaWeb course.  Keep that state stable: retrying every second made
  // the badge jump between the dock and the top-left corner.
  let presentationAssociationMissing = false;
  let unlinkedPresentationId = '';
  let presentationAssociationNoticeLogged = false;
  let presentationAssociationBadgeShown = false;
  let bridgeStopped = false;
    let syncTimerId = null;
    let domObserver = null;
    let bridgePort = null;
    let proxyRequestSequence = 0;
    const pendingProxyRequests = new Map();
    // The classroom state contains the two critical live features: score
    // notifications and the mirrored seating plan. Keep it independent from
    // the heavier presentation/video state.
    // The bridge now polls only lightweight note/plan visibility state while
    // the plan is closed. One request per second keeps grade notices quick
    // without starving Google Slides or the phone.
    const CLASSROOM_POLL_MS = 1000;

    const bridgeSession = {
        version: BRIDGE_VERSION,
        dispose() {
            bridgeStopped = true;
            if (syncTimerId) window.clearInterval(syncTimerId);
            syncTimerId = null;
            closeBridgePort(new Error('Bridge remplacé'));
            try { domObserver?.disconnect(); } catch (_) {}
            document.removeEventListener('click', onBadgeCapture, true);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
                chrome.storage.onChanged.removeListener(onStorageChanged);
            }
        }
    };
    window.__CONDA_BRIDGE_SESSION__ = bridgeSession;

function isExtensionContextError(error) {
  return /extension context invalidated|extension runtime non disponible|message channel closed|receiving end does not exist|listener indicated an asynchronous response/i.test(String(error?.message || error || ''));
}

function isPresentationAssociationMissingError(error) {
  const message = String(error?.message || error || '').toLocaleLowerCase('fr-FR');
  return message.includes('présentation condaweb non associée')
    || message.includes('presentation condaweb non associee')
    || message.includes('ouvrez-la depuis la page cours');
}

function showPresentationUnlinkedBadge() {
  const text = 'Présentation non liée — ouvre-la depuis Cours';
  isConnected = false;
  const currentLabel = document.getElementById('conda-bridge-badge-label')?.textContent;
  if (presentationAssociationBadgeShown && currentLabel === text) return;
  presentationAssociationBadgeShown = true;
  renderBadge(false, text);
}

    function stopForExtensionReload(error) {
        if (bridgeStopped) return;
        // Chrome invalidates the old content-script world while an extension
        // reloads. This is expected, so it must not pollute the error page.
        console.info('[CondaWeb Bridge] ancien contexte arrêté après rechargement de l’extension.');
        bridgeSession.dispose();
        // The newly injected script recreates the badge and overlays.
    }

    function closeBridgePort(error) {
        const port = bridgePort;
        bridgePort = null;
        if (port) {
            try { port.disconnect(); } catch (_) {}
        }
        pendingProxyRequests.forEach(({ reject, timer }) => {
            window.clearTimeout(timer);
            reject(error);
        });
        pendingProxyRequests.clear();
    }

    function ensureBridgePort() {
        if (bridgePort) return bridgePort;
        if (bridgeStopped || typeof chrome === 'undefined' || !chrome.runtime?.id) {
            throw new Error('Extension runtime non disponible');
        }

        const port = chrome.runtime.connect({ name: 'condaweb-api-proxy-v1' });
        bridgePort = port;
        port.onMessage.addListener((response) => {
            const requestId = String(response?.requestId || '');
            const pending = pendingProxyRequests.get(requestId);
            if (!pending) return;
            pendingProxyRequests.delete(requestId);
            window.clearTimeout(pending.timer);
            if (response?.ok) pending.resolve(response.data);
            else pending.reject(new Error(response?.error || `Erreur CondaWeb HTTP ${response?.status || 'inconnue'}`));
        });
        port.onDisconnect.addListener(() => {
            if (bridgePort !== port) return;
            const error = chrome.runtime?.lastError || new Error('Port CondaWeb fermé');
            if (isExtensionContextError(error)) stopForExtensionReload(error);
            else closeBridgePort(error);
        });
        console.info('[CondaWeb Bridge] port de synchronisation ouvert');
        return port;
    }

    // Some already-open Slides tabs can still carry the click handler from an
    // older bridge version (the one that opened a prompt containing a class
    // ID). Capture the click before that handler runs. This works as soon as
    // this version is injected; it does not depend on a successful API call.
    function onBadgeCapture(event) {
        const target = event.target instanceof Element
            ? event.target.closest('#conda-bridge-badge')
            : null;
        if (!target) return;
        const dismissButton = event.target instanceof Element
            ? event.target.closest('.conda-bridge-dismiss')
            : null;
        if (dismissButton) {
            event.preventDefault();
            event.stopImmediatePropagation();
            badgeDismissedForPage = true;
            target.remove();
            console.info('[CondaWeb Bridge] badge de connexion masqué pour cette page');
            return;
        }
        // The small grip is reserved for moving the badge. It must never
        // trigger a synchronization while the teacher is positioning it.
        if (event.target instanceof Element && event.target.closest('.conda-bridge-drag-handle')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        console.info('[CondaWeb Bridge] clic badge : reconnexion demandée');
        void connectAndSynchronizeNow();
    }
    document.addEventListener('click', onBadgeCapture, true);

    const oldBadge = document.getElementById('conda-bridge-badge');
    if (oldBadge) oldBadge.onclick = null;

    function consumeScoreAlertReplay(classData, { replayOnInitial = false } = {}) {
        const scoreAlertSyncVersion = Number(classData?.scoreAlertSyncVersion || 0);
        const replayId = String(classData?.scoreAlertReplayId || '');
        const isNewReplay = !scoreAlertSyncVersionKnown
            ? replayOnInitial && scoreAlertSyncVersion > 0
            : scoreAlertSyncVersion > lastScoreAlertSyncVersion;

        if (isNewReplay && replayId) {
            displayedAlertIds.delete(replayId);
            replayableAlertIds.add(replayId);
            console.info('[CondaWeb Bridge notes] rediffusion demandée', { replayId, scoreAlertSyncVersion });
        }
        lastScoreAlertSyncVersion = Math.max(lastScoreAlertSyncVersion, scoreAlertSyncVersion);
        scoreAlertSyncVersionKnown = true;
    }

    function storeResolvedClass(classData) {
        const resolvedId = String(classData?._id || classData?.id || '');
        if (!resolvedId || resolvedId === activeClassId) return;
        const previousId = activeClassId;
        activeClassId = resolvedId;
        activeClassName = String(classData?.name || activeClassName || 'Classe active');
        console.info('[CondaWeb Bridge] classe réparée pour le tableau', { previousId, activeClassId, activeClassName });
    }

    async function fetchClassroomState({ manual = false } = {}) {
        if (!activeClassId) throw new Error('Aucune classe associée');
        const marker = manual ? `manual=${Date.now()}` : `live=${Date.now()}`;
        const name = String(activeClassName || '').trim();
        const suffix = name ? `&className=${encodeURIComponent(name)}` : '';
        const wantsPlan = currentClassroomState?.classPlanVisible === true;
        const planSuffix = wantsPlan ? '&includePlan=1' : '';
        const data = await callCondaApi(`/api/classroom/bridge-state/${encodeURIComponent(activeClassId)}?${marker}${suffix}${planSuffix}`);
        storeResolvedClass(data);
        const planSignature = `${data?._id || activeClassId}:${data?.planStudentCount || data?.planStudents?.length || 0}:${data?.layout?.cols || 0}:${data?.layout?.rows || 0}`;
        if (planSignature !== lastPlanSignature) {
            lastPlanSignature = planSignature;
            console.info('[CondaWeb Bridge plan] état reçu', {
                classId: data?._id || activeClassId,
                students: Number(data?.planStudentCount ?? data?.planStudents?.length ?? 0),
                cols: data?.layout?.cols,
                rows: data?.layout?.rows
            });
        }
        return data;
    }

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
    function onFullscreenChange() {
        if (overlayRoot) {
            const targetParent = document.fullscreenElement || document.body || document.documentElement;
            if (targetParent) targetParent.appendChild(overlayRoot);
        }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // 2. Appel sécurisé via un port persistant du service worker. Contrairement
    // à sendMessage/sendResponse, ce canal ne se ferme pas entre le fetch et sa
    // réponse quand Chrome met le worker en veille.
    function callCondaApi(path, options = {}) {
        return new Promise((resolve, reject) => {
            let requestId = '';
            if (bridgeStopped) {
                return reject(new Error('Extension runtime non disponible'));
            }
            try {
                const port = ensureBridgePort();
                requestId = `${Date.now()}-${++proxyRequestSequence}`;
                const timer = window.setTimeout(() => {
                    const pending = pendingProxyRequests.get(requestId);
                    if (!pending) return;
                    pendingProxyRequests.delete(requestId);
                    reject(new Error('Délai de réponse CondaWeb dépassé'));
                }, 15000);
                pendingProxyRequests.set(requestId, { resolve, reject, timer });
                port.postMessage({
                    type: 'PROXY_FETCH',
                    requestId,
                    path,
                    method: options.method || 'GET',
                    body: options.body
                });
            } catch (error) {
                const pending = pendingProxyRequests.get(requestId);
                if (pending) {
                    pendingProxyRequests.delete(requestId);
                    window.clearTimeout(pending.timer);
                }
                if (isExtensionContextError(error)) stopForExtensionReload(error);
                reject(error);
            }
        });
    }

    // 3. La classe n'est volontairement plus reprise depuis le stockage de
    // l'extension. Ce stockage est partagé par tous les onglets Google Slides
    // et mélangeait par exemple 5A et 5D. La page CondaWeb qui ouvre Slides
    // transmet désormais le couple précis cours + classe dans l'URL.
    function loadConfig() {
        // Kept as a no-op for older initialization code.
    }
    let currentCourseId = '';
    let currentCourseTitle = '';
    let hasAutoConnected = false;

    loadConfig();
    function onStorageChanged(changes, areaName) {
            // Intentionally ignored: a selection in the popup or another
            // Slides tab must never change this tab's classroom.
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener(onStorageChanged);
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

        const query = new URLSearchParams(window.location.search);
        return {
            presentationId,
            title,
            slideObjectId,
            bridgeCourseId: String(query.get('condaCourseId') || '').trim(),
            bridgeClassId: String(query.get('condaClassId') || '').trim()
        };
    }

    // Auto-connexion intelligente : relie automatiquement le diaporama Google au bon cours CondaWeb
async function autoConnectPresentation({ replaceClass = false, force = false } = {}) {
  const { presentationId, title, slideObjectId, bridgeCourseId, bridgeClassId } = getSlideInfo();
  if (!presentationId && !title) return false;

  // A presentation opened directly in Google Slides has no CondaWeb context.
  // Do not keep calling the API every few seconds in that case: it made the
  // connector blink and needlessly flooded the server.
  if (unlinkedPresentationId && unlinkedPresentationId !== presentationId) {
    presentationAssociationMissing = false;
    unlinkedPresentationId = '';
    presentationAssociationNoticeLogged = false;
    presentationAssociationBadgeShown = false;
    nextAutoConnectAt = 0;
  }
  if (presentationAssociationMissing
    && unlinkedPresentationId === presentationId
    && !force
    && !replaceClass) {
    showPresentationUnlinkedBadge();
    return false;
  }

  try {
            const data = await callCondaApi('/api/courses/presentation-remote/auto-connect', {
                method: 'POST',
                body: {
                    presentationId,
                    title,
                    slideIndex: 0,
                    // The Slides bridge now mirrors only plan/notes. Avoid
                    // transferring video scenes on every connection.
                    light: true,
                    // The browser tab owns this pair. It is supplied by the
                    // CondaWeb page that launched the presentation, so two
                    // classes of the same level can never be mixed.
                    courseId: bridgeCourseId,
                    classId: bridgeClassId
                }
            });
    if (data?.ok && data.courseId) {
      presentationAssociationMissing = false;
      unlinkedPresentationId = '';
      presentationAssociationNoticeLogged = false;
      presentationAssociationBadgeShown = false;
      currentCourseId = data.courseId;
                currentCourseTitle = data.title || title;
                const classChanged = Boolean(data.classId) && String(data.classId) !== activeClassId;
                if (data.classId) activeClassId = String(data.classId);
                if (data.className) activeClassName = String(data.className);
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
                return true;
            }
  } catch (e) {
    if (isPresentationAssociationMissingError(e)) {
      presentationAssociationMissing = true;
      unlinkedPresentationId = presentationId;
      // Stop periodic reconnection attempts until the page is opened from
      // CondaWeb (or the user explicitly requests a new connection).
      nextAutoConnectAt = Number.POSITIVE_INFINITY;
      if (!presentationAssociationNoticeLogged) {
        console.info('[CondaWeb Bridge] Présentation non liée à CondaWeb : ouvre-la depuis la page Cours pour connecter le plan, les alertes et les contrôles.', {
          presentationId,
          title,
        });
      }
      presentationAssociationNoticeLogged = true;
      showPresentationUnlinkedBadge();
      return false;
    }
    if (isExtensionContextError(e) || bridgeStopped) return false;
            console.warn('[CondaWeb Bridge] Auto-connect en attente…', e.message);
        }
        return false;
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

            const classData = await fetchClassroomState({ manual: true });
            currentClassroomState = classData;
            // A manual reconnect must not replay a score change from a
            // previous lesson. Only changes received after this connection
            // are shown on Slides.
            consumeScoreAlertReplay(classData, { replayOnInitial: false });
            isConnected = true;
            hasSuccessfulClassSync = true;
            consecutiveSyncFailures = 0;
            renderAllOverlays();
            console.info('[CondaWeb Bridge] synchronisation manuelle terminée', { activeClassId, currentCourseId });
        } catch (error) {
            if (isExtensionContextError(error) || bridgeStopped) return;
            isConnected = false;
            console.error('[CondaWeb Bridge] synchronisation manuelle impossible', {
                message: error?.message || String(error), activeClassId, currentCourseId
            });
            renderBadge(false, 'Connexion impossible — clique pour réessayer');
        } finally {
            manualConnectInFlight = false;
        }
    }

    // Google Slides owns media playback. The bridge deliberately does not
    // synchronize scenes or videos when the current slide changes.
    async function checkCurrentSlide() {
        const hash = window.location.hash || '';
        if (hash !== lastSeenSlideHash) {
            lastSeenSlideHash = hash;
            console.debug('[CondaWeb Bridge] slide Google détectée (média géré par Google Slides)');
        }
    }

    // Controls are opened only after an explicit teacher choice. We do not
    // persist or reload a control for a slide, so opening Slides can never
    // cause an exam to appear by itself.
    async function openSelectedControl(choice) {
        if (!currentCourseId) {
            alert('La présentation CondaWeb est encore en cours de connexion. Réessaie dans une seconde.');
            return;
        }
        try {
            if (!choice?._id) return;
            currentSlideControl = { controlId: String(choice._id), controlTitle: String(choice.title || 'Contrôle') };
            currentSlideControlDetails = choice;
            controlMenuOpen = false;
            controlMenuRows = [];
            console.info('[CondaWeb Bridge contrôle] ouverture demandée par le professeur', { courseId: currentCourseId, controlId: choice._id, title: choice.title });
            renderAllOverlays();
            void openControlWindows();
        } catch (error) {
            console.error('[CondaWeb Bridge contrôle] ouverture impossible', error?.message || String(error));
            alert('Impossible d’ouvrir ce contrôle.');
        }
    }

    async function openControlsMenu() {
        try {
            const rows = await callCondaApi('/api/controls/all');
            const classKey = String(activeClassName || '').replace(/\s/g, '').toUpperCase();
            controlMenuRows = (Array.isArray(rows) ? rows : []).filter((control) => {
                if (control?.active === false) return false;
                const targets = Array.isArray(control?.targetClassrooms) ? control.targetClassrooms : [];
                return !targets.length || targets.some((target) => String(target || '').replace(/\s/g, '').toUpperCase() === classKey);
            });
            controlMenuOpen = true;
            console.info('[CondaWeb Bridge contrôle] menu ouvert', { controls: controlMenuRows.length, className: activeClassName });
            renderAllOverlays();
        } catch (error) {
            console.error('[CondaWeb Bridge contrôle] liste impossible', error?.message || String(error));
            alert('Impossible de charger les contrôles disponibles.');
        }
    }

    async function togglePlanFromSlides() {
        if (!activeClassId) return;
        const visible = currentClassroomState?.classPlanVisible !== true;
        try {
            await callCondaApi(`/api/classroom/${encodeURIComponent(activeClassId)}/bridge-plan`, {
                method: 'PUT', body: { visible }
            });
            // Fetch immediately after opening so the complete grid is ready
            // before the next regular live poll.
            currentClassroomState = await fetchClassroomState({ manual: true });
            console.info('[CondaWeb Bridge plan] visibilité modifiée depuis Slides', { visible });
            renderAllOverlays();
        } catch (error) {
            console.error('[CondaWeb Bridge plan] modification impossible', error?.message || String(error));
        }
    }

    function getControlPublicUrl(controlId) {
        return new Promise((resolve) => {
            try {
                chrome.storage.local.get(['condaServerUrl'], ({ condaServerUrl }) => {
                    const server = String(condaServerUrl || 'https://condaweb.vercel.app');
                    const appUrl = server.replace(/:3000\/?$/, ':5173');
                    resolve(`${appUrl.replace(/\/$/, '')}/?control=${encodeURIComponent(controlId)}`);
                });
            } catch (_) { resolve(`https://condaweb.vercel.app/?control=${encodeURIComponent(controlId)}`); }
        });
    }

    async function getCurrentControlDetails() {
        if (!currentSlideControl?.controlId) return null;
        if (String(currentSlideControlDetails?._id || '') === String(currentSlideControl.controlId)) return currentSlideControlDetails;
        const rows = await callCondaApi('/api/controls/all');
        currentSlideControlDetails = (Array.isArray(rows) ? rows : [])
            .find((row) => String(row?._id || '') === String(currentSlideControl.controlId)) || null;
        return currentSlideControlDetails;
    }

    function makeFloatingControlWindow(root, className, headerText) {
        root.querySelector(`.${className}`)?.remove();
        const panel = document.createElement('section');
        panel.className = className;
        const header = document.createElement('header');
        const label = document.createElement('span');
        label.textContent = headerText;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Fermer cette fenêtre');
        // Do not let Google Slides or the draggable header consume the close
        // gesture. Pointerdown is stopped before the header starts dragging.
        close.onpointerdown = (event) => { event.stopPropagation(); };
        close.onpointerup = (event) => { event.preventDefault(); event.stopPropagation(); panel.remove(); };
        close.onclick = (event) => { event.preventDefault(); event.stopPropagation(); panel.remove(); };
        header.append(label, close);
        panel.appendChild(header);
        root.appendChild(panel);

        let dragStart = null;
        header.onpointerdown = (event) => {
            if (event.target?.closest?.('button')) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.transform = 'none';
            dragStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
            header.setPointerCapture?.(event.pointerId);
        };
        header.onpointermove = (event) => {
            if (!dragStart) return;
            panel.style.left = `${Math.max(8, dragStart.left + event.clientX - dragStart.x)}px`;
            panel.style.top = `${Math.max(8, dragStart.top + event.clientY - dragStart.y)}px`;
        };
        header.onpointerup = () => { dragStart = null; };
        header.onpointercancel = () => { dragStart = null; };
        return panel;
    }

    function fillProjectedControl(panel, control) {
        // Les mots entre guillemets servent à définir les trous côté professeur.
        // Ils ne doivent jamais révéler la réponse aux élèves au tableau.
        const publicPrompt = (value) => String(value || '')
            .replace(/["“«][^"”»]*["”»]/g, '__________')
            .replace(/\s{2,}/g, ' ')
            .trim();
        const title = document.createElement('h2');
        title.textContent = String(control?.title || currentSlideControl?.controlTitle || 'Contrôle');
        panel.appendChild(title);
        const intro = document.createElement('p');
        intro.textContent = 'Répondez sur feuille ou scannez le QR code.';
        panel.appendChild(intro);
        const questions = document.createElement('div');
        questions.className = 'conda-projected-control-questions';
        const items = Array.isArray(control?.items) ? control.items : [];
        if (!items.length) {
            const empty = document.createElement('p');
            empty.textContent = 'Le contenu du contrôle est indisponible pour le moment.';
            questions.appendChild(empty);
        }
        items.forEach((item, index) => {
            const question = document.createElement('article');
            const number = document.createElement('strong');
            number.textContent = `${index + 1}. ${String(item?.lessonTitle || 'Question')}`;
            const prompt = document.createElement('p');
            prompt.textContent = publicPrompt(item?.prompt);
            question.append(number, prompt);
            const choices = Array.isArray(item?.choices) ? item.choices : [];
            if (choices.length) {
                const list = document.createElement('ol');
                choices.forEach((choice) => {
                    const row = document.createElement('li');
                    row.textContent = String(choice || '');
                    list.appendChild(row);
                });
                question.appendChild(list);
            }
            questions.appendChild(question);
        });
        panel.appendChild(questions);
    }

    async function openControlWindows() {
        if (!currentSlideControl?.controlId) return;
        const root = ensureOverlayRoot();
        const controlPanel = makeFloatingControlWindow(root, 'conda-projected-control-window', '📝 CONTRÔLE · glisser / redimensionner');
        try {
            fillProjectedControl(controlPanel, await getCurrentControlDetails());
        } catch (error) {
            console.error('[CondaWeb Bridge contrôle] contenu impossible', error?.message || String(error));
            fillProjectedControl(controlPanel, null);
        }

        const url = await getControlPublicUrl(currentSlideControl.controlId);
        const qrPanel = makeFloatingControlWindow(root, 'conda-control-qr-window', '📱 QR DU CONTRÔLE · glisser / redimensionner');
        const title = document.createElement('strong');
        title.textContent = String(currentSlideControl.controlTitle || 'Contrôle');
        const qr = document.createElement('img');
        qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
        qr.alt = `QR code : ${currentSlideControl.controlTitle || 'Contrôle'}`;
        const note = document.createElement('small');
        note.textContent = 'Les élèves scannent ce QR ; les autres répondent sur feuille.';
        qrPanel.append(title, qr, note);
        console.info('[CondaWeb Bridge contrôle] contrôle et QR ouverts dans Slides', { controlId: currentSlideControl.controlId });
    }

    // 5. Boucle principale de synchronisation avec CondaWeb
    async function syncWithCondaWeb() {
        if (bridgeStopped || syncInFlight) return;
        syncInFlight = true;
        try {
        if (!hasAutoConnected && Date.now() >= nextAutoConnectAt) {
            const connected = await autoConnectPresentation();
            if (!connected && presentationAssociationMissing) {
                showPresentationUnlinkedBadge();
                return;
            }
            // Never hammer the API while the server is starting or waking up.
            if (!connected) nextAutoConnectAt = Date.now() + 5000;
        }

        checkCurrentSlide();

        if (!activeClassId) {
            renderBadge(false, 'En attente de classe…');
            return;
        }

        try {
            // Récupère l'état de la classe (alertes élèves, avertissements)
            const classData = await fetchClassroomState();
            consumeScoreAlertReplay(classData, { replayOnInitial: false });
            currentClassroomState = classData;
            const latestAlert = Array.isArray(classData?.activeScoreAlerts)
                ? classData.activeScoreAlerts[classData.activeScoreAlerts.length - 1]
                : null;
            const liveSignature = [
                classData?.scoreAlertSyncVersion || 0,
                latestAlert?.id || '',
                classData?.activeStudentHighlightTime || '',
                Array.isArray(classData?.activeHourWarnings) ? classData.activeHourWarnings.map((row) => row?.studentId || row?.name || '').join('|') : ''
            ].join(':');
            if (liveSignature !== lastLiveClassroomSignature) {
                lastLiveClassroomSignature = liveSignature;
                console.info('[CondaWeb Bridge direct] état reçu', {
                    classId: classData?._id || '',
                    className: classData?.name || '',
                    scoreAlertVersion: Number(classData?.scoreAlertSyncVersion || 0),
                    latestAlert,
                    highlight: classData?.activeStudentHighlight || '',
                    hourWarnings: Array.isArray(classData?.activeHourWarnings) ? classData.activeHourWarnings.length : 0
                });
            }
            isConnected = true;
            hasSuccessfulClassSync = true;
            consecutiveSyncFailures = 0;
            lastSuccessfulClassSyncAt = Date.now();
            // Les fonctions de l'onglet Classe ne dépendent pas d'un cours actif.
            isConnected = Boolean(classData?._id || classData?.id);
            // Render the plan and grade alert immediately. Media is entirely
            // handled by Google Slides and causes no bridge request.
            renderAllOverlays();

        } catch (err) {
            if (isExtensionContextError(err)) return;
            consecutiveSyncFailures += 1;
            console.warn('[CondaWeb Bridge] état de classe indisponible', {
                classId: activeClassId,
                failures: consecutiveSyncFailures,
                message: err?.message || String(err)
            });
            // A single slow request is not a real disconnection. Keep the
            // last valid state (and the green badge) for 20 seconds.
            const recentlyConnected = lastSuccessfulClassSyncAt > 0 && (Date.now() - lastSuccessfulClassSyncAt) < 20000;
            if (recentlyConnected) {
                renderBadge(true, `${currentCourseTitle || 'CondaWeb'} · reconnexion…`);
            } else if (consecutiveSyncFailures >= 3) {
                isConnected = false;
                // The class can have been deleted or replaced. Drop only the
                // automatic association and resolve it again five seconds
                // later; the teacher never has to enter an ID.
                hasAutoConnected = false;
                activeClassId = '';
                activeClassName = '';
                nextAutoConnectAt = Date.now() + 5000;
                renderBadge(false, 'Reconnexion automatique…');
            }
        }
        } finally {
            syncInFlight = false;
        }
    }

    // 6. Rendu des calques visuels sans innerHTML (conforme Trusted Types de Google Docs)
    function renderAllOverlays() {
        const root = ensureOverlayRoot();
        const displayCourse = currentCourseTitle ? (currentCourseTitle.length > 20 ? currentCourseTitle.slice(0, 18) + '…' : currentCourseTitle) : '';
        const badgeText = displayCourse ? `${displayCourse} (${activeClassName || 'Actif'})` : (activeClassName || 'CondaWeb Connecté');
  if (presentationAssociationMissing) {
    showPresentationUnlinkedBadge();
  } else {
    renderBadge(isConnected, badgeText);
  }
        renderAlerts(root);
        renderHourWarnings(root);
        // Les animations et vidéos sont désormais entièrement gérées par
        // Google Slides. L'extension ne doit jamais monter un lecteur ou
        // intercepter leur lecture : elle se limite au plan, aux contrôles
        // choisis explicitement et aux notifications de notes.
        renderClassPlanModal(root);
        renderGoogleControlTools(root);
    }

    function renderGoogleControlTools(root) {
        const existingControlCard = root.querySelector('.conda-slide-control-card');
        existingControlCard?.remove();

        let dock = root.querySelector('.conda-slide-control-dock');
        if (!dock) {
            dock = document.createElement('div');
            dock.className = 'conda-slide-control-dock';
            root.appendChild(dock);
        }

        let planButton = dock.querySelector('.conda-slide-plan-toggle');
        if (!planButton) {
            planButton = document.createElement('button');
            planButton.type = 'button';
            planButton.onclick = () => { void togglePlanFromSlides(); };
            dock.appendChild(planButton);
        }
        planButton.className = `conda-slide-plan-toggle ${currentClassroomState?.classPlanVisible === true ? 'active' : ''}`;
        planButton.textContent = currentClassroomState?.classPlanVisible === true ? '📍 PLAN ON' : '📍 PLAN';

        let addButton = dock.querySelector('.conda-slide-control-add');
        if (!addButton) {
            addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.className = 'conda-slide-control-add';
            addButton.textContent = '📝 CONTRÔLE';
            addButton.title = 'Choisir un contrôle à attacher à la diapositive Google courante';
            addButton.onclick = () => { void openControlsMenu(); };
            dock.appendChild(addButton);
        }

        const connectionBadge = root.querySelector('#conda-bridge-badge');
        if (isConnected && connectionBadge && connectionBadge.parentElement !== dock) {
            dock.appendChild(connectionBadge);
        }

        let menu = dock.querySelector('.conda-slide-control-menu');
        if (controlMenuOpen) {
            if (!menu) {
                menu = document.createElement('div');
                menu.className = 'conda-slide-control-menu';
                dock.appendChild(menu);
            }
            // Update menu contents only if needed, but for simplicity here we can rebuild the menu
            // since it's only open when the user explicitly clicks the button.
            while (menu.firstChild) menu.removeChild(menu.firstChild);
            if (!controlMenuRows.length) {
                const empty = document.createElement('span');
                empty.textContent = 'Aucun contrôle actif pour cette classe';
                menu.appendChild(empty);
            }
            controlMenuRows.forEach((control) => {
                const choice = document.createElement('button');
                choice.type = 'button';
                choice.textContent = String(control.title || 'Contrôle');
                choice.onclick = () => { void openSelectedControl(control); };
                menu.appendChild(choice);
            });
        } else if (menu) {
            menu.remove();
        }
    }

    function restoreBadgePosition(badge) {
        try {
            const position = JSON.parse(sessionStorage.getItem('condaBridgeBadgePosition') || 'null');
            if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;
            badge.style.left = `${Math.max(0, position.left)}px`;
            badge.style.top = `${Math.max(0, position.top)}px`;
        } catch (_) {
            // A malformed saved position must never prevent the bridge UI.
        }
    }

    function enableBadgeDrag(badge) {
        if (badge.dataset.dragReady === '1') return;
        badge.dataset.dragReady = '1';
        const grip = badge.querySelector('.conda-bridge-drag-handle');
        if (!grip) return;
        grip.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = badge.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            grip.setPointerCapture?.(event.pointerId);
            const move = (moveEvent) => {
                const maxLeft = Math.max(0, window.innerWidth - rect.width);
                const maxTop = Math.max(0, window.innerHeight - rect.height);
                badge.style.left = `${Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX))}px`;
                badge.style.top = `${Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY))}px`;
            };
            const finish = () => {
                window.removeEventListener('pointermove', move, true);
                window.removeEventListener('pointerup', finish, true);
                const nextRect = badge.getBoundingClientRect();
                sessionStorage.setItem('condaBridgeBadgePosition', JSON.stringify({ left: nextRect.left, top: nextRect.top }));
                console.info('[CondaWeb Bridge] badge déplacé', { left: Math.round(nextRect.left), top: Math.round(nextRect.top) });
            };
            window.addEventListener('pointermove', move, true);
            window.addEventListener('pointerup', finish, true);
        });
    }

    // Badge d'état flottant en haut à gauche (sans innerHTML)
    function renderBadge(connected, text) {
        const root = ensureOverlayRoot();
        let badge = document.getElementById('conda-bridge-badge');
        if (connected) badgeDismissedForPage = false;
        if (badgeDismissedForPage && !connected) {
            badge?.remove();
            return;
        }
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'conda-bridge-badge';
            badge.className = 'conda-bridge-badge';

            const grip = document.createElement('span');
            grip.className = 'conda-bridge-drag-handle';
            grip.title = 'Déplacer le bouton';
            grip.setAttribute('aria-label', 'Déplacer le bouton CondaWeb');
            grip.textContent = '⋮⋮';
            badge.appendChild(grip);

            const dot = document.createElement('div');
            dot.className = 'conda-bridge-dot';
            const dotColor = connected ? '#10b981' : '#ef4444';
            dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 10px ${dotColor}; flex-shrink: 0;`;
            badge.appendChild(dot);

            const label = document.createElement('span');
            label.className = 'conda-bridge-label';
            label.textContent = `⚡ ${text}`;
            badge.appendChild(label);

            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'conda-bridge-dismiss';
            dismiss.title = 'Masquer le bouton de connexion';
            dismiss.setAttribute('aria-label', 'Masquer le bouton de connexion');
            dismiss.textContent = '×';
            badge.appendChild(dismiss);
            root.appendChild(badge);
            restoreBadgePosition(badge);
            enableBadgeDrag(badge);
            console.log('[CondaWeb Bridge] ✅ Badge affiché à l\'écran (haut-gauche).');

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
        badge.classList.toggle('is-connected', Boolean(connected));
        // A failed reconnection must put the badge back in the floating area.
        // appendChild moves the existing node without creating a duplicate.
        if (!connected && badge.parentElement !== root) root.appendChild(badge);
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
        // All new actions are written into activeScoreAlerts by the server.
        // Do not rebuild alerts from legacy fields here: those fields persist
        // across reloads and were replaying old pupils such as Pedro.
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
            const hasScoreChange = Number.isFinite(Number(alert?.score)) && Number(alert?.pointsDelta || 0) !== 0;
            if (hasScoreChange) {
                const points = Number(alert.pointsDelta);
                const absolute = Math.abs(points);
                const formatted = Number.isInteger(absolute) ? String(absolute) : absolute.toFixed(1).replace('.', ',');
                title.textContent = `${alert.studentName || 'Élève'} ${points > 0 ? '+' : '−'}${formatted} point${absolute > 1 ? 's' : ''}`;
            } else {
                title.textContent = alert.type === 'highlight' ? 'ÉLÈVE APPELÉ' : (isNegative ? 'NOTE EN BAISSE' : (isWarning ? 'AVERTISSEMENT' : 'NOTE EN HAUSSE'));
            }
            body.appendChild(title);

            const sub = document.createElement('span');
            if (hasScoreChange) {
                const score = Number(alert.score);
                sub.textContent = `Nouvelle note : ${Number.isInteger(score) ? score : score.toFixed(1).replace('.', ',')} / 20`;
            } else {
                sub.textContent = alert.message || alert.studentName || '';
            }
            body.appendChild(sub);

            toast.appendChild(body);
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'conda-alert-close';
            close.textContent = '×';
            close.title = 'Fermer cette notification';
            close.setAttribute('aria-label', 'Fermer cette notification');
            close.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toast.remove();
            });
            toast.appendChild(close);
            stack.appendChild(toast);
            // Remains readable from the back of the classroom.  The alert is
            // still retained server-side for 30 seconds so a delayed bridge
            // can render it once, but this visible toast lasts ten seconds.
            window.setTimeout(() => toast.remove(), 10000);
        });
    }

    // Dettes persistantes et avertissements de l'heure (sans innerHTML)
    function renderHourWarnings(root) {
        const warnings = Array.isArray(currentClassroomState?.activeHourWarnings) ? currentClassroomState.activeHourWarnings : [];
        const debts = Array.isArray(currentClassroomState?.activePersistentDebts) ? currentClassroomState.activePersistentDebts : [];
        const notices = [
            ...debts.map((row) => ({ ...row, noticeType: row.status || 'incomplete' })),
            ...warnings.map((row) => ({ ...row, noticeType: 'warning', expiresAt: row.expiresAt || '' }))
        ].filter((row) => !dismissedPersistentNoticeIds.has(`${row.noticeType}:${row.studentId || row.name || ''}:${row.expiresAt || ''}`));
        let dock = root.querySelector('.conda-hour-warnings-dock');

        if (notices.length === 0) {
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
        title.textContent = 'À RÉGLER';
        dock.appendChild(title);
        const ul = document.createElement('ul');
        notices.forEach((row) => {
            const noticeId = `${row.noticeType}:${row.studentId || row.name || ''}:${row.expiresAt || ''}`;
            const li = document.createElement('li');
            li.className = `conda-persistent-notice ${row.noticeType}`;
            const label = document.createElement('span');
            const prefix = row.noticeType === 'punishment' ? 'Punition · ' : (row.noticeType === 'warning' ? 'Avertissement · ' : 'Travail incomplet · ');
            label.textContent = `${prefix}${row.name || row.studentName || ''}`;
            li.appendChild(label);
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.title = 'Masquer cette alerte';
            close.setAttribute('aria-label', 'Masquer cette alerte');
            close.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                dismissedPersistentNoticeIds.add(noticeId);
                renderHourWarnings(root);
            });
            li.appendChild(close);
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
            callCondaApi(`/api/classroom/${encodeURIComponent(activeClassId)}/bridge-plan`, {
                method: 'PUT',
                body: { visible: false }
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
            // Render every physical desk first. CSS Grid otherwise collapses
            // empty positions into dark gaps, making the seating plan look
            // different from the teacher's real five/six-column layout.
            for (let seatY = 0; seatY < rows; seatY += 1) {
                for (let seatX = 0; seatX < cols; seatX += 1) {
                    const emptySeat = document.createElement('div');
                    emptySeat.setAttribute('aria-label', `Place vide colonne ${seatX + 1}, rangée ${seatY + 1}`);
                    emptySeat.style.cssText = `grid-column: ${cols - seatX}; grid-row: ${rows - seatY}; padding: 10px; background: #fff; border: 2px solid #cbd5e1; border-radius: 10px; min-width: 0; box-sizing: border-box;`;
                    grid.appendChild(emptySeat);
                }
            }
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
    domObserver = new MutationObserver(() => {
        if (bridgeStopped) return;
        const root = document.getElementById('condaweb-overlay-root');
        if (!root || !document.contains(root)) {
            console.log('[CondaWeb Bridge] Restauration du calque d\'overlay détaché...');
            ensureOverlayRoot();
      if (presentationAssociationMissing) {
        showPresentationUnlinkedBadge();
      } else {
        renderBadge(isConnected, activeClassName || 'CondaWeb Connecté');
      }
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
    // The classroom call is deliberately light and guarded by syncInFlight:
    // one request at a time, every 800 ms. This makes the Google Slides board
    // react to the phone almost immediately without creating request piles.
    syncTimerId = window.setInterval(syncWithCondaWeb, CLASSROOM_POLL_MS);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        window.addEventListener('load', init);
    }
})();
