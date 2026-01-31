// @signatures: HomeworkStudio, detectLevel, fetchData, handleFileSelect, handleSave, handleToggleStudent, handleUpdateChapter, isMain, myClassesIds, mySubjectIds, tObj, targetLvl, toggleFullClass, updateLevel
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';

const SUBJECTS_LIST = ["MATHS", "FRANÇAIS", "HISTOIRE-GÉO", "ANGLAIS", "ESPAGNOL", "ALLEMAND", "SVT", "PHYSIQUE-CHIMIE", "TECHNOLOGIE", "ARTS PLASTIQUES", "MUSIQUE", "EPS", "LATIN", "GREC", "PHILOSOPHIE", "SES", "NSI"];

export const StudioUtils = {
    // ✅ FIX : RÉTABLISSEMENT DE LA FONCTIONgetChaptersForContext
    getChaptersForContext: (selectedClasses, chapters, user, targetSection, allClasses) => {
        if (!selectedClasses || selectedClasses.length === 0) return [];
        const uid = String(user.id || user._id);
        const chaptersPerClass = selectedClasses.map(clsName => {
            const targetLvl = (allClasses || []).find(c => c.name === clsName)?.level;
            return (chapters || []).filter(c => {
                if (c.isArchived) return false;
                if (String(c.teacherId) !== uid) return false;
                if (targetSection && c.section !== targetSection) return false;
                const isClassSpecific = c.classroom === clsName;
                const isLevelShared = c.sharedLevel && targetLvl && String(c.sharedLevel) === String(targetLvl);
                const isGlobalGeneral = c.classroom === "" && c.sharedLevel === "" && c.section === "GÉNÉRAL";
                return isClassSpecific || isLevelShared || isGlobalGeneral;
            });
        });
        
        if (!chaptersPerClass[0]) return [];
        let commonTitles = chaptersPerClass[0].map(c => c.title);
        for (let i = 1; i < chaptersPerClass.length; i++) {
            const currentClassTitles = chaptersPerClass[i].map(c => c.title);
            commonTitles = commonTitles.filter(t => currentClassTitles.includes(t));
        }
        const commonChapters = chaptersPerClass[0]
            .filter(c => commonTitles.includes(c.title))
            .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        if (commonChapters.length === 0) {
            return (chapters || []).filter(c => !c.isArchived && c.classroom === "" && c.sharedLevel === "" && c.section === "GÉNÉRAL");
        }
        return commonChapters;
    },

    findDefaultChapterId: (selectedClasses, chapters, user, targetSection, allClasses) => {
        const available = StudioUtils.getChaptersForContext(selectedClasses, chapters, user, targetSection, allClasses);
        if (available.length > 0) return available[0]._id;
        return "";
    },

    getStudentsForViewingClass: (viewingClass, allStudents, allClasses) => {
        if(!viewingClass) return [];
        const tObj = (allClasses || []).find(c => c.name.trim().toUpperCase() === viewingClass.trim().toUpperCase());
        const tId = tObj ? String(tObj._id) : null;
        return (allStudents || []).filter(s => {
            const isMain = (s.currentClass || "").trim().toUpperCase() === viewingClass.trim().toUpperCase();
            const isOption = tId && (s.assignedGroups || []).some(gId => String(gId) === tId);
            return isMain || isOption;
        }).sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
    },

    SUBJECTS_LIST
};

