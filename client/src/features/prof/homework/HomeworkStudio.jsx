import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR - VERSION 93
 * Fix : Rendu d'image universel (Local Preview & Cloud Display)
 */
export default function HomeworkStudio({ initialData, chapters, globalClass, globalClassId, user, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: '', classroom: globalClass, 
      levels: [{ instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }],
      assignedStudents: [], isAllClass: true
  });

  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [classStudents, setClassStudents] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  useEffect(() => {
    if (globalClassId) {
        fetch('/api/admin/students')
            .then(r => r.json())
            .then(all => setClassStudents(all.filter(s => String(s.classId) === String(globalClassId))));
    }
  }, [globalClassId]);

  // FONCTION MIRACLE : Transforme un lien Drive ou local en image affichable
  const getDisplayUrl = (url) => {
      if (!url) return "";
      if (url.startsWith('/uploads')) return url; // Image locale en attente de synchro
      if (url.includes('drive.google.com')) {
          // Extrait l'ID de l'URL Drive pour forcer l'affichage direct
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
      } catch (err) { alert("Erreur upload temporaire."); } 
      finally { setIsUploading(false); e.target.value = null; }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.chapterId) return alert("❌ Titre et Dossier requis !");
    setIsPublishing(true);
    const finalAssigned = formData.isAllClass ? classStudents.map(s => s._id) : formData.assignedStudents;
    try {
        const res = await fetch('/api/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, assignedStudents: finalAssigned, teacherId: user.id || user._id })
        });
        const resData = await res.json();
        if (res.ok) onClose();
        else alert("🔥 ERREUR : " + (resData.error || "Échec synchro Cloud."));
    } catch(e) { alert("Erreur réseau."); }
    finally { setIsPublishing(false); }
  };

  return (
    <div className="v84-studio-container">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        {zoomImg && <div className="v84-zoom-overlay" onClick={() => setZoomImg(null)}><img src={getDisplayUrl(zoomImg)} alt="zoom" /></div>}
        
        {(isUploading || isPublishing) && (
            <div className="v84-upload-loader">
                <div className="v84-spinner"></div>
                <span>{isPublishing ? 'SYNCHRONISATION GOOGLE DRIVE...' : 'RÉCEPTION...'}</span>
            </div>
        )}

        <div className="v84-header">
            <div className="v84-header-left">
                <div className="v84-icon">📝</div>
                <input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." />
            </div>
            <div className="v84-version-tag">STUDIO V93</div>
            <button onClick={onClose} className="v84-close-btn">✕</button>
        </div>

        <div className="v84-body">
            <div className="v84-sidebar-left">
                <h4 className="v84-sidebar-label">Pages du DM</h4>
                <div className="v84-pages-list custom-scrollbar">
                    {formData.levels.map((lvl, idx) => (
                        <div key={idx} className={`v84-page-item ${activeLevelIdx === idx ? 'active' : ''}`} onClick={() => setActiveLevelIdx(idx)}>
                            <div className="v84-page-header">
                                <span className="v84-page-name">PAGE {idx + 1}</span>
                                {formData.levels.length > 1 && <button className="v84-del-page" onClick={(e) => { e.stopPropagation(); setFormData({...formData, levels: formData.levels.filter((_, i) => i !== idx)}); setActiveLevelIdx(0); }}>✕</button>}
                            </div>
                        </div>
                    ))}
                    <button className="v84-add-page-btn" onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }]})}>+ NOUVELLE PAGE</button>
                </div>
                <div className="v84-chapter-box">
                    <label className="v84-sidebar-label">Dossier Master</label>
                    <select className="v84-select" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                        <option value="">-- CHOISIR --</option>
                        {chapters.filter(c => !globalClass || c.classroom === globalClass).map(c => <option key={c._id} value={c._id}>[{c.section}] {c.title}</option>)}
                    </select>
                </div>
            </div>

            <div className="v84-main-editor custom-scrollbar">
                <div className="v84-card">
                    <label className="v84-card-label">1. ÉNONCÉ & CONSIGNE</label>
                    <textarea className="v84-textarea" value={activeLevel.instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Consigne textuelle..." />
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 CHARGER ÉNONCÉ(S)</button>
                    <div className="v84-gallery">
                        {activeLevel.instructionUrls.map((url, i) => (
                            <div key={i} className="v84-thumb">
                                <img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} />
                                <button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="v84-card v84-ai-card">
                    <label className="v84-card-label">2. CORRECTION IA (Indices)</label>
                    <textarea className="v84-textarea v84-ai-textarea" value={activeLevel.aiHints} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Ce que l'IA doit vérifier..." />
                </div>

                <div className="v84-card">
                    <label className="v84-card-label">3. DOCUMENTS SUPPORTS</label>
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📂 CHARGER SUPPORTS</button>
                    <div className="v84-gallery">
                        {activeLevel.attachmentUrls.map((url, i) => (
                            <div key={i} className="v84-thumb">
                                <img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} />
                                <button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="v84-sidebar-right">
                <h4 className="v84-sidebar-label">Assignation ({globalClass})</h4>
                <div className="v84-students-list custom-scrollbar">
                    <div className={`v84-student-row ${formData.isAllClass ? 'selected' : ''}`} onClick={() => setFormData({...formData, isAllClass: true, assignedStudents: []})}><div className="v84-check"></div><span>TOUTE LA CLASSE</span></div>
                    {classStudents.map(s => <div key={s._id} className={`v84-student-row ${formData.assignedStudents.includes(s._id) ? 'selected' : ''}`} onClick={() => { const next = formData.assignedStudents.includes(s._id) ? formData.assignedStudents.filter(id => id !== s._id) : [...formData.assignedStudents, s._id]; setFormData({...formData, assignedStudents: next, isAllClass: false}); }}><div className="v84-check"></div><span>{s.firstName} {s.lastName}</span></div>)}
                </div>
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>PUBLIER LE DEVOIR 🚀</button>
            </div>
        </div>
    </div>
  );
}