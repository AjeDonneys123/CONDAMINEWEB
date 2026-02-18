// @signatures: StudioDistributionSidebar
import React, { useEffect } from 'react';
import './StudioDistributionSidebar.css';

export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, targetSection, loading, onSave, saveLabel = "PUBLIER 🚀"
}) {

    // 1. FILTRAGE STRICT DES CLASSES
    // On ne montre que les classes du prof, et si un niveau est ciblé, que ce niveau.
    const availableClasses = (allClasses || []).filter(c => {
        // Filtre de niveau strict (ex: Si je suis dans l'onglet "4ème", je ne veux pas voir les "3ème")
        if (targetLevel && c.level && String(c.level) !== String(targetLevel)) return false;
        
        // Admin ou Dev voit tout
        if (user.isDeveloper || user.role === 'admin') return true;
        
        // Prof ne voit que ses classes assignées
        const myIds = (user.assignedClasses || []).map(id => String(id._id || id));
        return myIds.includes(String(c._id));
    }).sort((a,b) => a.name.localeCompare(b.name));

    // Auto-select première classe si rien n'est sélectionné
    useEffect(() => {
        // Si la classe en cours de visionnage n'est pas dans la liste disponible (ex: changement de filtre), on reset
        const currentIsAvailable = availableClasses.some(c => c.name === viewingClass);
        if (!currentIsAvailable && availableClasses.length > 0) {
            setViewingClass(availableClasses[0].name);
        } else if (!viewingClass && availableClasses.length > 0) {
            setViewingClass(availableClasses[0].name);
        }
    }, [availableClasses, viewingClass]);

    // 2. FILTRAGE STRICT DES DOSSIERS (CHAPTERS)
    const availableChapters = (chapters || []).filter(c => {
        // A. Filtre par Section (Matière)
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const chapSection = (c.section || "GÉNÉRAL").toUpperCase().trim();
        if (chapSection !== cleanSection) return false;

        if (c.isArchived) return false;

        // B. Filtre Contextuel (Classe active)
        if (viewingClass) {
             const currentClassObj = allClasses.find(cl => cl.name === viewingClass);
             const currentLevel = currentClassObj ? String(currentClassObj.level) : null;

             // Si le dossier est exclusif à une AUTRE classe -> CACHÉ
             if (c.classroom && c.classroom !== viewingClass) return false;

             // Si le dossier est exclusif à un AUTRE niveau -> CACHÉ
             if (c.sharedLevel && String(c.sharedLevel) !== currentLevel) return false;

             // Si le dossier a été masqué manuellement dans cette classe -> CACHÉ
             if (c.hiddenIn && c.hiddenIn.includes(viewingClass)) return false;
        }

        return true;
    }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 3. RECHERCHE DOSSIER DEFAUT (Parmis les filtrés)
    const findBestDefaultChapter = () => {
        return availableChapters.length > 0 ? availableChapters[0]._id : "";
    };

    // 4. LOGIQUE ÉLÈVES
    const rawStudents = (allStudents || []).filter(s => {
        if (!viewingClass) return false;
        if ((s.currentClass || "").trim() === viewingClass) return true;
        const clsObj = allClasses.find(c => c.name === viewingClass);
        if (clsObj && clsObj.type === 'GROUP') {
            const clsId = String(clsObj._id);
            return (s.assignedGroups || []).some(g => String(g._id || g) === clsId);
        }
        return false;
    }).sort((a,b) => a.lastName.localeCompare(b.lastName));

    const studentsToDisplay = rawStudents.filter(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes((studentSearch || "").toLowerCase())
    );

    const handleToggleStudent = (sId) => { 
        const next = { ...distribution }; 
        const defaultChapter = findBestDefaultChapter();
        
        const cfg = next[viewingClass] || { chapterId: defaultChapter, studentIds: [] };
        let currentIds = cfg.studentIds || [];
        
        // Logique "Tout le monde sauf..."
        if (currentIds.length === 0) {
            currentIds = rawStudents.map(s => s._id).filter(id => id !== sId);
        } else {
            if (currentIds.includes(sId)) currentIds = currentIds.filter(id => id !== sId);
            else currentIds.push(sId);
        }

        if (!next[viewingClass]) {
            const allIds = rawStudents.map(s => s._id);
            next[viewingClass] = {
                chapterId: defaultChapter,
                studentIds: allIds.filter(id => id !== sId)
            };
        } else {
            const ids = next[viewingClass].studentIds;
            if (ids.includes(sId)) next[viewingClass].studentIds = ids.filter(id => id !== sId);
            else next[viewingClass].studentIds = [...ids, sId];
        }
        setDistribution(next);
    };

    const toggleAllStudents = () => {
        const next = { ...distribution };
        if (next[viewingClass]) delete next[viewingClass];
        else {
             const defaultChapter = findBestDefaultChapter();
             next[viewingClass] = { chapterId: defaultChapter, studentIds: [] };
        }
        setDistribution(next);
    };

    const isClassSelected = !!distribution[viewingClass];
    const cfg = distribution[viewingClass];
    
    const isStudentSelected = (sId) => {
        if (!isClassSelected) return false;
        if (cfg.studentIds.length === 0) return true;
        return cfg.studentIds.includes(sId);
    };

    // Calcul du chapitre sélectionné pour l'affichage du select
    const selectedChapterValue = cfg?.chapterId || findBestDefaultChapter();

    return (
        <div className="v84-dist-sidebar custom-scrollbar">
            {/* 1. ONGLETS CLASSES */}
            <div className="v84-classes-tabs">
                {availableClasses.map(c => (
                    <button 
                        key={c._id} 
                        onClick={() => { setViewingClass(c.name); setStudentSearch(""); }} 
                        className={`v84-tab-btn ${distribution[c.name] ? 'active' : 'inactive'} ${viewingClass === c.name ? 'border-2 border-purple-700' : ''}`}
                        style={c.type === 'GROUP' ? { borderColor: '#f59e0b', color: distribution[c.name] ? 'white' : '#f59e0b' } : {}}
                    >
                        {c.name}
                    </button>
                ))}
                {availableClasses.length === 0 && <div className="text-xs text-slate-400 italic">Aucune classe disponible.</div>}
            </div>

            {/* 2. PANNEAU CLASSE ACTIVE */}
            {viewingClass && (
                <div className="v84-class-card animate-in slide-in-from-right">
                    <div className="v84-class-header" onClick={toggleAllStudents}>
                        <span className="v84-class-title">{viewingClass}</span>
                        <div className={`v84-check-badge ${isClassSelected ? 'checked' : ''}`}>{isClassSelected && '✓'}</div>
                    </div>

                    <div className="v84-folder-select-box">
                        <label className="v84-folder-label">Dossier de destination :</label>
                        <select 
                            className="v84-folder-select" 
                            value={selectedChapterValue} 
                            onChange={(e) => setDistribution(p => ({ 
                                ...p, 
                                [viewingClass]: { ...(p[viewingClass] || { studentIds: [] }), chapterId: e.target.value } 
                            }))} 
                            disabled={loading}
                        >
                            {availableChapters.length === 0 && <option value="">(Aucun dossier dans {targetSection})</option>}
                            {availableChapters.map(c => (
                                <option key={c._id} value={c._id}>{c.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="v84-search-box">
                        <span>🔎</span>
                        <input 
                            className="v84-search-input" 
                            placeholder="Chercher un élève..." 
                            value={studentSearch} 
                            onChange={e => setStudentSearch(e.target.value)} 
                        />
                    </div>

                    <div className="v84-students-list custom-scrollbar">
                        {studentsToDisplay.map(s => { 
                            const checked = isStudentSelected(s._id);
                            return (
                                <div key={s._id} onClick={() => handleToggleStudent(s._id)} className={`v84-student-item ${checked ? 'selected' : ''}`}>
                                    <div className="v84-student-checkbox">{checked && '✓'}</div>
                                    <span className="v84-student-name">{s.lastName} {s.firstName}</span>
                                </div>
                            ); 
                        })}
                        {studentsToDisplay.length === 0 && <div className="text-xs text-slate-400 text-center p-2">Aucun élève trouvé.</div>}
                    </div>
                </div>
            )}
            
            <button className="v84-publish-btn" onClick={onSave} disabled={loading || Object.keys(distribution).length === 0}>
                {loading ? 'PUBLICATION...' : saveLabel}
            </button>
        </div>
    );
}
