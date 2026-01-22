import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

/**
 * 🎨 STUDIO DEVOIR V194 - FIX DISTRIBUTION & SYNC FOLDERS
 * Fix 1 : "Mixed Mode" -> Si une classe est partielle et l'autre complète, on injecte tous les IDs de la complète.
 * Fix 2 : "Folder Auto-Sync" -> Sélectionner un dossier l'applique aux autres classes si le nom correspond.
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

  // --- 1. GESTION DES ONGLETS DE CLASSE ---
  const handleClassTabClick = (clsName) => {
      const isActive = !!distribution[clsName];
      if (isActive) {
          // Désélection
          setDistribution(prev => {
              const next = { ...prev };
              delete next[clsName];
              return next;
          });
          setViewingClass(clsName); // On reste dessus pour voir qu'elle est grise
      } else {
          // Sélection : On tente d'appliquer le dossier d'une autre classe déjà active
          setViewingClass(clsName);
          setDistribution(prev => {
              const next = { ...prev };
              
              // Recherche intelligente de dossier
              let smartChapterId = "";
              const activeClasses = Object.keys(prev);
              if (activeClasses.length > 0) {
                  // On prend le dossier de la première classe active
                  const sourceChapId = prev[activeClasses[0]].chapterId;
                  if (sourceChapId) {
                      smartChapterId = findEquivalentChapterId(clsName, sourceChapId);
                  }
              }

              // Fallback : premier dossier dispo de la classe
              if (!smartChapterId) {
                  const available = getChaptersForClass(clsName);
                  if (available.length > 0) smartChapterId = available[0]._id;
              }

              next[clsName] = { chapterId: smartChapterId, studentIds: [] }; // [] vide = Toute la classe par défaut
              return next;
          });
      }
  };

  // --- 2. GESTION DES ÉLÈVES ---
  const handleToggleStudent = (studentId) => {
      setDistribution(prev => {
          const currentConfig = prev[viewingClass] || { chapterId: "", studentIds: [] };
          const isActive = !!prev[viewingClass];
          let newIds = currentConfig.studentIds; // Si vide = toute la classe (mode implicite)
          
          if (!isActive) {
              // Si la classe n'était pas active, on l'active avec cet élève SEULEMENT
              newIds = [studentId];
          } else {
              // Si la liste est vide (mode "Toute la classe"), on la remplit avec TOUS SAUF CELUI CLIQUÉ (Exclusion)
              // OU ALORS : on part du principe que cliquer sur un élève passe en mode "Sélection Positive"
              // V194 : Mode "Sélection Positive".
              // Si la liste était vide (Toute la classe), cliquer sur un élève bascule en mode "Juste lui" ? 
              // Non, c'est trop radical.
              
              // Logique V194 :
              // État initial : studentIds = [] (Tout le monde)
              // Clic sur un élève -> studentIds = [id] (Juste lui)
              // Clic sur "TOUTE LA CLASSE" -> studentIds = [] (Reset)
              
              if (newIds.includes(studentId)) {
                  newIds = newIds.filter(id => id !== studentId);
              } else {
                  newIds = [...newIds, studentId];
              }
          }
          return { ...prev, [viewingClass]: { ...currentConfig, studentIds: newIds } };
      });
  };

  const toggleFullClass = () => {
      setDistribution(prev => ({
          ...prev,
          [viewingClass]: { ...prev[viewingClass], studentIds: [] } // Vide = Tout le monde
      }));
  };

  const studentsInView = allStudents.filter(s => s.currentClass === viewingClass);
  const currentConfig = distribution[viewingClass];
  const isSelected = !!currentConfig;
  const isFullClass = isSelected && currentConfig.studentIds.length === 0;

  // --- 3. GESTION DES DOSSIERS (AUTO-SYNC V194) ---
  const getChaptersForClass = (clsName) => {
      return chapters.filter(c => !c.isArchived && (c.classroom === clsName || (c.sharedLevel && String(c.sharedLevel) === String(targetLevel))));
  };
  
  const findEquivalentChapterId = (targetClass, sourceChapId) => {
      if (!sourceChapId) return "";
      const src = chapters.find(c => c._id === sourceChapId);
      if (!src) return "";
      
      const targets = getChaptersForClass(targetClass);
      // On cherche un dossier avec EXACTEMENT le même titre et section
      const sameName = targets.find(t => t.title === src.title && t.section === src.section);
      if (sameName) return sameName._id;
      return "";
  };

  const handleUpdateChapter = (clsName, chapId) => {
      // 1. Mise à jour de la classe courante
      setDistribution(prev => {
          const next = { ...prev };
          next[clsName] = { ...next[clsName], chapterId: chapId };
          
          // 2. AUTO-SYNC V194 : On essaie d'appliquer ce choix aux autres classes sélectionnées
          const selectedChap = chapters.find(c => c._id === chapId);
          if (selectedChap) {
              Object.keys(next).forEach(otherClass => {
                  if (otherClass !== clsName) {
                      const equivalentId = findEquivalentChapterId(otherClass, chapId);
                      if (equivalentId) {
                          next[otherClass] = { ...next[otherClass], chapterId: equivalentId };
                      }
                  }
              });
          }
          return next;
      });
  };

  // --- 4. SAUVEGARDE & PUBLICATION ---
  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title) return alert("❌ Titre requis !");
      if (targets.length === 0) return alert("❌ Sélectionnez au moins une classe !");
      
      const missingFolder = targets.find(cls => !distribution[cls].chapterId);
      if (missingFolder) return alert(`❌ La classe ${missingFolder} n'a pas de dossier de rangement !`);
      
      setIsPublishing(true);
      try {
          // GROUPAGE PAR DOSSIER DE DESTINATION (Pour éviter de créer 50 fois le même devoir)
          // Mais attention, chaque classe peut avoir un ID de chapitre différent même si le nom est le même.
          // Pour simplifier V194 : On crée une entrée Homework par "Groupe de diffusion" logique.
          // Si on veut une granularité fine, on crée 1 devoir par ID de chapitre différent.

          const groupedByChapter = {};
          targets.forEach(cls => {
              const chapId = distribution[cls].chapterId;
              if (!groupedByChapter[chapId]) groupedByChapter[chapId] = [];
              groupedByChapter[chapId].push(cls);
          });

          for (const chapId of Object.keys(groupedByChapter)) {
              const classList = groupedByChapter[chapId];
              
              // RÉSOLUTION MIXTE (PARTIEL vs TOTAL)
              // Si dans ce groupe, une classe est "Partielle", alors globalement isAllClass = false.
              // DU COUP, pour les classes "Totales", il faut explicitement lister tous leurs élèves.
              
              let finalAssignedStudents = [];
              let globalIsAllClass = true;

              // Est-ce qu'il y a au moins une classe en mode partiel dans ce lot ?
              const hasPartial = classList.some(cls => distribution[cls].studentIds.length > 0);

              if (hasPartial) {
                  globalIsAllClass = false; // Le devoir devient restrictif
                  
                  for (const cls of classList) {
                      const cfg = distribution[cls];
                      if (cfg.studentIds.length > 0) {
                          // Classe partielle : on ajoute juste les sélectionnés
                          finalAssignedStudents.push(...cfg.studentIds);
                      } else {
                          // Classe totale (mais mode restrictif global) : on ajoute TOUS les élèves de cette classe
                          const studentsOfClass = allStudents.filter(s => s.currentClass === cls);
                          finalAssignedStudents.push(...studentsOfClass.map(s => s._id));
                      }
                  }
              } else {
                  // Que des classes complètes -> Mode ouvert
                  globalIsAllClass = true;
                  finalAssignedStudents = [];
              }

              const payload = { 
                  ...formData, 
                  chapterId: chapId, 
                  targetClassrooms: classList, 
                  classroom: classList[0], // Rétro-compatibilité
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
            <div className="v84-version-tag">STUDIO V194</div>
            <button onClick={onClose} className="v84-close-btn">✕</button>
        </div>

        <div className="v84-body">
            
            {/* 1. COLONNE GAUCHE : PAGES */}
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

            {/* 3. COLONNE DROITE : DISTRIBUTION (V194) */}
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
                                // Mode partiel : On highlight l'élève spécifique
                                // Mode total : Tout le monde est highlighté implicitement
                                const displayChecked = isSelected && (distribution[viewingClass].studentIds.length > 0 ? distribution[viewingClass].studentIds.includes(s._id) : true);

                                return (
                                    <div key={s._id} className={`v84-student-row ${displayChecked ? 'selected' : ''}`} onClick={() => handleToggleStudent(s._id)}>
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