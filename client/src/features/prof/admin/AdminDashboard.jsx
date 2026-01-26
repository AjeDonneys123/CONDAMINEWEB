import React, { useState, useEffect, useRef } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [activeClassTab, setActiveClassTab] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [modalMode, setModalMode] = useState(null); 
    const [currentItem, setCurrentItem] = useState(null);
    
    // DATA REFERENCES
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allStudents, setAllStudents] = useState([]); 
    
    // MAGIC MODAL
    const [showMagicModal, setShowMagicModal] = useState(false);
    const [magicText, setMagicText] = useState("");
    const [magicClass, setMagicClass] = useState("");
    const [magicForceOption, setMagicForceOption] = useState("");
    
    // MEMBER MANAGEMENT
    const [manageItem, setManageItem] = useState(null); 
    const [memberSearch, setMemberSearch] = useState(""); 

    // FILTERS FOR MODAL
    const [filterSub, setFilterSub] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterGroup, setFilterGroup] = useState("");
    
    const fileInputRef = useRef(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rC, rS, rSt] = await Promise.all([
                fetch('/api/admin/classrooms').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/subjects').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/students').then(r => r.ok ? r.json() : [])
            ]);
            setAllClasses(Array.isArray(rC) ? rC.sort((a,b) => (a.name||"").localeCompare(b.name||"")) : []);
            setAllSubjects(Array.isArray(rS) ? rS : []);
            setAllStudents(Array.isArray(rSt) ? rSt : []);

            const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' };
            const r = await fetch(`/api/admin/${map[view]}`);
            if (r.ok) {
                const data = await r.json();
                let list = Array.isArray(data) ? data : [];
                if (view === 'classes') list = list.filter(c => c.type === 'CLASS');
                else if (view === 'groups') list = list.filter(c => c.type === 'GROUP');
                setItems(list);
            }
        } catch (e) { console.error("Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); setSearchTerm(''); if (view !== 'students') setActiveClassTab('ALL'); }, [view]);

    useEffect(() => {
        if (modalMode) { setFilterSub(""); setFilterClass(""); setFilterGroup(""); }
    }, [modalMode]);

    const getDisplayedItems = () => {
        let res = items;
        if (view === 'students' && activeClassTab !== 'ALL') res = res.filter(s => String(s.classId) === String(activeClassTab));
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            res = res.filter(item => {
                const n = item.name ? item.name.toLowerCase() : '';
                const f = item.firstName ? item.firstName.toLowerCase() : '';
                const l = item.lastName ? item.lastName.toLowerCase() : '';
                return n.includes(term) || f.includes(term) || l.includes(term);
            });
        }
        return res;
    };
    const displayedItems = getDisplayedItems();

    const handleResetActivities = async () => {
        if (!confirm("⚠️ ATTENTION ! VOULEZ-VOUS VRAIMENT TOUT EFFACER ?\n\nCela supprimera :\n- Tous les devoirs et copies\n- Tous les jeux et scores\n- Tous les scans\n\nCette action est irréversible.")) return;
        setImporting(true);
        try {
            const res = await fetch('/api/admin/maintenance/reset-content', { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) { alert("✅ " + (data.message || "Nettoyage réussi !")); onRefresh(); } else { alert("❌ " + (data.error || "Erreur")); }
        } catch(e) { alert("❌ Erreur Réseau"); }
        setImporting(false);
    };

    const getActiveContext = () => { if (activeClassTab && activeClassTab !== 'ALL') { const cls = allClasses.find(c => c._id === activeClassTab); return cls ? { name: cls.name, level: cls.level, id: cls._id } : null; } return null; };
    
    const handleOpenCreate = () => { 
        let defaults = { firstName: '', lastName: '', email: '', parentEmail: '', classId: '', currentLevel: '', assignedGroups: [], name: '', level: '', type: 'CLASS', password: '', taughtSubjects: [], assignedClasses: [] }; 
        const context = getActiveContext(); 
        if (view === 'groups') { defaults.type = 'GROUP'; if (context) defaults.level = context.level; } 
        else if (view === 'classes') { defaults.type = 'CLASS'; } 
        else if (view === 'students' && context) { defaults.classId = context.id; defaults.currentClass = context.name; defaults.currentLevel = context.level; } 
        setCurrentItem(defaults); setModalMode('create'); 
    };

    const toggleArrayItem = (field, id) => { 
        const list = currentItem[field] || []; 
        setCurrentItem({ 
            ...currentItem, 
            [field]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] 
        }); 
    };

    const handleOpenMagic = () => { const context = getActiveContext(); if (context) setMagicClass(context.name); else setMagicClass(""); setMagicForceOption(""); setMagicText(""); setShowMagicModal(true); };
    const handleMagicImport = async () => { if (!magicText || magicText.length < 10) return alert("Collez les données !"); setImporting(true); try { const res = await fetch('/api/admin/import-magic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText: magicText, defaultClass: magicClass.toUpperCase(), forceOption: magicForceOption }) }); const data = await res.json(); if (res.ok) { alert("✅ " + data.message); setShowMagicModal(false); loadData(); onRefresh(); } else { alert("❌ " + data.error); } } catch(e) { alert("Erreur réseau"); } setImporting(false); };
    const handleFileSelect = async (e) => { const file = e.target.files[0]; if (!file) return; setImporting(true); const formData = new FormData(); formData.append('file', file); formData.append('defaultClass', magicClass.toUpperCase()); formData.append('forceOption', magicForceOption); try { const res = await fetch('/api/admin/import-csv', { method: 'POST', body: formData }); const data = await res.json(); if (res.ok) { alert("✅ " + data.message); setShowMagicModal(false); loadData(); onRefresh(); } else { alert("❌ " + data.error); } } catch (err) { alert("Erreur réseau lors de l'upload."); } setImporting(false); e.target.value = null; };
    const handleMigration = async () => { if(!confirm("⚠️ NETTOYAGE BDD ?")) return; setImporting(true); try { const res = await fetch('/api/admin/maintenance/migrate-students', { method: 'POST' }); const data = await res.json(); alert(data.message); loadData(); } catch(e) {} setImporting(false); };
    const getMembersOf = (item) => { if (!item) return []; if (item.type === 'CLASS') return allStudents.filter(s => String(s.classId) === String(item._id)); if (item.type === 'GROUP') return allStudents.filter(s => (s.assignedGroups || []).includes(item._id)); return []; };
    const handleMembership = async (action, studentId) => { if (!manageItem) return; try { await fetch('/api/admin/membership', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, targetId: manageItem._id, type: manageItem.type, action }) }); await loadData(); } catch (e) {} };
    const currentMembers = getMembersOf(manageItem);
    const potentialMembers = memberSearch.length > 1 ? allStudents.filter(s => { const isInside = currentMembers.some(m => m._id === s._id); if (isInside) return false; return s.firstName.toLowerCase().includes(memberSearch.toLowerCase()) || s.lastName.toLowerCase().includes(memberSearch.toLowerCase()); }) : [];
    const openEdit = (it) => { setCurrentItem({ ...it }); setModalMode('edit'); };
    const handleSave = async () => { const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' }; if (view === 'students' && currentItem.classId) currentItem.currentClass = allClasses.find(c => c._id === currentItem.classId)?.name || ''; try { const res = await fetch(`/api/admin/${map[view]}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentItem) }); if (res.ok) { setModalMode(null); loadData(); if(['classes','groups','teachers'].includes(view)) onRefresh(); } else { const err = await res.json(); alert("Erreur: " + err.error); } } catch(e) { alert("Erreur Réseau"); } };
    const handleDelete = async (id) => { if (!confirm("Supprimer ?")) return; const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' }; await fetch(`/api/admin/${map[view]}/${id}`, { method: 'DELETE' }); loadData(); };
    const isGroupMode = view === 'groups';

    return (
        <>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv,.txt" style={{display:'none'}} />
            {importing && <div className="zoom-overlay level-2"><div className="text-white font-black text-2xl animate-pulse text-center">🔮 TRAITEMENT...</div></div>}
            
            {showMagicModal && (<div className="zoom-overlay" onClick={() => setShowMagicModal(false)}><div className="zoom-card !w-[800px] !max-w-none" onClick={e => e.stopPropagation()}><div className="z-header"><h2 className={`text-xl font-black mb-1 uppercase ${isGroupMode ? 'text-orange-500' : 'text-indigo-600'}`}>{isGroupMode ? '🔮 IMPORTATION GROUPE & ÉLÈVES' : '🔮 IMPORTATION CLASSE & ÉLÈVES'}</h2><p className="text-[10px] text-slate-400 font-bold uppercase">Copiez un tableau Excel/Sheets (Nom, Prénom, etc.)</p></div><div className="z-body">{isGroupMode ? (<div className="flex gap-4 mb-4"><div className="flex-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">CLASSE DE RATTACHEMENT (Obligatoire)</label><input className="admin-input border-indigo-100 focus:border-indigo-500" placeholder="ex: 6D, T1..." value={magicClass} onChange={e => setMagicClass(e.target.value)} /></div><div className="flex-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">NOM DU GROUPE (Option forcée)</label><input className="admin-input border-orange-200 focus:border-orange-500 bg-orange-50" placeholder="ex: ANGLAIS LVA, CHORALE..." value={magicForceOption} onChange={e => setMagicForceOption(e.target.value)} /></div></div>) : (<div className="flex gap-4 mb-4"><div className="flex-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">NOM DE LA CLASSE PAR DÉFAUT</label><input className="admin-input border-indigo-100 focus:border-indigo-500" placeholder="ex: 6D, T1" value={magicClass} onChange={e => setMagicClass(e.target.value)} /></div></div>)}<textarea className="w-full h-[300px] p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-xs mb-6 outline-none focus:border-slate-300 transition-all" placeholder="Collez le tableau ici..." value={magicText} onChange={e => setMagicText(e.target.value)} /></div><div className="z-footer"><button onClick={() => fileInputRef.current.click()} className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xs border border-emerald-100 hover:bg-emerald-100 transition-colors">📂 UPLOAD CSV / TXT</button><button onClick={() => setShowMagicModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-black text-xs">ANNULER</button><button onClick={handleMagicImport} className={`flex-1 py-4 text-white rounded-xl font-black text-xs shadow-lg animate-pulse ${isGroupMode ? 'bg-orange-500' : 'bg-indigo-600'}`}>LANCER L'IA 🤖</button></div></div></div>)}
            {manageItem && (<div className="zoom-overlay" onClick={() => setManageItem(null)}><div className="zoom-card" onClick={e => e.stopPropagation()}><div className="z-header"><h2 className="text-xl font-black mb-1 uppercase text-slate-800">{manageItem.type === 'CLASS' ? '🏫' : '👥'} {manageItem.name}</h2><p className="text-[10px] font-bold text-slate-400 uppercase">GESTION DES EFFECTIFS ({getMembersOf(manageItem).length} Élèves)</p></div><div className="z-body"><div className="member-list custom-scrollbar">{getMembersOf(manageItem).map(m => (<div key={m._id} className="member-row"><span>{m.firstName} {m.lastName} <span className="text-[9px] text-slate-400">({m.currentClass})</span></span><button onClick={() => handleMembership('remove', m._id)} className="member-btn-remove" title="Retirer">✕</button></div>))}{getMembersOf(manageItem).length === 0 && <div className="p-4 text-center text-slate-300 italic text-xs">Aucun élève.</div>}</div><div className="member-add-box"><input className="admin-input" placeholder="🔎 Ajouter un élève..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />{memberSearch.length > 1 && (<div className="finder-results-mini custom-scrollbar">{potentialMembers.map(p => (<div key={p._id} className="finder-row-mini" onClick={() => { handleMembership('add', p._id); setMemberSearch(""); }}><span>{p.firstName} {p.lastName} <span className="opacity-50 text-[8px]">({p.currentClass})</span></span><span className="text-green-600 font-black">+</span></div>))}</div>)}</div></div><div className="z-footer"><button onClick={() => setManageItem(null)} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs">FERMER</button></div></div></div>)}
            
            {modalMode && currentItem && (
                <div className="zoom-overlay" onClick={() => setModalMode(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        <div className="z-header">
                            <h2 className="text-xl font-black uppercase text-slate-800">{modalMode === 'create' ? `Nouveau ${view.slice(0,-1)}` : `Modifier ${currentItem.name || currentItem.lastName}`}</h2>
                        </div>
                        
                        <div className="z-body">
                            <div className="space-y-4 mb-6 flex-shrink-0">
                                {['teachers', 'students', 'staff'].includes(view) && <div className="flex gap-4"><input className="admin-input" placeholder="Prénom" value={currentItem.firstName} onChange={e => setCurrentItem({...currentItem, firstName: e.target.value})} /><input className="admin-input" placeholder="Nom" value={currentItem.lastName} onChange={e => setCurrentItem({...currentItem, lastName: e.target.value})} /></div>}
                                {view === 'students' && (<div className="flex gap-4"><input className="admin-input" placeholder="Email Élève" value={currentItem.email} onChange={e => setCurrentItem({...currentItem, email: e.target.value})} /><input className="admin-input" placeholder="Email Parent" value={currentItem.parentEmail || ''} onChange={e => setCurrentItem({...currentItem, parentEmail: e.target.value})} /></div>)}
                                {['teachers', 'staff'].includes(view) && <input className="admin-input" placeholder="Mot de passe" value={currentItem.password} onChange={e => setCurrentItem({...currentItem, password: e.target.value})} />}
                                {['classes', 'groups'].includes(view) && (<div className="flex gap-4"><input className="admin-input flex-1" placeholder={view === 'classes' ? "Nom (ex: 6A)" : "Nom (ex: SPE MATHS)"} value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} /><div className="flex-1 flex flex-col gap-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">NIVEAU</label><select className="admin-input" value={currentItem.level || ''} onChange={e => setCurrentItem({...currentItem, level: e.target.value})}><option value="">AUTO / AUCUN</option><option value="6">6ème</option><option value="5">5ème</option><option value="4">4ème</option><option value="3">3ème</option><option value="2">2nde</option><option value="1">1ère</option><option value="TERM">Terminale</option></select></div></div>)}
                                {view === 'subjects' && <input className="admin-input" placeholder="Nom" value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} />}
                            </div>
                            
                            {/* GRILLE PROFESSEUR */}
                            {view === 'teachers' && (
                                <div className="grid grid-cols-3 gap-4 border-t pt-4 flex-1 min-h-0">
                                    <div className="flex flex-col gap-2 h-full overflow-hidden">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[10px] font-black uppercase text-indigo-500">📚 Matières</h4>
                                            <input className="w-full p-2 text-[10px] font-bold border-2 border-indigo-50 rounded-xl bg-slate-50 outline-none" placeholder="🔎 Filtrer..." value={filterSub} onChange={e=>setFilterSub(e.target.value)} />
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white p-2 rounded-xl border-2 border-slate-100 custom-scrollbar flex flex-col gap-1 shadow-inner">
                                            {allSubjects.filter(s=>s.name.toLowerCase().includes(filterSub.toLowerCase())).map(s => <button key={s._id} onClick={() => toggleArrayItem('taughtSubjects', s._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.taughtSubjects?.includes(s._id) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{s.name}</button>)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 h-full overflow-hidden">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[10px] font-black uppercase text-emerald-500">🏫 Classes</h4>
                                            <input className="w-full p-2 text-[10px] font-bold border-2 border-emerald-50 rounded-xl bg-slate-50 outline-none" placeholder="🔎 Filtrer..." value={filterClass} onChange={e=>setFilterClass(e.target.value)} />
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white p-2 rounded-xl border-2 border-slate-100 custom-scrollbar flex flex-col gap-1 shadow-inner">
                                            {allClasses.filter(c => c.type === 'CLASS' && c.name.toLowerCase().includes(filterClass.toLowerCase())).map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedClasses', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedClasses?.includes(c._id) ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{c.name}</button>)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 h-full overflow-hidden">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[10px] font-black uppercase text-orange-500">👥 Groupes</h4>
                                            <input className="w-full p-2 text-[10px] font-bold border-2 border-orange-50 rounded-xl bg-slate-50 outline-none" placeholder="🔎 Filtrer..." value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} />
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white p-2 rounded-xl border-2 border-slate-100 custom-scrollbar flex flex-col gap-1 shadow-inner">
                                            {allClasses.filter(c => c.type === 'GROUP' && c.name.toLowerCase().includes(filterGroup.toLowerCase())).map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedClasses', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedClasses?.includes(c._id) ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{c.name}</button>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {view === 'students' && (
                                <div className="grid grid-cols-2 gap-4 border-t pt-4 flex-1 min-h-0">
                                    <div className="flex flex-col gap-2 h-full overflow-hidden">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-end">
                                                <h4 className="text-[10px] font-black uppercase text-emerald-500">🏫 Classe Principale</h4>
                                                <select className="text-[9px] p-1 border rounded bg-slate-50 font-bold uppercase w-16" value={currentItem.currentLevel || ''} onChange={e => setCurrentItem({...currentItem, currentLevel: e.target.value})} title="Forcer Niveau">
                                                    <option value="">AUTO</option><option value="6">6è</option><option value="5">5è</option><option value="4">4è</option><option value="3">3è</option><option value="2">2de</option><option value="1">1ère</option><option value="TERM">Term</option>
                                                </select>
                                            </div>
                                            <input className="w-full p-2 text-[10px] font-bold border-2 border-emerald-50 rounded-xl bg-slate-50 outline-none" placeholder="🔎 Filtrer..." value={filterClass} onChange={e=>setFilterClass(e.target.value)} />
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white p-2 rounded-xl border-2 border-slate-100 custom-scrollbar flex flex-col gap-1 shadow-inner">
                                            {allClasses.filter(c => c.type === 'CLASS' && c.name.toLowerCase().includes(filterClass.toLowerCase())).map(c => <button key={c._id} onClick={() => setCurrentItem({...currentItem, classId: c._id})} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.classId === c._id ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{c.name}</button>)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 h-full overflow-hidden">
                                        <div className="flex flex-col gap-1">
                                            <h4 className="text-[10px] font-black uppercase text-orange-500">👥 Options</h4>
                                            <input className="w-full p-2 text-[10px] font-bold border-2 border-orange-50 rounded-xl bg-slate-50 outline-none" placeholder="🔎 Filtrer..." value={filterGroup} onChange={e=>setFilterGroup(e.target.value)} />
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white p-2 rounded-xl border-2 border-slate-100 custom-scrollbar flex flex-col gap-1 shadow-inner">
                                            {allClasses.filter(c => c.type === 'GROUP' && c.name.toLowerCase().includes(filterGroup.toLowerCase())).map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedGroups', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedGroups?.includes(c._id) ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{c.name}</button>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="z-footer">
                            <button onClick={() => setModalMode(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl uppercase text-xs">Annuler</button>
                            <button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl uppercase text-xs shadow-xl">Enregistrer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* DASHBOARD CONTENT */}
            <div className="admin-container animate-in fade-in">
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-[30px] shadow-sm">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">{['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => <button key={v} onClick={() => setView(v)} className={`admin-tab ${view === v ? 'active' : ''}`}>{v.toUpperCase()}</button>)}</div>
                        <div className="flex gap-2">
                            {view === 'students' && <button onClick={handleMigration} className="bg-orange-500 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">🧹 CLEAN BDD</button>}
                            <button onClick={handleResetActivities} className="bg-red-600 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg animate-pulse hover:bg-red-700 transition-colors">🔥 VIDER CONTENU</button>
                            {(view === 'classes' || view === 'groups' || view === 'students') && <button onClick={handleOpenMagic} className="bg-purple-600 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">🔮 IMPORT</button>}
                            <button onClick={handleOpenCreate} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ AJOUTER</button>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔎</span>
                        <input type="text" placeholder={`Rechercher dans ${view}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border-2 border-slate-100 font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm" />
                    </div>

                    {view === 'students' && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-2">
                            <button onClick={() => setActiveClassTab('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${activeClassTab === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>TOUS</button>
                            {allClasses.filter(c => c.type === 'CLASS').map(c => (<button key={c._id} onClick={() => setActiveClassTab(c._id)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${activeClassTab === c._id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>{c.name}</button>))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden min-h-[400px]">
                    <table className="admin-table">
                        <tbody>
                            {displayedItems.map(it => (
                                <tr key={it._id} className="border-t hover:bg-slate-50 transition-colors">
                                    <td className="p-6">
                                        <div className="font-black text-slate-700 uppercase text-sm flex items-center gap-2">
                                            {it.name || `${it.firstName} ${it.lastName}`}
                                            {['classes','groups'].includes(view) && it.level && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">NIV {it.level}</span>}
                                            {view === 'students' && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">{it.currentClass || allClasses.find(c=>c._id===it.classId)?.name}</span>}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">{it.type || it.role || 'PROFIL'}</span>
                                    </td>
                                    <td className="p-6 text-right flex justify-end gap-2">
                                        {(view === 'classes' || view === 'groups') && (<button onClick={() => { setManageItem(it); setMemberSearch(""); }} className="bg-purple-100 text-purple-600 px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-purple-200 transition-colors">👥 GÉRER</button>)}
                                        <button onClick={() => openEdit(it)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-slate-200">MODIFIER</button>
                                        <button onClick={() => handleDelete(it._id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 font-bold hover:bg-red-100 flex items-center justify-center">✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}