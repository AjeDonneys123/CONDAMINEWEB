// @signatures: StudioDistributionSidebar, getAvailableChapters, findBestDefaultChapter, handleToggleStudent, toggleClass
import React from 'react';

/**
 * 🛡️ COMPOSANT DISTRIBUTION - VERSION GROUP-READY V5.2
 * RÔLE : Gère l'assignation pour Classes et Groupes (2CD NON DNL, etc.)
 */
export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, targetSection, loading, onSave, saveLabel = "PUBLIER 🚀"
}) {

    const getAvailableChapters = (clsName) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClasses || []).find(c => c.name === clsName);
        return safeChapters.filter(c => {
            if (c.isArchived) return false;
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
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

    // --- FILTRAGE PAR NIVEAU ---
    const availableClasses = (allClasses || []).filter(c => {
        const isAssigned = user.isDeveloper || (user.assignedClasses || []).some(id => String(id) === String(c._id));
        if (!isAssigned) return false;
        if (targetLevel && c.level !== targetLevel) return false;
        return true;
    }).sort((a,b) => a.name.localeCompare(b.name));

    // --- DÉTECTION ÉLÈVES (CLASSE OU GROUPE) ---
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
        <div className="v84-dist-sidebar custom-scrollbar">
            <div className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest px-1">
                Distribution {targetLevel ? `(Niv. ${targetLevel})` : ''}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                {availableClasses.map(c => (
                    <button key={c._id} onClick={() => setViewingClass(c.name)} className={`v84-tab-btn ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700 ring-2 ring-purple-500 ring-offset-2' : ''}`}>
                        {c.name}
                    </button>
                ))}
            </div>

            {viewingClass && (
                <div className="v84-class-card animate-in slide-in-from-right">
                    <div className="v84-class-header" onClick={() => toggleClass(viewingClass)}>
                        <span className="v84-class-title">{viewingClass}</span>
                        <div className={`v84-check-badge ${distribution[viewingClass] && distribution[viewingClass].studentIds.length === 0 ? 'checked' : ''}`}>
                            {distribution[viewingClass] && distribution[viewingClass].studentIds.length === 0 && '✓'}
                        </div>
                    </div>

                    <div className="v84-folder-select-box">
                        <label className="v84-folder-label">Dossier :</label>
                        <select className="v84-folder-select" value={distribution[viewingClass]?.chapterId || ""} onChange={e => {
                            const next = { ...distribution };
                            if (next[viewingClass]) { next[viewingClass].chapterId = e.target.value; setDistribution(next); }
                        }}>
                            {getAvailableChapters(viewingClass).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>

                    <div className="v84-search-box">
                        <span>🔎</span>
                        <input className="v84-search-input" placeholder="Chercher un élève..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                    </div>

                    <div className="v84-students-list custom-scrollbar">
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
            
            <button className="v84-publish-btn" onClick={onSave} disabled={loading || Object.keys(distribution).length === 0}>
                {loading ? 'PUBLICATION...' : saveLabel}
            </button>
        </div>
    );
}
