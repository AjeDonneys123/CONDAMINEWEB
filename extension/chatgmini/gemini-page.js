let activeRequestId = "";
let observer = null;

function announceReady() {
  chrome.runtime.sendMessage(
    {
      type: 'CHATGMINI_GEMINI_READY'
    },
    () => {
      void chrome.runtime.lastError;
    }
  );
}

function reportStatus(requestId, status, detail = '') {
  chrome.runtime.sendMessage({
    type: 'CHATGMINI_GEMINI_STATUS',
    requestId,
    status,
    detail
  }, () => {});
}

function findComposer() {
  const selectors = [
    'div[contenteditable="true"][role="textbox"]',
    'rich-textarea div[contenteditable="true"]',
    'textarea',
    '[contenteditable="true"]'
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  return null;
}

function setComposerText(node, text) {
  if (!node) return false;
  node.focus();
  if (node.tagName === 'TEXTAREA') {
    node.value = text;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  node.textContent = '';
  document.execCommand('insertText', false, text);
  if (!String(node.textContent || '').trim()) {
    node.textContent = text;
  }
  node.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function findSendButton() {
  const candidates = [
    ...document.querySelectorAll('button'),
    ...document.querySelectorAll('[role="button"]'),
    ...document.querySelectorAll('[aria-label]'),
    ...document.querySelectorAll('[data-test-id]')
  ];
  return candidates.find((btn) => {
    const text = String(btn.textContent || '').toLowerCase();
    const label = String(btn.getAttribute('aria-label') || '').toLowerCase();
    const dataTest = String(btn.getAttribute('data-test-id') || '').toLowerCase();
    const title = String(btn.getAttribute('title') || '').toLowerCase();
    const classes = String(btn.className || '').toLowerCase();
    const haystack = `${text} ${label} ${dataTest} ${title} ${classes}`;
    if (/stop|detener|arreter|arrêter/.test(haystack)) return false;
    return !btn.disabled && (
      /send|envoyer|soumettre/.test(text) ||
      /send|envoyer|soumettre/.test(label) ||
      /send|submit/.test(dataTest) ||
      /send|envoyer|soumettre/.test(title) ||
      /send|submit/.test(classes)
    );
  }) || null;
}

function findStopButton() {
  const candidates = [
    ...document.querySelectorAll('button'),
    ...document.querySelectorAll('[role="button"]'),
    ...document.querySelectorAll('[aria-label]')
  ];
  return candidates.find((btn) => {
    const text = String(btn.textContent || '').toLowerCase();
    const label = String(btn.getAttribute('aria-label') || '').toLowerCase();
    const title = String(btn.getAttribute('title') || '').toLowerCase();
    const haystack = `${text} ${label} ${title}`;
    return /stop|detener|arreter|arrêter/.test(haystack);
  }) || null;
}

function clickNode(node) {
  if (!node) return false;
  try { node.focus?.(); } catch (_) {}
  try { node.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); } catch (_) {}
  try { node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (_) {}
  try { node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); } catch (_) {}
  try { node.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch (_) {}
  try { node.click?.(); } catch (_) {}
  return true;
}

function extractLatestResponse() {
  const selectors = [
    'message-content',
    '.model-response-text',
    '[data-message-author-role="model"]',
    'model-response',
    '.markdown',
    'response-container',
    'model-response .markdown',
    '[data-test-id="conversation-turn-model"]',
    '[class*="model-response"]',
    '[class*="response-content"]',
    '[class*="markdown"]'
  ];
  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)];
    const texts = nodes
      .map((node) => String(node.innerText || node.textContent || '').trim())
      .filter((text) => text && text.length > 20 && !/hola|por donde empezamos|crear imagen|crear musica/i.test(text));
    if (texts.length) return texts[texts.length - 1];
  }
  return '';
}

function startWatchingResponse(requestId, baselineText = '') {
  activeRequestId = requestId;
  if (observer) observer.disconnect();
  reportStatus(requestId, 'watching', 'Surveillance de la reponse demarree.');
  let lastText = String(baselineText || '').trim();
  let stableTicks = 0;
  const startedAt = Date.now();

  observer = new MutationObserver(() => {
    const next = extractLatestResponse();
    if (!next) return;
    if (next === baselineText) return;
    if (next !== lastText) {
      lastText = next;
      stableTicks = 0;
      return;
    }
    stableTicks += 1;
    if (stableTicks < 3) return;
    observer.disconnect();
    observer = null;
    reportStatus(requestId, 'response_ready', 'Reponse detectee.');
    chrome.runtime.sendMessage({
      type: 'CHATGMINI_GEMINI_RESPONSE',
      requestId,
      text: next
    }, () => {
      void chrome.runtime.lastError;
    });
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  const timeoutId = setInterval(() => {
    if (!observer) {
      clearInterval(timeoutId);
      return;
    }
    if (Date.now() - startedAt < 15000) return;
    clearInterval(timeoutId);
    observer.disconnect();
    observer = null;
    const fallback = extractLatestResponse();
    if (fallback && fallback !== baselineText) {
      reportStatus(requestId, 'response_ready', 'Reponse detectee en verification finale.');
      chrome.runtime.sendMessage({
        type: 'CHATGMINI_GEMINI_RESPONSE',
        requestId,
        text: fallback
      }, () => {
        void chrome.runtime.lastError;
      });
      return;
    }
    reportStatus(requestId, 'response_timeout', 'Aucune reponse detectee apres 15 secondes.');
  }, 1000);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'CHATGMINI_GEMINI_PING') {
    sendResponse({ ok: true, ready: true });
    return false;
  }
  if (!message || message.type !== 'CHATGMINI_GEMINI_SEND_PROMPT') return false;
  const requestId = String(message.requestId || '');
  const promptText = String(message.promptText || '');
  const composer = findComposer();
  if (!composer) {
    reportStatus(requestId, 'composer_missing', 'Composer Gemini introuvable.');
    sendResponse({ ok: false, error: 'Composer Gemini introuvable.' });
    return false;
  }
  reportStatus(requestId, 'composer_found', 'Composer Gemini trouve.');
  const baselineText = extractLatestResponse();
  setComposerText(composer, promptText);
  reportStatus(requestId, 'prompt_injected', 'Prompt injecte dans Gemini.');
  let sendAttempts = 0;
  const trySend = () => {
    sendAttempts += 1;
    const stopButton = findStopButton();
    if (stopButton) {
      if (sendAttempts === 1 || sendAttempts % 3 === 0) {
        reportStatus(requestId, 'send_wait', "Gemini n'est pas pret: reponse en cours.");
      }
      if (sendAttempts >= 45) {
        reportStatus(requestId, 'send_missing', 'Gemini est reste bloque sur une reponse en cours.');
        return;
      }
      setTimeout(trySend, 1000);
      return;
    }
    const sendButton = findSendButton();
    if (sendButton) {
      reportStatus(requestId, 'send_found', `Bouton envoyer trouve (${String(sendButton.getAttribute('aria-label') || sendButton.textContent || sendButton.tagName).trim().slice(0, 80)}).`);
      clickNode(sendButton);
    } else {
      reportStatus(requestId, 'send_missing', 'Bouton envoyer introuvable.');
    }
    try {
      composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
      composer.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      reportStatus(requestId, 'enter_sent', 'Tentative envoi clavier.');
    } catch (_) {}
    startWatchingResponse(requestId, baselineText);
  };
  setTimeout(trySend, 500);
  sendResponse({ ok: true });
  return false;
});

announceReady();
