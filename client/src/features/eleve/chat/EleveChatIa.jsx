import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const postAction = async (studentId, sessionCode, pseudo, fields) => {
  const response = await fetch('/api/eleve/chat/didakbot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, sessionCode, pseudo, fields })
  });
  const data = await response.json();
  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error || data?.message || 'Le chat IA est momentanément indisponible.');
  }
  return data;
};

const cleanBotContent = (content) => String(content || '')
  .replace(/^(?:\s*\[[^\]]{1,1200}\]\s*:\s*)+/u, '')
  .trim();

const toMessage = (message) => {
  const role = String(message?.role || 'assistant');
  const content = String(message?.content || '');
  return {
  id: String(message?.id ?? `${role}-${message?.created_at || Math.random()}`),
  role,
  content: role === 'assistant' ? cleanBotContent(content) : content,
  pseudo: String(message?.pseudo || message?.participant_pseudo || ''),
  createdAt: message?.created_at || ''
  };
};

export default function EleveChatIa({ user }) {
  const studentId = String(user?._id || user?.id || '');
  const studentName = String(user?.name || user?.username || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Élève').trim();
  const [assignments, setAssignments] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const lastIdRef = useRef(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.sessionCode === selectedCode) || null,
    [assignments, selectedCode]
  );
  const chatTitle = selectedAssignment?.title ? `Chat IA · ${selectedAssignment.title}` : 'Chat IA';

  useEffect(() => {
    if (!studentId || user?.isVisitorPreview) {
      setAssignments([]);
      setLoadingAssignments(false);
      return undefined;
    }
    let active = true;
    const loadAssignments = async () => {
      setLoadingAssignments(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (user?.currentClass) params.set('level', user.currentClass);
        if (user?.classId) params.set('classId', user.classId);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await fetch(`/api/eleve/homework/list/${encodeURIComponent(studentId)}${query}`);
        if (!response.ok) throw new Error('Impossible de charger les devoirs.');
        const homeworks = await response.json();
        const found = (Array.isArray(homeworks) ? homeworks : []).flatMap((homework) =>
          (Array.isArray(homework?.didakbotAssignments) ? homework.didakbotAssignments : [])
            .filter((item) => String(item?.studentId || '') === studentId && item?.sessionCode)
            .map((item) => ({
              sessionCode: String(item.sessionCode),
              studentName: String(item.studentName || studentName),
              title: String(homework.title || 'Devoir'),
              homeworkId: String(homework._id || ''),
              chatbotId: String(item.chatbotId || ''),
              className: String(item.className || homework.targetLevel || '')
            }))
        );
        const unique = [...new Map(found.map((item) => [item.sessionCode, item])).values()];
        if (!active) return;
        setAssignments(unique);
        setSelectedCode((current) => unique.some((item) => item.sessionCode === current) ? current : (unique[0]?.sessionCode || ''));
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Impossible de charger les chats assignés.');
      } finally {
        if (active) setLoadingAssignments(false);
      }
    };
    loadAssignments();
    return () => { active = false; };
  }, [studentId, studentName, user?.currentClass, user?.classId, user?.isVisitorPreview]);

  const mergeMessages = useCallback((incoming) => {
    const normalized = (Array.isArray(incoming) ? incoming : []).map(toMessage).filter((message) => message.content);
    if (!normalized.length) return;
    for (const message of normalized) {
      const numericId = Number(message.id);
      if (Number.isFinite(numericId)) lastIdRef.current = Math.max(lastIdRef.current, numericId);
    }
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      normalized.forEach((message) => byId.set(message.id, message));
      return [...byId.values()].sort((a, b) => {
        const aId = Number(a.id); const bId = Number(b.id);
        return Number.isFinite(aId) && Number.isFinite(bId) ? aId - bId : 0;
      });
    });
  }, []);

  useEffect(() => {
    if (!selectedAssignment) {
      setSession(null);
      setMessages([]);
      lastIdRef.current = 0;
      return undefined;
    }
    let active = true;
    setJoining(true);
    setSession(null);
    setMessages([]);
    setError('');
    setStatus('');
    lastIdRef.current = 0;
    const join = async () => {
      try {
        const data = await postAction(studentId, selectedAssignment.sessionCode, selectedAssignment.studentName, {
          action: 'join_session',
          session_code: selectedAssignment.sessionCode,
          pseudo: selectedAssignment.studentName
        });
        if (!active) return;
        const joinedSession = data.session || {};
        setSession({
          sessionId: String(joinedSession.session_id || ''),
          chatbotId: String(joinedSession.chatbot_id || joinedSession.id || selectedAssignment.chatbotId || ''),
          participantId: String(data.participant_id || ''),
          name: String(joinedSession.name || 'Chat IA'),
          role: String(joinedSession.role || ''),
          welcomeMessage: String(joinedSession.welcome_message || '')
        });
        mergeMessages(data.messages || []);
      } catch (joinError) {
        if (active) setError(joinError?.message || 'Impossible de rejoindre ce chat.');
      } finally {
        if (active) setJoining(false);
      }
    };
    join();
    return () => { active = false; };
  }, [selectedAssignment, mergeMessages]);

  useEffect(() => {
    if (!session?.sessionId || !selectedAssignment) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const data = await postAction(studentId, selectedAssignment.sessionCode, selectedAssignment.studentName, {
          action: 'get_messages',
          session_id: session.sessionId,
          last_id: String(lastIdRef.current)
        });
        if (active) mergeMessages(data.messages || []);
      } catch (_) {}
    };
    const timer = window.setInterval(poll, 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session?.sessionId, selectedAssignment, mergeMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, joining]);

  const sendMessage = async (event) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || !session || sending) return;
    setSending(true);
    setError('');
    setDraft('');
    try {
      const data = await postAction(studentId, selectedAssignment.sessionCode, selectedAssignment.studentName, {
        action: 'send_message',
        session_id: session.sessionId,
        participant_id: session.participantId,
        chatbot_id: session.chatbotId,
        content,
        pseudo: selectedAssignment.studentName,
        is_mention: 'true'
      });
      const now = new Date().toISOString();
      const userId = String(data.user_message_id || `user-${Date.now()}`);
      const botId = String(data.bot_message_id || `assistant-${Date.now()}`);
      const userNumericId = Number(userId); const botNumericId = Number(botId);
      if (Number.isFinite(userNumericId)) lastIdRef.current = Math.max(lastIdRef.current, userNumericId);
      if (Number.isFinite(botNumericId)) lastIdRef.current = Math.max(lastIdRef.current, botNumericId);
      setMessages((current) => [
        ...current,
        { id: userId, role: 'user', content, pseudo: selectedAssignment.studentName, createdAt: now },
        { id: botId, role: 'assistant', content: cleanBotContent(data.bot_response), pseudo: 'Assistant pédagogique', createdAt: now }
      ].filter((message) => message.content));
      setStatus('Message envoyé');
      window.setTimeout(() => setStatus(''), 1800);
      inputRef.current?.focus();
    } catch (sendError) {
      setDraft(content);
      setError(sendError?.message || 'Le message n’a pas pu être envoyé.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-190px)] w-full max-w-7xl flex-col px-3 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-950 px-5 py-4 text-white shadow-lg">
        <div><div className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">CondaWeb · ChatIA</div><h1 className="mt-1 text-xl font-black sm:text-2xl">Ton espace de discussion</h1></div>
        <div className="text-right text-xs font-bold text-slate-300">Connecté comme <span className="text-white">{studentName}</span></div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-xs font-black uppercase tracking-wider text-slate-500">Mes chats de devoirs</h2>
          {loadingAssignments ? <p className="p-3 text-sm font-bold text-slate-400">Chargement…</p> : assignments.length ? (
            <div className="space-y-2">{assignments.map((item) => <button key={item.sessionCode} type="button" onClick={() => setSelectedCode(item.sessionCode)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedCode === item.sessionCode ? 'border-cyan-500 bg-cyan-50' : 'border-slate-100 hover:bg-slate-50'}`}><strong className="block text-sm text-slate-800">{item.title}</strong><span className="mt-1 block text-[11px] font-bold text-slate-500">{item.className} · Chat IA</span></button>)}</div>
          ) : <p className="p-3 text-sm font-semibold leading-relaxed text-slate-500">Aucun chat IA n’est encore associé à tes devoirs.</p>}
        </aside>

        <section className="flex min-h-[65vh] min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-violet-800 to-purple-700 px-5 py-4 text-white"><div><h2 className="text-lg font-black">{chatTitle}</h2><p className="text-xs font-semibold text-violet-100">{session?.role || 'Assistant pédagogique'}</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{selectedAssignment?.className || ''}</span></div>
          <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto bg-slate-50 p-4 sm:p-6" aria-live="polite">
            {joining && <div className="m-auto text-sm font-bold text-slate-400">Connexion au chat…</div>}
            {!joining && !session && !error && <div className="m-auto text-sm font-bold text-slate-400">Choisis un chat de devoir pour commencer.</div>}
            {session?.welcomeMessage && !messages.length && <article className="max-w-3xl self-start rounded-3xl rounded-tl-md border border-violet-200 bg-violet-100 p-5 text-sm leading-relaxed text-violet-950 shadow-sm">{session.welcomeMessage}</article>}
            {messages.map((message) => {
              const isUser = message.role === 'user';
              return <article key={message.id} className={`max-w-[92%] rounded-3xl p-4 shadow-sm sm:max-w-[80%] ${isUser ? 'self-end rounded-tr-md border border-emerald-500 bg-emerald-500 text-white' : 'self-start rounded-tl-md border border-orange-600 bg-orange-500 text-white'}`}><div className={`mb-1 text-[10px] font-black ${isUser ? 'text-emerald-50' : 'text-orange-100'}`}>{isUser ? (message.pseudo || studentName) : 'Assistant pédagogique'}</div><div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div></article>;
            })}
            {sending && <div className="self-start rounded-2xl border border-violet-200 bg-violet-100 px-4 py-3 text-xs font-bold text-violet-700 shadow-sm">Le chatbot répond…</div>}
          </div>
          {(error || status) && <div role={error ? 'alert' : 'status'} className={`px-4 py-2 text-xs font-bold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || status}</div>}
          <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4"><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} disabled={!session || joining || sending} rows={2} placeholder={session ? 'Écris ton message…' : 'Sélectionne un chat assigné'} className="min-h-12 flex-1 resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50" /><button type="submit" disabled={!session || !draft.trim() || sending} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">{sending ? '…' : 'Envoyer'}</button></form>
        </section>
      </div>
    </main>
  );
}
