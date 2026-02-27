// @signatures: StudentsManager, getStudentWorkload, handleOpenCorrection, handleRemovePunishment, handleSaveCorrection, loadMatrix
import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

const extractId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (typeof value?.toString === 'function' && value?.toString !== Object.prototype.toString) {
    const asString = value.toString();
    if (asString && asString !== '[object Object]') return asString;
  }
  if (typeof value === 'object') {
    if (value._id) return extractId(value._id);
    if (typeof value.id === 'string') return value.id;
    if (typeof value.$oid === 'string') return value.$oid;
  }
  return '';
};
const norm = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const antiCheatTone = (antiCheat = {}) => {
  const lvl = String(antiCheat?.level || '').toUpperCase();
  const score = Number(antiCheat?.score || 0);
  if (lvl === 'RED' || score >= 8) return { label: 'TRICHE: ROUGE', chip: 'bg-red-100 text-red-700 border-red-200' };
  if (lvl === 'ORANGE' || score >= 4) return { label: 'TRICHE: ORANGE', chip: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'TRICHE: VERTE', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};
const formatMs = (ms = 0) => {
  const v = Math.max(0, Number(ms || 0));
  const sec = Math.floor(v / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function StudentsManager({ globalClassId }) {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [trackingData, setTrackingData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [latePunishmentNames, setLatePunishmentNames] = useState([]);

  // MODALES
  const [editingSub, setEditingSub] = useState(null); 
  const [editorData, setEditorData] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [viewingStudent, setViewingStudent] = useState(null); // Pour la modale de suivi

  useEffect(() => {
    if (!globalClassId) return;
    loadMatrix();
  }, [globalClassId]);

  const loadMatrix = async () => {
    setLoading(true);
    try {
        const [sts, clsList, hws, gms, subs, progs] = await Promise.all([
            fetch('/api/admin/students').then(r => r.json()),
            fetch('/api/admin/classrooms').then(r => r.json()),
            fetch('/api/homework/all').then(r => r.json()),
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/homework/submissions').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json())
        ]);

        const currentClassObj = clsList.find(c => c._id === globalClassId);
        const currentClassName = currentClassObj ? currentClassObj.name : "";
        setClassName(currentClassName);

        const myStudents = sts
            .filter(s => {
                if (!currentClassObj) return false;
                if (currentClassObj.type === 'GROUP') {
                    return (s.assignedGroups || []).some(g => extractId(g) === String(globalClassId));
                }
                return String(s.classId) === String(globalClassId);
            })
            .sort((a,b) => a.lastName.localeCompare(b.lastName));
        setStudents(myStudents);
        const lateNames = myStudents
            .filter(s => s.punishmentStatus === 'LATE' || (s.punishmentStatus === 'PENDING' && s.punishmentDueDate && new Date(s.punishmentDueDate).getTime() <= Date.now()))
            .map(s => `${s.firstName} ${s.lastName}`);
        setLatePunishmentNames(lateNames);

        const allActs = [
            ...hws.map(h => ({ ...h, type: 'homework', label: '📝 ' + h.title })),
            ...gms.map(g => ({ ...g, type: 'game', label: '🎮 ' + g.title }))
        ];
        const classTargetKey = norm(currentClassName);
        const classStudentIds = new Set(myStudents.map((s) => extractId(s._id)));
        const scopedActs = allActs.filter((act) => {
            const targets = (act.targetClassrooms || []).map(norm);
            const hitsClassTarget = targets.includes(classTargetKey);
            const hasAssignedInClass = (act.assignedStudents || []).some((id) => classStudentIds.has(String(id)));
            return hitsClassTarget || hasAssignedInClass;
        });
        setActivities(scopedActs);

        const map = {};
        const hwTitleById = new Map((hws || []).map((h) => [String(h._id), h.title || '']));
        const studentNameKeyById = new Map(
            (sts || []).map((s) => [String(s._id), norm(`${s.firstName || ''} ${s.lastName || ''}`)])
        );
        subs.forEach(sub => {
            const sid = extractId(sub.studentId);
            const hid = extractId(sub.homeworkId);
            const hwTitleFromSub = typeof sub.homeworkId === 'object' ? sub.homeworkId?.title : '';
            const hwTitle = hwTitleFromSub || hwTitleById.get(String(hid)) || '';
            const sNameKey = studentNameKeyById.get(sid) || '';
            const payload = { done: true, score: sub.grade, subId: sub._id, antiCheat: sub.antiCheat || {} };
            if (hid) map[`${sid}_${hid}`] = payload;
            if (hwTitle) map[`${sid}_TITLE_${norm(hwTitle)}`] = payload;
            if (hwTitle && sNameKey) map[`${sNameKey}_TITLE_${norm(hwTitle)}`] = payload;
        });
        progs.forEach(prog => {
            const sid = extractId(prog.studentId);
            const gid = extractId(prog.gameId);
            map[`${sid}_${gid}`] = { done: true, score: prog.lastScore ? `${prog.lastScore}pts` : 'JOUÉ' };
        });
        setTrackingData(map);

    } catch (e) { console.error("Matrix Load Error", e); }
    setLoading(false);
  };

  // --- ACTIONS ---
  const handleOpenCorrection = async (subId) => {
      setEditingSub(subId);
      setEditorLoading(true);
      try {
          const res = await fetch(`/api/homework/submission/${subId}`);
          if (res.ok) setEditorData(await res.json());
      } catch(e) {}
      setEditorLoading(false);
  };

  const handleSaveCorrection = async () => {
      if (!editorData) return;
      await fetch(`/api/homework/submission/${editingSub}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(editorData) });
      setEditingSub(null); setEditorData(null); loadMatrix();
  };

  const handleRemovePunishment = async (hwId, sId) => {
      if(!confirm("Annuler cette punition pour l'élève ?")) return;
      await fetch('/api/homework/remove-punishment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ homeworkId: hwId, studentId: sId }) });
      // On recharge la matrice pour mettre à jour la vue
      loadMatrix();
      setViewingStudent(null); // On ferme la modale pour rafraîchir
  };

  // --- HELPER POUR LA MODALE SUIVI ---
  const getStudentWorkload = (sId) => {
      const currentStudentId = extractId(sId);
      const student = students.find((s) => extractId(s._id) === currentStudentId);
      if(!student) return [];
      
      const workload = [];
      const classTargetKey = norm(className);
      const studentId = currentStudentId;
      const studentNameKey = norm(`${student.firstName || ''} ${student.lastName || ''}`);

      activities.forEach(act => {
          // 1. CIBLAGE
          const assignedIds = (act.assignedStudents || []).map((id) => String(id));
          const isAssignedDirect = assignedIds.includes(studentId);
          const targets = (act.targetClassrooms || (act.classroom ? [act.classroom] : [])).map(norm);
          const isAssignedByClass = !!act.isAllClass && targets.includes(classTargetKey);
          const isAssigned = isAssignedDirect || isAssignedByClass;

          if (isAssigned) {
              const status =
                  trackingData[`${studentId}_${extractId(act._id)}`] ||
                  trackingData[`${studentId}_TITLE_${norm(act.title)}`] ||
                  trackingData[`${studentNameKey}_TITLE_${norm(act.title)}`];
              workload.push({
                  ...act,
                  isDone: !!status,
                  score: status ? status.score : null,
                  antiCheat: status ? (status.antiCheat || {}) : {}
              });
          }
      });
      return workload;
  };

  if (!globalClassId) return <div className="p-10 text-center text-slate-400 font-bold">Veuillez sélectionner une classe en haut.</div>;
  if (loading) return <div className="p-10 text-center text-indigo-500 font-black animate-pulse">CHARGEMENT DE LA MATRICE...</div>;

  const workloadItems = viewingStudent ? getStudentWorkload(viewingStudent._id) : [];

  return (
    <>
        {/* MODALE SUIVI ÉLÈVE */}
        {viewingStudent && (
            <div className="correction-overlay" onClick={() => setViewingStudent(null)}>
                <div className="correction-card !max-w-2xl !h-[80vh]" onClick={e => e.stopPropagation()}>
                    <div className="corr-header bg-slate-900">
                        <div>
                            <h2 className="text-xl font-black uppercase text-white">{viewingStudent.firstName} {viewingStudent.lastName}</h2>
                            <p className="text-xs text-slate-400 font-bold">SUIVI INDIVIDUEL</p>
                        </div>
                        <button onClick={() => setViewingStudent(null)} className="text-white text-2xl font-black">✕</button>
                    </div>
                    <div className="corr-body flex-col bg-slate-50 p-6 overflow-y-auto gap-4 custom-scrollbar">
                        
                        {/* PUNITIONS */}
                        {workloadItems.filter(w => w.isPunishment).length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-black text-red-500 uppercase mb-2">⚖️ PUNITIONS EN COURS</h4>
                                {workloadItems.filter(w => w.isPunishment).map(w => (
                                    <div key={w._id} className="bg-red-50 border border-red-200 p-4 rounded-xl flex justify-between items-center mb-2">
                                        <div>
                                            <div className="font-bold text-red-700">{w.title}</div>
                                            <div className="text-[10px] text-red-400 font-bold">{w.isDone ? "RENDUE (EN ATTENTE VALIDATION)" : "NON FAITE"}</div>
                                        </div>
                                        {!w.isDone && (
                                            <button onClick={() => handleRemovePunishment(w._id, viewingStudent._id)} className="bg-white text-red-500 px-3 py-1 rounded border border-red-200 text-xs font-black hover:bg-red-500 hover:text-white transition-colors">
                                                🗑️ ANNULER
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* DEVOIRS */}
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2">📚 DEVOIRS</h4>
                        {workloadItems.filter(w => w.type === 'homework' && !w.isPunishment).map(w => (
                            <div key={w._id} className={`p-4 rounded-xl border flex justify-between items-center mb-2 ${w.isDone ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                <div>
                                    <div className="font-bold text-slate-700">{w.title}</div>
                                    <div className={`text-[10px] font-black uppercase ${w.isDone ? 'text-green-600' : 'text-red-400'}`}>
                                        {w.isDone ? `✅ FAIT (${w.score})` : '⭕ À FAIRE'}
                                    </div>
                                    {w.isDone && (
                                        <div className={`inline-flex mt-2 px-2 py-1 rounded-full border text-[9px] font-black ${antiCheatTone(w.antiCheat).chip}`}>
                                            {antiCheatTone(w.antiCheat).label}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* JEUX */}
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2 mt-4">🎮 JEUX</h4>
                        {workloadItems.filter(w => w.type === 'game').map(w => (
                            <div key={w._id} className={`p-4 rounded-xl border flex justify-between items-center mb-2 ${w.isDone ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                                <div>
                                    <div className="font-bold text-slate-700">{w.title}</div>
                                    <div className={`text-[10px] font-black uppercase ${w.isDone ? 'text-purple-600' : 'text-red-400'}`}>
                                        {w.isDone ? `✅ JOUÉ (${w.score})` : '⭕ PAS ENCORE JOUÉ'}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {workloadItems.length === 0 && <div className="text-center p-10 text-slate-300 font-bold italic">Aucune activité assignée.</div>}
                    </div>
                </div>
            </div>
        )}

        {/* MODALE CORRECTION (Existante) */}
        {editingSub && (
            <div className="correction-overlay">
                <div className="correction-card animate-in">
                    <div className="corr-header">
                        <h2 className="text-xl font-black uppercase">CORRECTION</h2>
                        <button onClick={() => setEditingSub(null)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
                    </div>
                    {editorLoading || !editorData ? (
                        <div className="flex-1 flex items-center justify-center text-indigo-500 font-black">CHARGEMENT...</div>
                    ) : (
                        <>
                            <div className="corr-body">
                                <div className="mb-3">
                                    <div className={`inline-flex px-3 py-1 rounded-full border text-[10px] font-black ${antiCheatTone(editorData?.antiCheat || {}).chip}`}>
                                        {antiCheatTone(editorData?.antiCheat || {}).label}
                                    </div>
                                    {Array.isArray(editorData?.antiCheat?.reasons) && editorData.antiCheat.reasons.length > 0 && (
                                        <div className="mt-2 text-[11px] font-semibold text-slate-600">
                                            {editorData.antiCheat.reasons.slice(0, 3).join(' • ')}
                                        </div>
                                    )}
                                </div>
                                <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Surveillance</div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Temps réflexion avant écriture: {formatMs(editorData?.antiCheat?.telemetry?.firstWriteDelayMs || 0)}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        QCM vérification (durées): {(editorData?.antiCheat?.verification?.qcmDurationsMs || []).length > 0 ? (editorData.antiCheat.verification.qcmDurationsMs.map(formatMs).join(' / ')) : 'n/a'}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Score QCM: {Number(editorData?.antiCheat?.verification?.qcmScore || 0).toFixed(2)}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Mode réponse ouverte: {editorData?.antiCheat?.verification?.mode || 'texte'}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Temps réponse ouverte: {formatMs(editorData?.antiCheat?.verification?.responseDurationMs || 0)}
                                    </div>
                                    <div className="mt-2 text-[11px] text-slate-700">
                                        <span className="font-black uppercase text-slate-500">Transcription / Réponse ouverte</span>
                                        <div className="mt-1 p-2 rounded border border-slate-100 bg-slate-50 whitespace-pre-wrap">
                                            {editorData?.antiCheat?.verification?.transcript || 'Aucune donnée'}
                                        </div>
                                    </div>
                                </div>
                                <div className="corr-panel-student">
                                    <label className="corr-label">✍️ TEXTE ÉLÈVE</label>
                                    <textarea className="corr-textarea student" value={editorData.content} onChange={e => setEditorData({...editorData, content: e.target.value})} />
                                </div>
                                <div className="corr-panel-prof">
                                    <label className="corr-label">🤖 FEEDBACK</label>
                                    <textarea className="corr-textarea feedback" value={editorData.feedback} onChange={e => setEditorData({...editorData, feedback: e.target.value})} />
                                    <div className="corr-grade-box">
                                        <label className="corr-label">NOTE</label>
                                        <input className="corr-grade-input" value={editorData.grade} onChange={e => setEditorData({...editorData, grade: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="corr-footer">
                                <button onClick={() => setEditingSub(null)} className="corr-btn-cancel">ANNULER</button>
                                <button onClick={handleSaveCorrection} className="corr-btn-save">ENREGISTRER</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* TABLEAU */}
        <div className="bg-white rounded-[30px] border overflow-hidden shadow-xl animate-in flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="font-black text-slate-700 text-lg uppercase">📊 SUIVI D'ACTIVITÉ : {className}</h3>
                <span className="text-xs font-bold text-slate-400">{students.length} Élèves</span>
            </div>

            {latePunishmentNames.length > 0 && (
                <div className="mx-6 mt-4 mb-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-xs font-black uppercase">
                    ⚠️ Punitions en retard : {latePunishmentNames.join(', ')}
                </div>
            )}
            
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="students-table w-full">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left bg-slate-50 min-w-[200px] border-b border-r">Élève</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center bg-slate-50 border-b w-[100px]">Action</th>
                            {activities.filter(a => !a.isPunishment).map(act => (
                                <th key={act._id} className="p-4 text-[9px] font-black text-slate-600 uppercase text-center border-b min-w-[100px] max-w-[150px] truncate" title={act.title}>{act.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s._id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-4 text-xs font-bold text-slate-700 border-r border-b group-hover:text-indigo-700">
                                    {s.firstName} {s.lastName}
                                    {s.punishmentStatus !== 'NONE' && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black">PUNI</span>}
                                </td>
                                <td className="p-2 text-center border-b">
                                    <button onClick={() => setViewingStudent(s)} className="bg-slate-100 text-slate-500 px-3 py-1 rounded hover:bg-indigo-100 hover:text-indigo-600 text-[10px] font-black">📋 SUIVI</button>
                                </td>
                                {activities.filter(a => !a.isPunishment).map(act => {
                                    const studentNameKey = norm(`${s.firstName || ''} ${s.lastName || ''}`);
                                    const sid = extractId(s._id);
                                    const aid = extractId(act._id);
                                    const status =
                                        trackingData[`${sid}_${aid}`] ||
                                        trackingData[`${sid}_TITLE_${norm(act.title)}`] ||
                                        trackingData[`${studentNameKey}_TITLE_${norm(act.title)}`];
                                    return (
                                        <td key={act._id} className="p-2 text-center border-b">
                                            {status ? (
                                                <button onClick={() => act.type === 'homework' && handleOpenCorrection(status.subId)} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm ${act.type === 'homework' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`} title={act.type === 'homework' ? antiCheatTone(status.antiCheat).label : ''}>{status.score || 'OK'}</button>
                                            ) : <div className="text-slate-200 text-xs">•</div>}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </>
  );
}
