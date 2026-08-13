(function bootstrapCondaWebBridge() {
  const listeners = new Map();
  let context = null;

  const emit = (type, payload) => {
    const callbacks = listeners.get(type) || [];
    callbacks.forEach((callback) => callback(payload));
  };

  const send = (type, payload = {}) => {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: 'condamine-game',
      bridgeVersion: 1,
      type,
      ...payload,
    }, '*');
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.source !== 'condamine') return;
    const dispatchGameKey = (eventType, code, key) => {
      const keyCodes = {
        ArrowLeft: 37,
        ArrowUp: 38,
        ArrowRight: 39,
        ArrowDown: 40,
        Enter: 13,
        Space: 32,
        KeyZ: 90,
        KeyX: 88,
      };
      const keyCode = keyCodes[code] || 0;
      const keyboardEvent = new KeyboardEvent(eventType, { key, code, bubbles: true, cancelable: true });
      // Phaser 3 identifie les touches par event.keyCode. Sur Chrome mobile,
      // un KeyboardEvent synthétique laisse cette valeur à 0 par défaut.
      try {
        Object.defineProperties(keyboardEvent, {
          keyCode: { get: () => keyCode },
          which: { get: () => keyCode },
          charCode: { get: () => keyCode },
        });
      } catch (_) { /* Le code moderne reste disponible en secours. */ }
      window.dispatchEvent(keyboardEvent);
    };
    if (event.data.type === 'key-state') {
      const code = String(event.data.code || 'Space');
      const key = String(event.data.key || (code === 'Space' ? ' ' : code.replace(/^Key/, '')));
      const eventType = event.data.pressed === false ? 'keyup' : 'keydown';
      dispatchGameKey(eventType, code, key);
      return;
    }
    if (event.data.type === 'simulate-key') {
      const code = String(event.data.code || 'Space');
      const key = String(event.data.key || (code === 'Space' ? ' ' : code.replace(/^Key/, '')));
      dispatchGameKey('keydown', code, key);
      setTimeout(() => dispatchGameKey('keyup', code, key), 80);
      return;
    }
    if (event.data.type === 'game-context') context = event.data.context || null;
    emit(event.data.type, event.data);
  });

  window.CondaWebGame = {
    version: 1,
    send,
    requestQuestion: (payload) => send('request-question', { payload }),
    submitAnswer: (payload) => send('submit-answer', { payload }),
    getContext: () => context,
    getLessons: () => context?.lessons || [],
    getLessonById: (lessonId) => (context?.lessons || []).find((lesson) => lesson.id === lessonId) || null,
    openLearningGuide: () => send('open-learning-guide'),
    on(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
      return () => listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback));
    },
  };

  send('game-ready', { href: window.location.href });
})();
