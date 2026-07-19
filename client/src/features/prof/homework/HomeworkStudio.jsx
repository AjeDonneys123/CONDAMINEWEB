// @signatures: HomeworkStudio, handleSave
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_HW_DATA = { 
    title: '', content: '', date: '', teacherId: null, 
    levels: [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', aiHintUrls: [], dnbSection: 'docs', dnbSubject: 'histoire' }],
    isPunishment: false,
    assessmentKind: ''
};

const DNB_SECTION_OPTIONS = [
    { value: 'docs', label: 'Docs' },
    { value: 'paragraphe', label: 'Paragraphe' },
    { value: 'reperes', label: 'Repères' },
    { value: 'emc', label: 'EMC' }
];

const DNB_SUBJECT_OPTIONS = [
    { value: 'histoire', label: 'Histoire' },
    { value: 'geo', label: 'Géo' }
];

const normalizeClassName = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const isTroisiemeClass = (value = '') => /^3/.test(normalizeClassName(value));
const isSecondeClass = (value = '') => /^(2|2DE|SECONDE)/.test(normalizeClassName(value));

export default function HomeworkStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses, globalClass }) {
    
    // 1. ÉTATS DU DEVOIR
    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        if (!base.levels || base.levels.length === 0) base.levels = [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', dnbSection: 'docs', dnbSubject: 'histoire' }];
        base.levels = base.levels.map((lvl) => ({
            dnbSection: 'docs',
            dnbSubject: 'histoire',
            responseMode: 'text',
            instructionUrls: [],
            attachmentUrls: [],
            aiHintUrls: [],
            ...lvl
        }));
        if (!base.date) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            base.date = tomorrow.toISOString().split('T')[0];
        } else base.date = base.date.split('T')[0];
        return base;
    });

    const [activeLevelIdx, setActiveLevelIdx] = useState(0);

    // 2. DONNÉES CONTEXTUELLES (Robustesse)
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    
    // 3. ÉTATS DISTRIBUTION
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [previewAsset, setPreviewAsset] = useState(null);
    const [previewAsImage, setPreviewAsImage] = useState(true);
    const [dragDocIndex, setDragDocIndex] = useState(null);
    const [dropDocIndex, setDropDocIndex] = useState(null);
    
    const fileInputRef = useRef(null);
    const uploadTypeRef = useRef(null);
    const [uploadType, setUploadType] = useState(null);

    // 4. CHARGEMENT DE SECOURS (Si les props sont vides)
    useEffect(() => {
        const initDistribution = () => {
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
        };

        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            setLoading(true);
            Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')])
                .then(([sts, cls]) => {
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                    initDistribution();
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            initDistribution();
        }
    }, []);

    // 5. HANDLERS
    const handleInput = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const selectedClassNames = Object.keys(distribution || {});
    const canMarkDnb = selectedClassNames.some(isTroisiemeClass);
    const canMarkSecondeTraining = selectedClassNames.some(isSecondeClass);
    const assessmentLabel = formData.assessmentKind === 'dnb'
        ? 'DNB'
        : formData.assessmentKind === 'rqp'
            ? 'RQP'
            : formData.assessmentKind === 'commentaire'
                ? 'Commentaire'
                : 'Devoir classique';
    const handleLevelInput = (idx, f, v) => {
        const lvls = [...formData.levels];
        lvls[idx][f] = v;
        setFormData(p => ({ ...p, levels: lvls }));
    };
    const handleAddLevel = () => {
        setFormData(prev => ({ ...prev, levels: [...prev.levels, { instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', aiHintUrls: [], responseMode: 'text', dnbSection: 'docs', dnbSubject: 'histoire' }] }));
        setActiveLevelIdx(formData.levels.length); 
    };
    const handleRemoveLevel = (e, idx) => {
        e.stopPropagation();
        if (formData.levels.length === 1) return alert("Il faut au moins une question.");
        if (!confirm("Supprimer cette question ?")) return;
        const newLevels = formData.levels.filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, levels: newLevels }));
        setActiveLevelIdx(prev => Math.min(prev, newLevels.length - 1));
    };
    const updateCurrentLevel = (field, value) => {
        const newLevels = [...formData.levels];
        const nextLevel = { ...newLevels[activeLevelIdx], [field]: value };
        if (field === 'dnbSection' && value === 'emc') nextLevel.dnbSubject = 'emc';
        if (field === 'dnbSection' && value !== 'emc' && String(nextLevel.dnbSubject || '') === 'emc') nextLevel.dnbSubject = 'histoire';
        newLevels[activeLevelIdx] = nextLevel;
        setFormData(prev => ({ ...prev, levels: newLevels }));
    };
    const triggerUpload = (type) => {
        uploadTypeRef.current = type;
        setUploadType(type);
        if (fileInputRef.current) {
            fileInputRef.current.multiple = type === 'docs' || type === 'sheet';
            fileInputRef.current.click();
        }
    };
    const uploadHomeworkFiles = async (files, type) => {
        const list = Array.from(files || []).filter(Boolean);
        if (list.length === 0) return;
        const currentUploadType = type || uploadTypeRef.current || uploadType || 'docs';
        setLoading(true);
        const fd = new FormData();
        list.forEach((f, index) => {
            const file = f instanceof File
                ? f
                : new File([f], `image-collee-${Date.now()}-${index}.png`, { type: f.type || 'image/png' });
            fd.append('files', file);
        });
        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.urls && res.urls.length > 0) {
                if (currentUploadType === 'sheet') updateCurrentLevel('instructionUrls', [...(formData.levels[activeLevelIdx].instructionUrls || []), ...res.urls]);
                else if (currentUploadType === 'correction') updateCurrentLevel('aiHintUrls', [...(formData.levels[activeLevelIdx].aiHintUrls || []), ...res.urls]);
                else updateCurrentLevel('attachmentUrls', [...(formData.levels[activeLevelIdx].attachmentUrls || []), ...res.urls]);
            }
        } catch(err) {
            alert("Erreur Upload");
        } finally {
            setLoading(false);
            uploadTypeRef.current = null;
        }
    };
    const handlePasteUpload = async (event, type = 'docs') => {
        const items = Array.from(event.clipboardData?.items || []);
        const files = items
            .filter((item) => String(item.type || '').startsWith('image/'))
            .map((item, index) => {
                const file = item.getAsFile();
                if (!file) return null;
                const ext = String(file.type || '').includes('jpeg') ? 'jpg' : 'png';
                return new File([file], `image-collee-${Date.now()}-${index}.${ext}`, { type: file.type || 'image/png' });
            })
            .filter(Boolean);
        if (files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        await uploadHomeworkFiles(files, type);
    };
    const handleFileChange = async (e) => {
        const files = e.target.files; if (!files || files.length === 0) return;
        await uploadHomeworkFiles(files, uploadTypeRef.current || uploadType);
        e.target.value = "";
    };
    const removeAttachment = (type, urlIdx) => {
        if (type === 'sheet') {
            const current = formData.levels[activeLevelIdx].instructionUrls || [];
            updateCurrentLevel('instructionUrls', Number.isFinite(urlIdx) ? current.filter((_, i) => i !== urlIdx) : []);
        }
        else if (type === 'correction') {
            const current = formData.levels[activeLevelIdx].aiHintUrls || [];
            updateCurrentLevel('aiHintUrls', Number.isFinite(urlIdx) ? current.filter((_, i) => i !== urlIdx) : []);
        }
        else updateCurrentLevel('attachmentUrls', formData.levels[activeLevelIdx].attachmentUrls.filter((_, i) => i !== urlIdx));
    };
    const moveAttachment = (fromIndex, toIndex) => {
        const list = [...formData.levels[activeLevelIdx].attachmentUrls];
        if (toIndex < 0 || toIndex >= list.length) return;
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        updateCurrentLevel('attachmentUrls', list);
    };
    const handleDocDragStart = (e, index) => {
        setDragDocIndex(index);
        setDropDocIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };
    const handleDocDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropDocIndex !== index) setDropDocIndex(index);
    };
    const handleDocDrop = (e, index) => {
        e.preventDefault();
        if (dragDocIndex !== null && dragDocIndex !== index) {
            moveAttachment(dragDocIndex, index);
        }
        setDragDocIndex(null);
        setDropDocIndex(null);
    };
    const handleDocDragEnd = () => {
        setDragDocIndex(null);
        setDropDocIndex(null);
    };

    const openPreview = (url, label) => {
        setPreviewAsImage(true);
        setPreviewAsset({ url, label });
    };
    const closePreview = () => setPreviewAsset(null);

    // 6. SAUVEGARDE GROUPÉE
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et au moins une Classe requis !");
        
        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls];
                if (!cfg.chapterId) return; 
                
                const isAllClass = cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET_' + cfg.studentIds.sort().join('-')}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        chapterId: cfg.chapterId,
                        classrooms: [],
                        assignedStudents: cfg.studentIds,
                        isAllClass: isAllClass
                    };
                }
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
                    teacherId: user.id || user._id
                };
                if (formData.isPunishment) {
                    // Une punition est un template ciblé par classe:
                    // elle ne doit jamais être publiée en "classe entière" classique.
                    payload.isAllClass = false;
                    payload.assignedStudents = [];
                }
                if (formData._id && key === Object.keys(groups)[0]) { /* update */ } else { delete payload._id; }
                await api.post('/homework', payload); 
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde: " + e.message); }
        setLoading(false);
    };

    const currentLvl = formData.levels[activeLevelIdx];

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            <div className="v84-hw-header">
                <div className="flex items-center gap-3"><span className="text-3xl">📝</span><input className="v84-hw-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU DEVOIR..." autoFocus /></div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{assessmentLabel}</span>
                    <label className="text-[10px] font-black uppercase text-red-500 flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-1 rounded-lg border border-red-100"><input type="checkbox" checked={formData.isPunishment} onChange={e => handleInput('isPunishment', e.target.checked)} />Punition</label>
                    <input type="date" className="v84-hw-date-input" value={formData.date} onChange={e => handleInput('date', e.target.value)} />
                    <button onClick={onClose} className="v84-close-btn">✕</button>
                </div>
            </div>

            <div className="v84-hw-body">
                <div className="v84-hw-editor custom-scrollbar">
                    <div className="mb-4 p-3 rounded-2xl border border-slate-200 bg-white flex flex-wrap items-center gap-2">
                        <div className="text-[11px] font-black uppercase text-slate-400 mr-2">Type d'entraînement</div>
                        <button
                            type="button"
                            className={`v84-res-btn upload ${formData.assessmentKind === '' ? 'bg-slate-900 text-white' : ''}`}
                            onClick={() => handleInput('assessmentKind', '')}
                        >
                            Devoir classique
                        </button>
                        {canMarkDnb && (
                            <button
                                type="button"
                                className={`v84-res-btn upload ${formData.assessmentKind === 'dnb' ? 'bg-violet-600 text-white border-violet-700' : ''}`}
                                onClick={() => handleInput('assessmentKind', 'dnb')}
                            >
                                Définir en DNB
                            </button>
                        )}
                        {canMarkSecondeTraining && (
                            <>
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${formData.assessmentKind === 'rqp' ? 'bg-blue-600 text-white border-blue-700' : ''}`}
                                    onClick={() => handleInput('assessmentKind', 'rqp')}
                                >
                                    Définir en RQP
                                </button>
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${formData.assessmentKind === 'commentaire' ? 'bg-emerald-600 text-white border-emerald-700' : ''}`}
                                    onClick={() => handleInput('assessmentKind', 'commentaire')}
                                >
                                    Définir en commentaire
                                </button>
                            </>
                        )}
                        {!canMarkDnb && !canMarkSecondeTraining && (
                            <span className="text-[11px] font-bold text-slate-400">Sélectionne une classe de 3e ou de 2de pour afficher les marquages spéciaux.</span>
                        )}
                    </div>
                    <div className="hw-level-tabs">
                        {formData.levels.map((lvl, idx) => (<div key={idx} onClick={() => setActiveLevelIdx(idx)} className={`hw-tab-btn ${activeLevelIdx === idx ? 'active' : ''}`}><span>Question {idx + 1}</span>{formData.levels.length > 1 && (<span className="hw-tab-delete" onClick={(e) => handleRemoveLevel(e, idx)}>✕</span>)}</div>))}
                        <button className="hw-tab-add" onClick={handleAddLevel}>+</button>
                    </div>
                    <div className="v84-hw-card">
                        {formData.assessmentKind === 'dnb' && (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                                <div className="hw-section-title">Classement brevet de cette partie</div>
                                <div className="flex flex-wrap gap-3 items-end">
                                    <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                        Exercice
                                        <select
                                            className="v84-hw-date-input bg-white"
                                            value={currentLvl.dnbSection || 'docs'}
                                            onChange={(e) => updateCurrentLevel('dnbSection', e.target.value)}
                                        >
                                            {DNB_SECTION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </label>
                                    {String(currentLvl.dnbSection || 'docs') === 'emc' ? (
                                        <div className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                            Matière
                                            <div className="v84-hw-date-input bg-white flex items-center">EMC</div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                            Matière
                                            <select
                                                className="v84-hw-date-input bg-white"
                                                value={['histoire', 'geo'].includes(String(currentLvl.dnbSubject || '')) ? currentLvl.dnbSubject : 'histoire'}
                                                onChange={(e) => updateCurrentLevel('dnbSubject', e.target.value)}
                                            >
                                                {DNB_SUBJECT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </label>
                                    )}
                                    <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                        Total points
                                        <input
                                            type="number"
                                            min="1"
                                            step="0.5"
                                            className="v84-hw-date-input bg-white"
                                            value={currentLvl.maxPoints ?? ''}
                                            placeholder="ex: 8"
                                            onChange={(e) => updateCurrentLevel('maxPoints', e.target.value === '' ? '' : Number(e.target.value))}
                                        />
                                    </label>
                                    <div className="text-[11px] font-bold text-violet-500">
                                        Sert à ranger cette question dans l'onglet Brevet élève. Le total points est prioritaire pour la correction IA.
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="hw-section-title">Type de page</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${String(currentLvl.responseMode || 'text') !== 'fill' ? 'bg-slate-900 text-white' : ''}`}
                                    onClick={() => updateCurrentLevel('responseMode', 'text')}
                                >
                                    Question classique
                                </button>
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${String(currentLvl.responseMode || '') === 'fill' ? 'bg-violet-600 text-white border-violet-700' : ''}`}
                                    onClick={() => updateCurrentLevel('responseMode', 'fill')}
                                >
                                    Page à remplir
                                </button>
                            </div>
                            {String(currentLvl.responseMode || '') === 'fill' && (
                                <div className="mt-2 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                                    Pour une page DNB à compléter, dépose l'image de la page dans “Fiche Question”.
                                    L'élève pourra ajouter des carrés texte sur l'image.
                                </div>
                            )}
                        </div>
                        <div><div className="hw-section-title">Consigne textuelle</div><textarea className="v84-hw-textarea custom-scrollbar" placeholder="Écrivez votre question ou consigne ici..." value={currentLvl.instruction} onChange={e => updateCurrentLevel('instruction', e.target.value)} /></div>
                        <div>
                            <div className="hw-section-title">Fiche Question / Pages de l'exercice</div>
                            {formData.assessmentKind === 'dnb' && String(currentLvl.dnbSection || 'docs') === 'docs' && (
                                <div className="mb-2 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                    Mode DNB documents : colle ou envoie toutes les captures de cette partie ici.
                                    L'élève verra les pages ensemble, avec miniatures et navigation.
                                </div>
                            )}
                            {currentLvl.instructionUrls && currentLvl.instructionUrls.length > 0 ? (
                                <div
                                    className="hw-sheet-zone hw-sheet-zone-preview hw-sheet-zone-gallery"
                                    style={{borderColor: '#22c55e', background: '#f0fdf4'}}
                                    onPaste={(e) => handlePasteUpload(e, 'sheet')}
                                    tabIndex={0}
                                    title="Clique ici puis colle avec Ctrl+V / Cmd+V. Utilise + QUESTION pour choisir un fichier."
                                >
                                    <div className="hw-sheet-gallery">
                                        {currentLvl.instructionUrls.map((url, i) => (
                                            <div key={`${url}-${i}`} className="hw-sheet-thumb" onClick={(e) => { e.stopPropagation(); openPreview(url, `Page ${i + 1}`); }}>
                                                <img src={url} alt={`Page ${i + 1}`} />
                                                <span>Page {i + 1}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeAttachment('sheet', i); }}>✕</button>
                                            </div>
                                        ))}
                                        <button type="button" className="hw-sheet-add-more" onClick={(e) => { e.stopPropagation(); triggerUpload('sheet'); }}>+ QUESTION</button>
                                    </div>
                                    <button className="hw-sheet-remove" onClick={(e) => { e.stopPropagation(); removeAttachment('sheet'); }}>Tout supprimer</button>
                                </div>
                            ) : (
                                <div
                                    className="hw-sheet-zone"
                                    onPaste={(e) => handlePasteUpload(e, 'sheet')}
                                    tabIndex={0}
                                    title="Clique ici puis colle une image avec Ctrl+V ou Cmd+V. Utilise + QUESTION pour choisir un fichier."
                                >
                                    <div className="hw-sheet-placeholder">
                                        <span style={{fontSize: '2rem'}}>🖼️</span>
                                        <span>Coller une fiche ici</span>
                                        <small>Ctrl/Cmd+V · ou bouton ci-dessous</small>
                                        <button type="button" className="hw-sheet-add-more" onClick={(e) => { e.stopPropagation(); triggerUpload('sheet'); }}>+ QUESTION</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="hw-section-title">Documents de travail (Aide)</div>
                            <div
                                className="v84-hw-attachments"
                                onPaste={(e) => handlePasteUpload(e, 'docs')}
                                tabIndex={0}
                                title="Clique dans cette zone puis colle une ou plusieurs images avec Ctrl+V ou Cmd+V"
                            >
                                {currentLvl.attachmentUrls.map((url, i) => (
                                    <div
                                        key={i}
                                        className={`v84-att-card${dragDocIndex === i ? ' is-dragging' : ''}${dropDocIndex === i && dragDocIndex !== i ? ' is-drop-target' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDocDragStart(e, i)}
                                        onDragOver={(e) => handleDocDragOver(e, i)}
                                        onDrop={(e) => handleDocDrop(e, i)}
                                        onDragEnd={handleDocDragEnd}
                                        onClick={() => openPreview(url, `Document ${i + 1}`)}
                                    >
                                        <img src={url} className="v84-att-thumb" alt={`Doc ${i + 1}`} />
                                        <div className="v84-att-meta">
                                            <span>📎 Doc {i + 1}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeAttachment('docs', i); }} className="v84-att-remove-btn">✕</button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => triggerUpload('docs')} className="v84-att-add-btn">+ DOC</button>
                                <div className="v84-att-paste-hint">Ctrl/Cmd+V pour coller une image</div>
                            </div>
                        </div>
                        <div>
                            <div className="hw-section-title" style={{color: '#7c3aed'}}>🧠 Indices Correction IA (Secret)</div>
                            <div
                                className="hw-ai-box"
                                onPaste={(e) => handlePasteUpload(e, 'correction')}
                                tabIndex={0}
                                title="Clique ici puis colle une image de corrigé avec Ctrl+V ou Cmd+V"
                            >
                                <textarea
                                    className="hw-ai-input custom-scrollbar"
                                    placeholder="Donnez ici les mots-clés ou les réponses attendues pour aider l'IA à corriger..."
                                    value={currentLvl.aiHints}
                                    onChange={e => updateCurrentLevel('aiHints', e.target.value)}
                                    onPaste={(e) => {
                                        const hasImage = Array.from(e.clipboardData?.items || []).some((item) => String(item.type || '').startsWith('image/'));
                                        if (hasImage) handlePasteUpload(e, 'correction');
                                    }}
                                />
                                <div className="hw-ai-docs">
                                    {(currentLvl.aiHintUrls || []).map((url, i) => (
                                        <div key={`${url}-${i}`} className="hw-ai-doc-card" onClick={() => openPreview(url, `Corrigé ${i + 1}`)}>
                                            <img src={url} alt={`Corrigé ${i + 1}`} />
                                            <span>Corrigé {i + 1}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeAttachment('correction', i); }}>✕</button>
                                        </div>
                                    ))}
                                    <button type="button" className="v84-att-add-btn" onClick={() => triggerUpload('correction')}>+ CORRIGÉ</button>
                                    <span className="v84-att-paste-hint">Ctrl/Cmd+V pour coller une image</span>
                                </div>
                            </div>
                        </div>
                        {formData.assessmentKind === 'dnb' && (
                            <div className="text-[11px] font-bold rounded-xl border border-violet-100 bg-violet-50 text-violet-700 px-3 py-2">
                                {currentLvl.compactCorrection ? (
                                    <>
                                        ✅ Fiche compacte DNB générée
                                        {currentLvl.compactCorrection?.total_points ? ` · total ${currentLvl.compactCorrection.total_points} pts` : ''}
                                        {Array.isArray(currentLvl.compactCorrection?.questions) ? ` · ${currentLvl.compactCorrection.questions.length} question(s)` : ''}
                                    </>
                                ) : currentLvl.compactCorrectionError ? (
                                    <>⚠️ Fiche compacte non générée : {currentLvl.compactCorrectionError}</>
                                ) : (
                                    <>ℹ️ À l’enregistrement, le corrigé/aide IA sera résumé en fiche compacte pour économiser les tokens.</>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <StudioDistributionSidebar 
                    user={user}
                    allClasses={allClasses} // Données passées
                    allStudents={allStudents} // Données passées
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetSection={targetSection} 
                    targetLevel={targetLevel} 
                    punishmentMode={formData.isPunishment}
                    loading={loading}
                    onSave={handleSave}
                />
            </div>

            {previewAsset && (
                <div className="hw-preview-modal" onClick={closePreview}>
                    <div className="hw-preview-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="hw-preview-head">
                            <strong>{previewAsset.label}</strong>
                            <button className="hw-preview-close" onClick={closePreview}>✕</button>
                        </div>
                        <div className="hw-preview-body">
                            {previewAsImage ? (
                                <img src={previewAsset.url} alt={previewAsset.label} className="hw-preview-image" onError={() => setPreviewAsImage(false)} />
                            ) : (
                                <iframe src={previewAsset.url} title={previewAsset.label} className="hw-preview-frame" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
