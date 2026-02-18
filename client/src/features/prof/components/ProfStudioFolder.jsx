// @signatures: StudioDistributionSidebar
import React from 'react';

export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, targetSection, loading, onSave, saveLabel = "PUBLIER 🚀"
}) {

    const findBestDefaultChapter = (clsName) => {
        const safeChapters = Array.isArray(chapters) ? chapters : [];
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClasses || []).find(c => c.name === clsName);
        const matches = safeChapters.filter(c => {
            if (c.isArchived) return false;
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
            if (c.classroom === clsName) return true;
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        return matches.length > 0 ? matches[0]._id : "";
    };

    const handleToggleStudent = (sId) => { 
        const next = { ...distribution }; 
        const cfg = next[viewingClass] || { chapterId: findBestDefaultChapter(viewingClass), studentIds: [] };
        let currentIds = [...cfg.studentIds];
        if (currentIds.includes(sId)) currentIds = currentIds.filter(id => id !== sId);
        else currentIds.push(sId);
        if (currentIds.length === 0) delete next[viewingClass];
        else next[viewingClass] = { ...cfg, studentIds: currentIds };
        setDistribution(next);
    };

    const availableClasses = (allClasses || []).filter(c => {
        if (targetLevel && c.level !== targetLevel) return false;
        return user.isDeveloper || (user.assignedClasses || []).some(id => String(id) === String(c._id));
    }).sort((a,b) => a.name.localeCompare(b.name));

    const studentsToDisplay = (allStudents || []).filter(s => 
        (s.currentClass === viewingClass) && 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes((studentSearch || "").toLowerCase())
    ).sort((a,b) => a.lastName.localeCompare(b.lastName));

    return (
        <div className="v84-dist-sidebar custom-scrollbar">
            <div className="mb-4 flex flex-wrap gap-2">
                {availableClasses.map(c => (
                    <button key={c._id} onClick={() => setViewingClass(c.name)} className={`v84-tab-btn ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700' : ''}`}>
                        {c.name}
                    </button>
                ))}
            </div>

            {viewingClass && (
                <div className="v84-class-card animate-in slide-in-from-right">
                    <div className="v84-class-header" onClick={() => {
                        const next = { ...distribution };
                        if (next[viewingClass]) delete next[viewingClass];
                        else next[viewingClass] = { chapterId: findBestDefaultChapter(viewingClass), studentIds: [] };
                        setDistribution(next);
                    }}>
                        <span className="v84-class-title">{viewingClass}</span>
                        <div className={`v84-check-badge ${distribution[viewingClass] ? 'checked' : ''}`}>{distribution[viewingClass] && '✓'}</div>
                    </div>

                    <div className="v84-folder-select-box">
                        <label className="v84-folder-label">Dossier :</label>
                        <select className="v84-folder-select" value={distribution[viewingClass]?.chapterId || ""} onChange={e => {
                            const next = { ...distribution };
                            if (next[viewingClass]) { next[viewingClass].chapterId = e.target.value; setDistribution(next); }
                        }}>
                            {chapters.filter(c => c.section.toUpperCase() === (targetSection || "GÉNÉRAL").toUpperCase()).map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>

                    <div className="v84-search-box">
                        <span>🔎</span>
                        <input className="v84-search-input" placeholder="Chercher un élève..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                    </div>

                    <div className="v84-students-list custom-scrollbar">
                        {studentsToDisplay.map(s => { 
                            const isSelected = distribution[viewingClass]?.studentIds?.includes(String(s._id)); 
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
