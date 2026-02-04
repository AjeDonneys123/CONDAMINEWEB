// @signatures: HomeworkStudio, StudioUtils, getAvailableChapters, handleAddAttachment, handleDateChange, handleDrop, handleFileSelect, handleInput, handlePaste, handleRemoveAttachment, handleSave, handleToggleStudent, loadData, toggleAllStudents
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';

const StudioUtils = {
    getStudentsForViewingClass: (clsName, allStudents, allClasses) => {
        if (!clsName) return [];
        const clsObj = allClasses.find(c => c.name === clsName);
        const clsId = clsObj ? String(clsObj._id) : null;
        return allStudents.filter(s => {
            const mainClass = (s.currentClass || "").trim().toUpperCase();
            if (mainClass === clsName) return true;
            if (clsId && (s.assignedGroups || []).some(g => String(g) === clsId || String(g._id) === clsId)) return true;
            return false;
        }).sort((a,b) => a.lastName.localeCompare(b.lastName));
    }
};

const DEFAULT_HW_DATA = { 
    title: '', content: '', date: '', chapterId: '', teacherId: null, 
    targetClassrooms: [], assignedStudents: [], attachments: [], isAllClass: true 
};

export default function HomeworkStudio({ initialData, chapters, classFilter, user, targetSection, onClose }) {

    // --- INIT ---
    const initData = () => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        base.teacherId = user.id || user._id;
        if (!base.targetClassrooms || base.targetClassrooms.length === 0) {
            if (base.classroom) base.targetClassrooms = [base.classroom];
            else if (classFilter) base.targetClassrooms = [classFilter];
            else base.targetClassrooms = [];
        }
        if (!base.date) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            base.date = tomorrow.toISOString().split('T')[0];
        } else { base.date = base.date.split('T')[0]; }
        return base;
    };

    const [formData, setFormData] = useState(initData());
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(classFilter || "");
    const [studentSearch, setStudentSearch] = useState(""); 
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // --- LOGIQUE ---
    const getAvailableChapters = (clsName) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        if (safeChapters.length === 0) return [];
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = allClasses.find(c => c.name === clsName);

        let matches = safeChapters.filter(c => 
            !c.isArchived && (c.section || "GÉNÉRAL").toUpperCase().trim() === cleanSection
        );

        matches = matches.filter(c => {
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        });
        return matches.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const findBestDefaultChapter = (clsName) => {
        const available = getAvailableChapters(clsName);
        if (available.length > 0) return available[0]._id;
        return "";
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [sts, cls] = await Promise.all([ api.get('/admin/students'), api.get('/admin/classrooms') ]);
            const safeSts = Array.isArray(sts) ? sts : [];
            const safeCls = Array.isArray(cls) ? cls : [];
            setAllStudents(safeSts); setAllClasses(safeCls); 
            
            if (formData) {
                const targets = formData.targetClassrooms || [];
                const newDist = {};
                targets.forEach(clsName => {
                    const clsObj = safeCls.find(c => c.name === clsName);
                    const clsId = clsObj ? String(clsObj._id) : null;
                    let classStudentIds = safeSts.filter(s => {
                        const isMain = (s.currentClass||"").trim().toUpperCase() === clsName.trim().toUpperCase();
                        const isOption = clsId && (s.assignedGroups||[]).some(gId => String(gId) === clsId);
                        return (isMain || isOption) && (formData.assignedStudents||[]).includes(s._id);
                    }).map(s => s._id);

                    let chId = formData.chapterId;
                    if (!chId || chId === "") {
                        const localClsObj = safeCls.find(c => c.name === clsName);
                        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
                        const matches = (chapters || []).filter(c => 
                            !c.isArchived && (c.section || "GÉNÉRAL").toUpperCase().trim() === cleanSection &&
                            (c.classroom === clsName || (c.sharedLevel && localClsObj && String(c.sharedLevel) === String(localClsObj.level)) || (!c.classroom && !c.sharedLevel && (!c.hiddenIn || !c.hiddenIn.includes(clsName))))
                        ).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
                        if (matches.length > 0) chId = matches[0]._id;
                    }
                    newDist[clsName] = { chapterId: chId || "", studentIds: classStudentIds };
                });
                setDistribution(newDist);
                if (targets.length > 0 && !viewingClass) setViewingClass(targets[0]);
            }
        } catch(e) { console.error("Load Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    // AUTO-SELECT
    useEffect(() => {
        if (!viewingClass && allClasses.length > 0) {
            const myClassesIds = (user.assignedClasses || []).map(c => String(c._id || c));
            const myClasses = allClasses.filter(c => user.isDeveloper || user.role === 'admin' || myClassesIds.includes(String(c._id))).sort((a,b) => a.name.localeCompare(b.name));
            if (myClasses.length > 0) setViewingClass(myClasses[0].name);
        }
    }, [allClasses, viewingClass, user]);

    // --- HANDLERS ---
    const handleInput = (field, value) => setFormData(p => ({ ...p, [field]: value }));
    const handleDateChange = (e) => setFormData(p => ({ ...p, date: e.target.value }));
    const handleAddAttachment = async (file) => {
        setLoading(true); const fd = new FormData(); fd.append('file', file);
        try { const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd }); const data = await res.json(); if (data.url) setFormData(p => ({ ...p, attachments: [...p.attachments, { name: data.name, url: data.url, type: file.type }] })); } catch(e) { alert("Erreur upload"); } setLoading(false);
    };
    const handleRemoveAttachment = (idx) => setFormData(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== idx) }));
    const handleFileSelect = (e) => { if (e.target.files[0]) handleAddAttachment(e.target.files[0]); e.target.value = null; };
    const handlePaste = (e) => { const items = e.clipboardData.items; for (let i=0; i<items.length; i++) { if (items[i].kind === 'file') { handleAddAttachment(items[i].getAsFile()); return; } } };
    const handleDrop = (e) => { e.preventDefault(); if(e.dataTransfer.files[0]) handleAddAttachment(e.dataTransfer.files[0]); };

    // --- RENDER ---
    const targetLevel = allClasses.find(c => c.name === viewingClass)?.level;
    const myClassesIds = (user.assignedClasses || []).map(c => String(c._id || c));
    const availableClasses = allClasses.filter(c => { 
        if (targetLevel && String(c.level) !== String(targetLevel)) return false; 
        if (user.isDeveloper || user.role === 'admin') return true; 
        return myClassesIds.includes(String(c._id)); 
    }).sort((a,b) => a.name.localeCompare(b.name));
    
    const rawStudents = StudioUtils.getStudentsForViewingClass(viewingClass, allStudents, allClasses);
    const studentsToDisplay = rawStudents.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()));

    const handleToggleStudent = (sId) => { 
        setDistribution(prev => { 
            const next = { ...prev }; const cfg = next[viewingClass]; 
            if (!cfg) { const defId = findBestDefaultChapter(viewingClass); next[viewingClass] = { chapterId: defId, studentIds: [sId] }; } 
            else { 
                let newIds = cfg.studentIds.length === 0 ? rawStudents.map(s => s._id).filter(id => id !== sId) : (cfg.studentIds.includes(sId) ? cfg.studentIds.filter(id => id !== sId) : [...cfg.studentIds, sId]); 
                if (newIds.length === 0) delete next[viewingClass]; else if (newIds.length === rawStudents.length) next[viewingClass] = { ...cfg, studentIds: [] }; else next[viewingClass] = { ...cfg, studentIds: newIds }; 
            } 
            return next; 
        }); 
    };

    const toggleAllStudents = () => { 
        setDistribution(prev => { 
            const next = { ...prev }; 
            if (next[viewingClass]) delete next[viewingClass]; else { const defId = findBestDefaultChapter(viewingClass); next[viewingClass] = { chapterId: defId, studentIds: [] }; } 
            return next; 
        }); 
    };

    const isClassSelected = !!distribution[viewingClass];
    const distCfg = distribution[viewingClass];
    const availableChapters = getAvailableChapters(viewingClass);

    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls];
                const realChapterId = cfg.chapterId || findBestDefaultChapter(cls);
                if (!realChapterId) return;
                const finalIds = cfg.studentIds.length > 0 ? cfg.studentIds : StudioUtils.getStudentsForViewingClass(cls, allStudents, allClasses).map(s => s._id);
                const isAllClass = cfg.studentIds.length === 0;
                const groupKey = `${realChapterId}_${isAllClass ? 'ALL' : 'SUBSET'}`;
                if (!groups[groupKey]) { groups[groupKey] = { chapterId: realChapterId, classrooms: [], assignedStudents: [], isAllClass: isAllClass }; }
                groups[groupKey].classrooms.push(cls);
                if (!isAllClass) { groups[groupKey].assignedStudents.push(...finalIds); }
            });
            const groupKeys = Object.keys(groups);
            for (let i = 0; i < groupKeys.length; i++) {
                const key = groupKeys[i];
                const grp = groups[key];
                const payload = { ...formData, chapterId: grp.chapterId, targetClassrooms: grp.classrooms, assignedStudents: grp.isAllClass ? [] : grp.assignedStudents, isAllClass: grp.isAllClass, teacherId: user.id || user._id, type: 'homework' };
                if (formData._id && i > 0) { delete payload._id; }
                await api.post('/homeworks', payload);
            }
            onClose();
        } catch(e) { console.error(e); alert("Erreur sauvegarde."); }
        setLoading(false);
    };

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
            <div className="v84-hw-header">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">📝</span>
                    <input className="v84-hw-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU DEVOIR..." autoFocus />
                </div>
                <div className="flex items-center gap-3">
                    <input type="date" className="v84-hw-date-input" value={formData.date} onChange={handleDateChange} />
                    <button onClick={onClose} className="v84-close-btn">✕</button>
                </div>
            </div>

            <div className="v84-hw-body">
                {/* EDITOR GAUCHE AVEC CARTE BLANCHE */}
                <div className="v84-hw-editor custom-scrollbar" onPaste={handlePaste} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
                    <div className="v84-hw-card">
                        <textarea className="v84-hw-textarea custom-scrollbar" placeholder="Description, consignes, liens..." value={formData.content} onChange={e => handleInput('content', e.target.value)} />
                        <div className="v84-hw-attachments">
                            {(formData.attachments || []).map((att, idx) => (
                                <div key={idx} className="v84-att-chip">
                                    <span>📎 {att.name.substring(0, 20)}</span>
                                    <button onClick={() => handleRemoveAttachment(idx)} className="ml-2 text-red-400 hover:text-red-600 font-bold">✕</button>
                                </div>
                            ))}
                            <button onClick={() => fileInputRef.current.click()} className="v84-att-add-btn">+ AJOUTER FICHIER</button>
                        </div>
                    </div>
                </div>

                {/* SIDEBAR DROITE */}
                <div className="v84-dist-sidebar custom-scrollbar">
                    <div className="v84-classes-tabs">
                        {availableClasses.map(c => (
                            <button key={c._id} onClick={() => { setViewingClass(c.name); setStudentSearch(""); }} className={`v84-tab-btn ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700' : ''}`} style={c.type === 'GROUP' ? { color: '#f59e0b', borderColor: '#fcd34d' } : {}}>
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {viewingClass && (
                        <div className="v84-class-card">
                            <div className="v84-class-header" onClick={toggleAllStudents}>
                                <span className="v84-class-title">{viewingClass}</span>
                                <div className={`v84-check-badge ${isClassSelected ? 'checked' : ''}`}>{isClassSelected && '✓'}</div>
                            </div>
                            <div className="v84-folder-select-box">
                                <label className="v84-folder-label">Dossier :</label>
                                <select className="v84-folder-select" value={distCfg?.chapterId || findBestDefaultChapter(viewingClass)} onChange={(e) => setDistribution(p => ({ ...p, [viewingClass]: { ...p[viewingClass], chapterId: e.target.value } }))} disabled={loading}>
                                    <option value="">-- CHOISIR --</option>
                                    {availableChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div className="v84-search-box">
                                <span>🔎</span>
                                <input className="v84-search-input" placeholder="Chercher un élève..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                            </div>
                            <div className="v84-students-list custom-scrollbar">
                                {studentsToDisplay.map(s => { 
                                    const checked = isClassSelected && (distribution[viewingClass].studentIds.length === 0 || distribution[viewingClass].studentIds.includes(s._id));
                                    return (
                                        <div key={s._id} onClick={() => handleToggleStudent(s._id)} className={`v84-student-item ${checked ? 'selected' : ''}`}>
                                            <div className="v84-student-checkbox">{checked && '✓'}</div>
                                            <span className="v84-student-name">{s.lastName} {s.firstName}</span>
                                        </div>
                                    ); 
                                })}
                            </div>
                        </div>
                    )}
                    
                    <button className="v84-publish-btn" onClick={handleSave} disabled={loading}>
                        {loading ? '...' : (initialData ? 'MODIFIER' : 'PUBLIER 🚀')}
                    </button>
                </div>
            </div>
        </div>
    );
}
