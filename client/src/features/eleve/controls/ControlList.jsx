import React, { useEffect, useState } from 'react';

const FillQuestion = ({ item, values, onChange, locked, correction }) => {
  const parts = String(item.prompt || '').split(/(["“«][^"”»]+["”»])/g);
  let blank = 0;
  return <div className="leading-[2.8] text-lg font-bold">{parts.map((part, i) => {
    const match = part.match(/^["“«]([^"”»]+)["”»]$/); if (!match) return <React.Fragment key={i}>{part}</React.Fragment>;
    const index = blank++; const detail=correction?.blankResults?.find(row=>Number(row.index)===index); const bad = locked && correction && (detail ? !detail.correct : !correction.correct);
    return <span key={i} className="inline-flex flex-col align-middle mx-1 leading-tight"><input disabled={locked} value={values[index] || ''} onChange={e=>onChange(index,e.target.value)} className={`min-w-[150px] max-w-[260px] px-2 py-1 border-b-4 bg-slate-50 text-center ${bad?'border-red-500 text-red-600':'border-blue-500'}`}/>{bad&&<><small className="text-green-700 text-center">{correction.expectedAnswers?.[index]}</small><button type="button" onClick={()=>correction.onContest?.(index)} className="text-[10px] text-red-700 underline">{detail?.contestStatus==='pending'?'Contesté':'Contester'}</button></>}</span>;
  })}</div>;
};

function ControlWorkspace({ control, user, onQuit }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(control.submitted || null);
  const [sending, setSending] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cheatAlertCount, setCheatAlertCount] = useState(0);
  const [showCheatModal, setShowCheatModal] = useState(false);
  const lastAlertTimeRef = React.useRef(0);

  const requestFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      setIsFullscreen(true);
    } catch (_) {}
  };

  const triggerCheat = React.useCallback((reason) => {
    if (result) return;
    const now = Date.now();
    if (now - lastAlertTimeRef.current < 2500) return;
    lastAlertTimeRef.current = now;

    setCheatAlertCount(c => c + 1);
    setShowCheatModal(true);

    const studentFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || 'Élève';
    const payload = {
      studentName: studentFullName,
      studentId: user._id || user.id || '',
      reason: reason || "Sortie du plein écran / Changement d'application sur mobile",
      timestamp: now
    };

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(`/api/eleve/controls/${encodeURIComponent(control._id)}/cheat-alert`, blob);
      } else {
        fetch(`/api/eleve/controls/${encodeURIComponent(control._id)}/cheat-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) {}
  }, [result, user, control._id]);

  useEffect(() => {
    if (result) return;

    const onVis = () => { if (document.visibilityState === 'hidden') triggerCheat("Changement d'application ou d'onglet détecté (écran masqué)"); };
    const onBlur = () => triggerCheat("Perte de focus de la fenêtre (sortie de l'écran du contrôle)");
    const onFs = () => {
      const fs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(fs);
      if (!fs && !result) triggerCheat("Sortie du mode plein écran sur le téléphone");
    };
    const onHide = () => triggerCheat("Fermeture ou mise en arrière-plan de la page");

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    window.addEventListener('pagehide', onHide);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      window.removeEventListener('pagehide', onHide);
    };
  }, [result, triggerCheat]);

  const finish = async () => {
    if (!confirm('Confirmer : j’ai fini mon contrôle ? Après validation, les réponses seront verrouillées.')) return;
    setSending(true);
    try {
      const payload = (control.items || []).map(item => ({
        itemId: item.id,
        value: answers[item.id]?.value,
        values: answers[item.id]?.values || []
      }));
      const r = await fetch(`/api/eleve/controls/${control._id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user._id || user.id, answers: payload })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      setResult(d);
    } catch (e) {
      alert(e.message);
    } finally {
      setSending(false);
    }
  };

  const correction = id => (result?.corrections || result?.answers || []).find(a => String(a.itemId) === String(id));
  const contest = async (itemId, blankIndex) => {
    const message = prompt('Explique pourquoi ta réponse est équivalente :');
    if (!message) return;
    const r = await fetch(`/api/eleve/controls/${control._id}/contest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: user._id || user.id, itemId, blankIndex, message })
    });
    if (r.ok) setResult(v => ({
      ...v,
      corrections: (v.corrections || v.answers || []).map(a => a.itemId === itemId ? {
        ...a,
        contestStatus: Number.isInteger(blankIndex) ? a.contestStatus : 'pending',
        blankResults: (a.blankResults || []).map(b => b.index === blankIndex ? { ...b, contestStatus: 'pending' } : b)
      } : a)
    }));
  };

  return (
    <div className="max-w-5xl mx-auto p-5">
      <div className="flex justify-between mb-4">
        <div>
          <div className="text-xs font-black text-rose-500">CONTRÔLE</div>
          <h1 className="text-3xl font-black">{control.title}</h1>
        </div>
        <button onClick={onQuit} className="rounded-full border w-12 h-12 text-2xl">×</button>
      </div>

      {!result && (
        isFullscreen ? (
          <div className="p-3 mb-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs font-bold shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>🔒 MODE EXAMEN PLEIN ÉCRAN ACTIF · SURVEILLANCE ANTI-TRICHE EN DIRECT</span>
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Sécurisé</span>
          </div>
        ) : (
          <div className="p-4 mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <strong className="text-xs sm:text-sm font-black text-amber-900 block">SURVEILLANCE ANTI-TRICHE ACTIVE</strong>
                <span className="text-[11px] text-amber-800 leading-snug block mt-0.5">Toute sortie de l'application est immédiatement signalée au professeur au tableau !</span>
              </div>
            </div>
            <button
              type="button"
              onClick={requestFullscreen}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wide shadow-md transition transform active:scale-95 shrink-0"
            >
              ⛶ Activer le plein écran
            </button>
          </div>
        )
      )}

      {result && <div className="mb-5 p-5 rounded-2xl bg-blue-50 text-blue-900 font-black text-xl">Résultat automatique : {result.score}/{result.total}</div>}

      <div className="space-y-5">
        {(control.items || []).map((item, index) => {
          const corr = correction(item.id);
          const decorated = corr ? { ...corr, onContest: (blankIndex) => contest(item.id, blankIndex) } : corr;
          return (
            <article key={item.id} className={`p-5 rounded-3xl border-2 bg-white ${corr && !corr.correct ? 'border-red-200' : 'border-slate-200'}`}>
              <div className="text-xs font-black text-violet-600 mb-2">{index + 1}. {item.lessonTitle}</div>
              {item.type === 'fill' ? (
                <FillQuestion
                  item={item}
                  values={answers[item.id]?.values || []}
                  locked={!!result}
                  correction={decorated}
                  onChange={(i, value) => setAnswers(v => ({ ...v, [item.id]: { values: Object.assign([...(v[item.id]?.values || [])], { [i]: value }) } }))}
                />
              ) : item.type === 'qcm' ? (
                <>
                  <h2 className="font-black text-lg mb-3">{item.prompt}</h2>
                  <div className="grid gap-2">
                    {item.choices.map((choice, i) => (
                      <label key={i} className="p-3 rounded-xl border font-bold">
                        <input
                          disabled={!!result}
                          type="radio"
                          name={item.id}
                          checked={Number(answers[item.id]?.value) === i}
                          onChange={() => setAnswers(v => ({ ...v, [item.id]: { value: i } }))}
                        /> {choice}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-black text-lg mb-3">{item.prompt}</h2>
                  <textarea
                    disabled={!!result}
                    className="w-full border-2 rounded-xl p-3"
                    value={answers[item.id]?.value || ''}
                    onChange={e => setAnswers(v => ({ ...v, [item.id]: { value: e.target.value } }))}
                  />
                </>
              )}
              {corr && !corr.correct && item.type !== 'fill' && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 p-3 text-red-700 font-black">
                  <span>Compté comme faux</span>
                  <button onClick={() => contest(item.id)} disabled={corr.contestStatus === 'pending'} className="bg-white border rounded-lg px-3 py-2">
                    {corr.contestStatus === 'pending' ? 'Contestation envoyée' : 'Contester'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!result && (
        <button onClick={finish} disabled={sending} className="sticky bottom-4 mt-6 w-full rounded-2xl bg-rose-600 text-white p-5 text-xl font-black shadow-xl">
          {sending ? 'CORRECTION…' : 'J’AI FINI MON CONTRÔLE'}
        </button>
      )}

      {showCheatModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-950 border-4 border-red-500 rounded-3xl p-6 text-center text-white shadow-2xl flex flex-col items-center gap-4">
            <div className="text-5xl animate-bounce">🚨</div>
            <h2 className="text-xl md:text-2xl font-black text-red-300 uppercase tracking-wide">SORTIE D'ÉCRAN DÉTECTÉE !</h2>
            <p className="text-xs md:text-sm text-red-100 leading-relaxed font-medium">Tu as quitté l'écran du contrôle ou changé d'application sur ton téléphone.</p>
            <div className="p-3 rounded-2xl bg-black/50 border border-red-500/60 w-full text-xs font-bold text-amber-300">
              Ton nom et cette infraction ({cheatAlertCount}e signalement) ont été immédiatement transmis en gros au tableau du professeur !
            </div>
            <button
              type="button"
              onClick={() => { setShowCheatModal(false); requestFullscreen(); }}
              className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wide shadow-xl shadow-red-600/40 transition transform active:scale-95"
            >
              REPRENDRE LE CONTRÔLE EN PLEIN ÉCRAN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlList({user,openItemId=''}){const[rows,setRows]=useState([]);const[selected,setSelected]=useState(null);useEffect(()=>{fetch(`/api/eleve/controls/list/${user._id||user.id}`).then(r=>r.ok?r.json():[]).then(data=>{setRows(data);const id=openItemId||new URLSearchParams(location.search).get('control');if(id)setSelected(data.find(x=>String(x._id)===String(id))||null)}).catch(()=>setRows([]))},[user,openItemId]);if(selected)return <ControlWorkspace control={selected} user={user} onQuit={()=>setSelected(null)}/>;return <div className="max-w-5xl mx-auto p-5"><h1 className="text-4xl font-black mb-6">📝 MES CONTRÔLES</h1><div className="grid md:grid-cols-2 gap-4">{rows.map(row=><button key={row._id} onClick={()=>setSelected(row)} className="text-left bg-white border-2 rounded-3xl p-5"><div className="text-xl font-black">{row.title}</div><div className="text-sm text-slate-500 font-bold">{row.submitted?`Rendu · ${row.submitted.score}/${row.submitted.total}`:'À faire'}</div></button>)}</div></div>}
