import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR V219 - GÉNÉRATEUR DE GRILLE AUTO
 * - Analyse multimodal des documents (Énoncés + Supports).
 * - Remplissage automatique des indices IA pour la correction.
 */
export default function HomeworkStudio({ initialData, chapters, globalClass, globalClassId, user, onClose }) {
  
  const initTargets = initialData?.targetClassrooms || (globalClass ? [globalClass] : []);
  
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: '', 
      targetClassrooms: initTargets, 
      levels: [{ instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }],
      assignedStudents: [], isAllClass: true
  });

  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [allStudents, setAllStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  
  const [viewingClass, setViewingClass] = useState(globalClass || "");
  const [distribution, setDistribution] = useState({});

  const [zoomImg, setZoomImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingHints, setIsGeneratingHints] = useState(false);
  
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

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
                    let classStudentIds = sts
                        .filter(s => (s.currentClass || "").trim().toUpperCase() === clsName.trim().toUpperCase() && (assignedIds || []).includes(s._id))
                        .map(s => s._id);
                    newDist[clsName] = { chapterId: chapId, studentIds: classStudentIds };
                });
                setDistribution(newDist);
                if (targets.length > 0) setViewingClass(targets[0]);
            }
            else if (globalClass) {
                setViewingClass(globalClass);
                const defaultChap = chapters.find(c => c.classroom === globalClass && !c.isArchived);
                setDistribution({ [globalClass]: { chapterId: defaultChap ? defaultChap._id : "", studentIds: [] } });
            }
        } catch (e) { console.error("Load Error", e); }
    };
    fetchData();
  }, []);

  // --- 🤖 LOGIQUE GÉNÉRATION GRILLE AUTO ---
  const handleAutoGenerateGrid = async () => {
    const current = formData.levels[activeLevelIdx];
    const allAssets = [...current.instructionUrls, ...current.attachmentUrls];
    
    if (allAssets.length === 0) {
        return alert("Veuillez charger au moins une image (énoncé ou support) pour l'analyse.");
    }

    setIsGeneratingHints(true);
    try {
        const res = await fetch('/api/homework/generate-hints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                instruction: current.instruction,
                assets: allAssets 
            })
        });
        const data = await res.json();
        if (data.hints) {
            updateLevel('aiHints', data.hints);
        } else {
            alert("L'IA n'a pas pu générer de grille.");
        }
    } catch (e) { alert("Erreur serveur lors de l'analyse."); }
    setIsGeneratingHints(false);
  };

  const activeLevel = formData.levels[activeLevelIdx];
  const updateLevel = (field, value) => { const newLevels = [...formData.levels]; newLevels[activeLevelIdx][field] = value; setFormData({ ...formData, levels: newLevels }); };
  
  const handleFileSelect = async (e) => { 
    const files = e.target.files; 
    if (!files || files.length === 0) return; 
    setIsUploading(true); 
    const data = new FormData(); 
    for (let i = 0; i < files.length; i++) data.append('files', files[i]); 
    try { 
        const res = await fetch('/api/homework/upload', { method: 'POST', body: data }); 
        const result = await res.json(); 
        if (res.ok) updateLevel(uploadTarget, [...activeLevel[uploadTarget], ...result.urls]); 
    } catch (err) { alert("Erreur upload."); } 
    finally { setIsUploading(false); e.target.value = null; } 
  };

  const detectLevel = () => {
      const refClass = viewingClass || globalClass || (initialData?.targetClassrooms ? initialData.targetClassrooms[0] : null);
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

  const getChaptersForClass = (clsName) => {
      const myId = user.id || user._id;
      return chapters.filter(c => {
          if (c.isArchived) return false;
          const ownerId = c.teacherId?._id || c.teacherId;
          if (String(ownerId) !== String(myId)) return false;
          if (c.classroom === clsName) return true;
          if (c.sharedLevel && String(c.sharedLevel) === String(targetLevel)) return true;
          return false;
      }).sort((a, b) => (a.section || "Z").localeCompare(b.section || "Z"));
  };
  
  const handleClassTabClick = (clsName) => { setViewingClass(clsName); };
  const isAllLevelSelected = availableClasses.length > 0 && availableClasses.every(c => distribution[c.name]);

  const toggleAllLevel = () => {
    if (isAllLevelSelected) {
        setDistribution(prev => { const next = { ...prev }; availableClasses.forEach(c => delete next[c.name]); return next; });
    } else {
        setDistribution(prev => {
            const next = { ...prev };
            availableClasses.forEach(c => { if (!next[c.name]) next[c.name] = { chapterId: getChaptersForClass(c.name)[0]?._id || "", studentIds: [] }; });
            return next;
        });
    }
  };

  const toggleFullClass = () => {
      setDistribution(prev => {
          const next = { ...prev };
          const config = next[viewingClass];
          if (config && config.studentIds.length === 0) delete next[viewingClass];
          else next[viewingClass] = { chapterId: getChaptersForClass(viewingClass)[0]?._id || "", studentIds: [] };
          return next;
      });
  };

  const handleToggleStudent = (studentId) => {
      setDistribution(prev => {
          const next = { ...prev };
          const config = next[viewingClass];
          const allS = allStudents.filter(s => s.currentClass === viewingClass).map(s => s._id);
          if (!config) next[viewingClass] = { chapterId: getChaptersForClass(viewingClass)[0]?._id || "", studentIds: [studentId] };
          else {
              let newIds = config.studentIds.length === 0 ? allS.filter(id => id !== studentId) : (config.studentIds.includes(studentId) ? config.studentIds.filter(id => id !== studentId) : [...config.studentIds, studentId]);
              if (newIds.length === 0) delete next[viewingClass];
              else if (newIds.length === allS.length) next[viewingClass] = { ...config, studentIds: [] };
              else next[viewingClass] = { ...config, studentIds: newIds };
          }
          return next;
      });
  };

  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
      setIsPublishing(true);
      try {
          for (const cls of targets) {
              const cfg = distribution[cls];
              const payload = { ...formData, chapterId: cfg.chapterId, targetClassrooms: [cls], classroom: cls, teacherId: user.id || user._id, assignedStudents: cfg.studentIds, isAllClass: cfg.studentIds.length === 0 };
              await fetch('/api/homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          }
          onClose();
      } catch(e) { alert("Erreur sauvegarde."); }
      setIsPublishing(false);
  };

  const isSelected = !!distribution[viewingClass];
  const isFullClass = isSelected && distribution[viewingClass].studentIds.length === 0;

  return (
    <div className="v84-studio-container">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        {zoomImg && <div className="v84-zoom-overlay" onClick={() => setZoomImg(null)}><img src={zoomImg} alt="zoom" /></div>}
        {(isUploading || isPublishing || isGeneratingHints) && <div className="v84-upload-loader"><div className="v84-spinner"></div><span>{isUploading ? 'UPLOAD...' : (isPublishing ? 'PUBLICATION...' : 'ANALYSE IA...')}</span></div>}

        <div className="v84-header">
            <div className="v84-header-left"><div className="v84-icon">📝</div><input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." /></div>
            <div className="v84-version-tag">STUDIO V219</div>
            <button onClick={onClose} className="v84-close-btn">✕</button>
        </div>

        <div className="v84-body">
            <div className="v84-sidebar-left">
                <h4 className="v84-sidebar-label">Pages du DM</h4>
                <div className="v84-pages-list custom-scrollbar">
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className={`v84-page-item ${activeLevelIdx === idx ? 'active' : ''}`} onClick={() => setActiveLevelIdx(idx)}>
                            <div className="v84-page-header"><span className="v84-page-name">PAGE {idx + 1}</span>{formData.levels.length > 1 && <button className="v84-del-page" onClick={(e) => { e.stopPropagation(); setFormData({...formData, levels: formData.levels.filter((_, i) => i !== idx)}); setActiveLevelIdx(0); }}>✕</button>}</div>
                        </div>
                    ))}
                    <button className="v84-add-page-btn" onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }]})}>+ NOUVELLE PAGE</button>
                </div>
            </div>

            <div className="v84-main-editor custom-scrollbar">
                {/* 1. ÉNONCÉ */}
                <div className="v84-card">
                    <label className="v84-card-label">1. ÉNONCÉ & CONSIGNE</label>
                    <textarea className="v84-textarea" value={activeLevel.instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Consigne textuelle..." />
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 CHARGER ÉNONCÉ(S)</button>
                    <div className="v84-gallery">{activeLevel.instructionUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div>
                </div>
                
                {/* 2. CORRECTION IA (MULTIMODAL) */}
                <div className="v84-card v84-ai-card">
                    <div className="flex justify-between items-center mb-4">
                        <label className="v84-card-label !mb-0">2. CORRECTION IA (Grille attendue)</label>
                        <button 
                            onClick={handleAutoGenerateGrid} 
                            disabled={isGeneratingHints}
                            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all flex items-center gap-2"
                        >
                            <span>✨ GÉNÉRER GRILLE AUTO</span>
                        </button>
                    </div>
                    <textarea 
                        className="v84-textarea v84-ai-textarea" 
                        value={activeLevel.aiHints} 
                        onChange={e => updateLevel('aiHints', e.target.value)} 
                        placeholder="Chargez vos documents au-dessus ou en-dessous, puis cliquez sur 'GÉNÉRER GRILLE AUTO'..." 
                    />
                </div>

                {/* 3. SUPPORTS */}
                <div className="v84-card">
                    <label className="v84-card-label">3. DOCUMENTS SUPPORTS</label>
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📂 CHARGER SUPPORTS</button>
                    <div className="v84-gallery">{activeLevel.attachmentUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div>
                </div>
            </div>

            <div className="v84-sidebar-right" style={{width: '400px'}}>
                <h4 className="v84-sidebar-label">DISTRIBUTION (Niveau {targetLevel || '?'})</h4>
                <button onClick={toggleAllLevel} className={`w-full py-3 mb-4 rounded-xl font-black text-xs uppercase transition-all ${isAllLevelSelected ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{isAllLevelSelected ? '✕ TOUT DÉSACTIVER' : '✓ TOUT LE NIVEAU'}</button>
                <div className="mb-4 flex flex-wrap gap-2">{availableClasses.map(c => <button key={c._id} onClick={() => handleClassTabClick(c.name)} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${distribution[c.name] ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'} ${viewingClass === c.name ? 'border-2 border-slate-900 scale-105' : ''}`}>{c.name}</button>)}</div>
                {viewingClass && (
                    <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                        <div className="flex justify-between items-center mb-4"><span className="font-black text-slate-700 uppercase">Classe {viewingClass}</span>{isSelected && <span className={`text-[9px] px-2 py-1 rounded font-bold ${isFullClass ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>{isFullClass ? 'TOUTE LA CLASSE' : 'SÉLECTION PARTIELLE'}</span>}</div>
                        {isSelected && (
                            <div className="mb-4"><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Ranger dans :</label><select className="w-full p-2 rounded-xl text-xs font-bold border-2 outline-none border-slate-200" value={distribution[viewingClass].chapterId} onChange={(e) => { const n={...distribution}; n[viewingClass].chapterId=e.target.value; setDistribution(n); }}><option value="">-- SÉLECTIONNER UN DOSSIER --</option>{getChaptersForClass(viewingClass).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}</select></div>
                        )}
                        <div className="v84-students-list custom-scrollbar flex-1 border-t border-slate-200 pt-2"><div className={`v84-student-row ${isFullClass ? 'selected' : ''}`} onClick={toggleFullClass}><div className="v84-check"></div><span className="font-black">TOUTE LA CLASSE</span></div>{allStudents.filter(s => (s.currentClass || "").trim().toUpperCase() === viewingClass.trim().toUpperCase()).sort((a,b)=>a.lastName.localeCompare(b.lastName)).map(s => <div key={s._id} className={`v84-student-row ${distribution[viewingClass]?.studentIds.includes(s._id) ? 'selected' : ''}`} onClick={() => handleToggleStudent(s._id)}><div className="v84-check"></div><span>{s.lastName} {s.firstName}</span></div>)}</div>
                    </div>
                )}
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>PUBLIER 🚀</button>
            </div>
        </div>
    </div>
  );
}