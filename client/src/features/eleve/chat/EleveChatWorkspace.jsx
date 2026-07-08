import React, { useEffect, useRef, useState } from 'react';
import './EleveChatWorkspace.css';

const MAX_HISTORY = 12;

export default function EleveChatWorkspace({ user }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState(null);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const threadRef = useRef(null);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, pending]);

  const sendMessage = async () => {
    const text = String(input || '').trim();
    const studentId = String(user?._id || user?.id || '').trim();
    if (!text || !studentId || pending) return;

    const studentMessage = { role: 'student', text };
    const nextMessages = [...messages, studentMessage];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setPending(true);
    setStreaming(false);

    try {
      const payload = {
        studentId,
        message: text,
        history: messages.slice(-MAX_HISTORY).map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'student',
          text: String(item.text || '').slice(0, 2000)
        }))
      };
      const response = await fetch('/api/eleve/chat/message/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Erreur HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let assistantAdded = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = done ? '' : (lines.pop() || '');
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);
          if (data.error) throw new Error(data.error);
          const chunk = String(data.text || '');
          if (!chunk) continue;
          answer += chunk;
          if (!assistantAdded) {
            assistantAdded = true;
            setStreaming(true);
            setMessages((current) => [...current, { role: 'assistant', text: answer }]);
          } else {
            setMessages((current) => current.map((item, index) =>
              index === current.length - 1 && item.role === 'assistant'
                ? { ...item, text: answer }
                : item
            ));
          }
        }
        if (done) break;
      }
      if (!answer.trim()) throw new Error("L'IA n'a pas renvoye de reponse.");
    } catch (requestError) {
      setError(requestError.message || "L'IA locale est momentanement indisponible.");
    } finally {
      setPending(false);
      setStreaming(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const addDiagnosticLine = (line) => {
    setDiagnostic((current) => ({
      status: current?.status || 'running',
      lines: [...(current?.lines || []), line].slice(-80)
    }));
  };

  const runOneDiagnostic = async ({ label, url, options }) => {
    const startedAt = performance.now();
    let firstNetworkChunkMs = null;
    let firstTextMs = null;
    let events = 0;
    let textChunks = 0;
    let text = '';
    addDiagnosticLine(`▶ ${label}`);
    const response = await fetch(url, options);
    addDiagnosticLine(`  headers: ${Math.round(performance.now() - startedAt)} ms | HTTP ${response.status}`);
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      throw new Error(`${label}: HTTP ${response.status} ${body.slice(0, 120)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (value && firstNetworkChunkMs === null) {
        firstNetworkChunkMs = Math.round(performance.now() - startedAt);
        addDiagnosticLine(`  1er paquet reseau: ${firstNetworkChunkMs} ms`);
      }
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = done ? '' : (lines.pop() || '');
      for (const line of lines) {
        if (!line.trim()) continue;
        events += 1;
        const data = JSON.parse(line);
        if (data.error) throw new Error(`${label}: ${data.error}`);
        if (data.text) {
          textChunks += 1;
          text += String(data.text);
          if (firstTextMs === null) {
            firstTextMs = Math.round(performance.now() - startedAt);
            addDiagnosticLine(`  1er texte visible: ${firstTextMs} ms`);
          }
        }
        if (data.label || data.elapsedMs !== undefined) {
          addDiagnosticLine(`  event ${events}: ${data.label || 'done'} | serveur ${data.elapsedMs ?? '?'} ms`);
        }
      }
      if (done) break;
    }
    addDiagnosticLine(`✓ ${label}: ${Math.round(performance.now() - startedAt)} ms, ${events} events, ${textChunks} morceaux texte`);
    if (text) addDiagnosticLine(`  aperçu: ${text.slice(0, 120)}`);
    return { firstNetworkChunkMs, firstTextMs, events, textChunks };
  };

  const runStreamingDiagnostic = async () => {
    if (diagnosticRunning) return;
    setDiagnosticRunning(true);
    setDiagnostic({ status: 'running', lines: ['Diagnostic streaming lance...'] });
    try {
      await runOneDiagnostic({
        label: 'Test serveur pur, sans IA',
        url: '/api/eleve/chat/diagnostic/stream'
      });
      await runOneDiagnostic({
        label: 'Test Ollama reel',
        url: '/api/eleve/chat/diagnostic/ollama-stream',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        }
      });
      setDiagnostic((current) => ({
        status: 'done',
        lines: [...(current?.lines || []), '✅ Diagnostic termine. Si le test serveur pur arrive tard, le probleme vient du proxy/deploiement. Si seul Ollama arrive tard, le probleme vient du modele ou du Mac.']
      }));
    } catch (diagError) {
      setDiagnostic((current) => ({
        status: 'error',
        lines: [...(current?.lines || []), `❌ ${diagError.message || 'Diagnostic impossible.'}`]
      }));
    } finally {
      setDiagnosticRunning(false);
    }
  };

  return (
    <div className="eleve-chat-page">
      <div className="eleve-chat-shell">
        <div className="eleve-chat-head">
          <div>
            <div className="eleve-chat-kicker">IA locale active</div>
            <h2>Discussion avec Conda</h2>
          </div>
          <div className="eleve-chat-local-badge"><span /> Ollama</div>
        </div>

        <div className="eleve-chat-subtitle">
          Pose une question sur tes cours. Conda peut t&apos;expliquer et te guider sans faire le travail a ta place.
        </div>

        <div className={`eleve-chat-diagnostic ${diagnostic?.status || ''}`}>
          <div className="eleve-chat-diagnostic-head">
            <div>
              <div className="eleve-chat-diagnostic-title">Test streaming</div>
              <div className="eleve-chat-diagnostic-subtitle">
                Mesure si les morceaux arrivent vraiment au navigateur.
              </div>
            </div>
            <button
              type="button"
              className="eleve-chat-diagnostic-btn"
              onClick={runStreamingDiagnostic}
              disabled={diagnosticRunning}
            >
              {diagnosticRunning ? 'Test en cours…' : 'Tester'}
            </button>
          </div>
          {diagnostic && (
            <div className="eleve-chat-diagnostic-log">
              {diagnostic.lines.map((line, index) => (
                <div key={`${index}-${line}`} className="eleve-chat-diagnostic-line">{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="eleve-chat-thread" ref={threadRef}>
          {messages.length === 0 && (
            <div className="eleve-chat-empty">
              Bonjour {user?.firstName || ''} ! Que veux-tu comprendre aujourd&apos;hui ?
            </div>
          )}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`eleve-chat-bubble ${message.role}`}>
              <div className="eleve-chat-label">{message.role === 'assistant' ? 'Conda' : 'Toi'}</div>
              <div className="eleve-chat-text">{message.text}</div>
            </div>
          ))}
          {pending && !streaming && (
            <div className="eleve-chat-bubble assistant">
              <div className="eleve-chat-label">Conda</div>
              <div className="eleve-chat-text eleve-chat-thinking">Reflechit…</div>
            </div>
          )}
        </div>

        {error && <div className="eleve-chat-error">{error}</div>}

        <div className="eleve-chat-composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            className="eleve-chat-input"
            placeholder="Ecris ton message ici…"
            maxLength={2000}
            disabled={pending}
          />
          <button className="eleve-chat-send-btn" onClick={sendMessage} disabled={!String(input || '').trim() || pending}>
            {pending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  );
}
