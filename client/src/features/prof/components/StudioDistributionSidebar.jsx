// @signatures: StudioDistributionSidebar, findBestDefaultChapter, handleToggleStudent, toggleAllStudents
import React, { useEffect } from 'react';
import './StudioDistributionSidebar.css';

const normalizeClassLabel = (value = '') =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

const extractId = (value) => String(value?._id || value?.id || value || '');
const inferLevelFromName = (name = '') => {
    const cleaned = String(name || '').trim().toUpperCase();
    const m = cleaned.match(/^([1-6])/);
    if (m) return m[1];
    return '';
};

export default function StudioDistributionSidebar({ 
    user, allClasses, allStudents, chapters, distribution, setDistribution, 
    viewingClass, setViewingClass, studentSearch, setStudentSearch,
    targetLevel, targetSection, loading, onSave, saveLabel = "PUBLIER 🚀", punishmentMode = false
}) {

    // 1. FILTRAGE STRICT DES CLASSES (NIVEAU & PROF)
    const availableClasses = (allClasses || []).filter(c => {
        // A. Filtre Niveau (Le plus important)
        // Si un targetLevel est fourni (ex: "4"), on cache tout ce qui n'est pas "4"
        if (targetLevel) {
            const effectiveLevel = String(c.level || inferLevelFromName(c.name));
            if (effectiveLevel !== String(targetLevel)) return false;
        }
        
        // B. Filtre Permissions
        // Admin: voit tout. Prof (même développeur): uniquement ses classes assignées.
        if (user.role === 'admin') return true;
        
        // C. Filtre Prof (Mes classes uniquement)
        const myIds = (user.assignedClasses || []).map(id => String(id._id || id));
        return myIds.includes(String(c._id));
    }).sort((a,b) => a.name.localeCompare(b.name));

    // Auto-select première classe si rien n'est sélectionné
    useEffect(() => {
        // Si la classe active n'est pas dans la liste filtrée, on reset sur la première dispo
        const currentIsAvailable = availableClasses.some(c => c.name === viewingClass);
        if ((!viewingClass || !currentIsAvailable) && availableClasses.length > 0) {
            setViewingClass(availableClasses[0].name);
        }
    }, [availableClasses, viewingClass]);

    // 2. FILTRAGE STRICT DES DOSSIERS
    const getAvailableChaptersForClass = (className) => (chapters || []).filter(c => {
        // A. Filtre Section (Matière)
        const cleanSection = (targetSection || "GÉNÉRAL").toUpperCase().trim();
        const chapSection = (c.section || "GÉNÉRAL").toUpperCase().trim();
        if (chapSection !== cleanSection) return false;

        if (c.isArchived) return false;

        // B. Filtre Contextuel (Basé sur la classe qu'on regarde)
        if (className) {
             const currentClassObj = allClasses.find(cl => cl.name === className);
             const currentLevel = currentClassObj ? String(currentClassObj.level) : null;

             // Si le dossier est spécifique à une AUTRE classe -> CACHÉ
             if (c.classroom && c.classroom !== className) return false;

             // Si le dossier est spécifique à un AUTRE niveau -> CACHÉ
             if (c.sharedLevel && String(c.sharedLevel) !== String(currentLevel)) return false;

             // Si le dossier a été masqué manuellement -> CACHÉ
             if (c.hiddenIn && c.hiddenIn.includes(viewingClass)) return false;
        }

        return true;
    }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    const availableChapters = getAvailableChaptersForClass(viewingClass);

    const [punishmentChapterId, setPunishmentChapterId] = React.useState("");

    // Helper pour trouver le dossier par défaut
    const findBestDefaultChapter = (className = viewingClass) => {
        const chaptersForClass = getAvailableChaptersForClass(className);
        return chaptersForClass.length > 0 ? chaptersForClass[0]._id : "";
    };

    useEffect(() => {
        if (!punishmentMode) return;
        const def = findBestDefaultChapter();
        if (!punishmentChapterId && def) setPunishmentChapterId(def);
    }, [punishmentMode, availableChapters]);

    useEffect(() => {
        if (!punishmentMode) return;
        const chapterId = punishmentChapterId || findBestDefaultChapter();
        const next = {};
        availableClasses.forEach(c => {
            next[c.name] = { chapterId, studentIds: [] };
        });
        const cur = JSON.stringify(distribution || {});
        const nxt = JSON.stringify(next);
        if (cur !== nxt) setDistribution(next);
    }, [punishmentMode, availableClasses, punishmentChapterId]);

    // 3. LOGIQUE ÉLÈVES
    const rawStudents = (allStudents || []).filter(s => {
        if (!viewingClass) return false;
        const normalizedViewingClass = normalizeClassLabel(viewingClass);
        const normalizedStudentClass = normalizeClassLabel(s.currentClass || "");

        // Classe principale : on tolère les variantes d'écriture
        if (normalizedStudentClass && normalizedStudentClass === normalizedViewingClass) return true;

        const clsObj = allClasses.find(c => c.name === viewingClass);
        if (clsObj && clsObj.type === 'GROUP') {
            const clsId = extractId(clsObj);
            const inAssignedGroups = (s.assignedGroups || []).some(g => extractId(g) === clsId);
            if (inAssignedGroups) return true;

            // Fallback legacy: certains imports mettent le nom du groupe dans currentClass
            return normalizedStudentClass === normalizedViewingClass;
        }
        return false;
    }).sort((a,b) => a.lastName.localeCompare(b.lastName));

    const studentsToDisplay = rawStudents.filter(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes((studentSearch || "").toLowerCase())
    );

    // --- CORRECTION LOGIQUE DE SÉLECTION ---
    const handleToggleStudent = (sId) => { 
        const next = { ...distribution }; 
        const defaultChapter = findBestDefaultChapter();
        
        // On récupère ou initialise la config de cette classe
        const cfg = next[viewingClass] || { chapterId: defaultChapter, studentIds: [] };
        let currentIds = cfg.studentIds || [];
        
        // --- LOGIQUE CORRIGÉE ---
        // Liste vide = "Toute la classe" (Mode par défaut)
        // Liste remplie = "Seulement ces élèves" (Mode Subset)

        if (currentIds.length === 0) {
            // Si on est en mode "Tout le monde" et qu'on clique sur un élève :
            // L'utilisateur veut sélectionner UNIQUEMENT cet élève.
            currentIds = [sId];
        } else {
            // Mode normal : on ajoute ou on enlève
            if (currentIds.includes(sId)) {
                currentIds = currentIds.filter(id => id !== sId);
            } else {
                currentIds.push(sId);
            }
        }

        // Si on a désélectionné le dernier élève, on revient au mode "Tout le monde" ?
        // NON. Vide = Tout le monde. Donc si on vide la liste manuellement, ça re-coche tout le monde visuellement.
        // C'est contre-intuitif.
        // CORRECTION UX : Si la liste devient vide (0 élève sélectionné), on la laisse vide, mais le système backend doit comprendre "Personne".
        // ATTENTION : La convention actuelle est Vide = Tout le monde.
        // Si l'utilisateur veut sélectionner "Personne", il ne publie pas pour cette classe.
        
        // Donc, si on décoche le dernier, on revient techniquement à "Tout le monde".
        // Pour éviter ça, si la liste devient vide, on supprime carrément l'entrée de la classe (Désactivée).
        if (currentIds.length === 0) {
            delete next[viewingClass];
        } else {
             next[viewingClass] = {
                chapterId: cfg.chapterId || defaultChapter,
                studentIds: currentIds
            };
        }
       
        setDistribution(next);
    };

    const toggleAllStudents = () => {
        const next = { ...distribution };
        if (next[viewingClass]) delete next[viewingClass];
        else {
             const defaultChapter = findBestDefaultChapter();
             next[viewingClass] = { chapterId: defaultChapter, studentIds: [] }; // Vide = Tout le monde
        }
        setDistribution(next);
    };

    const selectAllClasses = () => {
        const next = { ...distribution };
        availableClasses.forEach((c) => {
            const existing = next[c.name];
            const fallbackChapter = findBestDefaultChapter(c.name);
            next[c.name] = {
                chapterId: existing?.chapterId || fallbackChapter,
                studentIds: existing?.studentIds || []
            };
        });
        setDistribution(next);
        if (!viewingClass && availableClasses.length > 0) {
            setViewingClass(availableClasses[0].name);
        }
    };

    const isClassSelected = !!distribution[viewingClass];
    const cfg = distribution[viewingClass];
    
    // Visuel : Est-ce que la case est cochée ?
    const isStudentSelected = (sId) => {
        if (!isClassSelected) return false;
        // Si tableau vide = Tout le monde est sélectionné (Convention Backend)
        if (cfg.studentIds.length === 0) return true;
        return cfg.studentIds.includes(sId);
    };

    // Calcul du chapitre sélectionné pour l'affichage du select
    const selectedChapterValue = cfg?.chapterId || findBestDefaultChapter();

    if (punishmentMode) {
        return (
            <div className="v84-dist-sidebar custom-scrollbar">
                <div className="v84-class-card animate-in slide-in-from-right">
                    <div className="v84-class-header">
                        <span className="v84-class-title">MODE PUNITION ({targetLevel || 'NIVEAU'})</span>
                        <div className="v84-check-badge checked">✓</div>
                    </div>

                    <div className="v84-folder-select-box">
                        <label className="v84-folder-label">Dossier de destination (commun) :</label>
                        <select
                            className="v84-folder-select"
                            value={punishmentChapterId || findBestDefaultChapter()}
                            onChange={(e) => setPunishmentChapterId(e.target.value)}
                            disabled={loading}
                        >
                            {availableChapters.length === 0 && <option value="">(Aucun dossier dans {targetSection})</option>}
                            {availableChapters.map(c => (
                                <option key={c._id} value={c._id}>{c.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="text-[10px] font-black text-slate-500 uppercase leading-5 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                        Classes ciblées automatiquement : {availableClasses.map(c => c.name).join(', ') || 'Aucune'}.
                        Élèves assignés automatiquement quand ils atteignent 3 croix.
                    </div>
                </div>

                <button className="v84-publish-btn" onClick={onSave} disabled={loading || availableClasses.length === 0 || !findBestDefaultChapter()}>
                    {loading ? 'PUBLICATION...' : saveLabel}
                </button>
            </div>
        );
    }

    return (
        <div className="v84-dist-sidebar custom-scrollbar">
            {/* 1. ONGLETS CLASSES (FILTRÉS) */}
            <div className="v84-classes-toolbar">
                <button
                    className="v84-classes-select-all-btn"
                    onClick={selectAllClasses}
                    disabled={loading || availableClasses.length === 0}
                >
                    TOUS
                </button>
            </div>
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
                {availableClasses.length === 0 && <div className="text-xs text-slate-400 italic">Aucune classe pour ce niveau.</div>}
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
