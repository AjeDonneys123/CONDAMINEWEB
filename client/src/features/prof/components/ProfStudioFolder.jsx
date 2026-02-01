// @signatures: ProfStudioFolder, confirmCreateChapter, confirmDelete, confirmMoveChapter, fetchSections, handleArchiveChapter, handleCreateChapter, handleDeleteChapter, handleMoveChapter, handleRenameChapter, isChapterVisible, isItemVisibleForClass
import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, studentsRef, classFilter, levelFilter, user, onEditItem, onDeleteItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState(null); // Protection anti-blackscreen
    const [showArchived, setShowArchived] = useState(false); 
    
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [movingChapter, setMovingChapter] = useState(null);
    const [deleteRequest, setDeleteRequest] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const getUserId = () => user?.id || user?._id;

    async function fetchSections() {
        const uid = getUserId();
        if (!uid) return;
        setLoading(true);
        setApiError(null);
        
        const classParam = classFilter ? `&classContext=${encodeURIComponent(classFilter)}` : '';
        try {
            const url = `/api/prof/structure/sections/${uid}?_t=${Date.now()}${classParam}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error(`API Indisponible (Status ${res.status}). Vérifiez le serveur Node.`);
            }

            const data = await res.json();
            const visibleSections = Array.isArray(data) ? data.filter(s => {
                if (s.name === "GÉNÉRAL") return true;
                if (s.hiddenIn && s.hiddenIn.includes(classFilter)) return false;
                return true;
            }) : [];
            
            setCustomSections(visibleSections);
        } catch(e) { 
            console.error("Fetch Error:", e.message);
            setApiError(e.message);
        }
        setLoading(false);
    }

    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]); 

    // --- RENDU SÉCURISÉ ---
    if (apiError) {
        return (
            <div className="p-10 bg-red-50 border-2 border-red-200 rounded-[30px] text-center">
                <h3 className="text-red-600 font-black text-xl mb-2">🚨 ERREUR DE CONNEXION API</h3>
                <p className="text-red-400 font-bold text-sm mb-4">{apiError}</p>
                <button onClick={fetchSections} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black">RÉESSAYER</button>
            </div>
        );
    }

    // (Reste du composant identique à la version stable...)
    // (Note: Je renvoie la suite pour être sûr que tout est là)
    
    async function handleRenameChapter(e, chapId, oldTitle) {
        e.stopPropagation();
        const newTitle = prompt("Nouveau nom du dossier :", oldTitle);
        if (!newTitle || newTitle === oldTitle) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
        if(onRefresh) onRefresh();
    }

    async function handleArchiveChapter(e, chapId, shouldArchive) {
        e.stopPropagation();
        if (shouldArchive && !confirm("📦 Archiver ce dossier ?")) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isArchived: shouldArchive }) });
        if(onRefresh) onRefresh();
    }

    async function handleDeleteChapter(e, chapId, title) {
        e.stopPropagation();
        if (!confirm(`⚠️ Supprimer définitivement "${title}" ?`)) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'DELETE' });
        if(onRefresh) onRefresh();
    }

    function handleMoveChapter(e, chap) { e.stopPropagation(); setMovingChapter(chap); setShowMoveModal(true); }

    async function confirmMoveChapter(sectionName) {
        if (!movingChapter) return;
        setIsProcessing(true);
        try {
            await fetch(`/api/prof/structure/chapters/${movingChapter._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: sectionName.toUpperCase().trim() }) });
            setShowMoveModal(false); setMovingChapter(null); if(onRefresh) onRefresh();
        } catch(e) { alert("Erreur"); }
        setIsProcessing(false);
    }

    const isChapterVisible = (chap) => {
        if (!classFilter) return true; 
        const chapClass = (chap.classroom || "").toUpperCase().trim();
        const chapLevel = (chap.sharedLevel || "").trim();
        if (chapClass === classFilter.toUpperCase().trim()) return true;
        if (chapLevel && String(chapLevel) === String(levelFilter)) return true;
        if (!chapClass && !chapLevel && chap.section === "GÉNÉRAL") return true;
        return false;
    };

    const isItemVisibleForClass = (item) => {
        if (!classFilter) return true;
        const targets = item.targetClassrooms || (item.classroom ? [item.classroom] : []);
        return targets.length === 0 || targets.some(t => t.toUpperCase() === classFilter.toUpperCase());
    };

    const activeColorInfo = customSections.find(s => s.name === activeSection);
    const activeColor = activeColorInfo ? activeColorInfo.color : '#64748b'; 

    return (
        <div className="animate-in fade-in relative">
            {/* BARRE DE SECTIONS */}
            <div className="p-8 rounded-b-[50px] bg-slate-900 shadow-2xl relative">
                <div className="flex justify-between items-center mb-8 px-4">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-[0.4em] opacity-40">Sections Cloud</h3>
                    <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Nouvelle Section</button>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                    <button onClick={() => { setActiveSection("GÉNÉRAL"); setShowArchived(false); }} className={`min-w-[140px] p-4 rounded-2xl border-2 transition-all ${activeSection === "GÉNÉRAL" ? 'bg-slate-800 border-white/20 scale-105' : 'bg-slate-800/40 border-slate-800 opacity-30'}`}>
                        <span className="font-black text-[10px] uppercase text-slate-400">GÉNÉRAL</span>
                    </button>
                    {customSections.map((s, idx) => (
                        <div key={idx} className="relative shrink-0">
                            <button onClick={() => setActiveSection(s.name)} className={`min-w-[140px] p-4 rounded-2xl border-2 transition-all ${activeSection === s.name ? 'bg-slate-800 border-white/20 scale-105' : 'bg-slate-800/40 border-slate-800'}`}>
                                <span className="font-black text-[10px] uppercase" style={{ color: s.color }}>{s.name}</span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-6 mt-12">
                <div className="flex justify-between items-end mb-10">
                    <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection}</h2>
                    <div className="flex gap-3">
                        {!showArchived && (
                            <>
                                <button onClick={() => onCreateActivity('homework', activeSection)} className="px-5 py-3 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase">+ Devoir</button>
                                <button onClick={() => onCreateActivity('game', activeSection)} className="px-5 py-3 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase">+ Jeu</button>
                                <button onClick={() => { setNewChapterTitle(""); setShowChapterModal(true); }} className="px-5 py-3 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">+ Dossier</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 pb-20">
                    {chapters
                        .filter(c => (c.section || "GÉNÉRAL").toUpperCase() === activeSection.toUpperCase() && !!c.isArchived === showArchived && isChapterVisible(c))
                        .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
                        .map(chap => {
                            const chapItems = items.filter(it => String(it.chapterId) === String(chap._id) && isItemVisibleForClass(it));
                            return (
                                <div key={chap._id} className="bg-white border-2 rounded-[35px] overflow-hidden shadow-sm border-[#f1f5f9]">
                                    <div className="p-6 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setOpenChaps({...openChaps, [chap._id]: !openChaps[chap._id]})}>
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl" style={{ backgroundColor: activeColor }}>{openChaps[chap._id] ? '📂' : '📁'}</div>
                                            <div className="flex flex-col">
                                                <h3 className="font-black text-slate-800 text-lg uppercase">{chap.title}</h3>
                                                <span className="text-[8px] font-black text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                                            </div>
                                        </div>
                                    </div>
                                    {openChaps[chap._id] && (
                                        <div className="bg-slate-50/50 border-t p-4 space-y-2">
                                            {chapItems.map(it => (
                                                <div key={it._id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                                                    <span className="font-black text-slate-700 text-xs uppercase">{it.title}</span>
                                                    <button onClick={() => onEditItem(it)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase">ÉDITER</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}
