// @signatures: ProfStudioFolder, fetchSections, handleRenameChapter, handleMoveChapter, handleMoveActivity, prepareDelete, executeDelete
import React, { useState, useEffect } from 'react';

/**
 * 📂 PROF STUDIO FOLDER (VRAI FICHIER RESTAURÉ)
 * Gestionnaire des dossiers, sections et affichage des activités.
 */
export default function ProfStudioFolder({ items, chapters, studentsRef, allClasses, classFilter, levelFilter, user, onEditItem, onCreateActivity, onRefresh, onDeleteItem }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    
    // MODALES
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionScope, setNewSectionScope] = useState("GLOBAL"); 
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterScope, setNewChapterScope] = useState("LEVEL"); 

    const [deleteTarget, setDeleteTarget] = useState(null); 

    const getUserId = () => user?.id || user?._id;

    // --- CHARGEMENT DES SECTIONS ---
    async function fetchSections() {
        const uid = getUserId();
        if (!uid) return;
        try {
            const res = await fetch(`/api/structure/sections/${uid}?classContext=${classFilter || ""}`);
            const data = await res.json();
            // On s'assure que GÉNÉRAL est toujours là et en premier
            let list = (data || []).filter(s => s.name !== "GÉNÉRAL");
            list.unshift({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });
            setCustomSections(list);
        } catch(e) { console.error("Fetch Sections Error", e); }
    }

    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]);

    // --- ACTIONS DE CRÉATION ---
    const handleCreateSection = async () => {
        if (!newSectionName) return;
        const uid = getUserId();
        const target = newSectionScope === 'CLASS' ? classFilter : (newSectionScope === 'LEVEL' ? levelFilter : null);
        await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: uid, sectionName: newSectionName.toUpperCase(), scope: newSectionScope, target: target })
        });
        setNewSectionName(""); setShowSectionModal(false); fetchSections();
    };

    const handleCreateChapter = async () => {
        if (!newChapterTitle) return;
        const uid = getUserId();
        const target = newChapterScope === 'CLASS' ? classFilter : levelFilter;
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newChapterTitle.toUpperCase(), section: activeSection, teacherId: uid, scope: newChapterScope, target: target })
        });
        setNewChapterTitle(""); setShowChapterModal(false); if (onRefresh) onRefresh();
    };

    // --- ACTIONS SUR CHAPITRES ---
    const handleRenameChapter = async (e, chapId, oldTitle) => {
        e.stopPropagation();
        const n = prompt("Nouveau nom :", oldTitle);
        if (!n || n === oldTitle) return;
        await fetch(`/api/structure/chapters/${chapId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: n.toUpperCase() })
        });
        if (onRefresh) onRefresh();
    };

    const handleArchiveChapter = async (e, chapId, shouldArchive) => {
        e.stopPropagation();
        await fetch(`/api/structure/chapters/${chapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isArchived: shouldArchive }) });
        if (onRefresh) onRefresh();
    };

    // --- SUPPRESSION ---
    const prepareDelete = (e, item, type) => {
        e.stopPropagation();
        
        // Protection Racine
        if (type === 'chapter' && activeSection === "GÉNÉRAL" && item.title === "GÉNÉRAL") {
            alert("🔒 Dossier Racine Protégé.");
            return;
        }

        const name = type === 'section' ? item.name : item.title;
        const id = item._id || item.id;
        
        // Si c'est une activité simple (devoir/jeu), on supprime direct via la prop parente
        if (type === 'homework' || type === 'game' || type === 'scan') {
            if (onDeleteItem) onDeleteItem(id, type);
            return;
        }

        // Si c'est structurel (Section/Chapitre), on vérifie le partage
        let isShared = type === 'section' ? item.scope !== 'CLASS' : (type === 'chapter' ? !!item.sharedLevel : false);
        
        if (!isShared) {
            if (confirm(`Supprimer ${name} ?`)) executeDelete(id, type, true);
        } else {
            setDeleteTarget({ id, type, name });
        }
    };

    const executeDelete = async (id, type, permanent) => {
        const uid = getUserId();
        // Route unique pour la suppression structurelle
        let url = (type === 'section') ? '/api/structure/sections' : '/api/structure/chapters/delete-request';
        
        // Si c'est une section, c'est un DELETE via body (astuce API)
        const method = 'POST'; 
        
        const body = { teacherId: uid, classId: classFilter, permanent };
        if (type === 'section') body.sectionName = deleteTarget?.name || id;
        if (type === 'chapter') body.chapterId = id;

        // Cas Section : API delete spécifique
        if (type === 'section') {
             await fetch('/api/structure/sections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else {
             await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        }

        setDeleteTarget(null); 
        if (type === 'section') setActiveSection("GÉNÉRAL"); 
        if (onRefresh) onRefresh();
    };

    // --- DÉPLACEMENT ---
    const handleMoveChapter = async (e, chapId) => {
        e.stopPropagation();
        const available = customSections.filter(s => s.name !== "GÉNÉRAL").map(s => s.name);
        if (available.length === 0) return alert("Créez d'abord une autre section !");
        
        const choice = prompt(`Vers quelle section ? (${available.join(', ')})`);
        if (!choice || !available.includes(choice.toUpperCase())) return;
        
        // On update le chapitre
        // Note: Il faudrait une route dédiée, ici on triche en changeant juste le nom s'il y a une API patch générique
        // Pour l'instant on suppose que le backend gère ça ou on le laisse simple
        alert("Fonctionnalité en cours de migration V8.5");
    };

    const handleMoveActivity = async (activity) => {
        const otherChaps = chapters.filter(c => c.section === activeSection && String(c._id) !== String(activity.chapterId));
        if (otherChaps.length === 0) return alert("Créez d'autres dossiers dans cette section !");
        
        const listStr = otherChaps.map((c, i) => `${i+1}. ${c.title}`).join('\n');
        const choice = prompt(`Vers quel dossier ?\n${listStr}`);
        const idx = parseInt(choice) - 1;
        
        if (isNaN(idx) || !otherChaps[idx]) return;
        
        // Appel API générique pour update l'activité
        const endpoint = activity.actType === 'game' ? '/api/games' : '/api/homeworks';
        await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ _id: activity._id, chapterId: otherChaps[idx]._id, title: activity.title }) // Min payload to update chapter
        });
        if (onRefresh) onRefresh();
    };

    const activeColor = customSections.find(s => s.name === activeSection)?.color || '#64748b';

    // --- FILTRAGE UI ---
    let filteredChapters = (chapters || []).filter(c => {
        if (c.section !== activeSection || c.isArchived !== showArchived) return false;
        if (c.hiddenIn && c.hiddenIn.includes(classFilter)) return false;
        
        // Toujours afficher la racine
        if (activeSection === "GÉNÉRAL" && c.title === "GÉNÉRAL") return true; 

        // Filtrage contextuel
        const isForMyClass = c.classroom && c.classroom.toUpperCase() === (classFilter || "").toUpperCase();
        const isForMyLevel = c.sharedLevel && String(c.sharedLevel) === String(levelFilter);
        const isGlobal = !c.classroom && !c.sharedLevel;

        return isForMyClass || isForMyLevel || isGlobal;
    });

    return (
        <div className="animate-in fade-in">
            {/* HEADER : SECTIONS */}
            <div className="p-6 rounded-b-[40px] bg-slate-900 shadow-xl">
                <div className="flex justify-between items-center mb-6 px-4">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest opacity-40">Sections Cloud</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all ${showArchived ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{showArchived ? '📂 Actifs' : '📦 Archives'}</button>
                        <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg">+ Section</button>
                    </div>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {customSections.map((s, idx) => (
                        <button key={idx} onClick={() => { setActiveSection(s.name); setShowArchived(false); }} className={`min-w-[120px] p-3 rounded-2xl border-2 transition-all ${activeSection === s.name ? 'bg-slate-800 border-white/20 scale-105' : 'bg-slate-800/40 border-transparent opacity-40'}`}>
                            <span className="font-black text-[10px] uppercase" style={{ color: s.color }}>{s.name}</span>
                            <div className="text-[6px] font-black text-white/30 mt-1 uppercase">{s.scope === 'GLOBAL' ? 'PARTOUT' : s.scope}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENU : DOSSIERS & ACTIVITÉS */}
            <div className="px-6 mt-10">
                <div className="flex justify-between items-end mb-8">
                    <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection}</h2>
                    {!showArchived && (
                        <div className="flex gap-2">
                            <button onClick={() => onCreateActivity('homework', activeSection)} className="px-5 py-3 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase shadow-lg">+ Devoir</button>
                            <button onClick={() => onCreateActivity('game', activeSection)} className="px-5 py-3 rounded-xl bg-purple-600 text-white text-[11px] font-black uppercase shadow-lg">+ Jeu</button>
                            <button onClick={() => setShowChapterModal(true)} className="px-5 py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase shadow-lg">+ Dossier</button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 pb-20">
                    {filteredChapters.map(chap => {
                        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
                        const isOpen = openChaps[chap._id];
                        const isRoot = activeSection === "GÉNÉRAL" && chap.title === "GÉNÉRAL";

                        return (
                            <div key={chap._id} className="bg-white border-2 rounded-[30px] overflow-hidden shadow-sm border-slate-100">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-inner" style={{ backgroundColor: activeColor }}>{isOpen ? '📂' : '📁'}</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-slate-800 text-md uppercase">{chap.title}</h3>
                                                {chap.sharedLevel && <span className="bg-purple-100 text-purple-600 text-[7px] font-black px-2 py-0.5 rounded uppercase border border-purple-200">NIV. {chap.sharedLevel}</span>}
                                                {chap.classroom && <span className="bg-indigo-50 text-indigo-400 text-[7px] font-black px-2 py-0.5 rounded uppercase border border-indigo-100">{chap.classroom}</span>}
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => handleRenameChapter(e, chap._id, chap.title)} title="Renommer" className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">✏️</button>
                                        <button onClick={(e) => handleArchiveChapter(e, chap._id, !showArchived)} title="Archiver" className="p-2 text-slate-300 hover:text-orange-500 transition-colors text-xl">{showArchived ? '♻️' : '📦'}</button>
                                        {!isRoot && <button onClick={(e) => prepareDelete(e, chap, 'chapter')} className="p-2 text-red-200 hover:text-red-500 transition-colors text-xl font-bold">✕</button>}
                                    </div>
                                </div>
                                
                                {isOpen && (
                                    <div className="bg-slate-50/50 border-t p-4 space-y-2">
                                        {chapItems.map(it => (
                                            <div key={it._id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl">{it.actType === 'game' ? '🎮' : (it.actType === 'scan' ? '📸' : '📝')}</span>
                                                    <span className="font-black text-slate-700 text-xs uppercase">{it.title}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleMoveActivity(it)} title="Déplacer" className="px-2 py-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600">📦</button>
                                                    <button onClick={() => onEditItem(it, activeSection)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[8px] font-black uppercase">ÉDITER</button>
                                                    <button onClick={(e) => prepareDelete(e, it, it.actType)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[10px]">✕</button>
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

            {/* MODALE SUPPRESSION */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in text-center">
                        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Action sur "{deleteTarget.name}"</h3>
                        <p className="text-sm text-slate-400 mb-8 px-6">Cet élément est partagé. Voulez-vous le supprimer définitivement ou simplement le masquer ici ?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, false)} className="w-full p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-lg hover:scale-105 transition-transform">🙈 Masquer (conserver ailleurs)</button>
                            <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, true)} className="w-full p-5 rounded-2xl font-black text-xs bg-red-600 text-white uppercase shadow-lg hover:scale-105 transition-transform">🔥 Supprimer définitivement</button>
                            <button onClick={() => setDeleteTarget(null)} className="w-full p-4 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase mt-4">Annuler</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE SECTION */}
            {showSectionModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Nouvelle Section</h3>
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

            {/* MODALE DOSSIER */}
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
                            <button onClick={handleCreateChapter} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-xl">Créer 📂</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
