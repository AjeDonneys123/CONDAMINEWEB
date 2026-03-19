import React, { useEffect, useMemo, useRef, useState } from 'react';

const SUCCESS_MESSAGE = "Bravo, vous avez terminé le processus de récupération. Votre travail est en cours de validation par le professeur.";

function speakText(text = '') {
  const value = String(text || '').trim();
  if (!value || typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(value);
  utter.lang = 'fr-FR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function emptyQuestion() {
  return { question: '', expectedAnswer: '', expectedKeywords: [], studentAnswer: '', oralPreferred: true };
}

function emptyMistake() {
  return { questionNumber: '', whatWasWrong: '', correctionMade: '' };
}

export default function ControlRecoveryWorkspace({ user, item, onQuit, onSaved }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [finalMessage, setFinalMessage] = useState('');
  const [questionCursor, setQuestionCursor] = useState(0);
  const [recording, setRecording] = useState(false);
  const [micMutedByUser, setMicMutedByUser] = useState(true);
  const [phase4Error, setPhase4Error] = useState(null);
  const recognitionRef = useRef(null);
  const activePhase = Math.max(1, Math.min(4, Number(form?.phase || 1)));

  useEffect(() => { setForm(item); }, [item]);
  useEffect(() => { setQuestionCursor(0); setMicMutedByUser(true); setRecording(false); }, [activePhase]);
  const currentQuestions = Array.isArray(form?.selfQuestions) && form.selfQuestions.length > 0 ? form.selfQuestions : [emptyQuestion()];
  const phase2Mistakes = Array.isArray(form?.phase2Mistakes) && form.phase2Mistakes.length > 0 ? form.phase2Mistakes : [emptyMistake()];

  const phase1Valid = form?.submissionMode === 'next_course'
    || (form?.submissionMode === 'photo' && Boolean(form?.uploadedPhotoUrl))
    || (form?.submissionMode === 'keyboard' && Boolean(String(form?.typedRedoText || '').trim()));
  const phase2Valid = phase2Mistakes.some((row) =>
    String(row?.questionNumber || '').trim() &&
    String(row?.whatWasWrong || '').trim() &&
    String(row?.correctionMade || '').trim()
  );
  const phase3Valid = currentQuestions.some((q) => String(q?.question || '').trim() && String(q?.expectedAnswer || '').trim());
  const phase4Valid = currentQuestions.every((q) => !String(q?.question || '').trim() || Boolean(String(q?.studentAnswer || '').trim()));
  const currentPhase4Question = currentQuestions[Math.max(0, Math.min(questionCursor, currentQuestions.length - 1))] || emptyQuestion();

  const progressPct = useMemo(() => {
    let score = 0;
    if (phase1Valid) score += 25;
    if (phase2Valid) score += 25;
    if (phase3Valid) score += 25;
    if (phase4Valid) score += 25;
    return score;
  }, [phase1Valid, phase2Valid, phase3Valid, phase4Valid]);

  const patchForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const normalizeText = (value = '') => String(value || '')
    .replace(/[’`´]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const evaluatePhase4Answer = (question) => {
    const answer = String(question?.studentAnswer || '').trim();
    const expectedAnswer = String(question?.expectedAnswer || '').trim();
    const keywords = Array.isArray(question?.expectedKeywords)
      ? question.expectedKeywords.map((k) => String(k || '').trim()).filter(Boolean)
      : [];
    const normalizedAnswer = normalizeText(answer);
    const missingWords = keywords.filter((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      return normalizedKeyword && !normalizedAnswer.includes(normalizedKeyword);
    });
    const ok = keywords.length === 0
      ? answer.length >= 10
      : missingWords.length === 0;
    return { ok, expectedAnswer, missingWords };
  };

  const save = async (next = form) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/eleve/control-recovery/save/${encodeURIComponent(next._id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sauvegarde impossible');
      setForm(data.item);
      if (onSaved) onSaved(data.item);
      return data.item;
    } catch (e) {
      alert(e.message || 'Sauvegarde impossible');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (idx, patch) => {
    const rows = currentQuestions.map((row, rowIdx) => rowIdx === idx ? { ...row, ...patch } : row);
    patchForm({ selfQuestions: rows });
  };

  const updateKeyword = (questionIdx, keywordIdx, value) => {
    const current = Array.isArray(currentQuestions[questionIdx]?.expectedKeywords) ? currentQuestions[questionIdx].expectedKeywords : [];
    const nextKeywords = current.map((keyword, idx) => idx === keywordIdx ? value : keyword);
    updateQuestion(questionIdx, { expectedKeywords: nextKeywords });
  };

  const addKeyword = (questionIdx) => {
    const current = Array.isArray(currentQuestions[questionIdx]?.expectedKeywords) ? currentQuestions[questionIdx].expectedKeywords : [];
    updateQuestion(questionIdx, { expectedKeywords: [...current, ''] });
  };

  const updateMistake = (idx, patch) => {
    const rows = phase2Mistakes.map((row, rowIdx) => rowIdx === idx ? { ...row, ...patch } : row);
    patchForm({ phase2Mistakes: rows });
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/eleve/control-recovery/upload-photo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload impossible');
      patchForm({ uploadedPhotoUrl: data.url });
    } catch (e) {
      alert(e.message || 'Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  const startDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Micro non disponible. Utilise la saisie clavier.");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      const text = Array.from(event.results || []).map((r) => r?.[0]?.transcript || '').join(' ').trim();
      if (!text) return;
      updateQuestion(questionCursor, { studentAnswer: text });
    };
    rec.onerror = () => {
      recognitionRef.current = null;
      setRecording(false);
      setMicMutedByUser(true);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
    };
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopDictation = () => {
    try { recognitionRef.current?.stop?.(); } catch (_) {}
    recognitionRef.current = null;
    setRecording(false);
  };

  const toggleDictation = () => {
    if (recording) {
      setMicMutedByUser(true);
      stopDictation();
      return;
    }
    setMicMutedByUser(false);
    startDictation();
  };

  useEffect(() => () => stopDictation(), []);

  const validatePhase = async () => {
    const checks = {
      1: phase1Valid,
      2: phase2Valid,
      3: phase3Valid,
      4: phase4Valid
    };
    if (!checks[activePhase]) {
      const messages = {
        1: "Complète la phase 1 ou choisis 'Le rendre au prochain cours'.",
        2: "Renseigne au moins une question ratée avec l’erreur et la correction.",
        3: "Crée au moins une question avec sa réponse attendue.",
        4: "Réponds à toutes les questions créées."
      };
      return alert(messages[activePhase]);
    }

    if (activePhase === 4) {
      for (const question of currentQuestions) {
        if (!String(question?.question || '').trim()) continue;
        const evaluation = evaluatePhase4Answer(question);
        if (!evaluation.ok) {
          stopDictation();
          const missingList = evaluation.missingWords.join(', ');
          const message = evaluation.expectedAnswer
            ? `Non. La réponse était: ${evaluation.expectedAnswer}. Il te manque les mots clés suivants: ${missingList}.`
            : `Non. Il te manque les mots clés suivants: ${missingList}.`;
          setPhase4Error({
            question: String(question?.question || '').trim(),
            message
          });
          speakText(message);
          setQuestionCursor(0);
          return;
        }
      }
      setPhase4Error(null);
    }

    const nextPhase = Math.min(4, activePhase + 1);
    const saved = await save({ ...form, phase: nextPhase });
    if (saved && activePhase === 4) {
      const res = await fetch(`/api/eleve/control-recovery/complete/${encodeURIComponent(form._id)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const missing = Array.isArray(data?.details?.missing) ? data.details.missing.join(', ') : '';
        return alert(missing ? `${data?.error || 'Validation impossible'}\n${missing}` : (data?.error || 'Validation impossible'));
      }
      setForm(data.item);
      setFinalMessage(data.message || SUCCESS_MESSAGE);
      speakText(data.message || SUCCESS_MESSAGE);
      if (onSaved) onSaved(data.item);
    }
  };

  const titleValue = String(form?.title || '') === 'RÉCUPÉRER CONTRÔLE' ? '' : String(form?.title || '');
  const subjectValue = String(form?.subject || '').toUpperCase() === 'GÉNÉRAL' ? '' : String(form?.subject || '');

  const phaseCardClass = "rounded-[28px] border border-slate-200 bg-white p-6 md:p-8 min-h-[58vh] flex flex-col";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b bg-gradient-to-r from-amber-50 via-white to-emerald-50 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-600">Récupérer contrôle</div>
            <div className="text-2xl font-black text-slate-800">Phase {activePhase} / 4</div>
            <div className="text-sm font-semibold text-slate-500">{user?.firstName} {user?.lastName}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-slate-400">Progression</div>
              <div className="text-xl font-black text-emerald-600">{progressPct}%</div>
            </div>
            <button onClick={onQuit} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-500">Fermer</button>
          </div>
        </div>

        <div className="p-6">
          {phase4Error && activePhase === 4 && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
              <div className="text-[11px] font-black uppercase tracking-widest">Réponse incorrecte</div>
              <div className="mt-2 text-lg font-black">{phase4Error.question}</div>
              <div className="mt-2 font-semibold">{phase4Error.message}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <input
              className="rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-800 placeholder:text-slate-300"
              value={titleValue}
              onChange={(e) => patchForm({ title: e.target.value })}
              placeholder="Titre du contrôle"
            />
            <input
              className="rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold text-slate-800 placeholder:text-slate-300"
              value={subjectValue}
              onChange={(e) => patchForm({ subject: e.target.value })}
              placeholder="Matière (Histoire Géographie EMC)"
            />
          </div>

          {activePhase === 1 && (
            <section className={phaseCardClass}>
              <div className="text-3xl font-black text-slate-800">Phase 1. Refaire le contrôle</div>
              <div className="mt-2 text-base text-slate-500 font-semibold">Choisis une modalité. Si tu sélectionnes "Le rendre au prochain cours", tu peux passer directement à la suite.</div>
              <div className="flex flex-wrap gap-2 mt-6 mb-6">
                {[
                  ['photo', '📷 Photo du contrôle refait'],
                  ['keyboard', '⌨️ Le refaire au clavier'],
                  ['next_course', '🗓️ Le rendre au prochain cours']
                ].map(([value, label]) => (
                  <button key={value} onClick={() => patchForm({ submissionMode: value })} className={`px-4 py-3 rounded-2xl border font-black text-[12px] ${form?.submissionMode === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>{label}</button>
                ))}
              </div>
              <div className="flex-1">
                {form?.submissionMode === 'photo' && (
                  <div className="space-y-4">
                    <input type="file" accept="image/*" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                    {uploading && <div className="text-sm font-bold text-slate-400">Upload...</div>}
                    {form?.uploadedPhotoUrl && <img src={form.uploadedPhotoUrl} alt="Contrôle refait" className="max-h-[420px] rounded-2xl border border-slate-200 bg-white" />}
                  </div>
                )}
                {form?.submissionMode === 'keyboard' && (
                  <textarea className="w-full min-h-[320px] rounded-2xl border-2 border-slate-200 px-4 py-4 font-semibold outline-none placeholder:text-slate-300" value={form?.typedRedoText || ''} onChange={(e) => patchForm({ typedRedoText: e.target.value })} placeholder="Recopie ici ton contrôle refait..." />
                )}
                {form?.submissionMode === 'next_course' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-600 font-semibold">
                    Tu as choisi de rendre le contrôle au prochain cours. Tu peux passer à la phase suivante.
                  </div>
                )}
              </div>
            </section>
          )}

          {activePhase === 2 && (
            <section className={phaseCardClass}>
              <div className="text-3xl font-black text-slate-800">Phase 2. Expliquer ses erreurs</div>
              <div className="mt-2 text-base text-slate-500 font-semibold">Écris le numéro des questions ratées, ce qui n’allait pas, et ce que tu as corrigé.</div>
              <div className="flex-1 mt-6 space-y-4">
                {phase2Mistakes.map((row, idx) => (
                  <div key={`mistake_${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold placeholder:text-slate-300" value={row.questionNumber || ''} onChange={(e) => updateMistake(idx, { questionNumber: e.target.value })} placeholder="Question n°" />
                    <textarea className="min-h-[180px] rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300" value={row.whatWasWrong || ''} onChange={(e) => updateMistake(idx, { whatWasWrong: e.target.value })} placeholder="Ce qui n’allait pas" />
                    <textarea className="min-h-[180px] rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300" value={row.correctionMade || ''} onChange={(e) => updateMistake(idx, { correctionMade: e.target.value })} placeholder="Ce que j’ai corrigé" />
                  </div>
                ))}
                <button onClick={() => patchForm({ phase2Mistakes: [...phase2Mistakes, emptyMistake()] })} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px]">+ AJOUTER UNE QUESTION RATÉE</button>
              </div>
            </section>
          )}

          {activePhase === 3 && (
            <section className={phaseCardClass}>
              <div className="text-3xl font-black text-slate-800">Phase 3. Créer sa fiche d’apprentissage</div>
              <div className="mt-2 text-base text-slate-500 font-semibold">Pour chaque erreur: la question ratée, la réponse attendue, puis les mots-clés.</div>
              <div className="flex-1 mt-6 space-y-4">
                {currentQuestions.map((row, idx) => (
                  <div key={idx} className="rounded-2xl border border-sky-100 bg-white p-4 space-y-3">
                    <input className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold placeholder:text-slate-300" value={row.question || ''} onChange={(e) => updateQuestion(idx, { question: e.target.value })} placeholder={`Question ratée ${idx + 1}`} />
                    <textarea className="w-full min-h-[120px] rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300" value={row.expectedAnswer || ''} onChange={(e) => updateQuestion(idx, { expectedAnswer: e.target.value })} placeholder="Réponse attendue" />
                    <div className="space-y-2">
                      {(Array.isArray(row.expectedKeywords) && row.expectedKeywords.length > 0 ? row.expectedKeywords : ['']).map((keyword, keywordIdx) => (
                        <input
                          key={`kw_${idx}_${keywordIdx}`}
                          className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300"
                          value={keyword || ''}
                          onChange={(e) => updateKeyword(idx, keywordIdx, e.target.value)}
                          placeholder={`Mot-clé ${keywordIdx + 1}`}
                        />
                      ))}
                      <button type="button" onClick={() => addKeyword(idx)} className="px-4 py-2 rounded-2xl border border-slate-200 bg-slate-50 font-black text-[12px] text-slate-600">
                        + MOT-CLÉ
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => patchForm({ selfQuestions: [...currentQuestions, emptyQuestion()] })} className="px-4 py-2 rounded-2xl bg-sky-600 text-white font-black text-[12px]">+ QUESTION</button>
              </div>
            </section>
          )}

          {activePhase === 4 && (
            <section className={phaseCardClass}>
              <div className="text-3xl font-black text-slate-800">Phase 4. Répondre à ses propres questions</div>
              <div className="mt-2 text-base text-slate-500 font-semibold">Lis ou écoute chaque question, puis réponds à l’oral ou à l’écrit.</div>
              <div className="flex-1 mt-6">
                <div className="rounded-2xl border border-emerald-100 bg-white p-5 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[11px] font-black uppercase text-emerald-600">Question {questionCursor + 1} / {currentQuestions.length}</div>
                    <button
                      type="button"
                      onClick={() => setQuestionCursor((prev) => Math.min(currentQuestions.length - 1, prev + 1))}
                      disabled={questionCursor >= currentQuestions.length - 1}
                      className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] disabled:opacity-40"
                    >
                      Question suivante
                    </button>
                  </div>
                  <div className="font-black text-slate-800 text-2xl">
                    {currentPhase4Question.question || `Question ${questionCursor + 1}`}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => speakText(currentPhase4Question.question)} className="px-3 py-2 rounded-xl border border-slate-200 font-black text-[12px]">🔊 Lire</button>
                    <button onClick={toggleDictation} className={`px-3 py-2 rounded-xl font-black text-[12px] ${recording ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
                      {recording && !micMutedByUser ? '🎙️ Désactiver micro' : '🎙️ Activer micro'}
                    </button>
                  </div>
                  <textarea
                    className="w-full min-h-[240px] rounded-2xl border-2 border-slate-200 px-4 py-3 font-semibold placeholder:text-slate-300"
                    value={currentPhase4Question.studentAnswer || ''}
                    onChange={(e) => {
                      setPhase4Error(null);
                      updateQuestion(questionCursor, { studentAnswer: e.target.value });
                    }}
                    placeholder="Ta réponse orale retranscrite ou ta réponse écrite..."
                  />
                </div>
              </div>
            </section>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => save(form)} disabled={saving} className="px-5 py-3 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-600 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={async () => {
                  if (activePhase <= 1) return;
                  setPhase4Error(null);
                  await save({ ...form, phase: Math.max(1, activePhase - 1) });
                }}
                disabled={saving || activePhase <= 1}
                className="px-5 py-3 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-600 disabled:opacity-40"
              >
                Phase précédente
              </button>
            </div>
            <button onClick={validatePhase} disabled={saving || (activePhase === 1 ? !phase1Valid : activePhase === 2 ? !phase2Valid : activePhase === 3 ? !phase3Valid : !phase4Valid || form?.status === 'done')} className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[12px] disabled:opacity-40">
              {activePhase < 4 ? 'Valider cette phase' : (form?.status === 'done' ? 'Contrôle récupéré' : 'Valider la récupération')}
            </button>
          </div>

        </div>
      </div>

      {finalMessage && (
        <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-emerald-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b bg-gradient-to-r from-emerald-50 via-white to-amber-50">
              <div className="text-[11px] font-black uppercase tracking-widest text-emerald-600">Récupération terminée</div>
              <div className="mt-2 text-2xl font-black text-slate-800">{finalMessage}</div>
            </div>
            <div className="px-6 py-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setFinalMessage('')}
                className="px-5 py-3 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-600"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setFinalMessage('');
                  if (onQuit) onQuit();
                }}
                className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black text-[12px]"
              >
                Retour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
