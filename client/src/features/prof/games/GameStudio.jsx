import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio({ initialData, chapters, classFilter, user, targetSection, onClose }) {

    const [formData, setFormData] = useState(initialData || { 
        title: '', 
        questions: [{ q: "", options: ["", "", "", ""], a: 0 }],
        targetClassrooms: classFilter ? [classFilter] : [],
        assignedStudents: [], 
        isAllClass: true 
    });

    const [activeQIdx, setActiveQIdx] = useState(0);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(classFilter || "");
    const [isPublishing, setIsPublishing] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    // V445 : FILTRAGE STRICT PAR SECTION
    const getChaptersForClass = (clsName) => {
        const targetLvl = allClasses.find(c => c.name === clsName)?.level;
        return chapters.filter(c => {
            if (c.isArchived) return false;
            if (String(c.teacherId) !== String(user.id || user._id)) return false;
            
            // FILTRE SECTION
            if (targetSection && c.section !== targetSection) return false;

            if (c.classroom === clsName) return true;
            if (c.sharedLevel && targetLvl && String(c.sharedLevel) === String(targetLvl)) return true;
            if (c.classroom === "" && c.section === "GÉNÉRAL") return true;
            return false;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const findDefaultChapterId = (clsName) => {
        const available = getChaptersForClass(clsName);
        const ch1 = available.find(c => c.title === "CH1");
        if (ch1) return ch1._id;
        if (available.length > 0) return available[0]._id;
        return "";
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [sts, cls] = await Promise.all([
                    fetch('/api/admin/students').then(r => r.json()),
                    fetch('/api/admin/classrooms').then(r => r.json())
                ]);
                setAllStudents(sts);
                setAllClasses(cls);

                if (initialData) {
                    const targets = initialData.targetClassrooms || [initialData.classroom];
                    const assignedIds = initialData.assignedStudents || [];
                    const isAll = initialData.isAllClass;
                    const chapId = initialData.chapterId;
                    
                    const newDist = {};
                    targets.forEach(clsName => {
                        const clsObj = cls.find(c => c.name === clsName);
                        const clsId = clsObj ? String(clsObj._id) : null;
                        let classStudentIds = [];
                        if (!isAll) {
                            classStudentIds = sts.filter(s => {
                                const isMain = (s.currentClass || "").trim().toUpperCase() === clsName.trim().toUpperCase();
                                const isOption = clsId && (s.assignedGroups || []).some(gId => String(gId) === clsId);
                                return (isMain || isOption) && assignedIds.includes(s._id);
                            }).map(s => s._id);
                        }
                        newDist[clsName] = { chapterId: chapId, studentIds: classStudentIds };
                    });
                    setDistribution(newDist);
                    if(targets.length > 0) setViewingClass(targets[0]);
                } 
                else if (classFilter) {
                    setViewingClass(classFilter);
                    const defId = findDefaultChapterId(classFilter);
                    setDistribution({ [classFilter]: { chapterId: defId, studentIds: [] } });
                }
            } catch (e) { console.error("Load Error", e); }
        };
        fetchData();
    }, []);

    // ... (Reste des fonctions inchangé) ...
    const activeQ = formData.questions[activeQIdx];
    const updateQuestion = (f, v) => { const n = [...formData.questions]; n[activeQIdx] = { ...n[activeQIdx], [f]: v }; setFormData({ ...formData, questions: n }); };
    const updateOption = (i, v) => { const n = [...formData.questions]; n[activeQIdx].options[i] = v; setFormData({ ...formData, questions: n }); };
    const addQuestion = () => { setFormData(prev => ({ ...prev, questions: [...prev.questions, { q: "", options: ["", "", "", ""], a: 0 }] })); setActiveQIdx(formData.questions.length); };
    const deleteQuestion = (e, i) => { e.stopPropagation(); if(formData.questions.length<=1) return; setFormData({ ...formData, questions: formData.questions.filter((_, idx) => idx !== i) }); setActiveQIdx(0); };
    const handleAiGen = async () => { if(!aiPrompt) return; setAiLoading(true); try { const r = await fetch('/api/games/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic:aiPrompt, count:5})}); const d = await r.json(); if(Array.isArray(d)) { setFormData(prev => ({...prev, questions: [...prev.questions, ...d]})); setActiveQIdx(formData.questions.length); setAiPrompt(""); } } catch(e){} setAiLoading(false); };
    const handleClassToggle = (clsName) => { setViewingClass(clsName); };
    
    const getStudentsForViewingClass = () => { if (!viewingClass) return []; const targetObj = allClasses.find(c => c.name.trim().toUpperCase() === viewingClass.trim().toUpperCase()); const targetId = targetObj ? String(targetObj._id) : null; return allStudents.filter(s => { const isMain = (s.currentClass || "").trim().toUpperCase() === viewingClass.trim().toUpperCase(); const isOption = targetId && (s.assignedGroups || []).some(gId => String(gId) === targetId); return isMain || isOption; }).sort((a,b) => a.lastName.localeCompare(b.lastName)); };
    const studentsInView = getStudentsForViewingClass();

    const toggleFullClass = () => { setDistribution(prev => { const next = { ...prev }; if (next[viewingClass]) delete next[viewingClass]; else { const defId = findDefaultChapterId(viewingClass); next[viewingClass] = { chapterId: defId, studentIds: [] }; } return next; }); };
    const toggleStudent = (sId) => { setDistribution(prev => { const next = { ...prev }; const cfg = next[viewingClass]; const allIds = studentsInView.map(s => s._id); if (!cfg) { const defId = findDefaultChapterId(viewingClass); next[viewingClass] = { chapterId: defId, studentIds: [sId] }; } else if (cfg.studentIds.length === 0) { const newIds = allIds.filter(id => id !== sId); next[viewingClass] = { ...cfg, studentIds: newIds }; } else { let newIds = [...cfg.studentIds]; if (newIds.includes(sId)) newIds = newIds.filter(id => id !== sId); else newIds.push(sId); if (newIds.length === 0) delete next[viewingClass]; else if (newIds.length === allIds.length) next[viewingClass] = { ...cfg, studentIds: [] }; else next[viewingClass] = { ...cfg, studentIds: newIds }; } return next; }); };
    const handleUpdateChapter = (cls, cId) => { setDistribution(prev => ({ ...prev, [cls]: { ...prev[cls], chapterId: cId } })); };

    const handleSave = async () => {
        if (!formData.title) return alert("Titre requis !");
        const targets = Object.keys(distribution);
        if (targets.length === 0) return alert("Sélectionnez au moins une classe !");
        setIsPublishing(true);
        try {
            const byChap = {};
            targets.forEach(t => {
                let cid = distribution[t].chapterId;
                if (!cid) cid = "DEFAULT"; 
                if(!byChap[cid]) byChap[cid] = [];
                byChap[cid].push(t);
            });

            for (const chapId of Object.keys(byChap)) {
                const classes = byChap[chapId];
                let finalIds = [];
                let isGlobal = true;
                for (const cls of classes) {
                    const cfg = distribution[cls];
                    if (cfg.studentIds.length > 0) { isGlobal = false; finalIds.push(...cfg.studentIds); } 
                    else { const clsObj = allClasses.find(c => c.name === cls); const clsId = clsObj ? String(clsObj._id) : null; const sOfClass = allStudents.filter(s => { const isMain = (s.currentClass || "").trim().toUpperCase() === cls.trim().toUpperCase(); const isOption = clsId && (s.assignedGroups || []).some(gId => String(gId) === clsId); return isMain || isOption; }).map(s => s._id); finalIds.push(...sOfClass); }
                }
                
                let realChapterId = chapId;
                if (chapId === "DEFAULT") {
                    const firstClass = classes[0];
                    const defId = findDefaultChapterId(firstClass);
                    if (defId) realChapterId = defId;
                    else {
                        const res = await fetch('/api/structure/chapters', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title: "CH1", classroom: firstClass, teacherId: user._id || user.id, section: targetSection || "GÉNÉRAL" }) });
                        const newChap = await res.json();
                        realChapterId = newChap._id;
                    }
                }

                const payload = { ...formData, chapterId: realChapterId, teacherId: user.id || user._id, targetClassrooms: classes, assignedStudents: isGlobal ? [] : finalIds, isAllClass: isGlobal };
                await fetch('/api/games', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            }
            onClose();
        } catch(e) { alert("Erreur Sauvegarde"); }
        setIsPublishing(false);
    };

    const detectLevel = () => { const r=viewingClass||classFilter||(initialData?.targetClassrooms?initialData.targetClassrooms[0]:null); if(!r)return null; const o=allClasses.find(c=>c.name===r); if(o&&o.level)return o.level; const m=r.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2)/); return m?m[0]:null; };
    const targetLevel = detectLevel();
    const myClassesIds = (user.assignedClasses || []).map(c => String(c._id || c));
    const availableClasses = allClasses.filter(c => { if (targetLevel && String(c.level) !== String(targetLevel)) return false; if (user.isDeveloper || user.role === 'admin') return true; return myClassesIds.includes(String(c._id)); }).sort((a,b) => a.name.localeCompare(b.name));
    const distCfg = distribution[viewingClass];
    const isSel = !!distCfg;
    const isPartial = isSel && distCfg.studentIds.length > 0;
    const activeColorClass = isPartial ? 'bg-pink-500 border-pink-500' : 'bg-purple-600 border-purple-600';

    return (
        <div className="v84-game-container animate-in fade-in">
            <div className="v84-game-header">
                <div className="flex items-center flex-1">
                    <div className="v84-game-icon">🎮</div>
                    <input className="v84-game-title-input" placeholder="TITRE DU JEU..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <button onClick={onClose} className="text-3xl text-slate-300 hover:text-red-500 transition-colors">✕</button>
            </div>

            <div className="v84-game-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    <h4 className="v84-field-label">QUESTIONS ({formData.questions.length})</h4>
                    {formData.questions.map((q, i) => (
                        <div key={i} className={`v84-q-item ${activeQIdx === i ? 'active' : ''}`} onClick={() => setActiveQIdx(i)}>
                            <div className="flex justify-between items-center"><span className="v84-q-preview text-xs">Q{i+1}. {q.q || '(Vide)'}</span>{formData.questions.length > 1 && <button onClick={(e) => deleteQuestion(e, i)} className="text-slate-300 hover:text-red-500 font-bold px-2">×</button>}</div>
                            <div className="v84-q-sub">{q.options.filter(o => o).length}/4 options</div>
                        </div>
                    ))}
                    <button className="v84-add-q-btn" onClick={addQuestion}>+ AJOUTER QUESTION</button>
                </div>

                <div className="v84-game-editor custom-scrollbar">
                    <div className="v84-ai-widget"><span className="text-2xl">✨</span><div className="flex-1"><h5 className="font-black text-xs uppercase mb-1">Générateur Magique</h5><input className="v84-ai-input w-full" placeholder="Sujet..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiGen()} /></div><button className="v84-ai-btn" onClick={handleAiGen} disabled={aiLoading}>{aiLoading ? '...' : 'GÉNÉRER'}</button></div>
                    {activeQ && (
                        <div className="v84-q-card animate-in slide-in-from-bottom-2">
                            <label className="v84-field-label">ÉNONCÉ DE LA QUESTION {activeQIdx + 1}</label>
                            <input className="v84-q-input" placeholder="Posez votre question ici..." value={activeQ.q} onChange={e => updateQuestion('q', e.target.value)} autoFocus />
                            <div className="mt-8"><label className="v84-field-label">RÉPONSES (Cochez la bonne)</label><div className="v84-answers-grid">{activeQ.options.map((opt, i) => (<div key={i} className={`v84-ans-row ${activeQ.a === i ? 'correct' : ''}`} onClick={() => updateQuestion('a', i)}><div className="v84-correct-radio">{String.fromCharCode(65 + i)}</div><input className="v84-ans-input" placeholder={`Réponse ${String.fromCharCode(65 + i)}`} value={opt} onChange={e => updateOption(i, e.target.value)} onClick={(e) => e.stopPropagation()} /></div>))}</div></div>
                        </div>
                    )}
                </div>

                <div className="v84-dist-sidebar">
                    <h4 className="v84-field-label mb-2">DISTRIBUTION (NIV {targetLevel || '?'})</h4>
                    <div className="flex flex-wrap gap-2 mb-6">
                        {availableClasses.map(c => {
                            const isTarget = !!distribution[c.name];
                            const isP = isTarget && distribution[c.name].studentIds.length > 0;
                            const isGroup = c.type === 'GROUP';
                            const badgeStyle = isGroup ? (viewingClass === c.name ? 'border-orange-500 text-orange-600' : 'text-orange-400') : '';
                            return (
                                <button key={c._id} onClick={() => handleClassToggle(c.name)} className={`v84-tab-btn-game ${viewingClass === c.name ? 'scale-110 shadow-md border-slate-800' : ''} ${isTarget ? (isP ? 'bg-pink-500 text-white' : 'bg-purple-600 text-white') : 'inactive'} ${badgeStyle}`}>
                                    {c.name}
                                </button>
                            );
                        })}
                    </div>

                    {viewingClass ? (
                        <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b bg-white flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={toggleFullClass}>
                                <span className="font-black text-xs text-slate-700">{viewingClass}</span>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSel ? activeColorClass : 'border-slate-300'}`}>{isSel && <span className="text-white text-xs">✓</span>}</div>
                            </div>
                            
                            {isSel && (
                                <div className="p-3 bg-slate-50 border-b border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Ranger dans :</label>
                                    <select 
                                        className="w-full p-2 rounded-lg text-xs font-bold border border-slate-300 outline-none bg-white"
                                        value={distCfg.chapterId}
                                        onChange={(e) => handleUpdateChapter(viewingClass, e.target.value)}
                                    >
                                        <option value="">-- CHOISIR DOSSIER --</option>
                                        {getChaptersForClass(viewingClass).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                {studentsInView.length > 0 ? studentsInView.map(s => {
                                    const isChecked = isSel && (distCfg.studentIds.length === 0 || distCfg.studentIds.includes(s._id));
                                    return (
                                        <div key={s._id} onClick={() => toggleStudent(s._id)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? (isPartial?'bg-pink-100':'bg-purple-100') : 'hover:bg-slate-100'}`}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? activeColorClass : 'border-slate-300'}`}>{isChecked && <span className="text-white text-[9px]">✓</span>}</div>
                                            <span className={`text-xs font-bold ${isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{s.lastName} {s.firstName}</span>
                                        </div>
                                    );
                                }) : <div className="text-center text-xs text-slate-400 p-4">Aucun élève trouvé.</div>}
                            </div>
                        </div>
                    ) : <div className="text-center text-slate-300 font-bold mt-10 text-xs">SÉLECTIONNEZ UNE CLASSE</div>}

                    <button className="v84-game-publish-btn" onClick={handleSave} disabled={isPublishing}>{isPublishing ? 'PUBLICATION...' : 'ENREGISTRER LE JEU 🚀'}</button>
                </div>
            </div>
        </div>
    );
}