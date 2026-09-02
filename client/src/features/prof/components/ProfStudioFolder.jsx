// @signatures: ProfStudioFolder, executeDelete, fetchSections, handleArchiveChapter, handleCreateChapter, handleCreateSection, handleOpenEditSection, handleRenameChapter, handleSaveSectionEdit, handleUpdateChapterComplete, prepareDelete
import React, { useState, useEffect } from 'react';

/**
 * 📁 PROF STUDIO FOLDER - VERSION AUTO CH1
 * Crée automatiquement CH1 à l'ajout de section et rafraîchit.
 */
export default function ProfStudioFolder({ items, chapters, studentsRef, classFilter, levelFilter, user, onEditItem, onCreateActivity, onRefresh, onDeleteItem }) {
    const DEFAULT_SECTIONS = [{ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' }];
    const rawSections = Array.isArray(user?.subjectSections) ? user.subjectSections : [];
    const isHgTeacher = rawSections.some((section) => /HIST|GEO|EMC|HG/.test(String(section?.name || '').toUpperCase()));
    const ACTIVITY_OPTIONS = [
        { type: 'homework', label: 'Devoir', icon: '📝', tone: 'bg-orange-50 border-orange-200 text-orange-700' },
        { type: 'learning', label: 'Apprentissage', icon: '🧠', tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        { type: 'control', label: 'Contrôle', icon: '📝', tone: 'bg-rose-50 border-rose-200 text-rose-700' },
        { type: 'lecture', label: 'Lecture', icon: '📖', tone: 'bg-sky-50 border-sky-200 text-sky-700' },
        ...(isHgTeacher ? [{ type: 'comment', label: 'Commentaire', icon: '🧾', tone: 'bg-amber-50 border-amber-200 text-amber-700' }] : []),
        { type: 'production', label: 'Production', icon: '🏗️', tone: 'bg-lime-50 border-lime-200 text-lime-700' }
    ];
    const [customSections, setCustomSections] = useState(DEFAULT_SECTIONS);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    const [activityPickerChapterId, setActivityPickerChapterId] = useState('');
    
    // MODALES DOSSIERS
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterScope, setNewChapterScope] = useState("LEVEL"); 
    const [showEditChapterModal, setShowEditChapterModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null); 

    // MODALES SECTIONS
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionScope, setNewSectionScope] = useState("GLOBAL"); 
    const [showEditSectionModal, setShowEditSectionModal] = useState(false);
    const [editingSection, setEditingSection] = useState(null); 

    const [deleteTarget, setDeleteTarget] = useState(null); 
    const [draggedActivity, setDraggedActivity] = useState(null);
    const [dropChapterId, setDropChapterId] = useState('');
    const [enabledOverrides, setEnabledOverrides] = useState({});
    const [chapterActiveOverrides, setChapterActiveOverrides] = useState({});

    const PRESET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#64748b"];
    const isObjectId = (v) => /^[a-f0-9]{24}$/i.test(String(v || '').trim());
    const normalizeClassKey = (value = '') =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
    const inferLevelFromName = (name = '') => {
        const m = String(name || '').trim().toUpperCase().match(/^([1-6])/);
        return m ? m[1] : '';
    };
    const normalizeLevel = (value = '') => {
        const raw = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
        if (!raw) return '';
        if (/^(6|6E|6EME|SIXIEME)/.test(raw)) return '6';
        if (/^(5|5E|5EME|CINQUIEME)/.test(raw)) return '5';
        if (/^(4|4E|4EME|QUATRIEME)/.test(raw)) return '4';
        if (/^(3|3E|3EME|TROISIEME)/.test(raw)) return '3';
        if (/^(2|2DE|2NDE|SECONDE)/.test(raw)) return '2';
        if (/^(1|1ERE|PREMIERE)/.test(raw)) return '1';
        if (/^(T|TERM|TERMINALE)/.test(raw)) return 'T';
        return raw;
    };
    const getUserId = () => {
        const fromUnderscore = String(user?._id || '').trim();
        const fromId = String(user?.id || '').trim();
        if (isObjectId(fromUnderscore)) return fromUnderscore;
        if (isObjectId(fromId)) return fromId;
        return '';
    };
    const getSectionsFromUserProfile = () => {
        const raw = Array.isArray(user?.subjectSections) ? user.subjectSections : [];
        const currentLevel = normalizeLevel(levelFilter || inferLevelFromName(classFilter || ''));
        const filtered = raw
            .filter(s => String(s?.name || '').toUpperCase() !== 'GÉNÉRAL')
            .filter(s => {
                const scope = String(s?.scope || 'GLOBAL').toUpperCase();
                if (Array.isArray(s?.hiddenIn) && s.hiddenIn.includes(classFilter)) return false;
                if (scope === 'GLOBAL') return true;
                if (scope === 'LEVEL') return normalizeLevel(s?.target || '') === currentLevel;
                if (scope === 'CLASS') return String(s?.target || '') === String(classFilter || '');
                return true;
            })
            .map(s => ({
                name: String(s?.name || '').toUpperCase(),
                color: s?.color || '#64748b',
                scope: s?.scope || 'GLOBAL',
                target: s?.target || null,
                hiddenIn: Array.isArray(s?.hiddenIn) ? s.hiddenIn : []
            }));
        return [DEFAULT_SECTIONS[0], ...filtered];
    };

    // SÉCURITÉ DATA
    const safeItems = Array.isArray(items) ? items : [];
    const safeChapters = Array.isArray(chapters) ? chapters : [];
    const safeSections = Array.isArray(customSections) ? customSections : [];
    const safeStudents = Array.isArray(studentsRef) ? studentsRef : [];
    const studentNameById = new Map(
        safeStudents.map((s) => {
            const id = String(s?._id || s?.id || '').trim();
            const name = `${s?.lastName || ''} ${s?.firstName || ''}`.trim() || (s?.nickname || '');
            return [id, name || id];
        })
    );
    const getAudienceLabel = (it) => {
        const classes = Array.isArray(it?.targetClassrooms)
            ? it.targetClassrooms.map((c) => String(c || '').trim()).filter(Boolean)
            : [];
        if (it?.isAllClass) {
            if (classes.length === 0) return 'Classe';
            return classes.join(', ');
        }
        const ids = Array.isArray(it?.assignedStudents)
            ? it.assignedStudents.map((x) => String((x && x._id) ? x._id : x)).filter(Boolean)
            : [];
        if (ids.length === 0) {
            return classes.length > 0 ? classes.join(', ') : 'Élèves ciblés';
        }
        const names = ids.map((id) => studentNameById.get(id) || id);
        return names.join(', ');
    };
    const getActivityIcon = (it = {}) => {
        if (it.actType === 'homework' && String(it.assessmentKind || '') === 'dnb') return '🎓';
        if (it.actType === 'homework') return '📝';
        if (it.actType === 'game') return '🎮';
        if (it.actType === 'scan') return '📸';
        if (it.actType === 'learning') return '🧠';
        if (it.actType === 'expose') return '🗣️';
        if (it.actType === 'lecture') return '📖';
        if (it.actType === 'fiche') return '🗂️';
        if (it.actType === 'production') return '🏗️';
        if (it.actType === 'comment') return '🧾';
        return '📝';
    };
    const getActivityApiBase = (type = '') => {
        if (type === 'homework') return '/api/homework';
        if (type === 'game') return '/api/games';
        if (type === 'learning') return '/api/learning';
        if (type === 'expose') return '/api/exposes';
        if (type === 'lecture') return '/api/lectures';
        if (type === 'comment') return '/api/comments';
        if (type === 'production') return '/api/productions';
        if (type === 'fiche') return '/api/fiches';
        return '';
    };
    const isItemInactive = (item = {}) => {
        const override = enabledOverrides[String(item?._id || '')];
        if (typeof override === 'boolean') return !override;
        if (item.actType === 'learning' && typeof item.active === 'boolean') return !item.active;
        return item.isEnabled === false;
    };

    // --- CHARGEMENT ---
    async function fetchSections() {
        const uid = getUserId();
        if (!uid) {
            setCustomSections(getSectionsFromUserProfile());
            return;
        }
        try {
            const res = await fetch(`/api/structure/sections/${uid}?classContext=${classFilter || ""}`);
            if (res.ok) {
                const data = await res.json();
                let list = (Array.isArray(data) ? data : []).filter(s => s.name.toUpperCase() !== "GÉNÉRAL");
                list.unshift({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });
                const fallback = getSectionsFromUserProfile();
                setCustomSections(list.length > 1 ? list : fallback);
            } else {
                setCustomSections(getSectionsFromUserProfile());
            }
        } catch(e) {
            console.error("Fetch Sections Error", e);
            setCustomSections(getSectionsFromUserProfile());
        }
    }
    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]);
    useEffect(() => {
        setActivityPickerChapterId('');
    }, [activeSection, showArchived]);

    // --- LOGIQUE SECTIONS (CRUD) ---
    async function handleCreateSection() {
        if (!newSectionName) return;
        const nameToSelect = newSectionName.toUpperCase();
        
        try {
            const res = await fetch('/api/structure/sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    teacherId: getUserId(), 
                    sectionName: nameToSelect, 
                    scope: newSectionScope, 
                    target: newSectionScope === 'CLASS' ? classFilter : levelFilter 
                })
            });

            if (res.ok) { 
                setNewSectionName(""); 
                setShowSectionModal(false); 
                // 1. On bascule l'UI sur la nouvelle section
                setActiveSection(nameToSelect);
                // 2. On recharge les données
                await fetchSections();
                if (onRefresh) onRefresh(); 
            }
        } catch (e) {
            console.error("Creation Error", e);
            alert("Erreur lors de la création de la section.");
        }
    }

    const handleOpenEditSection = (s) => {
        setEditingSection({ oldName: s.name, name: s.name, color: s.color, scope: s.scope, target: s.target });
        setShowEditSectionModal(true);
    };

    const handleSaveSectionEdit = async () => {
        if (!editingSection.name) return;
        const res = await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                teacherId: getUserId(), 
                oldName: editingSection.oldName, 
                sectionName: editingSection.name.toUpperCase(), 
                color: editingSection.color,
                scope: editingSection.scope,
                target: editingSection.scope === 'CLASS' ? classFilter : (editingSection.scope === 'LEVEL' ? levelFilter : editingSection.target)
            })
        });
        if (res.ok) {
            if (activeSection === editingSection.oldName) setActiveSection(editingSection.name.toUpperCase());
            setShowEditSectionModal(false);
            fetchSections();
            if (onRefresh) onRefresh(); 
        }
    };

    // --- LOGIQUE DOSSIERS (CRUD) ---
    async function handleCreateChapter() {
        if (!newChapterTitle) return;
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newChapterTitle.toUpperCase(), section: activeSection, teacherId: getUserId(), scope: newChapterScope, target: newChapterScope === 'CLASS' ? classFilter : levelFilter })
        });
        setNewChapterTitle(""); setShowChapterModal(false); if (onRefresh) onRefresh();
    }

    function handleRenameChapter(e, chapId, oldTitle) {
        e.stopPropagation();
        const chap = safeChapters.find(c => c._id === chapId);
        let scope = chap?.classroom ? "CLASS" : (chap?.sharedLevel ? "LEVEL" : "GLOBAL");
        setEditingChapter({ id: chapId, title: oldTitle, scope, section: (chap?.section || activeSection || "GÉNÉRAL").toUpperCase() });
        setShowEditChapterModal(true);
    }

    async function handleUpdateChapterComplete() {
        if (!editingChapter || !editingChapter.title) return;
        const target = editingChapter.scope === 'CLASS' ? classFilter : (editingChapter.scope === 'LEVEL' ? levelFilter : "");
        const res = await fetch(`/api/structure/chapters/${editingChapter.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: editingChapter.title.toUpperCase().trim(),
                scope: editingChapter.scope,
                target: target,
                section: (editingChapter.section || "GÉNÉRAL").toUpperCase()
            })
        });
        if (res.ok) { setShowEditChapterModal(false); setEditingChapter(null); if (onRefresh) onRefresh(); }
    }

    async function handleArchiveChapter(e, chapId, shouldArchive) {
        e.stopPropagation();
        const res = await fetch(`/api/structure/chapters/${chapId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: shouldArchive })
        });
        if (res.ok && onRefresh) onRefresh();
    }

    async function handleToggleChapterActive(e, chapter) {
        e.stopPropagation();
        const chapterId = String(chapter?._id || '');
        if (!chapterId) return;
        const override = chapterActiveOverrides[chapterId];
        const currentActive = typeof override === 'boolean' ? override : chapter?.active !== false;
        const nextActive = !currentActive;
        setChapterActiveOverrides((prev) => ({ ...prev, [chapterId]: nextActive }));
        try {
            const res = await fetch(`/api/structure/chapters/${chapterId}`, {
                method: 'PATCH',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: nextActive })
            });
            const saved = await res.json().catch(() => null);
            if (!res.ok || !saved || saved.active !== nextActive) {
                throw new Error(saved?.error || 'Le serveur n’a pas confirmé le nouveau statut.');
            }
            setChapterActiveOverrides((prev) => ({ ...prev, [chapterId]: saved.active }));
            if (onRefresh) await onRefresh();
        } catch (error) {
            setChapterActiveOverrides((prev) => ({ ...prev, [chapterId]: currentActive }));
            alert(`Impossible de changer le statut du chapitre : ${error.message}`);
        }
    }

    async function handleToggleActivityEnabled(e, item) {
        e.stopPropagation();
        if (!item?._id) return;
        if (!['homework', 'game', 'learning', 'expose', 'lecture', 'fiche', 'production', 'comment'].includes(item.actType)) return;
        const override = enabledOverrides[String(item._id)];
        const currentValue = typeof override === 'boolean'
            ? override
            : (item.actType === 'learning' && typeof item.active === 'boolean'
                ? item.active
                : item.isEnabled !== false);
        const nextValue = !currentValue;
        const base = getActivityApiBase(item.actType);
        setEnabledOverrides((prev) => ({ ...prev, [String(item._id)]: nextValue }));
        const res = await fetch(`${base}/${item._id}/enabled`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.actType === 'learning'
                ? { active: nextValue }
                : { isEnabled: nextValue })
        });
        if (!res.ok) {
            setEnabledOverrides((prev) => {
                const next = { ...prev };
                delete next[String(item._id)];
                return next;
            });
            alert("Impossible de changer le statut actif/inactif.");
            return;
        }
        if (onRefresh) onRefresh();
    }

    async function handleMoveActivityToChapter(item, targetChapterId) {
        const id = String(item?._id || '').trim();
        const chapterId = String(targetChapterId || '').trim();
        if (!id || !chapterId || String(item?.chapterId || '') === chapterId) return;
        const base = getActivityApiBase(item.actType);
        if (!base) return;
        const payload = {
            ...item,
            _id: id,
            chapterId
        };
        delete payload.actType;
        delete payload.status;
        delete payload.chapterTitle;
        delete payload.chapterSection;
        const res = await fetch(base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            alert("Impossible de déplacer cette activité.");
            return;
        }
        setOpenChaps(prev => ({ ...prev, [chapterId]: true }));
        if (onRefresh) onRefresh();
    }

    // --- SUPPRESSION UNIFIÉE ---
    function prepareDelete(e, item, type) {
        e.stopPropagation();
        const name = type === 'section' ? item.name : item.title;
        
        // Protection Racine
        if (type === 'chapter' && activeSection.toUpperCase() === "GÉNÉRAL" && name.trim().toUpperCase() === "GÉNÉRAL") {
            alert("🔒 PROTECTION : Racine indestructible.");
            return;
        }

        const id = item._id || item.id;
        
        // --- FIX : On force le passage par la modale pour TOUTES les sections ---
        if (type === 'section') {
            setDeleteTarget({ id, type, name, isShared: true });
            return;
        }

        let isShared = false;
        if (type === 'chapter') isShared = !!item.sharedLevel;
        else if (type === 'homework' || type === 'game' || type === 'learning' || type === 'expose' || type === 'lecture' || type === 'fiche' || type === 'production' || type === 'comment' || type === 'scan') {
            if (onDeleteItem) onDeleteItem(id, type, name);
            return;
        }

        setDeleteTarget({ id, type, name, isShared });
    }

    async function executeDelete(id, type, permanent) {
        const uid = getUserId();
        const url = (type === 'section') ? '/api/structure/sections/delete-request' : '/api/structure/chapters/delete-request';
        
        const body = { 
            teacherId: uid, 
            classId: classFilter, 
            permanent, 
            id, 
            type, 
            chapterId: id, 
            sectionName: deleteTarget?.name || id 
        };

        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

        if (res.ok) { 
            setDeleteTarget(null); 
            if (type === 'section') setActiveSection("GÉNÉRAL"); 
            if (onRefresh) onRefresh(); 
        } else {
            alert("Erreur lors de la suppression.");
        }
    }

    const activeColor = safeSections.find(s => s.name.toUpperCase() === activeSection.toUpperCase())?.color || '#64748b';
    const effectiveLevel = normalizeLevel(levelFilter || inferLevelFromName(classFilter || ''));

    const filteredChapters = safeChapters.filter(c => {
        const sectionName = String(c?.section || 'GÉNÉRAL').toUpperCase();
        const archived = c?.isArchived === true;
        if (sectionName !== activeSection.toUpperCase() || archived !== showArchived) return false;
        if (c.hiddenIn && c.hiddenIn.includes(classFilter)) return false;
        // Toujours afficher la racine si on est dans GÉNÉRAL
        if (activeSection.toUpperCase() === "GÉNÉRAL" && String(c?.title || '').toUpperCase() === "GÉNÉRAL") return true;
        
        const isForMyClass = c.classroom && String(c.classroom).toUpperCase() === String(classFilter || "").toUpperCase();
        const isForMyLevel = c.sharedLevel && normalizeLevel(c.sharedLevel) === effectiveLevel;
        const isGlobal = !c.classroom && !c.sharedLevel;
        return isForMyClass || isForMyLevel || isGlobal;
    });

    const uniqueItems = Array.from(new Map(safeItems.map(item => [item._id, item])).values());

    return (
        <div className="animate-in fade-in">
            {/* --- BARRE DES SECTIONS (AVEC BOUTONS ÉDITION RESTAURÉS) --- */}
            <div className="p-6 rounded-b-[40px] bg-slate-900 shadow-xl overflow-visible">
                <div className="flex justify-between items-center mb-2 px-4">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest opacity-40">Sections Cloud</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all ${showArchived ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{showArchived ? '📂 Actifs' : '📦 Archives'}</button>
                        <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg">+ Section</button>
                    </div>
                </div>
                
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 pt-8 px-4 overflow-y-visible">
                    {safeSections.map((s, idx) => {
                        const isGeneral = s.name.toUpperCase() === "GÉNÉRAL";
                        const isActive = activeSection.toUpperCase() === s.name.toUpperCase();
                        
                        return (
                            <div key={idx} className="relative group shrink-0">
                                <button 
                                    onClick={() => { setActiveSection(s.name); setShowArchived(false); }} 
                                    className={`min-w-[140px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${isActive ? 'bg-slate-800 border-white/20 scale-105 shadow-lg' : 'bg-slate-800/40 border-transparent opacity-40 hover:opacity-100'}`}
                                >
                                    <span className="font-black text-[11px] uppercase truncate w-full px-2" style={{ color: s.color }}>{s.name}</span>
                                    <div className="text-[7px] font-black text-white/30 mt-1 uppercase tracking-widest">{s.scope === 'GLOBAL' ? 'GLOBAL' : s.scope}</div>
                                </button>

                                {/* 🔥 BOUTONS D'ÉDITION DE SECTION RESTAURÉS 🔥 */}
                                {!isGeneral && (
                                    <div className="absolute -top-3 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleOpenEditSection(s); }}
                                            className="w-7 h-7 bg-white text-slate-600 shadow-xl rounded-full flex items-center justify-center text-[12px] border border-slate-200 hover:scale-110 transition-transform cursor-pointer"
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={(e) => prepareDelete(e, s, 'section')}
                                            className="w-7 h-7 bg-red-500 text-white shadow-xl rounded-full flex items-center justify-center text-[10px] font-black hover:scale-110 transition-transform cursor-pointer"
                                            title="Supprimer"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CONTENU DOSSIERS --- */}
            <div className="px-6 mt-10">
                <div className="flex justify-between items-end gap-4 mb-8 relative">
                        <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection}</h2>
                        {!showArchived && (
                            <div className="flex flex-wrap justify-end gap-3 relative">
                                <button
                                    onClick={() => setShowChapterModal(true)}
                                    className="px-5 py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase shadow-lg"
                                >
                                    + Dossier
                                </button>
                            </div>
                        )}
                </div>

                <div className="grid grid-cols-1 gap-4 pb-20">
                    {filteredChapters.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', { numeric: true, sensitivity: 'base' })).map(chap => {
                        const normalizedClassFilter = normalizeClassKey(classFilter);
                        const chapItems = uniqueItems.filter((it) => {
                            if (String(it.chapterId) !== String(chap._id)) return false;
                            if (!classFilter || !Array.isArray(it.targetClassrooms) || it.targetClassrooms.length === 0) return true;
                            const targetsCurrentClass = it.targetClassrooms.some((cls) => normalizeClassKey(cls) === normalizedClassFilter);
                            if (targetsCurrentClass) return true;
                            // Dans le tableau du professeur, un chapitre partagé au
                            // niveau doit conserver toutes ses activités visibles,
                            // même si leur distribution élève cible une autre classe
                            // de ce niveau. La cible exacte reste affichée sur la carte.
                            if (!chap.sharedLevel) return false;
                            const chapterLevel = normalizeLevel(chap.sharedLevel);
                            return it.targetClassrooms.some((cls) => normalizeLevel(inferLevelFromName(cls)) === chapterLevel);
                        });
                        const isOpen = openChaps[chap._id];
                        const chapterActive = typeof chapterActiveOverrides[String(chap._id)] === 'boolean'
                            ? chapterActiveOverrides[String(chap._id)]
                            : chap.active !== false;
                        const isRoot = activeSection.toUpperCase() === "GÉNÉRAL" && chap.title.toUpperCase() === "GÉNÉRAL";
                        const isLastSurvivor = activeSection.toUpperCase() === "GÉNÉRAL" && filteredChapters.length <= 1;

                        return (
                            <div
                                key={chap._id}
                                className={`bg-white border-2 rounded-[30px] overflow-hidden shadow-sm transition-colors ${dropChapterId === String(chap._id) ? 'border-violet-400 bg-violet-50/40' : 'border-slate-100'}`}
                                onDragOver={(e) => {
                                    if (!draggedActivity) return;
                                    e.preventDefault();
                                    setDropChapterId(String(chap._id));
                                }}
                                onDragLeave={() => setDropChapterId('')}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const item = draggedActivity;
                                    setDraggedActivity(null);
                                    setDropChapterId('');
                                    if (item) handleMoveActivityToChapter(item, chap._id);
                                }}
                            >
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-inner" style={{ backgroundColor: activeColor }}>{isOpen ? '📂' : '📁'}</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-slate-800 text-md uppercase">{chap.title}</h3>
                                                {chap.sharedLevel ? (
                                                    <span className="bg-purple-100 text-purple-600 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-purple-200">🎓 NIVEAU</span>
                                                ) : (!chap.classroom && !chap.sharedLevel && !isRoot) ? (
                                                    <span className="bg-emerald-50 text-emerald-500 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-100">🌍 GLOBAL</span>
                                                ) : !isRoot ? (
                                                    <span className="bg-indigo-50 text-indigo-400 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-100">🏫 CLASSE</span>
                                                ) : null}
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!showArchived && !isRoot && (
                                            <button
                                                onClick={(e) => handleToggleChapterActive(e, chap)}
                                                className={`mr-1 px-3 py-2 rounded-xl text-[9px] font-black border ${chapterActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                                            >
                                                {chapterActive ? 'ACTIF' : 'INACTIF'}
                                            </button>
                                        )}
                                        {!showArchived && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenChaps((prev) => ({ ...prev, [chap._id]: true }));
                                                    setActivityPickerChapterId((prev) => prev === String(chap._id) ? '' : String(chap._id));
                                                }}
                                                className={`mr-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase border transition-colors ${
                                                    activityPickerChapterId === String(chap._id)
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                                }`}
                                                title={`Créer une activité dans ${chap.title}`}
                                            >
                                                + Activité
                                            </button>
                                        )}
                                        <button onClick={(e) => handleRenameChapter(e, chap._id, chap.title)} title="Modifier" className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">✏️</button>
                                        <button onClick={(e) => handleArchiveChapter(e, chap._id, !showArchived)} title={showArchived ? "Désarchiver" : "Archiver"} className="p-2 text-slate-300 hover:text-orange-500 transition-colors text-xl">{showArchived ? '♻️' : '📦'}</button>
                                        {!isLastSurvivor && <button onClick={(e) => prepareDelete(e, chap, 'chapter')} className="p-2 text-red-200 hover:text-red-500 transition-colors text-xl font-bold">✕</button>}
                                    </div>
                                </div>

                                {activityPickerChapterId === String(chap._id) && !showArchived && (
                                    <div className="border-t border-indigo-100 bg-indigo-50/40 p-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="rounded-[22px] border border-indigo-100 bg-white shadow-lg p-4">
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Créer dans ce chapitre</div>
                                                    <div className="text-sm font-black text-slate-800">{chap.title}</div>
                                                </div>
                                                <button
                                                    onClick={() => setActivityPickerChapterId('')}
                                                    className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 text-slate-500 text-sm font-black"
                                                    title="Fermer"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                                {ACTIVITY_OPTIONS.map((option) => (
                                                    <button
                                                        key={option.type}
                                                        onClick={() => {
                                                            onCreateActivity(option.type, activeSection, String(chap._id));
                                                            setActivityPickerChapterId('');
                                                        }}
                                                        className={`w-full min-h-[68px] rounded-2xl border px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5 ${option.tone}`}
                                                    >
                                                        <div className="text-sm mb-1">{option.icon}</div>
                                                        <div className="text-[9px] font-black uppercase leading-tight">{option.label}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {isOpen && (
                                    <div className="bg-slate-50/50 border-t p-4 space-y-2">
                                            {chapItems.map(it => (
                                            <div
                                                key={it._id}
                                                draggable={['homework', 'game', 'learning', 'control', 'expose', 'lecture', 'fiche', 'production', 'comment'].includes(it.actType)}
                                                onDragStart={(e) => {
                                                    e.stopPropagation();
                                                    setDraggedActivity(it);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                    e.dataTransfer.setData('text/plain', `${it.actType}:${it._id}`);
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedActivity(null);
                                                    setDropChapterId('');
                                                }}
                                                className={`bg-white p-3 rounded-2xl flex justify-between items-start gap-3 shadow-sm border border-slate-100 ${draggedActivity?._id === it._id ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}`}
                                                title="Glisse cette activité dans un autre dossier pour la déplacer"
                                            >
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <span className="text-xl">{getActivityIcon(it)}</span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-black text-slate-700 text-xs uppercase truncate">{it.title}</div>
                                                    {(it.actType === 'homework' || it.actType === 'game' || it.actType === 'learning' || it.actType === 'expose' || it.actType === 'lecture' || it.actType === 'fiche' || it.actType === 'production') && (
                                                        <div className="text-[10px] font-bold text-slate-400 break-words whitespace-normal leading-4 mt-1">
                                                            👥 {getAudienceLabel(it)}
                                                        </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0 self-start">
                                                    {/* BOUTON DÉPLACEMENT (Pas encore implémenté côté serveur pour activité, placeholder) */}
                                                    {(it.actType === 'homework' || it.actType === 'game' || it.actType === 'learning' || it.actType === 'expose' || it.actType === 'lecture' || it.actType === 'fiche' || it.actType === 'production') && (
                                                        <button
                                                            onClick={(e) => handleToggleActivityEnabled(e, it)}
                                                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase border ${
                                                                isItemInactive(it)
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            }`}
                                                        >
                                                            {isItemInactive(it) ? 'INACTIF' : 'ACTIF'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => onEditItem(it, activeSection)}
                                                        className="w-9 h-9 rounded-lg bg-slate-900 text-white text-[13px] flex items-center justify-center"
                                                        title="Modifier"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={(e) => prepareDelete(e, it, it.actType)}
                                                        className="w-9 h-9 rounded-lg bg-red-50 text-red-500 text-[14px] flex items-center justify-center border border-red-100"
                                                        title="Supprimer"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {chapItems.length === 0 && <div className="text-center p-8 text-[10px] font-bold text-slate-300 uppercase italic tracking-widest">Dossier Vide</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- MODALE SUPPRESSION RESTAURÉE --- */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[40000] flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in text-center">
                        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Action sur "{deleteTarget.name}"</h3>
                        
                        {deleteTarget.isShared ? (
                            <>
                                <p className="text-sm text-slate-400 mb-8 px-6">Cet élément est partagé. Voulez-vous le supprimer partout ou simplement le masquer ici ?</p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, false)} className="w-full p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-lg hover:scale-105 transition-transform">🙈 Masquer ici (conserver ailleurs)</button>
                                    <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, true)} className="w-full p-5 rounded-2xl font-black text-xs bg-red-600 text-white uppercase shadow-lg hover:scale-105 transition-transform">🔥 Supprimer partout</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-slate-400 mb-8 px-6">Voulez-vous supprimer définitivement cet élément propre à la classe ?</p>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, true)} className="w-full p-5 rounded-2xl font-black text-xs bg-red-600 text-white uppercase shadow-lg hover:scale-105 transition-transform">🔥 Supprimer définitivement</button>
                                </div>
                            </>
                        )}
                        <button onClick={() => setDeleteTarget(null)} className="w-full p-4 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase mt-4">Annuler</button>
                    </div>
                </div>
            )}

            {/* --- MODALE ÉDITION SECTION RESTAURÉE --- */}
            {showEditSectionModal && editingSection && (
                <div className="fixed inset-0 z-[40000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Édition Section</h3>
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Nom de la section</label>
                            <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold outline-none focus:ring-4 ring-indigo-500/20" value={editingSection.name} onChange={e => setEditingSection({...editingSection, name: e.target.value})} />
                        </div>
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3">Thème Couleur</label>
                            <div className="grid grid-cols-6 gap-2 px-2">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} onClick={() => setEditingSection({...editingSection, color: c})} className={`w-10 h-10 rounded-xl border-4 transition-all ${editingSection.color === c ? 'border-slate-900 scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3">Statut / Portée</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['GLOBAL', 'LEVEL', 'CLASS'].map(s => (
                                    <button key={s} onClick={() => setEditingSection({...editingSection, scope: s})} className={`p-4 rounded-2xl font-black text-[9px] border-2 transition-all ${editingSection.scope === s ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                                        {s === 'GLOBAL' ? '🌍 GÉNÉRAL' : s === 'LEVEL' ? '🎓 NIVEAU' : '🏫 CETTE CLASSE'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowEditSectionModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleSaveSectionEdit} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Sauvegarder ✨</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALE CRÉATION SECTION --- */}
            {showSectionModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-6 uppercase text-slate-800">Nouvelle Section</h3>
                        <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-6 outline-none focus:ring-4 ring-indigo-500/20" placeholder="Nom de la matière" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <button onClick={() => setNewSectionScope("GLOBAL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "GLOBAL" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🌍 GLOBAL</button>
                            <button onClick={() => setNewSectionScope("LEVEL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "LEVEL" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🎓 NIVEAU</button>
                            <button onClick={() => setNewSectionScope("CLASS")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "CLASS" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🏫 CLASSE</button>
                        </div>
                        <div className="flex gap-4"><button onClick={() => setShowSectionModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button><button onClick={handleCreateSection} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Valider ✨</button></div>
                    </div>
                </div>
            )}

            {/* --- MODALE CRÉATION DOSSIER --- */}
            {showChapterModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-md shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Nouveau Dossier</h3>
                        <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-6 outline-none focus:ring-4 ring-slate-900/10" placeholder="Titre (ex: CH1, CH2...)" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} autoFocus />
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <button onClick={() => setNewChapterScope("LEVEL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newChapterScope === "LEVEL" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🎓 TOUTES LES {levelFilter || '?'}</button>
                            <button onClick={() => setNewChapterScope("CLASS")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newChapterScope === "CLASS" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🏫 UNIQUEMENT {classFilter}</button>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowChapterModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleCreateChapter} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-xl">Créer</button>
                        </div>
                    </div>
                </div>
            )}

             {/* --- MODALE ÉDITION DOSSIER --- */}
            {showEditChapterModal && editingChapter && (
                <div className="fixed inset-0 z-[40000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-md shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Édition Dossier</h3>
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Titre</label>
                            <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold outline-none focus:ring-4 ring-indigo-500/20" value={editingChapter.title} onChange={e => setEditingChapter({...editingChapter, title: e.target.value})} />
                        </div>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Section</label>
                            <select
                                className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-5 outline-none focus:ring-4 ring-indigo-500/20"
                                value={editingChapter.section || "GÉNÉRAL"}
                                onChange={e => setEditingChapter({ ...editingChapter, section: e.target.value })}
                            >
                                {safeSections.map(s => (
                                    <option key={s.name} value={s.name.toUpperCase()}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3">Portée</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setEditingChapter({...editingChapter, scope: "LEVEL"})} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${editingChapter.scope === "LEVEL" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🎓 NIVEAU</button>
                                <button onClick={() => setEditingChapter({...editingChapter, scope: "CLASS"})} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${editingChapter.scope === "CLASS" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🏫 CLASSE</button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowEditChapterModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleUpdateChapterComplete} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Sauvegarder ✨</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
