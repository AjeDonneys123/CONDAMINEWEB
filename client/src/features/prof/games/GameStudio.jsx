import React, { useState, useEffect } from 'react';
import './GameStudio.css';

/**
 * 🎮 GAME STUDIO V216 (SAVE FIX)
 * Correction Critique : Normalisation des noms de classe lors de la sauvegarde.
 * Assure que tous les élèves sont bien inclus même en cas d'espaces invisibles.
 */
export default function GameStudio({ initialData, chapters, classFilter, user, onClose }) {

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
                        let classStudentIds = [];
                        if (!isAll) {
                            classStudentIds = sts
                                .filter(s => s.currentClass === clsName && assignedIds.includes(s._id))
                                .map(s => s._id);
                        }
                        newDist[clsName] = { chapterId: chapId, studentIds: classStudentIds };
                    });
                    setDistribution(newDist);
                    if(targets.length > 0) setViewingClass(targets[0]);
                } 
                else if (classFilter) {
                    setViewingClass(classFilter);
                    setDistribution({ [classFilter]: { chapterId: "", studentIds: [] } });
                }
            } catch (e) { console.error("Load Error", e); }
        };
        fetchData();
    }, []);

    // --- LOGIC HELPER ---
    const getChaptersForClass = (clsName) => {
        if (!user) return [];
        const myId = user.id || user._id;
        const clsObj = allClasses.find(c => c.name === clsName);
        const level = clsObj ? clsObj.level : (clsName.match(/^\d+/) ? clsName.match(/^\d+/)[0] : null);

        return chapters.filter(c => {
            if (c.isArchived) return false;
            const ownerId = c.teacherId?._id || c.teacherId;
            if (String(ownerId) !== String(myId)) return false;
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && String(c.sharedLevel) === String(level)) return true;
            return false;
        }).sort((a, b) => (a.section || "Z").localeCompare(b.section || "Z"));
    };

    const findEquivalentChapterId = (targetClass, sourceChapId) => {
        if (!sourceChapId) return "";
        const src = chapters.find(c => c._id === sourceChapId);
        if (!src) return "";
        const targets = getChaptersForClass(targetClass);
        const match = targets.find(t => 
            t.title.trim().toUpperCase() === src.title.trim().toUpperCase() && 
            (t.section || "").trim().toUpperCase() === (src.section || "").trim().toUpperCase()
        );
        return match ? match._id : "";
    };

    const handleUpdateChapter = (clsName, chapId) => {
        setDistribution(prev => {
            const next = { ...prev };
            next[clsName] = { ...next[clsName], chapterId: chapId };
            if (chapId) {
                Object.keys(next).forEach(otherClass => {
                    if (otherClass !== clsName) {
                        const equivalentId = findEquivalentChapterId(otherClass, chapId);
                        if (equivalentId) next[otherClass] = { ...next[otherClass], chapterId: equivalentId };
                    }
                });
            }
            return next;
        });
    };

    // --- DETECT LEVEL LOGIC ---
    const detectLevel = () => {
        const refClass = viewingClass || classFilter || (initialData?.targetClassrooms ? initialData.targetClassrooms[0] : null);
        if (!refClass) return null;
        const clsObj = allClasses.find(c => c.name === refClass);
        if (clsObj && clsObj.level) return clsObj.level;
        const match = refClass.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2)/);
        return match ? match[0] : null;
    };

    const targetLevel = detectLevel();
    const availableClasses = allClasses.filter(c => {
        if (c.type !== 'CLASS') return false;
        if (!targetLevel) return true;
        return String(c.level) === String(targetLevel);
    }).sort((a,b) => a.name.localeCompare(b.name));

    const isAllLevelSelected = availableClasses.length > 0 && availableClasses.every(c => distribution[c.name]);

    const toggleAllLevel = () => {
        if (isAllLevelSelected) {
            setDistribution(prev => {
                const next = { ...prev };
                availableClasses.forEach(c => delete next[c.name]);
                return next;
            });
        } else {
            setDistribution(prev => {
                const next = { ...prev };
                let sourceChap = "";
                const currentlySelected = Object.keys(next);
                if (currentlySelected.length > 0) sourceChap = next[currentlySelected[0]].chapterId;

                availableClasses.forEach(c => {
                    if (!next[c.name]) {
                        let smartChap = "";
                        if (sourceChap) smartChap = findEquivalentChapterId(c.name, sourceChap);
                        if (!smartChap) {
                            const chaps = getChaptersForClass(c.name);
                            smartChap = chaps.length > 0 ? chaps[0]._id : "";
                        }
                        next[c.name] = { chapterId: smartChap, studentIds: [] }; 
                    }
                });
                return next;
            });
        }
    };

    // UI HELPER
    const activeQ = formData.questions[activeQIdx];
    const updateQuestion = (f, v) => { const n = [...formData.questions]; n[activeQIdx] = { ...n[activeQIdx], [f]: v }; setFormData({ ...formData, questions: n }); };
    const updateOption = (i, v) => { const n = [...formData.questions]; n[activeQIdx].options[i] = v; setFormData({ ...formData, questions: n }); };
    const addQuestion = () => { setFormData({ ...formData, questions: [...formData.questions, { q: "", options: ["", "", "", ""], a: 0 }] }); setActiveQIdx(formData.questions.length); };
    const deleteQuestion = (e, i) => { e.stopPropagation(); if(formData.questions.length<=1) return; setFormData({ ...formData, questions: formData.questions.filter((_, idx) => idx !== i) }); setActiveQIdx(0); };
    const handleAiGen = async () => { if(!aiPrompt) return; setAiLoading(true); try { const r = await fetch('/api/games/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic:aiPrompt, count:5})}); const d = await r.json(); if(Array.isArray(d)) { setFormData(prev => ({...prev, questions: [...prev.questions, ...d]})); setActiveQIdx(formData.questions.length); setAiPrompt(""); } } catch(e){} setAiLoading(false); };

    // --- DISTRIBUTION INDIVIDUELLE ---
    const handleClassToggle = (clsName) => { setViewingClass(clsName); };

    const toggleFullClass = () => {
        setDistribution(prev => {
            const next = { ...prev };
            if (next[viewingClass]) delete next[viewingClass];
            else {
                let smartChap = "";
                const selected = Object.keys(next);
                if (selected.length > 0) smartChap = findEquivalentChapterId(viewingClass, next[selected[0]].chapterId);
                if (!smartChap) {
                    const chaps = getChaptersForClass(viewingClass);
                    smartChap = chaps.length > 0 ? chaps[0]._id : "";
                }
                next[viewingClass] = { chapterId: smartChap, studentIds: [] };
            }
            return next;
        });
    };

    const toggleStudent = (sId) => {
        setDistribution(prev => {
            const next = { ...prev };
            const cfg = next[viewingClass];
            const allS = allStudents.filter(s => s.currentClass === viewingClass).map(s => s._id);

            if (!cfg) {
                let smartChap = "";
                const selected = Object.keys(next);
                if (selected.length > 0) smartChap = findEquivalentChapterId(viewingClass, next[selected[0]].chapterId);
                if (!smartChap) {
                    const chaps = getChaptersForClass(viewingClass);
                    smartChap = chaps.length > 0 ? chaps[0]._id : "";
                }
                next[viewingClass] = { chapterId: smartChap, studentIds: [sId] };
            } else if (cfg.studentIds.length === 0) {
                const newIds = allS.filter(id => id !== sId);
                next[viewingClass] = { ...cfg, studentIds: newIds };
            } else {
                let newIds = [...cfg.studentIds];
                if (newIds.includes(sId)) newIds = newIds.filter(id => id !== sId);
                else newIds.push(sId);
                if (newIds.length === 0) delete next[viewingClass];
                else if (newIds.length === allS.length) next[viewingClass] = { ...cfg, studentIds: [] };
                else next[viewingClass] = { ...cfg, studentIds: newIds };
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!formData.title) return alert("Titre requis !");
        const targets = Object.keys(distribution);
        if (targets.length === 0) return alert("Sélectionnez au moins une classe !");
        const missing = targets.find(t => !distribution[t].chapterId);
        if (missing) return alert(`La classe ${missing} n'a pas de dossier sélectionné.`);

        setIsPublishing(true);
        try {
            const byChap = {};
            targets.forEach(t => {
                const cid = distribution[t].chapterId;
                if(!byChap[cid]) byChap[cid] = [];
                byChap[cid].push(t);
            });

            for (const chapId of Object.keys(byChap)) {
                const classes = byChap[chapId];
                let finalIds = [];
                let isGlobal = true;

                for (const cls of classes) {
                    const cfg = distribution[cls];
                    if (cfg.studentIds.length > 0) {
                        isGlobal = false;
                        finalIds.push(...cfg.studentIds);
                    } else {
                        // FIX: Normalisation stricte pour être sûr de trouver les élèves
                        const sOfClass = allStudents.filter(s => (s.currentClass || "").trim().toUpperCase() === cls.trim().toUpperCase()).map(s => s._id);
                        finalIds.push(...sOfClass);
                    }
                }
                
                const payload = { 
                    ...formData, 
                    chapterId: chapId, 
                    teacherId: user.id || user._id, 
                    targetClassrooms: classes, 
                    assignedStudents: isGlobal ? [] : finalIds, 
                    isAllClass: isGlobal 
                };
                
                await fetch('/api/games', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
            }
            onClose();
        } catch(e) { alert("Erreur Sauvegarde"); }
        setIsPublishing(false);
    };

    if (!user) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center">Chargement...</div>;

    const currentClassFolders = getChaptersForClass(viewingClass);
    const studentsInView = allStudents.filter(s => s.currentClass === viewingClass).sort((a,b)=>a.lastName.localeCompare(b.lastName));
    const distCfg = distribution[viewingClass];
    const isSel = !!distCfg;
    const isPartial = isSel && distCfg.studentIds.length > 0;
    const isFull = isSel && !isPartial;
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
                    <div className="v84-ai-widget"><span className="text-2xl">✨</span><div className="flex-1"><h5 className="font-black text-xs uppercase mb-1">Générateur Magique</h5><input className="v84-ai-input w-full" placeholder="Sujet..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAiGen()} /></div><button className="v84-ai-btn" onClick={handleAiGen} disabled={aiLoading}>{aiLoading ? '...' : 'GÉNÉRER 5 Q.'}</button></div>
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
                    
                    <button onClick={toggleAllLevel} className={`w-full py-3 mb-4 rounded-xl font-black text-xs uppercase transition-all ${isAllLevelSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                        {isAllLevelSelected ? '✕ TOUT DÉSACTIVER' : '✓ TOUT LE NIVEAU'}
                    </button>

                    <div className="flex flex-wrap gap-2 mb-6">
                        {availableClasses.map(c => {
                            const isTarget = !!distribution[c.name];
                            const isP = isTarget && distribution[c.name].studentIds.length > 0;
                            return (
                                <button key={c._id} onClick={() => handleClassToggle(c.name)} className={`v84-tab-btn-game ${viewingClass === c.name ? 'scale-110 shadow-md border-slate-800' : ''} ${isTarget ? (isP ? 'bg-pink-500 text-white' : 'bg-purple-600 text-white') : 'inactive'}`}>{c.name}</button>
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
                                <div className={`p-3 border-b border-opacity-20 ${isPartial ? 'bg-pink-50 border-pink-200' : 'bg-purple-50 border-purple-200'}`}>
                                    <select className={`w-full text-[10px] font-bold p-2 rounded-lg border-2 outline-none ${isPartial ? 'border-pink-200 text-pink-900' : 'border-purple-200 text-purple-900'}`} value={distCfg.chapterId} onChange={e => handleUpdateChapter(viewingClass, e.target.value)}>
                                        <option value="">-- CHOISIR DOSSIER --</option>
                                        {currentClassFolders.map(c => <option key={c._id} value={c._id}>{c.section ? `[${c.section}] ` : ''}{c.title}</option>)}
                                    </select>
                                    {currentClassFolders.length === 0 && <p className="text-[9px] text-red-500 mt-1 font-bold">Aucun dossier.</p>}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                {studentsInView.map(s => {
                                    const isChecked = isSel && (isFull || distCfg.studentIds.includes(s._id));
                                    const activeBg = isPartial ? 'bg-pink-100' : 'bg-purple-100';
                                    const activeText = isPartial ? 'text-pink-600' : 'text-purple-600';
                                    return (
                                        <div key={s._id} onClick={() => toggleStudent(s._id)} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? activeBg : 'hover:bg-slate-100'}`}>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? activeColorClass : 'border-slate-300'}`}>{isChecked && <span className="text-white text-[9px]">✓</span>}</div>
                                            <span className={`text-xs font-bold ${isChecked ? activeText : 'text-slate-500'}`}>{s.lastName} {s.firstName}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : <div className="text-center text-slate-300 font-bold mt-10 text-xs">SÉLECTIONNEZ UNE CLASSE</div>}

                    <button className="v84-game-publish-btn" onClick={handleSave} disabled={isPublishing}>{isPublishing ? 'PUBLICATION...' : 'ENREGISTRER LE JEU 🚀'}</button>
                </div>
            </div>
        </div>
    );
}