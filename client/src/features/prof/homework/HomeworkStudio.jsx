import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR V138 - CROSS-FOLDER
 * Fix : Le sélecteur de dossier permet de choisir un chapitre d'une autre classe.
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
  const [zoomImg, setZoomImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
        const [sts, cls] = await Promise.all([
            fetch('/api/admin/students').then(r => r.json()),
            fetch('/api/admin/classrooms').then(r => r.json())
        ]);
        setAllStudents(sts);
        setAllClasses(cls);
    };
    fetchData();
  }, []);

  const relevantStudents = allStudents.filter(s => formData.targetClassrooms.includes(s.currentClass));

  const getDisplayUrl = (url) => {
      if (!url) return "";
      if (url.startsWith('/uploads')) return url;
      if (url.includes('drive.google.com')) {
          const id = url.match(/[-\w]{25,}/);
          return id ? `https://drive.google.com/thumbnail?id=${id[0]}&sz=w1000` : url;
      }
      return url;
  };

  const activeLevel = formData.levels[activeLevelIdx];
  const updateLevel = (field, value) => {
    const newLevels = [...formData.levels];
    newLevels[activeLevelIdx][field] = value;
    setFormData({ ...formData, levels: newLevels });
  };

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

  const toggleClassTarget = (clsName) => {
      const current = formData.targetClassrooms || [];
      const createNew = current.includes(clsName) ? current.filter(c => c !== clsName) : [...current, clsName];
      setFormData({ ...formData, targetClassrooms: createNew });
  };

  const toggleStudent = (sId) => {
      const current = formData.assignedStudents || [];
      const createNew = current.includes(sId) ? current.filter(id => id !== sId) : [...current, sId];
      setFormData({ ...formData, assignedStudents: createNew, isAllClass: createNew.length === 0 });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.chapterId) return alert("❌ Titre et Dossier requis !");
    if (formData.targetClassrooms.length === 0) return alert("❌ Sélectionnez au moins une classe !");
    
    setIsPublishing(true);
    try {
        const res = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, classroom: formData.targetClassrooms[0], teacherId: user.id || user._id })
        });
        if (res.ok) onClose();
        else alert("Erreur sauvegarde.");
    } catch(e) { alert("Erreur réseau."); }
    finally { setIsPublishing(false); }
  };

  // TRI DES CHAPITRES POUR LE SELECT (Regroupés par classe)
  const sortedChapters = [...chapters].sort((a, b) => {
      // D'abord ceux de la classe active
      if (a.classroom === globalClass && b.classroom !== globalClass) return -1;
      if (a.classroom !== globalClass && b.classroom === globalClass) return 1;
      // Ensuite par nom de classe
      if (a.classroom < b.classroom) return -1;
      if (a.classroom > b.classroom) return 1;
      return 0;
  });

  return (
    <div className="v84-studio-container">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        {zoomImg && <div className="v84-zoom-overlay" onClick={() => setZoomImg(null)}><img src={getDisplayUrl(zoomImg)} alt="zoom" /></div>}
        {(isUploading || isPublishing) && <div className="v84-upload-loader"><div className="v84-spinner"></div><span>TRAITEMENT...</span></div>}

        <div className="v84-header">
            <div className="v84-header-left">
                <div className="v84-icon">📝</div>
                <input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." />
            </div>
            <div className="v84-version-tag">STUDIO V138</div>
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
                <div className="v84-chapter-box">
                    <label className="v84-sidebar-label">Dossier de Rangement</label>
                    <select className="v84-select" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                        <option value="">-- CHOISIR --</option>
                        {sortedChapters.map(c => (
                            <option key={c._id} value={c._id}>
                                {c.classroom ? `[${c.classroom}] ` : '[Commun] '}{c.title}
                            </option>
                        ))}
                    </select>
                    <p className="text-[9px] text-slate-400 mt-2 italic text-center">Vous pouvez ranger ce devoir dans un dossier d'une autre classe.</p>
                </div>
            </div>

            <div className="v84-main-editor custom-scrollbar">
                <div className="v84-card">
                    <label className="v84-card-label">1. ÉNONCÉ & CONSIGNE</label>
                    <textarea className="v84-textarea" value={activeLevel.instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Consigne textuelle..." />
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 CHARGER ÉNONCÉ(S)</button>
                    <div className="v84-gallery">{activeLevel.instructionUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div>
                </div>
                <div className="v84-card v84-ai-card">
                    <label className="v84-card-label">2. CORRECTION IA</label>
                    <textarea className="v84-textarea v84-ai-textarea" value={activeLevel.aiHints} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Indices pour la correction IA..." />
                </div>
                <div className="v84-card">
                    <label className="v84-card-label">3. SUPPORTS</label>
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📂 CHARGER SUPPORTS</button>
                    <div className="v84-gallery">{activeLevel.attachmentUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div>
                </div>
            </div>

            <div className="v84-sidebar-right">
                <h4 className="v84-sidebar-label">DIFFUSION</h4>
                <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">CLASSES CIBLES</span>
                    <div className="flex flex-wrap gap-2">
                        {allClasses.filter(c => c.type === 'CLASS').map(c => (
                            <button key={c._id} onClick={() => toggleClassTarget(c.name)} className={`px-3 py-1 rounded-lg text-[10px] font-black border transition-all ${formData.targetClassrooms.includes(c.name) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}>{c.name}</button>
                        ))}
                    </div>
                </div>
                <div className="v84-students-list custom-scrollbar">
                    <div className={`v84-student-row ${formData.isAllClass ? 'selected' : ''}`} onClick={() => setFormData({...formData, assignedStudents: [], isAllClass: true})}><div className="v84-check"></div><span>TOUS LES ÉLÈVES CIBLÉS</span></div>
                    {relevantStudents.map(s => (<div key={s._id} className={`v84-student-row ${formData.assignedStudents.includes(s._id) ? 'selected' : ''}`} onClick={() => toggleStudent(s._id)}><div className="v84-check"></div><div className="flex flex-col"><span>{s.firstName} {s.lastName}</span><span className="text-[8px] opacity-50">{s.currentClass}</span></div></div>))}
                </div>
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>PUBLIER 🚀</button>
            </div>
        </div>
    </div>
  );
}