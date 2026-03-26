import React, { useEffect, useMemo, useRef, useState } from 'react';
import './EleveChatWorkspace.css';

function makeRequestId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isWindowLikelyFullscreen() {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
  const domFullscreen = Boolean(document.fullscreenElement);
  const availWidthDelta = Math.abs(window.outerWidth - screen.availWidth);
  const availHeightDelta = Math.abs(window.outerHeight - screen.availHeight);
  const fullWidthDelta = Math.abs(window.outerWidth - screen.width);
  const fullHeightDelta = Math.abs(window.outerHeight - screen.height);
  return domFullscreen
    || (availWidthDelta <= 2 && availHeightDelta <= 2)
    || (fullWidthDelta <= 2 && fullHeightDelta <= 2);
}

export default function EleveChatWorkspace({ user }) {
  const [hasExtension, setHasExtension] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [pendingRequestId, setPendingRequestId] = useState('');
  const [streamingResponse, setStreamingResponse] = useState('');
  const threadRef = useRef(null);
  const pendingRequestIdRef = useRef('');

  useEffect(() => {
    pendingRequestIdRef.current = pendingRequestId;
  }, [pendingRequestId]);

  const pushSystemMessage = (text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    setMessages((prev) => [...prev, { role: 'system', text: clean }]);
  };

  const extensionHint = useMemo(() => {
    if (hasExtension) return '';
    return "L'extension ChatGmini est necessaire pour discuter avec Gemini depuis ton compte.";
  }, [hasExtension]);

  useEffect(() => {
    const detect = () => {
      const attrReady = typeof document !== 'undefined' && document.documentElement?.getAttribute('data-chatgmini-extension') === 'ready';
      setHasExtension(Boolean(attrReady));
    };
    const onMessage = (event) => {
      const data = event?.data || {};
      if (data.source !== 'chatgmini-extension') return;
      if (data.type === 'CHATGMINI_EXTENSION_READY') {
        setHasExtension(true);
        return;
      }
      if (data.type === 'CHATGMINI_CHAT_STATUS') {
        const reqId = String(data.requestId || '');
        if (pendingRequestIdRef.current && reqId && reqId !== pendingRequestIdRef.current) return;
        const detail = String(data.detail || data.status || "Etat extension recu.");
        setStatus(detail);
        pushSystemMessage(detail);
        if (/gemini_open_failed|Impossible d'ouvrir Gemini|gemini_missing|Clique sur Ouvrir Gemini|composer_missing|send_missing|response_timeout|extension_error/i.test(detail) && reqId) {
          setPendingRequestId('');
        }
        return;
      }
      if (data.type === 'CHATGMINI_CHAT_STREAM') {
        const reqId = String(data.requestId || '');
        if (pendingRequestIdRef.current && reqId && reqId !== pendingRequestIdRef.current) return;
        const text = String(data.text || '').trim();
        if (!text) return;
        setStreamingResponse(text);
        if (data.done) {
          setStatus('');
        }
        return;
      }
      if (data.type === 'CHATGMINI_CHAT_RESPONSE') {
        const reqId = String(data.requestId || '');
        if (pendingRequestIdRef.current && reqId && reqId !== pendingRequestIdRef.current) return;
        const text = String(data.text || '').trim();
        if (!text) return;
        setMessages((prev) => [...prev, { role: 'assistant', text }]);
        setStreamingResponse('');
        setStatus('');
        setPendingRequestId('');
      }
    };
    detect();
    window.addEventListener('message', onMessage);
    window.addEventListener('focus', detect);
    document.addEventListener('visibilitychange', detect);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', detect);
      document.removeEventListener('visibilitychange', detect);
    };
  }, [extensionHint]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, status, streamingResponse]);

  const sendMessage = () => {
    const text = String(input || '').trim();
    if (!text) return;
    if (pendingRequestIdRef.current) {
      pushSystemMessage("Gemini termine encore sa reponse. Attends quelques secondes avant d'envoyer un nouveau message.");
      return;
    }
    if (!hasExtension) {
      setStatus(extensionHint);
      pushSystemMessage(extensionHint);
      return;
    }
    const requestId = makeRequestId();
    setPendingRequestId(requestId);
    setStreamingResponse('');
    setMessages((prev) => [...prev, { role: 'student', text }]);
    setInput('');
    setStatus('');
    document.dispatchEvent(new CustomEvent('CHATGMINI_CHAT_RUN', {
      detail: {
        requestId,
        promptText: text,
        studentName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        className: String(user?.currentClass || '').trim()
      }
    }));
  };

  const openGemini = async () => {
    if (!hasExtension) {
      pushSystemMessage(extensionHint);
      return;
    }
    if (isWindowLikelyFullscreen()) {
      document.documentElement?.setAttribute('data-chatgmini-open-blocked', 'true');
      pushSystemMessage("Sors du plein ecran pour utiliser l'IA. Gemini ne doit pas s'ouvrir tant que la fenetre occupe tout l'ecran.");
      return;
    }
    document.documentElement?.setAttribute('data-chatgmini-open-blocked', 'false');
    pushSystemMessage('Demande d’ouverture de Gemini envoyee.');
    document.dispatchEvent(new CustomEvent('CHATGMINI_OPEN_GEMINI'));
  };

  return (
    <div className="eleve-chat-page">
      <div className="eleve-chat-shell">
        <div className="eleve-chat-head">
          <div>
            <div className="eleve-chat-kicker">Chat</div>
            <h2>Discussion avec Gemini</h2>
          </div>
          <button className="eleve-chat-open-btn" onClick={openGemini}>Ouvrir Gemini</button>
        </div>

        <div className="eleve-chat-subtitle">
          Gemini s'ouvre de facon visible. Les reponses surveillees reviennent aussi dans ce fil CondaWeb.
        </div>

        {!hasExtension && (
          <div className="eleve-chat-warning">
            <div>{extensionHint}</div>
            <a
              href="https://chromewebstore.google.com/search/gemini"
              target="_blank"
              rel="noreferrer"
              className="eleve-chat-install-link"
            >
              Installer l&apos;extension Gemini
            </a>
          </div>
        )}

        <div className="eleve-chat-thread" ref={threadRef}>
          {messages.length === 0 && (
            <div className="eleve-chat-empty">
              Commence la conversation ici. Tes messages et les reponses de Gemini apparaitront dans ce fil.
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`eleve-chat-bubble ${message.role}`}>
              <div className="eleve-chat-label">
                {message.role === 'assistant' ? 'Gemini' : message.role === 'system' ? 'Systeme' : 'Toi'}
              </div>
              <div className="eleve-chat-text">{message.text}</div>
            </div>
          ))}
          {streamingResponse && (
            <div className="eleve-chat-bubble assistant">
              <div className="eleve-chat-label">Gemini</div>
              <div className="eleve-chat-text">{streamingResponse}</div>
            </div>
          )}
        </div>

        <div className="eleve-chat-composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="eleve-chat-input"
            placeholder="Ecris ton message ici."
          />
          <button className="eleve-chat-send-btn" onClick={sendMessage} disabled={!String(input || '').trim() || !!pendingRequestId}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
