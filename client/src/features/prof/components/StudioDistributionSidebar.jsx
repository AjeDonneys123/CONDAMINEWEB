// @signatures: StudioDistributionSidebar, findBestDefaultChapter, handleToggleStudent, toggleAllStudents
import React, { useEffect } from 'react';

/**
 * 📦 COMPOSANT CERVEAU : LOGIQUE DE DISTRIBUTION UNIFIÉE
 * C'est lui qui calcule quelles classes afficher, qui est sélectionné, et dans quel dossier ça va.
 */
export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, targetSection, loading, onSave, saveLabel = "PUBLIER 🚀"
}) {

    // 1. CALCUL DES CLASSES DISPONIBLES
    // Si on est dans un dossier "Niveau 6ème", on ne montre que les 6èmes.
    const availableClasses = (allClasses || []).filter(c => {
        if (targetLevel && String(c.level) !== String(targetLevel)) return false;
        
        // Admin ou Dev voit tout
        if (user.isDeveloper || user.role === 'admin') return true;
        
        // Prof ne voit que ses classes assignées
        const myIds = (user.assignedClasses || []).map(id => String(id._id || id));
        return myIds.includes(String(c._id));
    }).sort((a,b) => a.name.localeCompare(b.name));

    // Auto-select première classe si rien n'est sélectionné
    useEffect(() => {
        if (!viewingClass && availableClasses.length > 0) {
            setViewingClass(availableClasses[0].name);
        }
    }, [availableClasses, viewingClass]);

    // 2. CHERCHER LE MEILLEUR DOSSIER PAR DÉFAUT
    const findBestDefaultChapter = (clsName) => {
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const clsObj = (allClasses || []).find(c => c.name === clsName);
        
        const matches = (chapters || []).filter(c => {
            if (c.isArchived) return false;
            // On reste dans la bonne section (ex: MATHS)
            if ((c.section || "GÉNÉRAL").toUpperCase().trim() !== cleanSection) return false;
            
            // Priorité 1: Dossier spécifique à la classe
            if (c.classroom === clsName) return true;
            
            // Priorité 2: Dossier partagé par niveau (ex: "6")
            if (c.sharedLevel && clsObj && String(c.sharedLevel) === String(clsObj.level)) return true;
            
            // Priorité 3: Dossier Global visible (pas caché)
            if (!c.classroom && !c.sharedLevel) return !c.hiddenIn || !c.hiddenIn.includes(clsName);
            
            return false;
        }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // Le plus récent en premier

        return matches.length > 0 ? matches[0]._id : "";
    };

    // 3. LOGIQUE SELECTION ÉLÈVE
    const rawStudents = (allStudents || []).filter(s => {
        if (!viewingClass) return false;
        // Élève de la classe principale
        if ((s.currentClass || "").trim() === viewingClass) return true;
        
        // Élève du groupe (Option)
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

    // Toggle un élève
    const handleToggleStudent = (sId) => { 
        const next = { ...distribution }; 
        const cfg = next[viewingClass] || { 
            chapterId: findBestDefaultChapter(viewingClass), 
            studentIds: [], 
            // Par défaut, si on clique un élève, on passe en mode "Subset"
            // Donc on initialise studentIds avec "tous sauf celui cliqué" ? Non, on commence vide.
        };
        
        let currentIds = cfg.studentIds || [];
        
        // Cas spécial : Si la liste était vide (Mode "Toute la classe"), et qu'on clique un élève,
        // cela veut dire qu'on veut désélectionner cet élève ? Ou qu'on veut ne sélectionner QUE lui ?
        // Convention Condamine : Vide = Tout le monde. Si on clique, on passe en mode sélection manuelle.
        // Donc si vide, on remplit avec TOUS les autres sauf lui.
        if (currentIds.length === 0) {
            currentIds = rawStudents.map(s => s._id).filter(id => id !== sId);
        } else {
            // Sinon comportement standard toggle
            if (currentIds.includes(sId)) currentIds = currentIds.filter(id => id !== sId);
            else currentIds.push(sId);
        }

        // Si on a tout vidé, ça veut dire "Personne" ? Non, dans notre logique vide = tout le monde.
        // C'est le piège. Il faut un flag explicite isAllClass.
        // SIMPLIFICATION : 
        // studentIds contient la liste des élèves CIBLÉS.
        // Si je clique un élève, il entre/sort de la liste.
        
        // RE-REFLEXION : La logique précédente : 
        // "Si studentIds est vide, c'est toute la classe".
        // "Si je clique un élève, je veux l'enlever de la distribution ?"
        // NON. Le plus simple : Cocher = Assigner.
        // Par défaut, on coche tout le monde visuellement, mais la liste est vide dans le state.
        
        // Nouvelle logique robuste :
        // On stocke explicitement les IDs des élèves CIBLÉS.
        
        if (!next[viewingClass]) {
            // Initialisation : On veut enlever cet élève, donc on met tous les autres
            const allIds = rawStudents.map(s => s._id);
            next[viewingClass] = {
                chapterId: findBestDefaultChapter(viewingClass),
                studentIds: allIds.filter(id => id !== sId)
            };
        } else {
            const ids = next[viewingClass].studentIds;
            if (ids.includes(sId)) {
                next[viewingClass].studentIds = ids.filter(id => id !== sId);
            } else {
                next[viewingClass].studentIds = [...ids, sId];
            }
        }
        
        // Si la liste devient égale à "Tous", on peut repasser en mode "Vide" (Optimisation) ou laisser tel quel.
        // On laisse tel quel pour la stabilité.
        setDistribution(next);
    };

    // Toggle Toute la classe
    const toggleAllStudents = () => {
        const next = { ...distribution };
        if (next[viewingClass]) {
            // Déjà actif -> on supprime (désactive pour cette classe)
            delete next[viewingClass];
        } else {
            // On active -> Mode "Toute la classe" (studentIds vide par convention backend)
            next[viewingClass] = { 
                chapterId: findBestDefaultChapter(viewingClass), 
                studentIds: [] // Vide = Tout le monde
            };
        }
        setDistribution(next);
    };

    const isClassSelected = !!distribution[viewingClass];
    const cfg = distribution[viewingClass];
    
    // Calcul de quels élèves sont cochés visuellement
    const isStudentSelected = (sId) => {
        if (!isClassSelected) return false;
        // Si liste vide = Tout le monde
        if (cfg.studentIds.length === 0) return true;
        return cfg.studentIds.includes(sId);
    };

    const availableChapters = (chapters || []).filter(c => {
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        return !c.isArchived && (c.section || "GÉNÉRAL").toUpperCase().trim() === cleanSection;
    }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // Tri antéchronologique

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
                            value={cfg?.chapterId || findBestDefaultChapter(viewingClass)} 
                            onChange={(e) => setDistribution(p => ({ 
                                ...p, 
                                [viewingClass]: { ...(p[viewingClass] || { studentIds: [] }), chapterId: e.target.value } 
                            }))} 
                            disabled={loading}
                        >
                            {availableChapters.length === 0 && <option value="">(Aucun dossier)</option>}
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
