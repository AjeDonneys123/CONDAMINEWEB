import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

/**
 * 📊 STUDENTS MANAGER V210 - CORRECTION & ÉDITION
 * Feature : Clic sur une note -> Ouvre la modale de correction.
 * Permet de modifier le texte de l'élève, le feedback et la note.
 */
export default function StudentsManager({ globalClassId }) {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [trackingData, setTrackingData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");

  // --- ÉTAT MODALE CORRECTION ---
  const [editingSub, setEditingSub] = useState(null); // ID de la soumission
  const [editorData, setEditorData] = useState(null); // Données chargées (content, feedback, grade)
  const [editorLoading, setEditorLoading] = useState(false);

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

        const myStudents = sts.filter(s => String(s.classId) === String(globalClassId));
        setStudents(myStudents);

        const myHomeworks = hws.filter(h => !h.isArchived && (h.targetClassrooms || []).includes(currentClassName));
        const myGames = gms.filter(g => !g.isArchived && (g.classroom === currentClassName));

        const allActs = [
            ...myHomeworks.map(h => ({ ...h, type: 'homework', label: '📝 ' + h.title })),
            ...myGames.map(g => ({ ...g, type: 'game', label: '🎮 ' + g.title }))
        ];

        setActivities(allActs);

        const map = {};
        
        // V210 : On stocke l'ID de la soumission pour pouvoir l'éditer
        subs.forEach(sub => {
            const key = `${sub.studentId}_${sub.homeworkId}`;
            map[key] = { done: true, score: sub.grade, subId: sub._id }; 
        });

        progs.forEach(prog => {
            const key = `${prog.studentId}_${prog.gameId}`;
            map[key] = { done: true, score: prog.lastScore ? `${prog.lastScore}pts` : 'JOUÉ' };
        });

        setTrackingData(map);

    } catch (e) { console.error("Matrix Load Error", e); }
    setLoading(false);
  };

  // --- ACTIONS CORRECTION ---
  const handleOpenCorrection = async (subId) => {
      setEditingSub(subId);
      setEditorLoading(true);
      try {
          const res = await fetch(`/api/homework/submission/${subId}`);
          if (res.ok) setEditorData(await res.json());
          else alert("Erreur chargement copie.");
      } catch(e) { alert("Erreur réseau"); setEditingSub(null); }
      setEditorLoading(false);
  };

  const handleSaveCorrection = async () => {
      if (!editorData) return;
      try {
          await fetch(`/api/homework/submission/${editingSub}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(editorData)
          });
          setEditingSub(null);
          setEditorData(null);
          loadMatrix(); // Rafraîchir la matrice pour voir la nouvelle note
      } catch(e) { alert("Erreur sauvegarde."); }
  };

  if (!globalClassId) return <div className="p-10 text-center text-slate-400 font-bold">Veuillez sélectionner une classe en haut.</div>;
  if (loading) return <div className="p-10 text-center text-indigo-500 font-black animate-pulse">CHARGEMENT DE LA MATRICE...</div>;

  return (
    <>
        {/* --- MODALE D'ÉDITION V210 --- */}
        {editingSub && (
            <div className="correction-overlay">
                <div className="correction-card animate-in">
                    <div className="corr-header">
                        <h2 className="text-xl font-black uppercase">CORRECTION & MODIFICATION</h2>
                        <button onClick={() => setEditingSub(null)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
                    </div>
                    {editorLoading || !editorData ? (
                        <div className="flex-1 flex items-center justify-center text-indigo-500 font-black">CHARGEMENT DE LA COPIE...</div>
                    ) : (
                        <>
                            <div className="corr-body">
                                {/* GAUCHE : ÉLÈVE */}
                                <div className="corr-panel-student">
                                    <label className="corr-label">✍️ TEXTE DE L'ÉLÈVE (Modifiable)</label>
                                    <textarea 
                                        className="corr-textarea student" 
                                        value={editorData.content} 
                                        onChange={e => setEditorData({...editorData, content: e.target.value})}
                                    />
                                </div>
                                {/* DROITE : PROF */}
                                <div className="corr-panel-prof">
                                    <label className="corr-label">🤖 FEEDBACK IA / PROF</label>
                                    <textarea 
                                        className="corr-textarea feedback" 
                                        value={editorData.feedback} 
                                        onChange={e => setEditorData({...editorData, feedback: e.target.value})}
                                    />
                                    <div className="corr-grade-box">
                                        <label className="corr-label">NOTE / APPRÉCIATION</label>
                                        <input 
                                            className="corr-grade-input" 
                                            value={editorData.grade} 
                                            onChange={e => setEditorData({...editorData, grade: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="corr-footer">
                                <button onClick={() => setEditingSub(null)} className="corr-btn-cancel">ANNULER</button>
                                <button onClick={handleSaveCorrection} className="corr-btn-save">ENREGISTRER LES MODIFICATIONS</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* --- MATRICE PRINCIPALE --- */}
        <div className="bg-white rounded-[30px] border overflow-hidden shadow-xl animate-in flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="font-black text-slate-700 text-lg uppercase">📊 SUIVI D'ACTIVITÉ : {className}</h3>
                <span className="text-xs font-bold text-slate-400">{students.length} Élèves • {activities.length} Activités</span>
            </div>
            
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="students-table w-full">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left bg-slate-50 min-w-[200px] border-b border-r">Nom de l'élève</th>
                            {activities.map(act => (
                                <th key={act._id} className="p-4 text-[9px] font-black text-slate-600 uppercase text-center border-b min-w-[100px] max-w-[150px] truncate" title={act.title}>
                                    {act.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s._id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-4 text-xs font-bold text-slate-700 border-r border-b group-hover:text-indigo-700">
                                    {s.firstName} {s.lastName}
                                </td>
                                {activities.map(act => {
                                    const status = trackingData[`${s._id}_${act._id}`];
                                    const isDone = !!status;
                                    
                                    let isAssigned = true;
                                    if (act.type === 'homework' && !act.isAllClass) {
                                        isAssigned = (act.assignedStudents || []).includes(s._id);
                                    }

                                    if (!isAssigned) {
                                        return <td key={act._id} className="p-2 text-center border-b bg-slate-50/30"><span className="text-[10px] text-slate-300">Non concerné</span></td>;
                                    }

                                    return (
                                        <td key={act._id} className="p-2 text-center border-b">
                                            {isDone ? (
                                                <button 
                                                    onClick={() => act.type === 'homework' && handleOpenCorrection(status.subId)}
                                                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm transition-transform active:scale-95 ${act.type === 'homework' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200 cursor-pointer' : 'bg-purple-100 text-purple-700 border-purple-200 cursor-default'}`}
                                                >
                                                    <span>{act.type === 'homework' ? '📝' : '🎮'}</span>
                                                    <span>{status.score || 'FAIT'}</span>
                                                </button>
                                            ) : (
                                                <div className="inline-flex items-center px-3 py-1 bg-red-50 text-red-400 rounded-full text-[10px] font-bold border border-red-100 opacity-50">
                                                    ⭕
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr><td colSpan={activities.length + 1} className="p-10 text-center italic text-slate-400">Aucun élève dans cette classe.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </>
  );
}