export default function HomeworkStudio({ initialData, chapters, globalClass, user, targetSection, onClose }) {
  const [formData, setFormData] = useState(initialData || { title: '', chapterId: '', subject: "Général", targetClassrooms: globalClass ? [globalClass] : [], levels: [{ instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }], assignedStudents: [], isAllClass: true, isPunishment: false });
  const [activeLevelIdx, setActiveLevelIdx] = useState(0);
  const [allStudents, setAllStudents] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState(SUBJECTS_LIST); 
  const [distribution, setDistribution] = useState({});
  const [viewingClass, setViewingClass] = useState(globalClass || "");
  const [isPublishing, setIsPublishing] = useState(false);
  const [studentSearch, setStudentSearch] = useState(""); 
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null);

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
            const mySubjectIds = (user.taughtSubjects || []).map(id => String(id));
            let finalList = [];
            if (mySubjectIds.length > 0 && !user.isDeveloper && user.role !== 'admin') {
                finalList = subData.filter(s => mySubjectIds.includes(String(s._id))).map(s => s.name);
            } else { finalList = subData.map(s => s.name).sort(); }
            setAvailableSubjects(finalList);
            if (!initialData && finalList.length > 0) setFormData(prev => ({ ...prev, subject: finalList[0] }));
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
                const defId = StudioUtils.findDefaultChapterId([globalClass], chapters, user, targetSection, cls);
                setDistribution({ [globalClass]: { chapterId: defId, studentIds: [] } });
            }
        } catch(e) { console.error("Load Error", e); }
    };
    fetchData();
  }, []);

  const targetLevel = (() => { const o = allClasses.find(c => c.name === viewingClass); return o ? o.level : null; })();
  const myClassesIds = (user.assignedClasses||[]).map(c=>String(c._id||c));
  const availableClasses = allClasses.filter(c => { 
      if(targetLevel) if(String(c.level)!==String(targetLevel)) return false; 
      if(user.isDeveloper||user.role==='admin') return true; 
      return myClassesIds.includes(String(c._id)); 
  }).sort((a,b) => a.name.localeCompare(b.name));
  
  const rawStudents = StudioUtils.getStudentsForViewingClass(viewingClass, allStudents, allClasses);
  const studentsToDisplay = rawStudents.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()));

  const handleToggleStudent = (sId) => { setDistribution(prev => { const next = { ...prev }; const cfg = next[viewingClass]; if (!cfg) { const defId = StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses); next[viewingClass] = { chapterId: defId, studentIds: [sId] }; } else { let newIds = cfg.studentIds.length === 0 ? rawStudents.map(s => s._id).filter(id => id !== sId) : (cfg.studentIds.includes(sId) ? cfg.studentIds.filter(id => id !== sId) : [...cfg.studentIds, sId]); if (newIds.length === 0) delete next[viewingClass]; else if (newIds.length === rawStudents.length) next[viewingClass] = { ...cfg, studentIds: [] }; else next[viewingClass] = { ...cfg, studentIds: newIds }; } return next; }); };
  const toggleFullClass = () => { setDistribution(prev => { const next = { ...prev }; if (next[viewingClass]) delete next[viewingClass]; else { const defId = StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses); next[viewingClass] = { chapterId: defId, studentIds: [] }; } return next; }); };
  
  const handleUpdateChapter = (cls, cId) => { 
      const targets = Object.keys(distribution);
      if (targets.length > 1) {
          const selectedChap = chapters.find(c => c._id === cId);
          if (selectedChap && confirm(`Appliquer le dossier "${selectedChap.title}" à toutes les classes sélectionnées ?`)) {
              const nextDist = { ...distribution };
              targets.forEach(tName => {
                  const equivalent = StudioUtils.getChaptersForContext([tName], chapters, user, targetSection, allClasses).find(c => c.title === selectedChap.title);
                  if (equivalent) nextDist[tName].chapterId = equivalent._id;
              });
              setDistribution(nextDist);
              return;
          }
      }
      setDistribution(prev => ({ ...prev, [cls]: { ...prev[cls], chapterId: cId } })); 
  };

  const activeLevel = formData.levels[activeLevelIdx];
  const updateLevel = (f, v) => { const n=[...formData.levels]; n[activeLevelIdx][f]=v; setFormData({...formData, levels:n}); };
  const handleFileSelect = async (e) => { 
      const files=e.target.files; if(!files||files.length===0)return; 
      const d=new FormData(); for(let i=0;i<files.length;i++)d.append('files', files[i]); 
      try { const r=await fetch('/api/homework/upload', {method:'POST', body:d}); const j=await r.json(); updateLevel(uploadTarget, [...activeLevel[uploadTarget], ...j.urls]); } catch(e){} e.target.value=null; 
  };

  const handleSave = async () => {
      const targets = Object.keys(distribution);
      if (!formData.title || targets.length === 0) return alert("❌ Titre et Classe requis !");
      setIsPublishing(true);
      try {
          for (const cls of targets) {
              const cfg = distribution[cls];
              let realChapterId = cfg.chapterId || StudioUtils.findDefaultChapterId([cls], chapters, user, targetSection, allClasses);
              let finalIds = [];
              let isGlobal = true;
              if (cfg.studentIds.length > 0) { isGlobal = false; finalIds = cfg.studentIds; } 
              else { finalIds = StudioUtils.getStudentsForViewingClass(cls, allStudents, allClasses).map(s => s._id); }
              const payload = { ...formData, chapterId: realChapterId, targetClassrooms: [cls], classroom: cls, teacherId: user.id || user._id, assignedStudents: formData.isPunishment ? [] : finalIds, isAllClass: formData.isPunishment ? false : isGlobal };
              await fetch('/api/homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          }
          onClose();
      } catch(e) { alert("Erreur sauvegarde."); }
      setIsPublishing(false);
  };

  const isSelected = !!distribution[viewingClass];
  const distCfg = distribution[viewingClass];
  const selectedClassesList = Object.keys(distribution);
  const availableChapters = StudioUtils.getChaptersForContext(selectedClassesList.length > 1 ? selectedClassesList : [viewingClass], chapters, user, targetSection, allClasses);

  return (
    <div className={formData.isPunishment ? "v84-studio-container punishment-mode" : "v84-studio-container"}>
        <style>{`.punishment-mode { background: #fef2f2 !important; } .punishment-mode .v84-header { border-bottom-color: #fecaca; }`}</style>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept="image/*" onChange={handleFileSelect} />
        
        <div className="v84-header">
            <div className="v84-header-left"><div className="v84-icon">{formData.isPunishment ? '⚖️' : '📝'}</div><input className="v84-title-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="TITRE DU DEVOIR..." /></div>
            <div className="mr-4 flex items-center gap-2">
                <select className="p-2 rounded-xl font-bold bg-slate-100 text-slate-600 outline-none uppercase text-xs" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})}>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <button onClick={() => setFormData({...formData, isPunishment: !formData.isPunishment})} className={`px-4 py-2 rounded-full font-black text-xs mr-4 border-2 ${formData.isPunishment ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-300 border-slate-200'}`}>{formData.isPunishment ? '🔥 PUNITION' : '🛡️ DÉFINIR COMME PUNITION'}</button>
            <button onClick={onClose} className="v84-close-btn">✕</button>
        </div>

        <div className="v84-body">
            <div className="v84-sidebar-left"><h4 className="v84-sidebar-label">Contenu</h4><div className="v84-pages-list custom-scrollbar">{formData.levels.map((lvl, idx) => (<div key={idx} className={`v84-page-item ${activeLevelIdx === idx ? 'active' : ''}`} onClick={() => setActiveLevelIdx(idx)}><div className="v84-page-name">PAGE {idx + 1}</div></div>))}<button className="v84-add-page-btn" onClick={() => setFormData({...formData, levels: [...formData.levels, { instruction: '', instructionUrls: [], aiHints: '', attachmentUrls: [] }]})}>+ PAGE</button></div></div>
            <div className="v84-main-editor custom-scrollbar">
                <div className="v84-card">
                    <label className="v84-card-label uppercase tracking-widest text-[10px] opacity-50">Consigne & Documents</label>
                    <textarea className="v84-textarea" value={formData.levels[activeLevelIdx].instruction} onChange={e => updateLevel('instruction', e.target.value)} placeholder="Écrivez la consigne pour l'élève..." />
                    <div className="v84-ai-box"><div className="v84-ai-label"><span className="text-xl">🤖</span> CONSIGNES DE CORRECTION (IA)</div><textarea className="v84-ai-textarea" value={formData.levels[activeLevelIdx].aiHints || ''} onChange={e => updateLevel('aiHints', e.target.value)} placeholder="Ex: Sois sévère sur la grammaire..." /></div>
                    <div className="flex gap-2 mt-4"><button className="v84-upload-btn" onClick={() => { setUploadTarget('instructionUrls'); fileInputRef.current.click(); }}>📂 ÉNONCÉS</button><button className="v84-upload-btn secondary" onClick={() => { setUploadTarget('attachmentUrls'); fileInputRef.current.click(); }}>📎 PIÈCES JOINTES</button></div>
                    {activeLevel.instructionUrls.length > 0 && (<div className="mt-6"><h5 className="text-[10px] font-black text-indigo-500 uppercase mb-2">📚 ÉNONCÉS CHARGÉS</h5><div className="v84-gallery">{activeLevel.instructionUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} alt="instr"/><button className="v84-thumb-del" onClick={() => updateLevel('instructionUrls', activeLevel.instructionUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div></div>)}
                    {activeLevel.attachmentUrls.length > 0 && (<div className="mt-6"><h5 className="text-[10px] font-black text-slate-500 uppercase mb-2">📎 PIÈCES JOINTES CHARGÉES</h5><div className="v84-gallery">{activeLevel.attachmentUrls.map((url, i) => (<div key={i} className="v84-thumb"><img src={url} alt="attachment"/><button className="v84-thumb-del" onClick={() => updateLevel('attachmentUrls', activeLevel.attachmentUrls.filter((_, idx) => idx !== i))}>✕</button></div>))}</div></div>)}
                </div>
            </div>

            <div className="v84-sidebar-right">
                <h4 className="v84-sidebar-label">CIBLAGE (Niveau {targetLevel || '?'})</h4>
                <div className="mb-4 flex flex-wrap gap-2">{availableClasses.map(c => (<button key={c._id} onClick={() => { setViewingClass(c.name); setStudentSearch(""); }} className={`px-3 py-1 rounded-xl text-[10px] font-black transition-all ${distribution[c.name] ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'} ${viewingClass === c.name ? 'border-2 border-slate-900 scale-105' : ''} ${c.type === 'GROUP' ? 'border-orange-200 text-orange-500' : ''}`}>{c.name}</button>))}</div>
                
                {viewingClass && (
                    <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-4">
                        <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={toggleFullClass}>
                            <span className="font-black text-slate-700 uppercase">{viewingClass}</span>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>{isSelected && <span className="text-white text-xs">✓</span>}</div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 mb-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Ranger dans :</label>
                            <select className="w-full p-2 rounded-lg text-xs font-bold border border-slate-100 outline-none bg-slate-50" value={distCfg?.chapterId || StudioUtils.findDefaultChapterId([viewingClass], chapters, user, targetSection, allClasses)} onChange={(e) => handleUpdateChapter(viewingClass, e.target.value)}>
                                <option value="">-- CHOISIR DOSSIER --</option>
                                {availableChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                            </select>
                        </div>
                        
                        <div className="relative mb-2">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px]">🔎</span>
                            <input className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-400" placeholder="Chercher un élève..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {studentsToDisplay.map(s => { 
                                const checked = isSelected && (distribution[viewingClass].studentIds.length === 0 || distribution[viewingClass].studentIds.includes(s._id)); 
                                return (
                                    <div key={s._id} onClick={() => handleToggleStudent(s._id)} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${checked ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-100 text-slate-400'}`}>
                                        <div className={`w-4 h-4 rounded border shrink-0 ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}></div>
                                        <span className="text-[11px] font-bold truncate">{s.lastName} {s.firstName}</span>
                                    </div>
                                ); 
                            })}
                        </div>
                    </div>
                )}
                <button className="v84-publish-btn" onClick={handleSave} disabled={isPublishing}>{isPublishing ? '...' : (initialData ? 'MODIFIER ✍️' : 'PUBLIER 🚀')}</button>
            </div>
        </div>
    </div>
  );
}
