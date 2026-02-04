// @signatures: GameStudio, handleAddLevel, handleAddQuestion, handleDeleteLevel, handleDeleteQuestion, handleDrop, handleFileSelect, handleGenerateAI, handleInput, handleMoveQuestions, handleOpenSheet, handlePaste, handleRemoveAsset, handleRemoveFile, handleSave, handleSelectQuestion, handleToggleSelect, handleToggleStudent, handleUpdateAssetVideo, handleUploadAsset, isQuestionSelected, loadData, toggleAllStudents, updateQuestion
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import { StudioUtils } from '../homework/HomeworkStudio'; 

const DEFAULT_QUIZ_DATA = { 
    title: '', chapterId: '', teacherId: null, 
    targetClassrooms: [], assignedStudents: [], isAllClass: true, 
    globalIntro: { sheetUrl: "", videoUrl: "" },
    levels: [
        { 
            name: "Niveau 1", 
            intro: { sheetUrl: "", videoUrl: "" },
            questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }] 
        }
    ]
};

export default function GameStudio({ initialData, chapters, classFilter, user, targetSection, onClose }) {
    
    const initData = () => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_QUIZ_DATA };
        if (base.questions && (!base.levels || base.levels.length === 0)) {
            base.levels = [{ name: "Niveau 1", questions: base.questions, intro: {} }];
            delete base.questions;
        }
        if (!base.globalIntro) base.globalIntro = { sheetUrl: "", videoUrl: "" };
        base.levels.forEach(l => { if(!l.intro) l.intro = { sheetUrl: "", videoUrl: "" }; });
        base.teacherId = user.id || user._id;
        if (!base.targetClassrooms || base.targetClassrooms.length === 0) base.targetClassrooms = classFilter ? [classFilter] : [];
        return base;
    };

    const [formData, setFormData] = useState(initData());
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);
    const [selectedForMove, setSelectedForMove] = useState([]); 
    const [moveTargetLevel, setMoveTargetLevel] = useState("");
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(classFilter || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    
    // IA
    const [aiTopic, setAiTopic] = useState('');
    const [aiContextText, setAiContextText] = useState('');
    const [aiFile, setAiFile] = useState(null);
    const [aiGenerating, setAiGenerating] = useState(false);
    
    const fileInputRef = useRef(null);
    const assetInputRef = useRef(null);
    const [uploadTarget, setUploadTarget] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sts, cls] = await Promise.all([ api.get('/admin/students'), api.get('/admin/classrooms') ]);
            setAllStudents(sts); setAllClasses(cls);
            if (initialData) {
                const targets = initialData.targetClassrooms || [initialData.classroom];
                const newDist = {};
                targets.forEach(clsName => {
                    const clsObj = cls.find(c => c.name === clsName);
                    const clsId = clsObj ? String(clsObj._id) : null;
                    let classStudentIds = sts.filter(s => {
                        const isMain = (s.currentClass||"").trim().toUpperCase() === clsName.trim().toUpperCase();
                        const isOption = clsId && (s.assignedGroups||[]).some(gId => String(gId) === clsId);
                        return (isMain || isOption) && (initialData.assignedStudents||[]).includes(s._id);
                    }).map(s => s._id);
                    newDist[clsName] = { chapterId: initialData.chapterId, studentIds: classStudentIds };
                });
                setDistribution(newDist);
                if (targets.length > 0) setViewingClass(targets[0]);
            } else if (classFilter) {
                setViewingClass(classFilter);
                const defId = StudioUtils.findDefaultChapterId([classFilter], chapters, user, targetSection, cls);
                setDistribution({ [classFilter]: { chapterId: defId, studentIds: [] } });
            }
        } catch(e) {}
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [classFilter]);

    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const handleSelectQuestion = (lIdx, qIdx) => { setActiveLevelIdx(lIdx); setActiveQIdx(qIdx); };
    
    const handleAddLevel = () => {
        setFormData(p => ({ 
            ...p, 
            levels: [...p.levels, { name: `Niveau ${p.levels.length + 1}`, questions: [], intro: { sheetUrl: "", videoUrl: "" } }] 
        }));
        setActiveLevelIdx(formData.levels.length);
        setActiveQIdx(0);
    };

    const handleDeleteLevel = (e, lIdx) => {
        e.stopPropagation();
        if(!confirm("Supprimer ce niveau ?")) return;
        setFormData(p => {
            let newLevels = p.levels.filter((_, i) => i !== lIdx);
            if (newLevels.length === 0) newLevels = [{ name: "Niveau 1", questions: [], intro: {} }];
            return { ...p, levels: newLevels };
        });
        setActiveLevelIdx(0); setActiveQIdx(0);
    };

    const handleAddQuestion = () => {
        setFormData(p => {
            const newLevels = [...p.levels];
            newLevels[activeLevelIdx].questions.push({ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 });
            return { ...p, levels: newLevels };
        });
        setTimeout(() => setActiveQIdx(formData.levels[activeLevelIdx].questions.length), 0);
    };

    const handleDeleteQuestion = (e, lIdx, qIdx) => {
        e.stopPropagation();
        if(!confirm("Supprimer ?")) return;
        setFormData(p => {
            const newLevels = [...p.levels];
            newLevels[lIdx].questions = newLevels[lIdx].questions.filter((_, i) => i !== qIdx);
            return { ...p, levels: newLevels };
        });
        if(activeQIdx >= qIdx) setActiveQIdx(Math.max(0, activeQIdx - 1));
        setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx)));
    };

    const updateQuestion = (field, value, optionIndex = null) => { 
        setFormData(p => { 
            const newLevels = [...p.levels]; 
            if(!newLevels[activeLevelIdx] || !newLevels[activeLevelIdx].questions[activeQIdx]) return p;
            const currentQ = { ...newLevels[activeLevelIdx].questions[activeQIdx] }; 
            if (field === 'q' || field === 'a') { currentQ[field] = value; } 
            else if (field === 'options' && optionIndex !== null) { 
                const nextOptions = [...currentQ.options]; 
                nextOptions[optionIndex] = value; 
                currentQ.options = nextOptions; 
            } 
            newLevels[activeLevelIdx].questions[activeQIdx] = currentQ; 
            return { ...p, levels: newLevels }; 
        }); 
    };

    const handleToggleSelect = (e, lIdx, qIdx) => { e.stopPropagation(); const exists = selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx); if (exists) setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx))); else setSelectedForMove(prev => [...prev, { lIdx, qIdx }]); };
    const isQuestionSelected = (lIdx, qIdx) => selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx);
    const handleMoveQuestions = () => { if (moveTargetLevel === "" || isNaN(parseInt(moveTargetLevel))) return; const targetIdx = parseInt(moveTargetLevel); setFormData(prev => { const newLevels = prev.levels.map(l => ({ ...l, questions: [...l.questions] })); const questionsToMove = []; newLevels.forEach((lvl, lIdx) => { lvl.questions.forEach((q, qIdx) => { if (isQuestionSelected(lIdx, qIdx)) questionsToMove.push(q); }); }); newLevels.forEach((lvl, lIdx) => { lvl.questions = lvl.questions.filter((_, qIdx) => !isQuestionSelected(lIdx, qIdx)); }); newLevels[targetIdx].questions.push(...questionsToMove); return { ...prev, levels: newLevels }; }); setSelectedForMove([]); setActiveLevelIdx(targetIdx); setActiveQIdx(0); };

    const handleUploadAsset = async (e) => {
        const file = e.target.files[0];
        if (!file || uploadTarget === null) return;
        setLoading(true);
        const fd = new FormData(); fd.append('file', file);
        try {
            const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.url) {
                setFormData(prev => {
                    const next = { ...prev };
                    if (uploadTarget === -1) next.globalIntro = { ...next.globalIntro, sheetUrl: data.url };
                    else next.levels[uploadTarget].intro = { ...next.levels[uploadTarget].intro, sheetUrl: data.url };
                    return next;
                });
            }
        } catch(err) { alert("Erreur upload"); }
        setLoading(false); e.target.value = null;
    };
    const handleRemoveAsset = (idx) => { setFormData(prev => { const next = { ...prev }; if (idx === -1) next.globalIntro.sheetUrl = ""; else next.levels[idx].intro.sheetUrl = ""; return next; }); };
    const handleUpdateAssetVideo = (idx, url) => { setFormData(prev => { const next = { ...prev }; if (idx === -1) next.globalIntro.videoUrl = url; else next.levels[idx].intro.videoUrl = url; return next; }); };
    const handleOpenSheet = (url) => { window.open(url, '_blank'); };

    const handlePaste = (e) => { const items = e.clipboardData.items; for (let i = 0; i < items.length; i++) { if (items[i].kind === 'file') { setAiFile(items[i].getAsFile()); e.preventDefault(); return; } } };
    const handleDrop = (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setAiFile(e.dataTransfer.files[0]); };
    const handleFileSelect = (e) => { if (e.target.files[0]) setAiFile(e.target.files[0]); };
    const handleRemoveFile = (e) => { e.stopPropagation(); setAiFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; };

    const handleGenerateAI = async (mode = 'manual') => {
        setAiGenerating(true);
        try {
            const fd = new FormData();
            
            if (mode === 'sheet') {
                const sheetUrl = currentLevel.intro?.sheetUrl;
                if (!sheetUrl) return alert("Pas de fiche dans ce niveau !");
                fd.append('sheetUrl', sheetUrl);
            } 
            else {
                if (!aiTopic) {
                    setAiGenerating(false);
                    return alert("Entrez un sujet !");
                }
            }
            
            fd.append('topic', aiTopic || (mode === 'sheet' ? "Génère un quiz d'après cette fiche" : "Quiz"));
            fd.append('count', 5);

            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const cleaned = await res.json();

            if (Array.isArray(cleaned) && cleaned.length > 0) {
                setFormData(p => {
                    const newLevels = [...p.levels];
                    if (newLevels[activeLevelIdx].questions.length === 1 && newLevels[activeLevelIdx].questions[0].q === 'Nouvelle question') {
                        newLevels[activeLevelIdx].questions = cleaned;
                    } else {
                        newLevels[activeLevelIdx].questions = [...newLevels[activeLevelIdx].questions, ...cleaned];
                    }
                    return { ...p, levels: newLevels };
                });
                setActiveQIdx(0);
                setAiTopic("");
            } else { alert("L'IA n'a rien généré."); }
        } catch(e) { alert("Erreur IA"); } 
        setAiGenerating(false); 
    };

    const currentLevel = formData.levels[activeLevelIdx];
    const safeQList = currentLevel ? currentLevel.questions : [];
    const currentQ = safeQList[activeQIdx];
    const hasLevelSheet = !!currentLevel?.intro?.sheetUrl;
    const totalQuestionsCount = formData.levels.reduce((acc, l) => acc + l.questions.length, 0);

    const targetLevel = allClasses.find(c => c.name === viewingClass)?.level;
    const myClassesIds = (user.assignedClasses || []).map(c => String(c._id || c));
    const availableClasses = allClasses.filter(c => { if (targetLevel) if (String(c.level) !== String(targetLevel)) return false; if (user.isDeveloper || user.role === 'admin') return true; return myClassesIds.includes(String(c._id)); }).sort((a,b) => a.name.localeCompare(b.name));
    const rawStudents = StudioUtils.getStudentsForViewingClass(viewingClass, allStudents, allClasses);
    const studentsToDisplay = rawStudents.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()));
    
    const handleToggleStudent = (sId) => { setDistribution(prev => { const next = { ...prev }; const cfg = next[viewingClass]; if (!cfg) { const defId = StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses); next[viewingClass] = { chapterId: defId, studentIds: [sId] }; } else { let newIds = cfg.studentIds.length === 0 ? rawStudents.map(s => s._id).filter(id => id !== sId) : (cfg.studentIds.includes(sId) ? cfg.studentIds.filter(id => id !== sId) : [...cfg.studentIds, sId]); if (newIds.length === 0) delete next[viewingClass]; else if (newIds.length === rawStudents.length) next[viewingClass] = { ...cfg, studentIds: [] }; else next[viewingClass] = { ...cfg, studentIds: newIds }; } return next; }); };
    const toggleAllStudents = () => { setDistribution(prev => { const next = { ...prev }; if (next[viewingClass]) delete next[viewingClass]; else { const defId = StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses); next[viewingClass] = { chapterId: defId, studentIds: [] }; } return next; }); };
    
    // --- VARIABLES MANQUANTES RESTAURÉES ---
    const isClassSelected = !!distribution[viewingClass];
    const distCfg = distribution[viewingClass];
    const selectedClassesList = Object.keys(distribution);
    const availableChapters = StudioUtils.getChaptersForContext(selectedClassesList.length > 1 ? selectedClassesList : [viewingClass], chapters, user, targetSection, allClasses);

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        if (totalQuestionsCount === 0) return alert("Ajoutez au moins une question !");
        setLoading(true);
        try {
            for (const cls of targets) {
                const cfg = distribution[cls];
                let realChapterId = cfg.chapterId || StudioUtils.findDefaultChapterId([cls], chapters, user, targetSection, allClasses);
                let finalIds = cfg.studentIds.length > 0 ? cfg.studentIds : StudioUtils.getStudentsForViewingClass(cls, allStudents, allClasses).map(s => s._id);
                await api.post('/games', { ...formData, chapterId: realChapterId, targetClassrooms: [cls], teacherId: user.id || user._id, assignedStudents: finalIds, isAllClass: cfg.studentIds.length === 0, type: 'zombie' });
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); }
        setLoading(false);
    };

    return (
        <div className="v84-game-container">
            <input type="file" ref={assetInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleUploadAsset} />

            <div className="v84-game-header">
                <div className="flex items-center"><span className="v84-game-icon">🎮</span><input className="v84-game-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU QUIZ..." disabled={loading} /></div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            
            <div className="v84-game-body">
                {/* SIDEBAR GAUCHE */}
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {formData.levels.map((lvl, lIdx) => (
                        <div key={lIdx} className="v84-level-block">
                            <div className={`v84-level-header ${activeLevelIdx === lIdx ? 'active-lvl' : ''}`} onClick={() => { setActiveLevelIdx(lIdx); setActiveQIdx(0); }}>
                                {lvl.name} ({lvl.questions.length})
                                {formData.levels.length > 1 && <button className="v84-del-btn" onClick={(e) => handleDeleteLevel(e, lIdx)}>✕</button>}
                            </div>
                            
                            {activeLevelIdx === lIdx && (
                                <div className="v84-q-list">
                                    {lvl.questions.map((q, qIdx) => (
                                        <div key={qIdx} className={`v84-q-item ${activeQIdx === qIdx ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); handleSelectQuestion(lIdx, qIdx); }}>
                                            <input type="checkbox" className="v84-q-checkbox" checked={isQuestionSelected(lIdx, qIdx)} onChange={(e) => handleToggleSelect(e, lIdx, qIdx)} onClick={e => e.stopPropagation()} />
                                            <div className="v84-q-preview">Q{qIdx + 1}: {(q.q || "Question vide").substring(0, 30)}...</div>
                                            <button className="v84-del-btn" onClick={(e) => handleDeleteQuestion(e, lIdx, qIdx)}>✕</button>
                                        </div>
                                    ))}
                                    <button className="v84-add-q-btn" onClick={handleAddQuestion} disabled={loading}>+ QUESTION</button>
                                </div>
                            )}
                        </div>
                    ))}
                    {selectedForMove.length > 0 && <div className="v84-move-box"><div className="v84-move-title">{selectedForMove.length} Sélectionné(s)</div><div className="v84-move-actions"><select className="v84-move-select" value={moveTargetLevel} onChange={e => setMoveTargetLevel(e.target.value)}><option value="">Vers niveau...</option>{formData.levels.map((l, idx) => <option key={idx} value={idx}>{l.name}</option>)}</select><button className="v84-move-go-btn" onClick={handleMoveQuestions}>GO</button></div></div>}
                    <button className="v84-add-level-btn" onClick={handleAddLevel}>+ NOUVEAU NIVEAU</button>
                </div>

                {/* EDITOR CENTER */}
                <div className="v84-game-editor custom-scrollbar">
                    {/* RESSOURCES GLOBALES */}
                    {activeLevelIdx === 0 && activeQIdx === 0 && (
                        <div className="v84-resources-global">
                            <div className="v84-res-title global"><span>🌍</span> RESSOURCES GLOBALES</div>
                            <div className="v84-res-row">
                                {formData.globalIntro.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(formData.globalIntro.sheetUrl)}>📄 FICHE <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(-1); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(-1); assetInputRef.current.click(); }}>📤 FICHE</button> )}
                                <input className="v84-res-input" placeholder="Lien Vidéo..." value={formData.globalIntro.videoUrl} onChange={e => handleUpdateAssetVideo(-1, e.target.value)} />
                            </div>
                        </div>
                    )}
                    {/* RESSOURCES NIVEAU */}
                    {currentLevel && (
                        <div className="v84-resources-level">
                            <div className="v84-res-title local"><span>📍</span> RESSOURCES {currentLevel.name}</div>
                            <div className="v84-res-row">
                                {currentLevel.intro?.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(currentLevel.intro.sheetUrl)}>📄 FICHE <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(activeLevelIdx); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(activeLevelIdx); assetInputRef.current.click(); }}>📤 FICHE</button> )}
                                <input className="v84-res-input" placeholder="Vidéo..." value={currentLevel.intro?.videoUrl || ""} onChange={e => handleUpdateAssetVideo(activeLevelIdx, e.target.value)} />
                            </div>
                        </div>
                    )}
                    {/* IA WIDGET */}
                    <div className="v84-ai-widget">
                        <div className="v84-ai-row"><span className="text-2xl">🤖</span><input className="v84-ai-input" placeholder="Sujet / Consigne IA..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} /></div>
                        {hasLevelSheet && <button className="v84-gen-btn mb-2" onClick={() => handleGenerateAI('sheet')} disabled={aiGenerating}>{aiGenerating ? 'ANALYSE...' : '📄 GÉNÉRER D\'APRÈS LA FICHE DU NIVEAU'}</button>}
                        <button className={`v84-gen-btn ${hasLevelSheet ? 'bg-slate-400' : ''}`} onClick={() => handleGenerateAI('manual')} disabled={aiGenerating}>{aiGenerating ? '...' : (hasLevelSheet ? 'OU GÉNÉRER VIA LE SUJET' : 'GÉNÉRER VIA CE SUJET')}</button>
                    </div>
                    {/* EDITOR */}
                    {currentQ ? (
                        <div className="v84-q-card">
                            <span className="text-xs font-black text-slate-400 uppercase mb-4 block">{currentLevel.name} - Question {activeQIdx + 1}</span>
                            <textarea className="v84-q-input" value={currentQ.q || ""} onChange={e => updateQuestion('q', e.target.value)} rows="3" disabled={loading}/>
                            <div className="v84-answers-grid">{(currentQ.options || ['','','','']).map((opt, index) => (<div key={index} className={`v84-ans-row ${currentQ.a === index ? 'correct' : ''}`}><div className="v84-correct-radio" onClick={() => updateQuestion('a', index)}>{currentQ.a === index ? '✓' : ''}</div><input className="v84-ans-input" placeholder={`Opt ${index + 1}`} value={opt} onChange={e => updateQuestion('options', e.target.value, index)} disabled={loading}/></div>))}</div>
                        </div>
                    ) : <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase">Sélectionnez une question</div>}
                </div>

                {/* DISTRIBUTION */}
                <div className="v84-dist-sidebar custom-scrollbar">
                    <div className="mb-4 flex flex-wrap gap-2">{availableClasses.map(c => (<button key={c._id} onClick={() => { setViewingClass(c.name); setStudentSearch(""); }} className={`v84-tab-btn-game ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700' : ''}`} style={c.type === 'GROUP' ? { color: '#f59e0b', borderColor: '#fcd34d' } : {}}>{c.name}</button>))}</div>
                    {viewingClass && (
                        <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                            <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={toggleAllStudents}><span className="font-black text-slate-700 uppercase">{viewingClass}</span><div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isClassSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}>{isClassSelected && <span className="text-white text-xs">✓</span>}</div></div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 mb-4">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Dossier :</label>
                                <select className="w-full p-2 rounded-lg text-xs font-bold border border-slate-100 outline-none bg-slate-50" value={distCfg?.chapterId || StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses)} onChange={(e) => setDistribution(p => ({ ...p, [viewingClass]: { ...p[viewingClass], chapterId: e.target.value } }))} disabled={loading}>
                                    <option value="">-- CHOISIR --</option>
                                    {availableChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div className="relative mb-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px]">🔎</span><input className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-purple-400" placeholder="Chercher..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} /></div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {studentsToDisplay.map(s => { 
                                    const checked = isClassSelected && (distribution[viewingClass].studentIds.length === 0 || distribution[viewingClass].studentIds.includes(s._id));
                                    return (<div key={s._id} onClick={() => handleToggleStudent(s._id)} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${checked ? 'bg-purple-50 text-purple-700' : 'hover:bg-slate-100 text-slate-400'}`}>
                                        <div className={`w-4 h-4 rounded border shrink-0 ${checked ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}></div>
                                        <span className="text-[11px] font-bold truncate">{s.lastName} {s.firstName}</span>
                                    </div>); 
                                })}
                            </div>
                        </div>
                    )}
                    <button className="v84-game-publish-btn" onClick={handleSave} disabled={loading || totalQuestionsCount === 0}>{loading ? '...' : (initialData ? 'MODIFIER' : 'PUBLIER 🚀')}</button>
                </div>
            </div>
        </div>
    );
}
