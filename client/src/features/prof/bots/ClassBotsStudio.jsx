import React, { useEffect, useState } from 'react';

export default function ClassBotsStudio({ classId, className }) {
  const [data, setData] = useState({ creatorKey: '', bots: [] });
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [frenchBotShareLink, setFrenchBotShareLink] = useState('');
  const [researchBotShareLink, setResearchBotShareLink] = useState('');
  const [historicalCharacterBotShareLink, setHistoricalCharacterBotShareLink] = useState('');
  const [openBotId, setOpenBotId] = useState('');
  const [sessionsByBot, setSessionsByBot] = useState({});
  const [sessionsBusy, setSessionsBusy] = useState('');
  const [sessionsError, setSessionsError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState('');
  const [editingBot, setEditingBot] = useState(null);
  const [botDraft, setBotDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    let active = true;
    if (!classId) return undefined;
    fetch(`/api/classroom/bots/${encodeURIComponent(classId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Chargement des bots impossible.');
        if (active) { setData(result); setKey(result.creatorKey || ''); setFrenchBotShareLink(result.frenchHelpBotShareLink || ''); setResearchBotShareLink(result.researchBotShareLink || ''); setHistoricalCharacterBotShareLink(result.historicalCharacterBotShareLink || ''); setMessage(result.warning || ''); }
      })
      .catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [classId]);

  const saveKey = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatorKey: key })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Enregistrement impossible.');
      const refreshed = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}`, { cache: 'no-store' });
      const botsResult = await refreshed.json().catch(() => ({}));
      if (!refreshed.ok) throw new Error(botsResult.error || 'Chargement des bots impossible.');
      setData(botsResult);
      setFrenchBotShareLink(botsResult.frenchHelpBotShareLink || '');
      setResearchBotShareLink(botsResult.researchBotShareLink || '');
      setHistoricalCharacterBotShareLink(botsResult.historicalCharacterBotShareLink || '');
      setMessage(botsResult.warning || 'Clé enregistrée ; liste des bots actualisée.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const loadConversations = async (botId) => {
    setSessionsBusy(botId); setSessionsError('');
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}/${encodeURIComponent(botId)}/conversations`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Chargement des conversations impossible.');
      setSessionsByBot((current) => ({ ...current, [botId]: result.sessions || [] }));
    } catch (error) { setSessionsError(error.message); }
    finally { setSessionsBusy(''); }
  };

  const toggleConversations = async (bot) => {
    const botId = String(bot.chatbotId || bot.id || '');
    if (!botId) return;
    if (openBotId === botId) { setOpenBotId(''); return; }
    setOpenBotId(botId);
    setSessionsError('');
    if (sessionsByBot[botId]) return;
    await loadConversations(botId);
  };

  const deleteBot = async (bot) => {
    const shareLink = String(bot.shareLink || '').trim();
    const botId = String(bot.chatbotId || bot.id || '');
    if (!shareLink) { setMessage('Ce bot ne fournit pas de code de partage : suppression impossible.'); return; }
    if (!window.confirm(`Supprimer définitivement « ${bot.activityTitle || 'ce chatbot'} » de Didak’bot pour la clé de ${className} ? Cette action est irréversible et supprimera aussi ses sessions.`)) return;
    setDeleteBusy(botId); setMessage('');
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}/${encodeURIComponent(shareLink)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Didak’bot n’a pas confirmé la suppression.');
      setData((current) => ({ ...current, bots: current.bots.filter((item) => String(item.shareLink || '') !== shareLink) }));
      if (frenchBotShareLink === shareLink) setFrenchBotShareLink('');
      setSessionsByBot((current) => { const next = { ...current }; delete next[botId]; return next; });
      if (openBotId === botId) setOpenBotId('');
      setMessage('Chatbot supprimé de Didak’bot.');
    } catch (error) { setMessage(error.message); }
    finally { setDeleteBusy(''); }
  };

  const assignFrenchBot = async (shareLink) => {
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}/french-help`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareLink })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Association impossible.');
      setFrenchBotShareLink(shareLink);
      setMessage(shareLink ? 'Bot associé à l’aide au français pour cette classe.' : 'Bot français retiré.');
    } catch (error) { setMessage(error.message); }
  };

  const assignResearchBot = async (shareLink) => {
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}/research`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareLink })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Association impossible.');
      setResearchBotShareLink(shareLink);
      setMessage(shareLink ? 'Bot associé à Cyclopédia pour cette classe.' : 'Bot Cyclopédia retiré.');
    } catch (error) { setMessage(error.message); }
  };

  const assignHistoricalCharacterBot = async (shareLink) => {
    try {
      const response = await fetch(`/api/classroom/bots/${encodeURIComponent(classId)}/historical-character`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareLink })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Association impossible.');
      setHistoricalCharacterBotShareLink(shareLink);
      setMessage(shareLink ? 'Personnage historique associé à l’Atelier Recherche.' : 'Personnage historique retiré.');
    } catch (error) { setMessage(error.message); }
  };

  const openEditor = async (bot) => {
    setEditingBot(bot); setBotDraft(null); setEditError(''); setEditBusy(true);
    try {
      const shareLink = String(bot.shareLink || '').trim();
      if (!shareLink || !data.creatorKey) throw new Error('Le lien du bot ou la clé créateur de cette classe manque.');
      const response = await fetch(`https://novapeda.eu/didakbot3.php?page=create&edit=${encodeURIComponent(shareLink)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ action: 'get_chatbot', share_link: shareLink })
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) throw new Error(result?.error || result?.message || 'Didak’bot n’a pas renvoyé la configuration du chatbot.');
      let config = result.chatbot || result.bot || result.config || result.data || result;
      if (typeof config === 'string') { try { config = JSON.parse(config); } catch (_) {} }
      if (!config || typeof config !== 'object' || !['name', 'welcome_message', 'system_prompt', 'pedagogical_approach', 'behavioral_rules'].some((field) => Object.prototype.hasOwnProperty.call(config, field))) {
        throw new Error('La configuration reçue ne contient pas les champs modifiables attendus.');
      }
      setBotDraft(config);
    } catch (error) { setEditError(error.message || 'Chargement du chatbot impossible.'); }
    finally { setEditBusy(false); }
  };

  const saveBotEdits = async (event) => {
    event.preventDefault();
    if (!editingBot?.shareLink || !botDraft || !data.creatorKey) return;
    setEditBusy(true); setEditError('');
    try {
      const botConfig = { ...botDraft, user_key: data.creatorKey, share_link: editingBot.shareLink };
      const response = await fetch(`https://novapeda.eu/didakbot3.php?page=create&edit=${encodeURIComponent(editingBot.shareLink)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ action: 'save_chatbot', data: JSON.stringify(botConfig) })
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) throw new Error(result?.error || result?.message || 'Didak’bot n’a pas confirmé la modification.');
      setData((current) => ({ ...current, bots: (current.bots || []).map((item) => item.shareLink === editingBot.shareLink ? { ...item, activityTitle: botDraft.name || item.activityTitle } : item) }));
      setMessage('Chatbot modifié sur Didak’bot.'); setEditingBot(null); setBotDraft(null);
    } catch (error) { setEditError(error.message || 'Enregistrement impossible.'); }
    finally { setEditBusy(false); }
  };

  return <section className="mx-auto max-w-6xl p-6 md:p-8">
    <header className="mb-6 rounded-3xl bg-cyan-800 p-7 text-white shadow-lg">
      <h1 className="text-3xl font-black">🤖 Bots · {className || 'Classe'}</h1>
      <p className="mt-2 text-cyan-100">Tous les chatbots rattachés à la clé de cette classe apparaissent ici. Ouvre leurs sessions pour suivre les conversations.</p>
    </header>
    <form onSubmit={saveKey} className="mb-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
      <label className="mb-3 block font-black text-slate-800" htmlFor="class-didakbot-key">Clé créateur Didak’bot de {className || 'la classe'}</label>
      <div className="flex flex-wrap gap-3"><input id="class-didakbot-key" value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} autoComplete="off" className="min-w-[260px] flex-1 rounded-xl border border-cyan-200 bg-white px-4 py-3 font-mono font-bold" placeholder="Saisir la clé créateur" /><button disabled={busy} className="rounded-xl bg-cyan-700 px-6 py-3 font-black text-white disabled:opacity-50">{busy ? 'ENREGISTREMENT…' : 'ENREGISTRER LA CLÉ'}</button></div>
      {message && <p className="mt-3 text-sm font-bold text-slate-600">{message}</p>}
    </form>
    <h2 className="mb-4 text-xl font-black text-slate-800">Chatbots associés à {className || 'la classe'} <span className="text-slate-400">({data.bots?.length || 0})</span></h2>
    {!!data.bots?.length && <div className="mb-6 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-black text-violet-950">1 · 🔎 Recherche documentaire</h3><p className="mt-1 text-sm text-violet-700">Ce bot aide le groupe à construire son plan et génère les trois articles.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${researchBotShareLink ? 'bg-violet-700 text-white' : 'bg-white text-violet-500'}`}>{researchBotShareLink ? 'CONFIGURÉ' : 'À CHOISIR'}</span></div><div className="grid gap-2">{data.bots.map((bot) => <button key={`research-${bot.shareLink || bot.id}`} type="button" disabled={!bot.shareLink} onClick={() => assignResearchBot(bot.shareLink)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-black ${researchBotShareLink === bot.shareLink ? 'border-violet-700 bg-violet-700 text-white shadow-md' : 'border-violet-200 bg-white text-slate-700'}`}><span>{bot.activityTitle || 'Chatbot'}</span><span>{researchBotShareLink === bot.shareLink ? '✓ Sélectionné' : 'Choisir'}</span></button>)}</div></section><section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-black text-amber-950">2 · 🎭 Personnage historique</h3><p className="mt-1 text-sm text-amber-800">Il apparaît après quatre lignes de notes pour dialoguer avec l’élève.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${historicalCharacterBotShareLink ? 'bg-amber-600 text-white' : 'bg-white text-amber-600'}`}>{historicalCharacterBotShareLink ? 'CONFIGURÉ' : 'À CHOISIR'}</span></div><div className="grid gap-2">{data.bots.map((bot) => <button key={`character-${bot.shareLink || bot.id}`} type="button" disabled={!bot.shareLink} onClick={() => assignHistoricalCharacterBot(bot.shareLink)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-black ${historicalCharacterBotShareLink === bot.shareLink ? 'border-amber-600 bg-amber-500 text-white shadow-md' : 'border-amber-200 bg-white text-slate-700'}`}><span>{bot.activityTitle || 'Chatbot'}</span><span>{historicalCharacterBotShareLink === bot.shareLink ? '✓ Sélectionné' : 'Choisir'}</span></button>)}</div></section></div>}
    {!data.bots?.length ? <p className="rounded-2xl bg-slate-50 p-6 text-slate-500">{data.warning || (data.creatorKey ? 'Aucun chatbot trouvé pour cette clé.' : 'Enregistre la clé créateur de cette classe pour charger ses bots.')}</p> : <div className="space-y-3">{data.bots.map((bot) => { const botId = String(bot.chatbotId || bot.id || ''); const sessions = sessionsByBot[botId] || []; return <article key={botId || bot.shareLink} className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-black text-slate-800">{bot.activityTitle || 'Chatbot Didak’bot'}</h3>{bot.role && <p className="text-sm text-slate-500">{bot.role}</p>}<p className="mt-1 text-sm text-slate-500">ID {botId || '—'}{bot.shareLink ? ` · Code ${bot.shareLink}` : ''}</p></div><div className="flex flex-wrap gap-2">{bot.url && <a href={bot.url} target="_blank" rel="noreferrer" className="rounded-xl bg-cyan-700 px-4 py-2 font-bold text-white">Ouvrir le bot ↗</a>}<button type="button" onClick={() => openEditor(bot)} disabled={!bot.shareLink || editBusy || deleteBusy === botId} className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 font-bold text-indigo-800 disabled:opacity-50">✏️ Modifier</button><button type="button" onClick={() => toggleConversations(bot)} disabled={sessionsBusy === botId || deleteBusy === botId} className="rounded-xl border border-cyan-300 bg-white px-4 py-2 font-bold text-cyan-800 disabled:opacity-50">{sessionsBusy === botId ? 'CHARGEMENT…' : openBotId === botId ? 'Masquer les conversations' : '💬 Conversations'}</button><button type="button" onClick={() => deleteBot(bot)} disabled={deleteBusy === botId} aria-label={`Supprimer ${bot.activityTitle || 'le chatbot'}`} title="Supprimer ce chatbot de Didak’bot" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 font-black text-red-700 hover:bg-red-100 disabled:opacity-50">{deleteBusy === botId ? 'SUPPRESSION…' : '× Supprimer'}</button></div><div className="mt-4"><button type="button" onClick={() => assignFrenchBot(bot.shareLink)} disabled={!bot.shareLink || deleteBusy === botId} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">{frenchBotShareLink === bot.shareLink ? "✓ Bot d’aide au français" : "Associer comme bot d’aide au français"}</button></div></div>{openBotId === botId && <div className="mt-5 border-t border-slate-100 pt-4">{sessionsBusy === botId ? <p className="text-sm text-slate-500">Chargement des sessions…</p> : sessionsError ? <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-red-600"><span>{sessionsError}</span><button type="button" onClick={() => { setSessionsByBot((current) => { const next = { ...current }; delete next[botId]; return next; }); void loadConversations(botId); }} className="rounded-lg border border-red-200 px-3 py-2">Réessayer</button></div> : !sessions.length ? <p className="text-sm text-slate-500">Aucune session pour ce bot.</p> : <><p className="mb-3 text-sm font-bold text-slate-600">{sessions.length} session{sessions.length > 1 ? 's' : ''}</p><div className="space-y-2">{sessions.map((session) => { const hasMessages = Number(session.messageCount) > 0; return <div key={session.id || session.sessionCode} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${hasMessages ? 'border-orange-300 bg-orange-100' : 'border-slate-100 bg-slate-50'}`}><div><b className="text-slate-800">{session.pseudo || `Session ${session.sessionCode}`}</b><p className="text-xs text-slate-600">Code {session.sessionCode} · {session.messageCount} message{session.messageCount === 1 ? '' : 's'}</p></div>{session.url && <a href={session.url} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white">Ouvrir la conversation ↗</a>}</div>; })}</div></>}</div>}</article>; })}</div>}
    {editingBot && <div className="fixed inset-0 z-[30000] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" onClick={() => !editBusy && setEditingBot(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="edit-didakbot-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 bg-indigo-800 px-5 py-4 text-white"><div><h2 id="edit-didakbot-title" className="text-xl font-black">Modifier · {editingBot.activityTitle || 'Chatbot'}</h2><p className="text-sm text-indigo-100">Les changements seront enregistrés sur ce chatbot Didak’bot.</p></div><button type="button" className="rounded-lg px-3 py-2 text-2xl" onClick={() => setEditingBot(null)} disabled={editBusy} aria-label="Fermer">×</button></header>
        {editBusy && !botDraft ? <p className="p-8 text-center font-bold text-slate-600">Chargement de la configuration…</p> : botDraft && <form onSubmit={saveBotEdits} className="min-h-0 space-y-4 overflow-y-auto p-5">
          {editError && <p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{editError}</p>}
          {[
            ['name', 'Nom du chatbot'], ['language', 'Langue'], ['role', 'Rôle'], ['expertise_domain', 'Domaine d’expertise'], ['image_url', 'URL de l’image'],
            ['welcome_message', 'Message de bienvenue'], ['system_prompt', 'Instructions du chatbot'], ['pedagogical_approach', 'Approche pédagogique'], ['behavioral_rules', 'Règles comportementales'], ['knowledge_limits', 'Limites et cadre de connaissances'], ['context_material', 'Documents / contexte de référence'], ['max_sessions', 'Nombre maximum de sessions']
          ].map(([field, label]) => <label key={field} className="block text-sm font-bold text-slate-700">{label}
            {['welcome_message', 'system_prompt', 'pedagogical_approach', 'behavioral_rules', 'knowledge_limits', 'context_material'].includes(field)
              ? <textarea rows={field === 'system_prompt' || field === 'context_material' ? 5 : 3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-medium" value={botDraft[field] || ''} onChange={(event) => setBotDraft((current) => ({ ...current, [field]: event.target.value }))} />
              : <input type={field === 'max_sessions' ? 'number' : 'text'} min={field === 'max_sessions' ? 1 : undefined} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-medium" value={botDraft[field] ?? ''} onChange={(event) => setBotDraft((current) => ({ ...current, [field]: event.target.value }))} />}
          </label>)}
          <label className="block text-sm font-bold text-slate-700">Modèle<select className="mt-1 w-full rounded-xl border border-slate-300 p-3" value={botDraft.model || ''} onChange={(event) => setBotDraft((current) => ({ ...current, model: event.target.value }))}><option value="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8">Llama 4 Maverick 17B</option><option value="mistralai/Mistral-Small-3.2-24B-Instruct-2506">Mistral Small 3.2</option></select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-700">Verbosité<select className="mt-1 w-full rounded-xl border border-slate-300 p-3" value={botDraft.verbosity || 'normal'} onChange={(event) => setBotDraft((current) => ({ ...current, verbosity: event.target.value }))}><option value="concise">Concise</option><option value="normal">Normale</option><option value="detailed">Détaillée</option></select></label><label className="block text-sm font-bold text-slate-700">Nombre maximal de lignes<input type="number" min="1" max="100" className="mt-1 w-full rounded-xl border border-slate-300 p-3" value={botDraft.max_lines ?? '10'} onChange={(event) => setBotDraft((current) => ({ ...current, max_lines: event.target.value }))} /></label></div>
          <div className="grid gap-2 sm:grid-cols-2">{[['is_collaborative', 'Autoriser les conversations collaboratives'], ['track_conversations', 'Enregistrer les conversations'], ['allow_student_files', 'Autoriser les fichiers élèves'], ['context_only', 'Limiter les réponses au contexte fourni'], ['accessibility_buttons', 'Afficher les boutons d’accessibilité']].map(([field, label]) => <label key={field} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(botDraft[field])} onChange={(event) => setBotDraft((current) => ({ ...current, [field]: event.target.checked }))} />{label}</label>)}</div>
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t bg-white py-3"><button type="button" onClick={() => setEditingBot(null)} disabled={editBusy} className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700">Annuler</button><button type="submit" disabled={editBusy} className="rounded-xl bg-indigo-700 px-5 py-3 font-black text-white disabled:opacity-50">{editBusy ? 'ENREGISTREMENT…' : 'ENREGISTRER LES MODIFICATIONS'}</button></div>
        </form>}
        {editError && !botDraft && !editBusy && <div className="p-5"><p role="alert" className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{editError}</p><button type="button" className="mt-3 rounded-xl border px-4 py-2 font-bold" onClick={() => setEditingBot(null)}>Fermer</button></div>}
      </section>
    </div>}
  </section>;
}
