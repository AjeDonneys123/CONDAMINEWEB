// @signatures: HomeworkStudio, handleAddLevel, handleDeleteLevel, handleInput, handleSave, handleUpload, loadData, updateLevel, getAvailableChapters, findBestDefaultChapter
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_HW_DATA = { 
    title: '', chapterId: '', teacherId: null, 
    targetClassrooms: [], assignedStudents: [], isAllClass: true,
    isPunishment: false,
    levels: [ { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] } ]
};

export default function HomeworkStudio({ initialData, chapters, globalClass, globalLevel, user, targetSection, onClose }) {

    const getAvailableChapters = (clsName, allClassesList) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClassesList || []).find(c => c.name === clsName);
        return safeChapters.filter(c => {
            if (c.isArchived) return false;
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const findBestDefaultChapter = (clsName, allClassesList) => {
        const av = getAvailableChapters(clsName, allClassesList);
        return av.length > 0 ? av[0]._id : "";
    };

    const initData = () => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        base.teacherId = user.id || user._id;
        return base;
    };

    const [formData, setFormData] = useState(initData());
    const [activeLevelIdx, setActiveLevelIdx] = useState(0);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    const [uploadMode, setUploadMode] = useState(null); 

    const loadData = async () => {
        setLoading(true);
        try {
            const [sts, cls] = await Promise.all([ api.get('/admin/students'), api.get('/admin/classrooms') ]);
            setAllStudents(sts || []); setAllClasses(cls || []); 
            if (formData) {
                const newDist = {};
                // L'édition se concentre sur les classes du document chargé
                const targets = formData.targetClassrooms && formData.targetClassrooms.length > 0 ? formData.targetClassrooms : [globalClass];
                targets.forEach(clsName => {
                    const clsObj = (cls || []).find(c => c.name === clsName);
                    const ids = (sts || []).filter(s => {
                        const isM = (s.currentClass||"").trim().toUpperCase() === clsName.toUpperCase();
                        const isO = clsObj && (s.assignedGroups||[]).some(gId => String(gId) === String(clsObj._id));
                        return (isM || isO) && (formData.assignedStudents||[]).includes(String(s._id));
                    }).map(s => String(s._id));
                    newDist[clsName] = { chapterId: formData.chapterId || findBestDefaultChapter(clsName, cls), studentIds: ids };
                });
                setDistribution(newDist);
            }
        } catch(e) {}
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const updateLevel = (field, value) => { setFormData(p => { const next = p.levels.map((lvl, idx) => idx === activeLevelIdx ? { ...lvl, [field]: value } : lvl); return { ...p, levels: next }; }); };
    const handleAddLevel = () => { setFormData(p => ({ ...p, levels: [...p.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }] })); setActiveLevelIdx(formData.levels.length); };
    const handleDeleteLevel = (e, idx) => { e.stopPropagation(); if (formData.levels.length === 1) return; if(!confirm("Supprimer cette page ?")) return; setFormData(p => { const next = p.levels.filter((_, i) => i !== idx); return { ...p, levels: next }; }); setActiveLevelIdx(0); };

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files); if (files.length === 0 || !uploadMode) return;
        const currentMode = uploadMode; const currentLvl = activeLevelIdx;
        setLoading(true); const fd = new FormData(); files.forEach(f => fd.append('files', f)); if (e.target) e.target.value = "";
        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.urls) {
                setFormData(prev => {
                    const next = { ...prev }; const newLevels = next.levels.map((lvl, idx) => {
                        if (idx === currentLvl) {
                            const field = currentMode === 'instruction' ? 'instructionUrls' : 'attachmentUrls';
                            return { ...lvl, [field]: Array.from(new Set([...(lvl[field] || []), ...data.urls])) };
                        }
                        return lvl;
                    });
                    return { ...next, levels: newLevels };
                });
            }
        } catch(e) { alert("Erreur upload"); } finally { setLoading(false); setUploadMode(null); }
    };

    // --- SAUVEGARDE ATOMIQUE : 1 CLASSE = 1 REQUÊTE ---
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title.trim()) return alert("❌ Titre requis !");
        if (targets.length === 0) return alert("❌ Sélectionnez au moins une classe !");
        
        setLoading(true);
        try {
            const originalId = initialData?._id;
            const originalClass = initialData?.targetClassrooms?.[0]; // On assume 1 doc = 1 classe désormais
            let idUsed = false;

            for (const clsName of targets) {
                const cfg = distribution[clsName];
                const { actType, typeLabel, date, __v, createdAt, updatedAt, ...cleanFormData } = formData;

                const payload = { 
                    ...cleanFormData, 
                    chapterId: cfg.chapterId || findBestDefaultChapter(clsName, allClasses), 
                    targetClassrooms: [clsName], 
                    assignedStudents: cfg.studentIds, 
                    isAllClass: (cfg.studentIds || []).length === 0, 
                    teacherId: user.id || user._id, 
                    type: 'homework',
                    subject: targetSection || "GÉNÉRAL"
                };

                // Si cette classe est celle d'origine, on fait un UPDATE
                if (originalId && clsName === originalClass && !idUsed) {
                    payload._id = originalId;
                    idUsed = true;
                } else {
                    // Sinon, on supprime l'ID pour forcer un CLONE (Création d'un doc séparé)
                    delete payload._id;
                }

                await api.post('/homework', payload);
            }
            onClose();
        } catch(e) { alert("Erreur lors de la sauvegarde."); } finally { setLoading(false); }
    };

    const currentLevelData = formData.levels[activeLevelIdx];

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleUpload} />
            <div className="v84-hw-header">
                <div className="flex items-center gap-4 flex-1">
                    <span className="text-3xl bg-orange-500 text-white p-2 rounded-xl">📝</span>
                    <input className="v84-hw-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU DEVOIR..." />
                    <button onClick={() => handleInput('isPunishment', !formData.isPunishment)} className={`ml-4 px-4 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${formData.isPunishment ? 'bg-red-600 text-white shadow-lg animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                        {formData.isPunishment ? '🚨 MODE PUNITION ACTIF' : '⚖️ DÉFINIR COMME PUNITION'}
                    </button>
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="v84-hw-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    <div className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-2">Pages du Devoir</div>
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className={`v84-level-header ${activeLevelIdx === idx ? 'active-lvl' : ''}`} onClick={() => setActiveLevelIdx(idx)}>
                            <span className="flex items-center gap-2"><span className="opacity-30">#</span> PAGE {idx + 1}</span>
                            {formData.levels.length > 1 && <button className="v84-del-btn" onClick={(e) => handleDeleteLevel(e, idx)}>✕</button>}
                        </div>
                    ))}
                    <button className="v84-add-level-btn mt-6" onClick={handleAddLevel}>+ NOUVELLE PAGE</button>
                </div>

                <div className="v84-hw-editor custom-scrollbar">
                    {currentLevelData ? (
                        <div className="v84-hw-card animate-in fade-in">
                            <div className="mb-6">
                                <label className="v84-folder-label">CONSIGNE TEXTUELLE (Étape {activeLevelIdx + 1})</label>
                                <textarea className="v84-hw-textarea !h-32 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl" placeholder="Instructions..." value={currentLevelData.instruction} onChange={e => updateLevel('instruction', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-6 bg-slate-50 rounded-[30px] border-2 border-slate-100">
                                    <label className="v84-folder-label mb-4 block">📸 Consigne Images</label>
                                    <div className="flex flex-wrap gap-3">
                                        {(currentLevelData.instructionUrls || []).map((url, i) => (
                                            <div key={i} className="group relative w-20 h-20 bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                <img src={url} className="w-full h-full object-cover" />
                                                <button className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100" onClick={() => updateLevel('instructionUrls', currentLevelData.instructionUrls.filter((_, j) => i !== j))}>✕</button>
                                            </div>
                                        ))}
                                        <button className="w-20 h-20 border-3 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-3xl text-slate-300 hover:border-orange-400 hover:text-orange-400 transition-all" onClick={() => { setUploadMode('instruction'); fileInputRef.current.click(); }}>+</button>
                                    </div>
                                </div>
                                <div className="p-6 bg-indigo-50/50 rounded-[30px] border-2 border-indigo-100/50">
                                    <label className="v84-folder-label !text-indigo-500 mb-4 block">📁 Documents de Travail</label>
                                    <div className="flex flex-wrap gap-3">
                                        {(currentLevelData.attachmentUrls || []).map((url, i) => (
                                            <div key={i} className="group relative w-20 h-20 bg-white border-2 border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                                                <img src={url} className="w-full h-full object-cover" />
                                                <button className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black opacity-0 group-hover:opacity-100" onClick={() => updateLevel('attachmentUrls', currentLevelData.attachmentUrls.filter((_, j) => i !== j))}>✕</button>
                                            </div>
                                        ))}
                                        <button className="w-20 h-20 border-3 border-dashed border-indigo-200 rounded-xl flex items-center justify-center text-3xl text-indigo-300 hover:border-indigo-400 transition-all" onClick={() => { setUploadMode('attachment'); fileInputRef.current.click(); }}>+</button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t-2 border-slate-50">
                                <label className="v84-folder-label !text-purple-600 mb-2 block">🤖 Intelligence Artificielle (Indices)</label>
                                <textarea className="v84-hw-textarea !h-24 !bg-purple-50/50 !p-4 !text-sm border-2 border-purple-100 rounded-2xl" value={currentLevelData.aiHints} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Énumérez ici les éléments indispensables..." />
                            </div>
                        </div>
                    ) : ( <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4"><span className="text-6xl">📄</span><span className="font-black uppercase tracking-widest">Sélectionnez ou créez une page</span></div> )}
                </div>

                <StudioDistributionSidebar 
                    user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch={studentSearch} setStudentSearch={setStudentSearch} targetLevel={globalLevel} targetSection={targetSection} loading={loading} onSave={handleSave} saveLabel={initialData ? "MODIFIER" : "PUBLIER LE DEVOIR 🚀"}
                />
            </div>
        </div>
    );
}
