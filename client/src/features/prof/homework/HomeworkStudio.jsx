import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR V201 - OWNER FILTER
 * Fix : Filtrage strict des dossiers par PROPRIÉTAIRE.
 * Empêche de voir les dossiers des autres professeurs (Dossiers fantômes).
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
  const [distribution, setDistribution] = useState(initialData ? {} : (globalClass ? { [globalClass]: { chapterId: "", studentIds: [] } } : {}));

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
        if (globalClass && !initialData) {
            setViewingClass(globalClass);
            const defaultChap = chapters.find(c => c.classroom === globalClass && !c.isArchived);
            setDistribution({ [globalClass]: { chapterId: defaultChap ? defaultChap._id : "", studentIds: [] } });
        }
    };
    fetchData();
  }, []);

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

  // --- LOGIQUE DOSSIERS V201 (FIX FANTÔMES) ---
  
  const getChaptersForClass = (clsName) => {
      const myId = user.id || user._id;

      return chapters.filter(c => {
          // 1. Exclure les archivés
          if (c.isArchived) return false;

          // 2. FILTRE DE PROPRIÉTÉ (Empêche de voir les dossiers des collègues)
          // On gère le cas où teacherId est un objet (populé) ou une string
          const ownerId = c.teacherId?._id || c.teacherId;
          if (String(ownerId) !== String(myId)) return false;
          
          // 3. Inclure si c'est explicitement la classe
          if (c.classroom === clsName) return true;
          
          // 4. Inclure si c'est un niveau partagé correspondant
          if (c.sharedLevel && String(c.sharedLevel) === String(targetLevel)) return true;
          
          return false;
      }).sort((a, b) => {
          if (a.section !== b.section) return a.section.localeCompare(b.section);
          return a.title.localeCompare(b.title);
      });
  };
  
  const findEquivalentChapterId = (targetClass, sourceChapId) => {
      if (!sourceChapId) return "";
      const src = chapters.find(c => c._id === sourceChapId);
      if (!src) return "";
      
      const targets = getChaptersForClass(targetClass);
      const same = targets.find(t => 
          t.title.trim().toUpperCase() === src.title.trim().toUpperCase() && 
          (t.section || "").trim().toUpperCase() === (src.section || "").trim().toUpperCase()
      );
      
      if (same) return same._id;
      return "";
  };

  const getSmartChapterIdFor = (clsName) => {
      const activeClasses = Object.keys(distribution);
      if (activeClasses.length > 0) {
          const sourceChapId = distribution[activeClasses[0]].chapterId;
          if (sourceChapId) {
              const eq = findEquivalentChapterId(clsName, sourceChapId);
              if (eq) return eq;
          }
      }
      const available = getChaptersForClass(clsName);
      if (available.length > 0) return available[0]._id;
      return "";
  };

  const handleClassTabClick = (clsName) => { setViewingClass(clsName); };

  const toggleFullClass = () => {
      setDistribution(prev => {
          const next = { ...prev };
          const config = next[viewingClass];
          if (config && config.studentIds.length === 0) {
              delete next[viewingClass];
          } else {
              const chapId = config?.chapterId || getSmartChapterIdFor(viewingClass);
              next[viewingClass] = { chapterId: chapId, studentIds: [] };
          }
          return next;
      });
  };

  const handleToggleStudent = (studentId) => {
      setDistribution(prev => {
          const next = { ...prev };
          const config = next[viewingClass];
          const studentsInThisClass = allStudents.filter(s => s.currentClass === viewingClass).map(s => s._id);

          if (!config) {
              const chapId = getSmartChapterIdFor(viewingClass);
              next[viewingClass] = { chapterId: chapId, studentIds: [studentId] };
          } else if (config.studentIds.length === 0) {
              const allExceptOne = studentsInThisClass.filter(id => id !== studentId);
              next[viewingClass] = { ...config, studentIds: allExceptOne };
          } else {
              let newIds = [...config.studentIds];
              if (newIds.includes(studentId)) {
                  newIds = newIds.filter(id => id !== studentId);
                  if (newIds.length === 0) delete next[viewingClass];
                  else next[viewingClass] = { ...config, studentIds: newIds };
              } else {
                  newIds.push(studentId);
                  if (newIds.length === studentsInThisClass.length) next[viewingClass] = { ...config, studentIds: [] };
                  else next[viewingClass] = { ...config, studentIds: newIds };
              }
          }
          return next;
      });
  };

  const studentsInView = allStudents.filter(s => s.currentClass === viewingClass).sort((a,b) => a.lastName.localeCompare(b.lastName));
  const currentConfig = distribution[viewingClass];
  const isSelected = !!currentConfig;
  const isFullClass = isSelected && currentConfig.studentIds.length === 0;

  const handleUpdateChapter = (clsName, chapId) => {
      setDistribution(prev => {
          const next = { ...prev };
          next[clsName] = { ...next[clsName], chapterId: chapId };
          const selectedChap = chapters.find(c => c._id === chapId);
          if (selectedChap) {
              Object.keys(next).forEach(otherClass => {
                  if (otherClass !== clsName) {
                      const equivalentId = findEquivalentChapterId(otherClass, chapId);
                      next[otherClass] = { ...next[otherClass], chapterId: equivalentId };
                  }
              });
          }
          return next;
      });
  };

  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title) return alert("❌ Titre requis !");
      if (targets.length === 0) return alert("❌ Sélectionnez au moins une classe ou un élève !");
      
      const missingFolderClass = targets.find(cls => !distribution[cls].chapterId);
      if (missingFolderClass) {
          setViewingClass(missingFolderClass);
          return alert(`⚠️ ATTENTION : La classe ${missingFolderClass} n'a pas de dossier sélectionné !\n\nVeuillez choisir un dossier pour cette classe.`);
      }
      
      setIsPublishing(true);
      try {
          const groupedByChapter = {};
          targets.forEach(cls => {
              const chapId = distribution[cls].chapterId;
              if (!groupedByChapter[chapId]) groupedByChapter[chapId] = [];
              groupedByChapter[chapId].push(cls);
          });

          for (const chapId of Object.keys(groupedByChapter)) {
              const classList = groupedByChapter[chapId];
              let finalAssignedStudents = [];
              let globalIsAllClass = true;

              const hasPartial = classList.some(cls => distribution[cls].studentIds.length > 0);

              if (hasPartial) {
                  globalIsAllClass = false; 
                  for (const cls of classList) {
                      const cfg = distribution[cls];
                      if (cfg.studentIds.length > 0) {
                          finalAssignedStudents.push(...cfg.studentIds);
                      } else {
                          const studentsOfClass = allStudents.filter(s => s.currentClass === cls);
                          finalAssignedStudents.push(...studentsOfClass.map(s => s._id));
                      }
                  }
              } else {
                  globalIsAllClass = true;
                  finalAssignedStudents = [];
              }

              const payload = { 
                  ...formData, 
                  chapterId: chapId, 
                  targetClassrooms: classList, 
                  classroom: classList[0],
                  teacherId: user.id || user._id, 
                  assignedStudents: finalAssignedStudents, 
                  isAllClass: globalIsAllClass 
              };
              
              await fetch('/api/homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          }
          onClose();
      } catch(e) { console.error(e); alert("Erreur réseau."); }
      finally { setIsPublishing(false); }
  };

  const getDisplayUrl = (url) => url; 
  const activeLevel = formData.levels[activeLevelIdx];
  const updateLevel = (field, value) => { const newLevels = [...formData.levels]; newLevels[activeLevelIdx][field] = value; setFormData({ ...formData, levels: newLevels }); };
  const handleFileSelect = async (e) => { const files = e.target.files; if (!files || files.length === 0) return; setIsUploading(true); const data = new FormData(); for (let i = 0; i < files.length; i++) data.append('files', files[i]); try { const res = await fetch('/api/homework/upload', { method: 'POST', body: data }); const result = await res.json(); if (res.ok) updateLevel(uploadTarget, [...activeLevel[uploadTarget], ...result.urls]); } catch (err) { alert("Erreur upload."); } finally { setIsUploading(false); e.target.value = null; } };

  // --- FILTRAGE DROPDOWN (V201) ---
  const currentClassFolders = getChaptersForClass(viewingClass);

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
            <div className="v84-version-tag">STUDIO V201</div>
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
            </div>

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

            <div className="v84-sidebar-right" style={{width: '400px'}}>
                <h4 className="v84-sidebar-label">DISTRIBUTION (Niveau {targetLevel || '?'})</h4>
                
                <div className="mb-4 flex flex-wrap gap-2">
                    {availableClasses.map(c => {
                        const isPart = !!distribution[c.name];
                        const isView = viewingClass === c.name;
                        const isPartial = isPart && distribution[c.name].studentIds.length > 0;
                        
                        let bg = 'bg-slate-100 text-slate-400';
                        if (isPart) {
                            bg = !distribution[c.name].chapterId ? 'bg-red-500 text-white animate-pulse' : (isPartial ? 'bg-orange-500 text-white' : 'bg-indigo-600 text-white');
                        }
                        
                        const border = isView ? 'border-2 border-slate-900 scale-105 shadow-md' : 'border border-transparent opacity-90';

                        return (
                            <button key={c._id} onClick={() => handleClassTabClick(c.name)} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${bg} ${border}`}>{c.name}</button>
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
                                <select 
                                    className={`w-full p-2 rounded-xl text-xs font-bold border-2 outline-none ${!distribution[viewingClass].chapterId ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 focus:border-indigo-500'}`}
                                    value={distribution[viewingClass].chapterId} 
                                    onChange={(e) => handleUpdateChapter(viewingClass, e.target.value)}
                                >
                                    <option value="">-- SÉLECTIONNER UN DOSSIER --</option>
                                    {currentClassFolders.map(c => (
                                        <option key={c._id} value={c._id}>
                                            {c.section ? `[${c.section}] ` : ''}{c.sharedLevel ? `[PARTAGÉ] ` : ''}{c.title}
                                        </option>
                                    ))}
                                </select>
                                {currentClassFolders.length === 0 && <p className="text-[9px] text-red-500 mt-1 font-bold">Aucun dossier disponible pour cette classe (Créez-en un dans Activités).</p>}
                            </div>
                        )}

                        <div className="v84-students-list custom-scrollbar flex-1 border-t border-slate-200 pt-2">
                            <div className={`v84-student-row ${isFullClass ? 'selected' : ''}`} onClick={toggleFullClass}>
                                <div className="v84-check"></div><span className="font-black">TOUTE LA CLASSE</span>
                            </div>
                            
                            {studentsInView.map(s => {
                                const isChecked = isSelected && (isFullClass || distribution[viewingClass].studentIds.includes(s._id));
                                return (
                                    <div key={s._id} className={`v84-student-row ${isChecked ? 'selected' : ''}`} onClick={() => handleToggleStudent(s._id)}>
                                        <div className="v84-check"></div><span>{s.lastName} {s.firstName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : <div className="flex-1 flex items-center justify-center text-slate-300 font-black italic">SÉLECTIONNEZ UNE CLASSE CI-DESSUS</div>}
                
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>PUBLIER 🚀</button>
            </div>
        </div>
    </div>
  );
}