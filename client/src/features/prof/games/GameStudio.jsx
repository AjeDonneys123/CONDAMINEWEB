// @signatures: GameStudio, handleAddLevel, handleAddQuestion, handleDeleteLevel, handleDeleteQuestion, handleGenerateAI, handleInput, handleSave, updateQuestion
import React, { useState, useEffect, useRef } from 'react';
import './GameStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_QUIZ_DATA = { 
    title: '', chapterId: '', teacherId: null, 
    targetClassrooms: [], assignedStudents: [], isAllClass: true, 
    levels: [ { name: "Niveau 1", intro: { sheetUrl: "", videoUrl: "" }, questions: [{ q: 'Question ?', options: ['', '', '', ''], a: 0 }] } ]
};

export default function GameStudio({ initialData, chapters, allClasses, allStudents, globalClass, globalLevel, user, targetSection, onClose }) {
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [activeQIdx, setActiveQIdx] = useState(0);
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);

    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_QUIZ_DATA };
        base.teacherId = user.id || user._id;
        return base;
    });

    const findBestDefaultChapter = (clsName) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClasses || []).find(c => c.name === clsName);
        const matches = safeChapters.filter(c => {
            if (c.isArchived) return false;
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        return matches.length > 0 ? matches[0]._id : "";
    };

    useEffect(() => {
        if (formData && initialData) {
            const newDist = {};
            const targets = formData.targetClassrooms && formData.targetClassrooms.length > 0 ? formData.targetClassrooms : [globalClass];
            targets.forEach(clsName => {
                const clsObj = (allClasses || []).find(c => c.name === clsName);
                const ids = (allStudents || []).filter(s => {
                    const isM = (s.currentClass||"").trim().toUpperCase() === clsName.toUpperCase();
                    const isO = clsObj && (s.assignedGroups||[]).some(gId => String(gId) === String(clsObj._id));
                    return (isM || isO) && (formData.assignedStudents||[]).includes(String(s._id));
                }).map(s => String(s._id));
                newDist[clsName] = { chapterId: formData.chapterId || findBestDefaultChapter(clsName), studentIds: ids };
            });
            setDistribution(newDist);
        }
    }, [initialData]);

    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const updateQuestion = (field, value, optionIndex = null) => { 
        setFormData(p => { 
            const next = [...p.levels];
            const q = next[activeLevelIdx].questions[activeQIdx];
            if (field === 'q' || field === 'a') q[field] = value;
            else if (field === 'options') q.options[optionIndex] = value;
            return { ...p, levels: next };
        }); 
    };

    const handleAddQuestion = () => {
        setFormData(p => {
            const next = [...p.levels];
            next[activeLevelIdx].questions.push({ q: 'Nouvelle Question', options: ['', '', '', ''], a: 0 });
            return { ...p, levels: next };
        });
        setTimeout(() => setActiveQIdx(formData.levels[activeLevelIdx].questions.length - 1), 0);
    };

    const handleGenerateAI = async () => {
        if (!aiTopic) return alert("Sujet requis !");
        setAiGenerating(true);
        try {
            const res = await fetch('/api/games/generate-content', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ topic: aiTopic, count: 5 }) 
            });
            const cleaned = await res.json();
            if (Array.isArray(cleaned)) {
                setFormData(p => {
                    const next = [...p.levels];
                    next[activeLevelIdx].questions = [...next[activeLevelIdx].questions, ...cleaned];
                    return { ...p, levels: next };
                });
                setAiTopic("");
            }
        } catch(e) { alert("Erreur IA"); } finally { setAiGenerating(false); }
    };

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        setLoading(true);
        try {
            const originalId = initialData?._id;
            for (const clsName of targets) {
                const cfg = distribution[clsName];
                const payload = { 
                    ...formData, 
                    chapterId: cfg.chapterId || findBestDefaultChapter(clsName), 
                    targetClassrooms: [clsName], 
                    assignedStudents: cfg.studentIds, 
                    isAllClass: cfg.studentIds.length === 0, 
                    teacherId: user.id || user._id,
                    subject: targetSection || "GÉNÉRAL"
                };
                if (originalId && clsName === initialData?.targetClassrooms?.[0]) payload._id = originalId;
                else delete payload._id;
                await api.post('/games', payload);
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde."); } setLoading(false);
    };

    const currentLevel = formData.levels[activeLevelIdx];
    const currentQ = currentLevel?.questions[activeQIdx];

    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center gap-4 flex-1">
                    <span className="v84-game-icon">🎮</span>
                    <input className="v84-game-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU QUIZ..." />
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>
            <div className="v84-game-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {formData.levels.map((lvl, lIdx) => (
                        <div key={lIdx} className="v84-level-block">
                            <div className={`v84-level-header ${activeLevelIdx === lIdx ? 'active-lvl' : ''}`} onClick={() => setActiveLevelIdx(lIdx)}>
                                {lvl.name} ({lvl.questions.length})
                            </div>
                            {activeLevelIdx === lIdx && (
                                <div className="v84-q-list">
                                    {lvl.questions.map((q, qIdx) => (
                                        <div key={qIdx} className={`v84-q-item ${activeQIdx === qIdx ? 'active' : ''}`} onClick={() => setActiveQIdx(qIdx)}>
                                            <div className="v84-q-preview">Q{qIdx + 1}: {q.q}</div>
                                        </div>
                                    ))}
                                    <button className="v84-add-q-btn" onClick={handleAddQuestion}>+ Question</button>
                                </div>
                            )}
                        </div>
                    ))}
                    <button className="v84-add-level-btn" onClick={() => setFormData({...formData, levels: [...formData.levels, { name: `Niveau ${formData.levels.length + 1}`, questions: [], intro: {} }]})}>+ Nouveau Niveau</button>
                </div>
                
                <div className="v84-game-editor">
                    <div className="v84-ai-widget">
                        <div className="v84-ai-row">
                            <span className="text-2xl">🤖</span>
                            <input className="v84-ai-input" placeholder="Sujet du quiz..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                            <button className="v84-gen-btn" onClick={handleGenerateAI} disabled={aiGenerating}>{aiGenerating ? '...' : 'GÉNÉRER'}</button>
                        </div>
                    </div>

                    {currentQ && (
                        <div className="v84-q-card animate-in fade-in">
                            <textarea className="v84-q-input" value={currentQ.q} onChange={e => updateQuestion('q', e.target.value)} placeholder="Tapez la question..." />
                            <div className="v84-answers-grid">
                                {currentQ.options.map((opt, i) => (
                                    <div key={i} className={`v84-ans-row ${currentQ.a === i ? 'correct' : ''}`}>
                                        <div className="v84-correct-radio" onClick={() => updateQuestion('a', i)}>{currentQ.a === i ? '✓' : ''}</div>
                                        <input className="v84-ans-input" value={opt} onChange={e => updateQuestion('options', e.target.value, i)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <StudioDistributionSidebar 
                    user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch={studentSearch} setStudentSearch={setStudentSearch} targetLevel={globalLevel} loading={loading} onSave={handleSave} saveLabel="PUBLIER LE QUIZ 🚀"
                    targetSection={targetSection}
                />
            </div>
        </div>
    );
}
