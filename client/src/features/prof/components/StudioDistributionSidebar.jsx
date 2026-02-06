// @signatures: StudioDistributionSidebar, getAvailableChapters, findBestDefaultChapter, handleToggleStudent, toggleClass, handleToggleAll
import React from 'react';

/**
 * 🛡️ COMPOSANT DISTRIBUTION - VERSION MASSIVE V6
 * RÔLE : Gère l'assignation pour Classes/Groupes ET le choix de la matière (ADN).
 * AJOUT : Case à cocher "Tout sélectionner" (Batch Assign).
 */
export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, loading, onSave, saveLabel = "PUBLIER 🚀",
    sections = [], currentSection, onSectionChange
}) {

    const getAvailableChapters = (clsName) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const activeSectionName = (currentSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClasses || []).find(c => c.name === clsName);
        
        return safeChapters.filter(c => {
            if (c.isArchived) return false;
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== activeSectionName) return false;
            
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const findBestDefaultChapter = (clsName) => {
        const av = getAvailableChapters(clsName);
        return av.length > 0 ? av[0]._id : "";
    };

    const handleToggleStudent = (sId) => { 
        const next = { ...distribution }; 
        const cfg = next[viewingClass] || { chapterId: findBestDefaultChapter(viewingClass), studentIds: [] };
        let currentIds = Array.isArray(cfg.studentIds) ? [...cfg.studentIds] : [];

        if (currentIds.length === 0) {
            currentIds = [sId];
        } else {
            currentIds = currentIds.includes(sId) ? currentIds.filter(id => id !== sId) : [...currentIds, sId];
        }
        
        if (currentIds.length === 0) delete next[viewingClass];
        else next[viewingClass] = { ...cfg, studentIds: currentIds };
        setDistribution(next);
    };

    const toggleClass = (clsName) => {
        const next = { ...distribution };
        if (next[clsName] && next[clsName].studentIds.length === 0) {
            delete next[clsName];
        } else {
            next[clsName] = { chapterId: findBestDefaultChapter(clsName), studentIds: [] };
        }
        setDistribution(next);
    };

    const availableClasses = (allClasses || []).filter(c => {
        const isAssigned = user.isDeveloper || (user.assignedClasses || []).some(id => String(id) === String(c._id));
        if (!isAssigned) return false;
        if (targetLevel && c.level !== targetLevel) return false;
        return true;
    }).sort((a,b) => a.name.localeCompare(b.name));

    // --- LOGIQUE TOUT SÉLECTIONNER ---
    const areAllClassesFullSelected = availableClasses.length > 0 && availableClasses.every(c => {
        const conf = distribution[c.name];
        // Est considéré comme "Full Selected" si présent ET liste d'élèves vide (mode toute la classe)
        return conf && conf.studentIds.length === 0;
    });

    const handleToggleAll = () => {
        const next = { ...distribution };
        
        if (areAllClassesFullSelected) {
            // SI TOUT EST DÉJÀ SÉLECTIONNÉ -> ON DÉCOCHE TOUT (Pour ce niveau)
            availableClasses.forEach(c => {
                delete next[c.name];
            });
        } else {
            // SINON -> ON COCHE TOUT EN MODE "TOUTE LA CLASSE"
            availableClasses.forEach(c => {
                // On écrase la config existante pour forcer "Toute la classe"
                next[c.name] = {
                    chapterId: findBestDefaultChapter(c.name),
                    studentIds: [] // Liste vide = Toute la classe
                };
            });
            // On force l'affichage de la première classe pour que l'utilisateur voit ce qu'il se passe
            if (availableClasses.length > 0 && !viewingClass) {
                setViewingClass(availableClasses[0].name);
            }
        }
        setDistribution(next);
    };

    // --- LOGIQUE D'AFFICHAGE ÉLÈVES ---
    const clsObj = (allClasses || []).find(c => c.name === viewingClass);
    const clsId = clsObj ? String(clsObj._id) : null;
    
    const studentsInTarget = (allStudents || []).filter(s => {
        const isMainClass = (s.currentClass || "").trim().toUpperCase() === viewingClass.toUpperCase();
        const isMemberOfGroup = clsId && (s.assignedGroups || []).some(g => String(g) === clsId || (g._id && String(g._id) === clsId));
        return isMainClass || isMemberOfGroup;
    }).sort((a,b) => a.lastName.localeCompare(b.lastName));

    const studentsToDisplay = studentsInTarget.filter(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes((studentSearch || "").toLowerCase())
    );

    return (
        <div className="v84-dist-sidebar custom-scrollbar flex flex-col h-full overflow-hidden">
            
            {/* SÉLECTEUR DE MATIÈRE */}
            <div className="mb-3 shrink-0">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">
                    ADN DU DEVOIR
                </label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {sections.map(sec => {
                        const isActive = (currentSection || "GÉNÉRAL") === sec.name;
                        return (
                            <button 
                                key={sec.name}
                                onClick={() => onSectionChange && onSectionChange(sec.name)}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase border whitespace-nowrap transition-all ${isActive ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                style={isActive ? { backgroundColor: sec.color, borderColor: sec.color } : {}}
                            >
                                {sec.name}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="h-px bg-slate-100 mb-3 shrink-0"></div>

            {/* HEADER DISTRIBUTION AVEC CHECKBOX MAGIQUE */}
            <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Distribution {targetLevel ? `(Niv. ${targetLevel})` : ''}
                </div>
                
                {/* BOUTON TOUT COCHER */}
                <div onClick={handleToggleAll} className="flex items-center gap-2 cursor-pointer group hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors">
                    <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${areAllClassesFullSelected ? 'bg-purple-600 border-purple-600' : 'border-slate-300 bg-white'}`}>
                        {areAllClassesFullSelected && <span className="text-white text-[8px] font-black">✓</span>}
                    </div>
                    <span className={`text-[8px] font-black uppercase ${areAllClassesFullSelected ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-500'}`}>
                        Tout Cocher
                    </span>
                </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5 shrink-0">
                {availableClasses.map(c => (
                    <button key={c._id} onClick={() => setViewingClass(c.name)} className={`v84-tab-btn ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700 ring-1 ring-purple-500 ring-offset-1' : ''}`}>
                        {c.name}
                    </button>
                ))}
            </div>

            {viewingClass && (
                <div className="v84-class-card animate-in slide-in-from-right flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="v84-class-header shrink-0" onClick={() => toggleClass(viewingClass)}>
                        <span className="v84-class-title">{viewingClass}</span>
                        <div className={`v84-check-badge ${distribution[viewingClass] && distribution[viewingClass].studentIds.length === 0 ? 'checked' : ''}`}>
                            {distribution[viewingClass] && distribution[viewingClass].studentIds.length === 0 && '✓'}
                        </div>
                    </div>

                    <div className="v84-folder-select-box shrink-0">
                        <label className="v84-folder-label">Dossier ({currentSection}) :</label>
                        <select className="v84-folder-select" value={distribution[viewingClass]?.chapterId || ""} onChange={e => {
                            const next = { ...distribution };
                            if (next[viewingClass]) { next[viewingClass].chapterId = e.target.value; setDistribution(next); }
                        }}>
                            {getAvailableChapters(viewingClass).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>

                    <div className="v84-search-box shrink-0">
                        <span>🔎</span>
                        <input className="v84-search-input" placeholder="Chercher un élève..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                    </div>

                    <div className="v84-students-list custom-scrollbar flex-1 overflow-y-auto">
                        {studentsToDisplay.map(s => { 
                            const classConfig = distribution[viewingClass];
                            const isSelected = classConfig && (classConfig.studentIds.length === 0 || classConfig.studentIds.includes(String(s._id))); 
                            return (
                                <div key={s._id} onClick={() => handleToggleStudent(String(s._id))} className={`v84-student-item ${isSelected ? 'selected' : ''}`}>
                                    <div className="v84-student-checkbox">{isSelected && '✓'}</div>
                                    <span className="v84-student-name">{s.lastName} {s.firstName}</span>
                                </div>
                            ); 
                        })}
                    </div>
                </div>
            )}
            
            <button className="v84-publish-btn shrink-0 mt-3" onClick={onSave} disabled={loading || Object.keys(distribution).length === 0}>
                {loading ? 'PUBLICATION...' : saveLabel}
            </button>
        </div>
    );
}
