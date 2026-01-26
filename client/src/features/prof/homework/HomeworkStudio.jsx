import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

const SUBJECTS_LIST = ["MATHS", "FRANÇAIS", "HISTOIRE-GÉO", "ANGLAIS", "ESPAGNOL", "ALLEMAND", "SVT", "PHYSIQUE-CHIMIE", "TECHNOLOGIE", "ARTS PLASTIQUES", "MUSIQUE", "EPS", "LATIN", "GREC", "PHILOSOPHIE", "SES", "NSI"];

export default function HomeworkStudio({ initialData, chapters, globalClass, user, targetSection, onClose }) {
  const [formData, setFormData] = useState(initialData || { title: '', chapterId: '', subject: "Général", targetClassrooms: globalClass ? [globalClass] : [], levels: [{ instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }], assignedStudents: [], isAllClass: true, isPunishment: false });
  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [allStudents, setAllStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState(SUBJECTS_LIST); 
  const [distribution, setDistribution] = useState({});
  const [viewingClass, setViewingClass] = useState(globalClass || "");
  const [isPublishing, setIsPublishing] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

  // V445 : FILTRAGE STRICT PAR SECTION
  const getChaptersForClass = (clsName) => {
      const targetLvl = allClasses.find(c => c.name === clsName)?.level;
      return chapters.filter(c => {
          if (c.isArchived) return false;
          if (String(c.teacherId) !== String(user.id || user._id)) return false;
          
          // FILTRE SECTION CRITIQUE
          if (targetSection && c.section !== targetSection) return false;

          if (c.classroom === clsName) return true;
          if (c.sharedLevel && targetLvl && String(c.sharedLevel) === String(targetLvl)) return true;
          if (c.classroom === "" && c.section === "GÉNÉRAL") return true;
          return false;
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const findDefaultChapterId = (clsName) => {
      const available = getChaptersForClass(clsName);
      // 1. Priorité au chapitre "CH1" de cette section
      const ch1 = available.find(c => c.title === "CH1");
      if (ch1) return ch1._id;
      // 2. Sinon le plus récent
      if (available.length > 0) return available[0]._id;
      return "";
  };

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [sts, cls, subData] = await Promise.all([
                fetch('/api/admin/students').then(r => r.json()),
                fetch('/api/admin/classrooms').then(r => r.json()),
                fetch('/api/admin/subjects').then(r => r.json())
            ]);
            setAllStudents(sts);
            setAllClasses(cls);

            const mySubjectIds = user.taughtSubjects || [];
            let mySubjectsList = [];
            if (mySubjectIds.length > 0 && !user.isDeveloper && user.role !== 'admin') {
                mySubjectsList = subData.filter(s => mySubjectIds.includes(s._id)).map(s => s.name);
            } else { mySubjectsList = subData.map(s => s.name); }
            if (mySubjectsList.length > 0) {
                setAvailableSubjects(mySubjectsList.sort());
                if (!mySubjectsList.includes(formData.subject) && formData.subject !== "Général") {
                    setFormData(prev => ({ ...prev, subject: mySubjectsList[0] }));
                }
            }

            if (initialData) {
                const targets = initialData.targetClassrooms || [initialData.classroom];
                const newDist = {};
                targets.forEach(clsName => {
                    const clsObj = cls.find(c => c.name === clsName);
                    const clsId = clsObj ? String(clsObj._id) : null;
                    let classStudentIds = sts.filter(s => {
                        const isMain = (s.currentClass||"").trim().toUpperCase() === clsName.trim().toUpperCase();
                        const isOption = clsId && (s.assignedGroups||[]).some(gId => String(gId) === clsId);
                        return (isMain || isOption) && (initialData.assignedStudents||[]).includes(s._id);
                    }).map(s => s._id);
                    newDist[clsName] = { chapterId: initialData.chapterId, studentIds: classStudentIds };
                });
                setDistribution(newDist);
                if (targets.length > 0) setViewingClass(targets[0]);
            }
            else if (globalClass) {
                setViewingClass(globalClass);
                const defId = findDefaultChapterId(globalClass);
                setDistribution({ [globalClass]: { chapterId: defId, studentIds: [] } });
            }
        } catch(e) { console.error("Load Error", e); }
    };
    fetchData();
  }, []);

  // ... (Logique inchangée pour le reste) ...
  const detectLevel = () => { const r=viewingClass||globalClass||(initialData?.targetClassrooms?initialData.targetClassrooms[0]:null); if(!r)return null; const o=allClasses.find(c=>c.name===r); if(o&&o.level)return o.level; const m=r.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2)/); return m?m[0]:null; };
  const targetLevel = detectLevel();
  const myClassesIds = (user.assignedClasses||[]).map(c=>String(c._id||c));
  const availableClasses = allClasses.filter(c => { if(targetLevel)if(String(c.level)!==String(targetLevel))return false; if(user.isDeveloper||user.role==='admin')return true; return myClassesIds.includes(String(c._id)); }).sort((a,b)=>{ if(a.type==='CLASS'&&b.type!=='CLASS')return -1; if(a.type!=='CLASS'&&b.type==='CLASS')return 1; return a.name.localeCompare(b.name); });
  
  const getStudentsForViewingClass = () => { if(!viewingClass)return[]; const tObj=allClasses.find(c=>c.name.trim().toUpperCase()===viewingClass.trim().toUpperCase()); const tId=tObj?String(tObj._id):null; return allStudents.filter(s=>{ const isMain=(s.currentClass||"").trim().toUpperCase()===viewingClass.trim().toUpperCase(); const isOption=tId&&(s.assignedGroups||[]).some(gId=>String(gId)===tId); return isMain||isOption; }).sort((a,b)=>a.lastName.localeCompare(b.lastName)); };
  const studentsToDisplay = getStudentsForViewingClass();

  const handleToggleStudent = (sId) => {
      setDistribution(prev => {
          const next = { ...prev };
          const cfg = next[viewingClass];
          const allIds = studentsToDisplay.map(s => s._id);
          if (!cfg) {
              const defId = findDefaultChapterId(viewingClass);
              next[viewingClass] = { chapterId: defId, studentIds: [sId] };
          } else {
              let newIds = cfg.studentIds.length === 0 ? allIds.filter(id => id !== sId) : (cfg.studentIds.includes(sId) ? cfg.studentIds.filter(id => id !== sId) : [...cfg.studentIds, sId]);
              if (newIds.length === 0) delete next[viewingClass];
              else if (newIds.length === allIds.length) next[viewingClass] = { ...cfg, studentIds: [] };
              else next[viewingClass] = { ...cfg, studentIds: newIds };
          }
          return next;
      });
  };

  const toggleFullClass = () => {
      setDistribution(prev => {
          const next = { ...prev };
          if (next[viewingClass]) delete next[viewingClass];
          else {
              const defId = findDefaultChapterId(viewingClass);
              next[viewingClass] = { chapterId: defId, studentIds: [] };
          }
          return next;
      });
  };

  const handleUpdateChapter = (cls, cId) => {
      setDistribution(prev => ({
          ...prev,
          [cls]: { ...prev[cls], chapterId: cId }
      }));
  };

  const activeLevel = formData.levels[activeLevelIdx];
  const updateLevel = (f, v) => { const n=[...formData.levels]; n[activeLevelIdx][f]=v; setFormData({...formData, levels:n}); };
  const handleFileSelect = async (e) => { const files=e.target.files; if(!files||files.length===0)return; const d=new FormData(); for(let i=0;i<files.length;i++)d.append('files', files[i]); try{const r=await fetch('/api/homework/upload', {method:'POST', body:d}); const j=await r.json(); updateLevel(uploadTarget, [...activeLevel[uploadTarget], ...j.urls]); } catch(e){} e.target.value=null; };

  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
      setIsPublishing(true);
      try {
          for (const cls of targets) {
              const cfg = distribution[cls];
              let realChapterId = cfg.chapterId;
              if (!realChapterId) {
                  const defId = findDefaultChapterId(cls);
                  if (defId) realChapterId = defId;
                  else {
                      // Fallback création CH1 si rien trouvé (très rare)
                      const res = await fetch('/api/structure/chapters', {
                          method: 'POST', headers: {'Content-Type':'application/json'},
                          body: JSON.stringify({ title: "CH1", classroom: cls, teacherId: user.id || user._id, section: targetSection || "GÉNÉRAL" })
                      });
                      const newChap = await res.json();
                      realChapterId = newChap._id;
                  }
              }
              let finalIds = [];
              let isGlobal = true;
              if (cfg.studentIds.length > 0) {
                  isGlobal = false;
                  finalIds = cfg.studentIds;
              } else {
                  const clsObj = allClasses.find(c => c.name === cls);
                  const clsId = clsObj ? String(clsObj._id) : null;
                  finalIds = allStudents.filter(s => {
                      const isMain = (s.currentClass || "").trim().toUpperCase() === cls.trim().toUpperCase();
                      const isOption = clsId && (s.assignedGroups || []).some(gId => String(gId) === clsId);
                      return isMain || isOption;
                  }).map(s => s._id);
              }
              const payload = { ...formData, chapterId: realChapterId, targetClassrooms: [cls], classroom: cls, teacherId: user.id || user._id, assignedStudents: formData.isPunishment ? [] : finalIds, isAllClass: formData.isPunishment ? false : isGlobal };
              await fetch('/api/homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          }
          onClose();
      } catch(e) { alert("Erreur sauvegarde."); }
      setIsPublishing(false);
  };

  const isSelected = !!distribution[viewingClass];
  const containerClass = formData.isPunishment ? "v84-studio-container punishment-mode" : "v84-studio-container";
  const distCfg = distribution[viewingClass];

  return (
    <div className={containerClass}>
        <style>{`.punishment-mode { background: #fef2f2 !important; } .punishment-mode .v84-header { border-bottom-color: #fecaca; }`}</style>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        <div className="v84-header">
            <div className="v84-header-left"><div className="v84-icon">{formData.isPunishment ? '⚖️' : '📝'}</div><input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." /></div>
            <div className="mr-4"><select className="p-2 rounded-xl font-bold bg-slate-100 text-slate-600 outline-none uppercase text-xs" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}><option value="Général">MATIÈRE...</option>{availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <button onClick={() => setFormData({...formData, isPunishment: !formData.isPunishment})} className={`px-4 py-2 rounded-full font-black text-xs mr-4 border-2 ${formData.isPunishment ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-300 border-slate-200'}`}>{formData.isPunishment ? '🔥 PUNITION' : '🛡️ DÉFINIR COMME PUNITION'}</button><button onClick={onClose} className="v84-close-btn">✕</button>
        </div>
        <div className="v84-body">
            <div className="v84-sidebar-left"><h4 className="v84-sidebar-label">Contenu</h4><div className="v84-pages-list custom-scrollbar">{formData.levels.map((lvl, idx) => (<div key={idx} className={`v84-page-item ${activeLevelIdx === idx ? 'active' : ''}`} onClick={() => setActiveLevelIdx(idx)}><div className="v84-page-name">PAGE {idx + 1}</div></div>))}<button className="v84-add-page-btn" onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }]})}>+ PAGE</button></div></div>
            <div className="v84-main-editor custom-scrollbar"><div className="v84-card"><label className="v84-card-label">CONSIGNE & DOCUMENTS</label><textarea className="v84-textarea" value={formData.levels[activeLevelIdx].instruction} onChange={e => { const l=[...formData.levels]; l[activeLevelIdx].instruction=e.target.value; setFormData({...formData, levels:l}); }} placeholder="Écrivez la consigne..." /><div className="flex gap-2 mt-4"><button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 ÉNONCÉS</button><button className="v84-upload-btn bg-slate-500" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📎 PIÈCES JOINTES</button></div>{activeLevel.instructionUrls.length > 0 && (<div className="mt-6"><h5 className="text-[10px] font-black text-indigo-500 uppercase mb-2">📚 ÉNONCÉS CHARGÉS</h5><div className="v84-gallery">{activeLevel.instructionUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} /><button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div></div>)}{activeLevel.attachmentUrls.length > 0 && (<div className="mt-6"><h5 className="text-[10px] font-black text-slate-500 uppercase mb-2">📎 PIÈCES JOINTES CHARGÉES</h5><div className="v84-gallery">{activeLevel.attachmentUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} /><button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div></div>)}</div></div>

            <div className="v84-sidebar-right" style={{width: '400px'}}>
                <h4 className="v84-sidebar-label">CIBLAGE (Niveau {targetLevel || '?'})</h4>
                <div className="mb-4 flex flex-wrap gap-2">
                    {availableClasses.length > 0 ? availableClasses.map(c => (
                        <button key={c._id} onClick={() => setViewingClass(c.name)} className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${distribution[c.name] ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'} ${viewingClass === c.name ? 'border-2 border-slate-900 scale-105' : ''} ${c.type === 'GROUP' ? 'border-orange-200 text-orange-500' : ''}`}>{c.name}</button>
                    )) : <div className="text-xs text-slate-400 italic">Aucune classe pour ce niveau.</div>}
                </div>
                {viewingClass && (
                    <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                        <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={toggleFullClass}>
                            <span className="font-black text-slate-700 uppercase">{viewingClass}</span>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{isSelected && <span className="text-white text-xs">✓</span>}</div>
                        </div>

                        {isSelected && (
                            <div className="p-3 bg-slate-50 border-b border-slate-100">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Ranger dans :</label>
                                <select 
                                    className="w-full p-2 rounded-lg text-xs font-bold border border-slate-300 outline-none bg-white"
                                    value={distCfg?.chapterId || ""}
                                    onChange={(e) => handleUpdateChapter(viewingClass, e.target.value)}
                                >
                                    <option value="">-- CHOISIR DOSSIER --</option>
                                    {getChaptersForClass(viewingClass).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {studentsToDisplay.length > 0 ? studentsToDisplay.map(s => {
                                const checked = isSelected && (distribution[viewingClass].studentIds.length === 0 || distribution[viewingClass].studentIds.includes(s._id));
                                return (
                                    <div key={s._id} onClick={() => handleToggleStudent(s._id)} className={`flex items-center gap-3 p-2 rounded cursor-pointer ${checked ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-500'}`}>
                                        <div className={`w-4 h-4 rounded border ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                                        <span className="text-xs font-bold">{s.lastName} {s.firstName}</span>
                                    </div>
                                );
                            }) : <div className="text-center text-xs text-slate-400 italic mt-4">Aucun élève trouvé.</div>}
                        </div>
                    </div>
                )}
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>{isPublishing ? '...' : 'PUBLIER 🚀'}</button>
            </div>
        </div>
    </div>
  );
}