import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR - VERSION 13
 * Simplification Arborescence (Retrait Année) + Badge visible.
 */
export default function HomeworkStudio({ initialData, chapters, globalClass, globalClassId, user, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', 
      chapterId: '', 
      classroom: globalClass, 
      levels: [{ instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }],
      assignedStudents: [],
      isAllClass: true
  });

  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [classStudents, setClassStudents] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  useEffect(() => {
    if (globalClassId) {
        fetch('/api/admin/students')
            .then(r => r.json())
            .then(all => setClassStudents(all.filter(s => String(s.classId) === String(globalClassId))));
    }
  }, [globalClassId]);

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
          if (res.ok && result.urls) updateLevel(uploadTarget, [...activeLevel[uploadTarget], ...result.urls]);
      } catch (err) { alert("Erreur upload"); } finally { setIsUploading(false); e.target.value = null; }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.chapterId) return alert("❌ Titre et Dossier requis !");
    
    let finalData = { ...formData, teacherId: user.id || user._id };
    if (formData.isAllClass) {
        finalData.assignedStudents = classStudents.map(s => s._id);
    }

    const res = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
    });
    if (res.ok) onClose();
  };

  return (
    <div className="hw-v3-studio-overlay">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        {zoomImg && <div className="v3-zoom-overlay" onClick={() => setZoomImg(null)}><div className="v3-zoom-card"><img src={zoomImg} alt="zoom" /><button className="v3-zoom-close">FERMER</button></div></div>}
        {isUploading && <div className="v3-upload-spinner"><div className="spinner"></div><span>V13 - SYNC CLOUD EN COURS...</span></div>}

        <div className="hw-v3-header">
            <div className="flex items-center gap-4 flex-1">
                <input className="hw-v3-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR MAISON..." />
            </div>
            <div className="v13-badge">STUDIO V13</div>
            <button onClick={onClose} className="v3-close-x">✕</button>
        </div>

        <div className="hw-v3-content">
            <div className="v3-side-nav">
                <label className="v3-label">Pages DM</label>
                {formData.levels.map((lvl, idx) => (
                    <div key={idx} className={`v3-page-tab ${activeLevelIdx === idx ? 'active' : ''}`} onClick={() => setActiveLevelIdx(idx)}>PAGE {idx + 1}</div>
                ))}
                <button className="v3-add-page" onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }]})}>+ PAGE</button>
                <div className="mt-auto">
                    <label className="v3-label">Destination (Master)</label>
                    <select className="v3-select" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                        <option value="">-- CHOISIR --</option>
                        {chapters.map(c => <option key={c._id} value={c._id}>[{c.section}] {c.title}</option>)}
                    </select>
                </div>
            </div>

            <div className="v3-editor-area custom-scrollbar">
                <div className="v3-card">
                    <label className="v3-label">1. Énoncé & Consignes (Images ou texte)</label>
                    <textarea className="v3-text-area" value={activeLevel.instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Écrivez vos instructions..." />
                    <button className="v3-add-doc-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 CHARGER ÉNONCÉ IMAGE</button>
                    <div className="v3-gallery">
                        {activeLevel.instructionUrls.map((url, i) => (
                            <div key={i} className="v3-thumb-box"><img src={url} onClick={() => setZoomImg(url)} /><button className="v3-del-btn" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>
                        ))}
                    </div>
                </div>
                <div className="v3-card ai-style"><label className="v3-label">2. Correction IA</label><textarea className="v3-text-area ai-input" value={activeLevel.aiHints} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Indices pour Gemini..." /></div>
                <div className="v3-card">
                    <label className="v3-label">3. Supports pour l'élève (Documents)</label>
                    <button className="v3-add-doc-btn" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📂 CHARGER DOCUMENTS SUPPORTS</button>
                    <div className="v3-gallery">
                        {activeLevel.attachmentUrls.map((url, i) => (
                            <div key={i} className="v3-thumb-box"><img src={url} onClick={() => setZoomImg(url)} /><button className="v3-del-btn" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="v3-side-assign">
                <label className="v3-label">Assignation & Ponts Drive</label>
                <div className="v3-students-list custom-scrollbar">
                    <div className={`v3-student-item ${formData.isAllClass ? 'selected' : ''}`} onClick={() => setFormData({...formData, isAllClass: true, assignedStudents: []})}>
                        TOUTE LA CLASSE ({globalClass})
                    </div>
                    {classStudents.map(s => (
                        <div key={s._id} className={`v3-student-item ${formData.assignedStudents.includes(s._id) ? 'selected' : ''}`} onClick={() => {
                            const next = formData.assignedStudents.includes(s._id) ? formData.assignedStudents.filter(id => id !== s._id) : [...formData.assignedStudents, s._id];
                            setFormData({...formData, assignedStudents: next, isAllClass: false});
                        }}>{s.firstName} {s.lastName}</div>
                    ))}
                </div>
                <button className="v3-save-btn" onClick={handleSave}>PUBLIER ET SYNC DRIVE</button>
            </div>
        </div>
    </div>
  );
}