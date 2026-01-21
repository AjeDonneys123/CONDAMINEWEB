import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR V159 - FULL RESTORATION
 * Fix : Restauration des colonnes "Pages" et "Contenu" (Consigne, IA, Supports).
 * Feature : Conserve la logique de distribution avancée (V157).
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

  const [zoomImg, setZoomImg] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  // --- CHARGEMENT ---
  useEffect(() => {
    const fetchData = async () => {
        const [sts, cls] = await Promise.all([
            fetch('/api/admin/students').then(r => r.json()),
            fetch('/api/admin/classrooms').then(r => r.json())
        ]);
        setAllStudents(sts);
        setAllClasses(cls);
        if (globalClass && !initialData) {
            setViewingClass(globalClass);
            const defaultChap = chapters.find(c => c.classroom === globalClass && !c.isArchived);
            setDistribution({ [globalClass]: { chapterId: defaultChap ? defaultChap._id : "", studentIds: [] } });
        }
    };
    fetchData();
  }, []);

  // --- LOGIQUE NIVEAU & FILTRAGE ---
  const detectLevel = () => {
      if (!globalClass) return null;
      const clsObj = allClasses.find(c => c.name === globalClass);
      if (clsObj && clsObj.level) return clsObj.level;
      const match = globalClass.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2)/);
      return match ? match[0] : null;
  };
  const targetLevel = detectLevel();

  const availableClasses = allClasses.filter(c => {
      if (c.type !== 'CLASS') return false;
      if (!targetLevel) return false; 
      return String(c.level) === String(targetLevel);
  });

  const [distribution, setDistribution] = useState(initialData ? {} : (globalClass ? { [globalClass]: { chapterId: "", studentIds: [] } } : {}));

  // --- LOGIQUE TOGGLE (V157) ---
  const handleClassTabClick = (clsName) => {
      const isActive = !!distribution[clsName];
      if (isActive) {
          setDistribution(prev => {
              const next = { ...prev };
              delete next[clsName];
              return next;
          });
          setViewingClass(clsName);
      } else {
          setViewingClass(clsName);
          setDistribution(prev => {
              const next = { ...prev };
              let smartChapterId = "";
              const otherClass = Object.keys(prev)[0];
              if (otherClass && prev[otherClass].chapterId) {
                  smartChapterId = findEquivalentChapterId(clsName, prev[otherClass].chapterId);
              }
              if (!smartChapterId) {
                  const available = getChaptersForClass(clsName);
                  if (available.length > 0) smartChapterId = available[0]._id;
              }
              next[clsName] = { chapterId: smartChapterId, studentIds: [] };
              return next;
          });
      }
  };

  const handleToggleStudent = (studentId) => {
      setDistribution(prev => {
          const currentConfig = prev[viewingClass] || { chapterId: "", studentIds: [] };
          const isActive = !!prev[viewingClass];
          let newIds = currentConfig.studentIds;
          
          if (!isActive) newIds = [studentId];
          else {
              if (newIds.includes(studentId)) newIds = newIds.filter(id => id !== studentId);
              else newIds = [...newIds, studentId];
          }
          return { ...prev, [viewingClass]: { ...currentConfig, studentIds: newIds } };
      });
  };

  const toggleFullClass = () => {
      const isActive = !!distribution[viewingClass];
      if (isActive) handleClassTabClick(viewingClass);
      else handleClassTabClick(viewingClass);
  };

  const relevantStudents = allStudents.filter(s => formData.targetClassrooms.includes(s.currentClass));
  const studentsInView = allStudents.filter(s => s.currentClass === viewingClass);
  const currentConfig = distribution[viewingClass];
  
  const isSelected = !!currentConfig;
  const isFullClass = isSelected && currentConfig.studentIds.length === 0;

  const getChaptersForClass = (clsName) => {
      return chapters.filter(c => !c.isArchived && (c.classroom === clsName || (c.sharedLevel && String(c.sharedLevel) === String(targetLevel))));
  };
  
  const findEquivalentChapterId = (clsName, srcId) => {
      if (!srcId) return "";
      const src = chapters.find(c => c._id === srcId);
      if (!src) return "";
      const targets = getChaptersForClass(clsName);
      const sameName = targets.find(t => t.title === src.title && t.section === src.section);
      if (sameName) return sameName._id;
      return "";
  };

  const handleUpdateChapter = (clsName, chapId) => {
      setDistribution(prev => ({ ...prev, [clsName]: { ...prev[clsName], chapterId: chapId } }));
  };

  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title) return alert("❌ Titre requis !");
      if (targets.length === 0) return alert("❌ Sélectionnez au moins une classe !");
      const missingFolder = targets.find(cls => !distribution[cls].chapterId);
      if (missingFolder) return alert(`❌ La classe ${missingFolder} n'a pas de dossier !`);
      setIsPublishing(true);
      try {
          const grouped = {};
          targets.forEach(cls => {
              const cfg = distribution[cls];
              if(!grouped[cfg.chapterId]) grouped[cfg.chapterId] = [];
              grouped[cfg.chapterId].push({ cls, cfg });
          });
          for (const chapId of Object.keys(grouped)) {
              const items = grouped[chapId];
              const targetClassrooms = items.map(i => i.cls);
              const assignedStudents = items.flatMap(i => i.cfg.studentIds);
              const isAllClass = items.every(i => i.cfg.studentIds.length === 0);
              const payload = { ...formData, chapterId: chapId, targetClassrooms, classroom: targetClassrooms[0], teacherId: user.id || user._id, assignedStudents, isAllClass };
              await fetch('/api/homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          }
          onClose();
      } catch(e) { alert("Erreur réseau."); }
      finally { setIsPublishing(false); }
  };

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

  // Trier les chapitres pour la sélection
  const sortedChapters = [...chapters].sort((a, b) => {
      if (a.classroom === globalClass && b.classroom !== globalClass) return -1;
      if (a.classroom !== globalClass && b.classroom === globalClass) return 1;
      return a.title.localeCompare(b.title);
  });

  return (
    <div className="v84-studio-container">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        {zoomImg && <div className="v84-zoom-overlay" onClick={() => setZoomImg(null)}><img src={getDisplayUrl(zoomImg)} alt="zoom" /></div>}
        {(isUploading || isPublishing) && <div className="v84-upload-loader"><div className="v84-spinner"></div><span>{isUploading ? 'UPLOAD...' : 'PUBLICATION...'}</span></div>}

        <div className="v84-header">
            <div className="v84-header-left">
                <div className="v84-icon">📝</div>
                <input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." />
            </div>
            <div className="v84-version-tag">STUDIO V159</div>
            <button onClick={onClose} className="v84-close-btn">✕</button>
        </div>

        <div className="v84-body">
            
            {/* 1. COLONNE GAUCHE : PAGES & DOSSIERS */}
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
                {/* Note : Le sélecteur de dossier est maintenant contextuel dans la colonne de droite, mais on peut laisser un indicateur ici si besoin */}
            </div>

            {/* 2. COLONNE CENTRALE : ÉDITEUR */}
            <div className="v84-main-editor custom-scrollbar">
                <div className="v84-card">
                    <label className="v84-card-label">1. ÉNONCÉ & CONSIGNE</label>
                    <textarea className="v84-textarea" value={activeLevel.instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Consigne textuelle..." />
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 CHARGER ÉNONCÉ(S)</button>
                    <div className="v84-gallery">
                        {activeLevel.instructionUrls.map((url, i) => (
                            <div key={i} className="v84-thumb"><img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>
                        ))}
                    </div>
                </div>
                
                <div className="v84-card v84-ai-card">
                    <label className="v84-card-label">2. CORRECTION IA (Indices)</label>
                    <textarea className="v84-textarea v84-ai-textarea" value={activeLevel.aiHints} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Indices pour aider l'IA à corriger..." />
                </div>
                
                <div className="v84-card">
                    <label className="v84-card-label">3. DOCUMENTS SUPPORTS</label>
                    <button className="v84-upload-btn" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📂 CHARGER SUPPORTS</button>
                    <div className="v84-gallery">
                        {activeLevel.attachmentUrls.map((url, i) => (
                            <div key={i} className="v84-thumb"><img src={getDisplayUrl(url)} onClick={() => setZoomImg(url)} /><button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. COLONNE DROITE : DISTRIBUTION */}
            <div className="v84-sidebar-right" style={{width: '400px'}}>
                <h4 className="v84-sidebar-label">DISTRIBUTION (Niveau {targetLevel || '?'})</h4>
                
                <div className="mb-4 flex flex-wrap gap-2">
                    {availableClasses.map(c => {
                        const isSel = !!distribution[c.name];
                        const isView = viewingClass === c.name;
                        const isPartial = isSel && distribution[c.name].studentIds.length > 0;
                        
                        let bg = 'bg-slate-100 text-slate-400';
                        if (isSel) bg = isPartial ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white';
                        
                        const border = isView ? 'border-2 border-slate-900 scale-105' : 'border border-transparent opacity-80';

                        return (
                            <button key={c._id} onClick={() => handleClassTabClick(c.name)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${bg} ${border}`}>{c.name}</button>
                        );
                    })}
                </div>

                {viewingClass ? (
                    <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-black text-slate-700 uppercase">Classe {viewingClass}</span>
                            {isSelected && <span className={`text-[9px] px-2 py-1 rounded font-bold ${isFullClass ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>{isFullClass ? 'TOUTE LA CLASSE' : 'SÉLECTION PARTIELLE'}</span>}
                        </div>

                        {isSelected && (
                            <div className="mb-4">
                                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Ranger dans :</label>
                                <select className="w-full p-2 rounded-xl text-xs font-bold border-2 border-slate-200 focus:border-indigo-500 outline-none" value={distribution[viewingClass].chapterId} onChange={(e) => handleUpdateChapter(viewingClass, e.target.value)}>
                                    <option value="">-- DOSSIER --</option>
                                    {getChaptersForClass(viewingClass).map(c => (<option key={c._id} value={c._id}>{c.sharedLevel ? `[PARTAGÉ] ` : ''}{c.title}</option>))}
                                </select>
                            </div>
                        )}

                        <div className="v84-students-list custom-scrollbar flex-1 border-t border-slate-200 pt-2">
                            <div className={`v84-student-row ${isFullClass ? 'selected' : ''}`} onClick={toggleFullClass}>
                                <div className="v84-check"></div><span>TOUTE LA CLASSE</span>
                            </div>
                            {studentsInView.map(s => {
                                const isChecked = isSelected && (isFullClass || distribution[viewingClass].studentIds.includes(s._id));
                                return (
                                    <div key={s._id} className={`v84-student-row ${isChecked ? 'selected' : ''}`} onClick={() => handleToggleStudent(s._id)}>
                                        <div className="v84-check"></div><span>{s.firstName} {s.lastName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : <div className="flex-1" />}
                
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>PUBLIER 🚀</button>
            </div>
        </div>
    </div>
  );
}