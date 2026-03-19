// @signatures: GameStudio, handleAddLevel, handleAddQuestion, handleDeleteLevel, handleDeleteQuestion, handleDrop, handleFileSelect, handleGenerateAI, handleInput, handleMoveQuestions, handleOpenSheet, handlePaste, handleRemoveAsset, handleRemoveFile, handleSave, handleSelectQuestion, handleToggleSelect, handleUpdateAssetVideo, handleUploadAsset, isQuestionSelected, updateQuestion
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import { applySegmentToUrl, normalizeVideoUrl } from '../../../utils/videoSegments';

export default function GameStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses }) {
    
    // --- ÉTATS DONNÉES ---
    const [formData, setFormData] = useState(initialData || { 
        title: '', 
        type: 'zombie', // zombie, starship
        levels: [{ name: "Niveau 1", questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: {} }],
        globalIntro: { sheetUrl: "", videoUrl: "" }
    });
    
    // --- ÉTATS UI ÉDITEUR ---
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);
    const [selectedForMove, setSelectedForMove] = useState([]); 
    const [moveTargetLevel, setMoveTargetLevel] = useState("");
    
    // --- ÉTATS DISTRIBUTION (SIDEBAR) ---
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState("");
    const [studentSearch, setStudentSearch] = useState("");
    
    const [loading, setLoading] = useState(false);
    
    // --- ÉTATS IA & ASSETS ---
    const [aiTopic, setAiTopic] = useState('');
    const [aiCount, setAiCount] = useState(5);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [segmentCache, setSegmentCache] = useState({});
    const [selectedSegmentBySlot, setSelectedSegmentBySlot] = useState({});
    
    const fileInputRef = useRef(null);
    const assetInputRef = useRef(null);
    const [uploadTarget, setUploadTarget] = useState(null); // -1 = Global, 0+ = Level Index
    const teacherId = String(user?._id || user?.id || '').trim();

    // CHARGEMENT DE SECOURS SI PROPS MANQUANTES
    useEffect(() => {
        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            const load = async () => {
                setLoading(true);
                try {
                    const [sts, cls] = await Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')]);
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                } catch(e) {}
                setLoading(false);
            };
            load();
        }

        // RECONSTRUCTION DISTRIBUTION SI ÉDITION
        if (initialData && initialData.targetClassrooms) {
            const dist = {};
            initialData.targetClassrooms.forEach(clsName => {
                dist[clsName] = {
                    chapterId: initialData.chapterId || "",
                    studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
                };
            });
            setDistribution(dist);
            if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
        }
    }, []);

    // --- LOGIQUE ÉDITEUR (RESTAURÉE) ---
    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const handleSelectQuestion = (lIdx, qIdx) => { setActiveLevelIdx(lIdx); setActiveQIdx(qIdx); };
    
    const handleAddLevel = () => { 
        setFormData(p => ({ 
            ...p, 
            levels: [...p.levels, { name: `Niveau ${p.levels.length + 1}`, questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: { sheetUrl: "", videoUrl: "" } }] 
        })); 
        setTimeout(() => {
            setActiveLevelIdx(formData.levels.length); 
            setActiveQIdx(0);
        }, 0); 
    };

    const handleDeleteLevel = (e, lIdx) => { 
        e.stopPropagation(); 
        if(!confirm("Supprimer ce niveau ?")) return; 
        setFormData(p => { 
            let newLevels = p.levels.filter((_, i) => i !== lIdx); 
            if (newLevels.length === 0) newLevels = [{ name: "Niveau 1", questions: [{ q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }], intro: {} }]; 
            return { ...p, levels: newLevels }; 
        }); 
        setActiveLevelIdx(0); 
        setActiveQIdx(0); 
    };

    const handleAddQuestion = () => { 
        setFormData(p => { 
            const newLevels = p.levels.map((lvl, idx) => {
                if (idx !== activeLevelIdx) return lvl;
                return {
                    ...lvl,
                    questions: [...lvl.questions, { q: 'Nouvelle question', options: ['', '', '', ''], a: 0 }]
                };
            });
            return { ...p, levels: newLevels }; 
        }); 
        setTimeout(() => setActiveQIdx(formData.levels[activeLevelIdx].questions.length), 0); 
    };

    const handleDeleteQuestion = (e, lIdx, qIdx) => { 
        e.stopPropagation(); 
        setFormData(p => { 
            const newLevels = p.levels.map((lvl, idx) => {
                if (idx !== lIdx) return lvl;
                return {
                    ...lvl,
                    questions: lvl.questions.filter((_, i) => i !== qIdx)
                };
            });
            return { ...p, levels: newLevels }; 
        }); 
        if(activeQIdx >= qIdx) setActiveQIdx(Math.max(0, activeQIdx - 1)); 
        setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx))); 
    };
    const updateQuestion = (field, value, optionIndex = null) => { 
        setFormData(p => { 
            const newLevels = p.levels.map((lvl, idx) => {
                if (idx !== activeLevelIdx) return lvl;
                
                const newQuestions = lvl.questions.map((q, qIdx) => {
                    if (qIdx !== activeQIdx) return q;
                    
                    const updatedQ = { ...q };
                    if (field === 'q' || field === 'a') { 
                        updatedQ[field] = value; 
                    } else if (field === 'options' && optionIndex !== null) { 
                        updatedQ.options = updatedQ.options.map((opt, optIdx) => optIdx === optionIndex ? value : opt);
                    }
                    return updatedQ;
                });
                
                return { ...lvl, questions: newQuestions };
            });
            return { ...p, levels: newLevels }; 
        }); 
    };

    const handleToggleSelect = (e, lIdx, qIdx) => { 
        e.stopPropagation(); 
        const exists = selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx); 
        if (exists) setSelectedForMove(prev => prev.filter(s => !(s.lIdx === lIdx && s.qIdx === qIdx))); 
        else setSelectedForMove(prev => [...prev, { lIdx, qIdx }]); 
    };

    const isQuestionSelected = (lIdx, qIdx) => selectedForMove.some(s => s.lIdx === lIdx && s.qIdx === qIdx);

    const handleMoveQuestions = () => { 
        if (moveTargetLevel === "" || isNaN(parseInt(moveTargetLevel))) return; 
        const targetIdx = parseInt(moveTargetLevel); 
        
        setFormData(prev => { 
            const questionsToMove = [];
            prev.levels.forEach((lvl, lIdx) => {
                lvl.questions.forEach((q, qIdx) => {
                    if (isQuestionSelected(lIdx, qIdx)) questionsToMove.push(q);
                });
            });

            const newLevels = prev.levels.map((lvl, lIdx) => {
                // 1. On filtre les questions qui partent
                let filteredQuestions = lvl.questions.filter((_, qIdx) => !isQuestionSelected(lIdx, qIdx));
                
                // 2. Si c'est le niveau cible, on ajoute les questions
                if (lIdx === targetIdx) {
                    filteredQuestions = [...filteredQuestions, ...questionsToMove];
                }
                
                return { ...lvl, questions: filteredQuestions };
            });

            return { ...prev, levels: newLevels }; 
        }); 

        setSelectedForMove([]); 
        setActiveLevelIdx(targetIdx); 
        setActiveQIdx(0); 
    };

    const handleUploadAsset = async (e) => { const file = e.target.files[0]; if (!file || uploadTarget === null) return; setLoading(true); const fd = new FormData(); fd.append('file', file); try { const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd }); const data = await res.json(); if (data.url) { setFormData(prev => { const next = { ...prev }; if (uploadTarget === -1) next.globalIntro = { ...next.globalIntro, sheetUrl: data.url }; else next.levels[uploadTarget].intro = { ...next.levels[uploadTarget].intro, sheetUrl: data.url }; return next; }); } } catch(err) { alert("Erreur upload"); } setLoading(false); e.target.value = null; };
    const handleRemoveAsset = (idx) => { setFormData(prev => { const next = { ...prev }; if (idx === -1) next.globalIntro.sheetUrl = ""; else next.levels[idx].intro.sheetUrl = ""; return next; }); };
    const handleUpdateAssetVideo = (idx, url) => {
        setFormData(prev => {
            const next = { ...prev };
            if (idx === -1) next.globalIntro.videoUrl = url;
            else next.levels[idx].intro.videoUrl = url;
            return next;
        });
        const slot = idx === -1 ? 'global' : `level_${idx}`;
        setSelectedSegmentBySlot(prev => ({ ...prev, [slot]: '' }));
    };
    const handleOpenSheet = (url) => { window.open(url, '_blank'); };

    const fetchSegmentsForUrl = async (url = '') => {
        const norm = normalizeVideoUrl(url || '');
        if (!teacherId || !norm) return;
        if (segmentCache[norm]) return;
        try {
            const res = await fetch(`/api/learning/video-segments?teacherId=${encodeURIComponent(teacherId)}&url=${encodeURIComponent(norm)}`);
            const list = res.ok ? await res.json() : [];
            setSegmentCache(prev => ({ ...prev, [norm]: Array.isArray(list) ? list : [] }));
        } catch (_) {
            setSegmentCache(prev => ({ ...prev, [norm]: [] }));
        }
    };

    useEffect(() => {
        const urls = [];
        if (formData?.globalIntro?.videoUrl) urls.push(formData.globalIntro.videoUrl);
        (formData?.levels || []).forEach((lvl) => {
            if (lvl?.intro?.videoUrl) urls.push(lvl.intro.videoUrl);
        });
        const unique = [...new Set(urls.map((u) => normalizeVideoUrl(u)).filter(Boolean))];
        unique.forEach((u) => fetchSegmentsForUrl(u));
    }, [formData?.globalIntro?.videoUrl, formData?.levels, teacherId]);

    const renderSegmentButtons = (url, idx) => {
        const norm = normalizeVideoUrl(url || '');
        const list = segmentCache[norm] || [];
        if (!list.length) return null;
        const slot = idx === -1 ? 'global' : `level_${idx}`;
        const selectedId = selectedSegmentBySlot[slot] || '';
        return (
            <div className="mt-2 max-w-[340px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <div className="text-[9px] font-black uppercase text-slate-400 mb-1">Séquence vidéo</div>
                <select
                    className="w-full bg-transparent font-black text-[12px] text-slate-700 outline-none"
                    value={selectedId}
                    onChange={(e) => {
                        const sid = String(e.target.value || '');
                        const seg = list.find((s) => String(s._id || s.id || '') === sid);
                        if (!seg) return;
                        handleUpdateAssetVideo(idx, applySegmentToUrl(url, seg));
                        setSelectedSegmentBySlot(prev => ({ ...prev, [slot]: sid }));
                    }}
                >
                    <option value="">Choisir une séquence</option>
                    {list.map((seg, i) => {
                        const sid = String(seg._id || seg.id || '');
                        return (
                            <option key={sid || i} value={sid}>
                                {seg.label || `Séquence ${i + 1}`}
                            </option>
                        );
                    })}
                </select>
            </div>
        );
    };
    
    // --- LOGIQUE IA ---
    const handleGenerateAI = async (mode = 'manual') => {
        setAiGenerating(true);
        try {
            const fd = new FormData();
            if (mode === 'sheet') { 
                const sheetUrl = currentLevel.intro?.sheetUrl; 
                if (!sheetUrl) { setAiGenerating(false); return alert("Pas de fiche !"); }
                fd.append('sheetUrl', sheetUrl); 
            } else { 
                if (!aiTopic) { setAiGenerating(false); return alert("Sujet requis !"); } 
            }
            fd.append('topic', aiTopic || "Quiz"); 
            fd.append('count', aiCount);
            fd.append('teacherId', teacherId);
            
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const cleaned = await res.json();
            
            if (Array.isArray(cleaned) && cleaned.length > 0) {
                setFormData(p => {
                    const newLevels = p.levels.map((lvl, idx) => {
                        if (idx !== activeLevelIdx) return lvl;
                        
                        // Détermination de la destination (remplacement ou ajout)
                        const isDummy = lvl.questions.length === 1 && lvl.questions[0].q === 'Nouvelle question';
                        return {
                            ...lvl,
                            questions: isDummy ? [...cleaned] : [...lvl.questions, ...cleaned]
                        };
                    });
                    return { ...p, levels: newLevels };
                });
                setActiveQIdx(0); 
                setAiTopic("");
            } else { 
                alert("Rien généré."); 
            }
        } catch(e) { 
            alert("Erreur IA"); 
        } 
        setAiGenerating(false); 
    };

    // --- SAUVEGARDE ---
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        
        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls];
                if (!cfg.chapterId) return; 

                const isAllClass = cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET'}`;
                
                if (!groups[key]) groups[key] = { chapterId: cfg.chapterId, classrooms: [], assignedStudents: cfg.studentIds, isAllClass };
                groups[key].classrooms.push(cls);
            });

            for (const key of Object.keys(groups)) {
                const grp = groups[key];
                const payload = {
                    ...formData,
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id,
                    type: formData.type || 'zombie'
                };
                if (formData._id && key === Object.keys(groups)[0]) { /* update */ } else { delete payload._id; }
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); }
        setLoading(false);
    };

    const currentLevel = formData.levels[activeLevelIdx];
    const currentQ = currentLevel ? currentLevel.questions[activeQIdx] : null;
    const hasLevelSheet = !!currentLevel?.intro?.sheetUrl;
    const totalQuestionsCount = formData.levels.reduce((acc, l) => acc + l.questions.length, 0);

    return (
        <div className="v84-game-container">
             <input type="file" ref={assetInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleUploadAsset} />
            <div className="v84-game-header">
                <div className="flex items-center gap-4">
                    <input className="v84-game-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU QUIZ..." />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            
            <div className="v84-game-body">
                
                {/* 1. SIDEBAR GAUCHE : ARBRE DES NIVEAUX */}
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
                    {selectedForMove.length > 0 && (
                        <div className="v84-move-box">
                            <div className="v84-move-title">{selectedForMove.length} Sélectionné(s)</div>
                            <div className="v84-move-actions">
                                <select className="v84-move-select" value={moveTargetLevel} onChange={e => setMoveTargetLevel(e.target.value)}><option value="">Vers niveau...</option>{formData.levels.map((l, idx) => <option key={idx} value={idx}>{l.name}</option>)}</select>
                                <button className="v84-move-go-btn" onClick={handleMoveQuestions}>GO</button>
                            </div>
                        </div>
                    )}
                    <button className="v84-add-level-btn" onClick={handleAddLevel}>+ NOUVEAU NIVEAU</button>
                </div>

                {/* 2. CENTRE : ÉDITEUR DE CONTENU */}
                <div className="v84-game-editor custom-scrollbar">
                    {/* ZONE RESSOURCES (INTRO) */}
                    {activeLevelIdx === 0 && activeQIdx === 0 && (
                        <div className="v84-resources-global">
                            <div className="v84-res-title global"><span>🌍</span> RESSOURCES GLOBALES (INTRO JEU)</div>
                            <div className="v84-res-row">
                                {formData.globalIntro.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(formData.globalIntro.sheetUrl)}>📄 FICHE PRÊTE <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(-1); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(-1); assetInputRef.current.click(); }}>📤 AJOUTER FICHE</button> )}
                                <div className="flex-1">
                                    <input className="v84-res-input" placeholder="Lien Vidéo..." value={formData.globalIntro.videoUrl} onChange={e => handleUpdateAssetVideo(-1, e.target.value)} />
                                    {renderSegmentButtons(formData.globalIntro.videoUrl, -1)}
                                </div>
                            </div>
                        </div>
                    )}
                    {currentLevel && (
                        <div className="v84-resources-level">
                            <div className="v84-res-title local"><span>📍</span> RESSOURCES {currentLevel.name}</div>
                            <div className="v84-res-row">
                                {currentLevel.intro?.sheetUrl ? (
                                    <div className="v84-res-badge" onClick={() => handleOpenSheet(currentLevel.intro.sheetUrl)}>📄 FICHE NIVEAU <span className="v84-res-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAsset(activeLevelIdx); }}>✕</span></div>
                                ) : ( <button className="v84-res-btn upload" onClick={() => { setUploadTarget(activeLevelIdx); assetInputRef.current.click(); }}>📤 FICHE NIVEAU</button> )}
                                <div className="flex-1">
                                    <input className="v84-res-input" placeholder="Vidéo..." value={currentLevel.intro?.videoUrl || ""} onChange={e => handleUpdateAssetVideo(activeLevelIdx, e.target.value)} />
                                    {renderSegmentButtons(currentLevel.intro?.videoUrl || "", activeLevelIdx)}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* ZONE IA */}
                    <div className="v84-ai-widget">
                        <div className="v84-ai-row">
                            <span className="text-2xl">🤖</span>
                            <input className="v84-ai-input" placeholder="Sujet / Consigne IA..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                            <div className="flex items-center gap-2 bg-slate-100 rounded px-2 ml-2">
                                <label className="text-[10px] font-bold text-slate-500">NB:</label>
                                <input type="number" min="1" max="20" className="w-12 bg-transparent text-center font-bold" value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 1)} />
                            </div>
                        </div>
                        {hasLevelSheet && <button className="v84-gen-btn mb-2" onClick={() => handleGenerateAI('sheet')} disabled={aiGenerating}>{aiGenerating ? 'ANALYSE...' : '📄 GÉNÉRER D\'APRÈS LA FICHE DU NIVEAU'}</button>}
                        <button className={`v84-gen-btn ${hasLevelSheet ? 'bg-slate-400' : ''}`} onClick={() => handleGenerateAI('manual')} disabled={aiGenerating}>{aiGenerating ? '...' : (hasLevelSheet ? 'OU GÉNÉRER VIA LE SUJET' : 'GÉNÉRER VIA CE SUJET')}</button>
                    </div>

                    {/* ZONE QUESTION */}
                    {currentQ ? (
                        <div className="v84-q-card">
                            <span className="text-xs font-black text-slate-400 uppercase mb-4 block">{currentLevel.name} - Question {activeQIdx + 1}</span>
                            <textarea className="v84-q-input" value={currentQ.q || ""} onChange={e => updateQuestion('q', e.target.value)} rows="3" disabled={loading}/>
                            <div className="v84-answers-grid">{(currentQ.options || ['','','','']).map((opt, index) => (<div key={index} className={`v84-ans-row ${currentQ.a === index ? 'correct' : ''}`}><div className="v84-correct-radio" onClick={() => updateQuestion('a', index)}>{currentQ.a === index ? '✓' : ''}</div><input className="v84-ans-input" placeholder={`Opt ${index + 1}`} value={opt} onChange={e => updateQuestion('options', e.target.value, index)} disabled={loading}/></div>))}</div>
                        </div>
                    ) : <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase">Sélectionnez une question</div>}
                </div>

                {/* 3. SIDEBAR DROITE : DISTRIBUTION UNIFIÉE */}
                <StudioDistributionSidebar 
                    user={user}
                    allClasses={allClasses}
                    allStudents={allStudents}
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetSection={targetSection}
                    targetLevel={targetLevel} // 🚀 TRANSMISSION DU FILTRE
                    loading={loading}
                    onSave={handleSave}
                />
            </div>
        </div>
    );
}
