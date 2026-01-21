import React, { useState, useEffect, useRef } from 'react';
import './AdminDashboard.css';

/**
 * ⚙️ DASHBOARD ADMIN V163 - IMPORT ANYWHERE
 * UX : Le bouton "IMPORTER CSV" est maintenant disponible dans CLASSES et GROUPES.
 * L'importation fait tout d'un coup (Classes + Groupes + Élèves).
 */
export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [activeClassTab, setActiveClassTab] = useState('ALL');
    const [modalMode, setModalMode] = useState(null); 
    const [currentItem, setCurrentItem] = useState(null);
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const fileInputRef = useRef(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [rC, rS, rSt] = await Promise.all([
                fetch('/api/admin/classrooms').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/subjects').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/students').then(r => r.ok ? r.json() : [])
            ]);
            setAllClasses((rC || []).sort((a,b) => a.name.localeCompare(b.name)));
            setAllSubjects(rS);
            setAllStudents(rSt);
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

    useEffect(() => { loadData(); if (view !== 'students') setActiveClassTab('ALL'); }, [view]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Message adapté au contexte
        const contextMsg = view === 'groups' 
            ? "Importer les GROUPES et ÉLÈVES depuis ce fichier ?" 
            : "Importer la CLASSE et ÉLÈVES depuis ce fichier ?";

        if(!confirm(`${contextMsg}\n(Le fichier doit être la liste des élèves avec leurs options)`)) return;
        
        setImporting(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/admin/import-csv', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) { alert("✅ " + data.message); loadData(); onRefresh(); } else { alert("❌ " + data.error); }
        } catch (err) { alert("Erreur réseau"); }
        setImporting(false);
        e.target.value = null;
    };

    const handleMigration = async () => {
        if(!confirm("⚠️ NETTOYAGE BDD :\n- Suppression birthDate & isTestAccount\n- Calcul auto des niveaux\n- Reset emails parents\n\nContinuer ?")) return;
        setImporting(true);
        try {
            const res = await fetch('/api/admin/maintenance/migrate-students', { method: 'POST' });
            const data = await res.json();
            alert(data.message);
            loadData();
        } catch(e) { alert("Erreur migration"); }
        setImporting(false);
    };

    const openCreate = () => {
        const template = view === 'teachers' ? { firstName: '', lastName: '', password: 'A', taughtSubjects: [], assignedClasses: [] } : 
                         view === 'classes' ? { name: '', type: 'CLASS', level: '' } :
                         view === 'groups' ? { name: '', type: 'GROUP', level: '' } :
                         view === 'subjects' ? { name: '', color: '#000000' } :
                         { firstName: '', lastName: '', email: '', parentEmail: '', classId: '', currentLevel: '', assignedGroups: [] }; 
        setCurrentItem(template);
        setModalMode('create');
    };
    const openEdit = (it) => { setCurrentItem({ ...it }); setModalMode('edit'); };
    const handleSave = async () => {
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' };
        if (view === 'students' && currentItem.classId) currentItem.currentClass = allClasses.find(c => c._id === currentItem.classId)?.name || '';
        const res = await fetch(`/api/admin/${map[view]}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentItem) });
        if (res.ok) { setModalMode(null); loadData(); if(['classes','groups','teachers'].includes(view)) onRefresh(); } else { const err = await res.json(); alert("Erreur : " + err.error); }
    };
    const handleDelete = async (id) => {
        if (!confirm("Supprimer ?")) return;
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' };
        await fetch(`/api/admin/${map[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };
    const toggleArrayItem = (field, id) => {
        const list = currentItem[field] || [];
        setCurrentItem({ ...currentItem, [field]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] });
    };
    const getDisplayedItems = () => {
        if (view === 'students' && activeClassTab !== 'ALL') return items.filter(s => String(s.classId) === String(activeClassTab));
        return items;
    };
    const displayedItems = getDisplayedItems();

    return (
        <div className="admin-container animate-in fade-in">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv,.txt" style={{display:'none'}} />
            {importing && <div className="zoom-overlay" style={{zIndex: 20000}}><div className="text-white font-black text-2xl animate-pulse text-center">🔮 TRAITEMENT...</div></div>}
            
            {modalMode && currentItem && (
                <div className="zoom-overlay" onClick={() => setModalMode(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black mb-6 uppercase text-slate-800">{modalMode === 'create' ? `Nouveau ${view.slice(0,-1)}` : `Modifier ${currentItem.name || currentItem.lastName}`}</h2>
                        <div className="space-y-4 mb-6">
                            {['teachers', 'students', 'staff'].includes(view) && <div className="flex gap-4"><input className="admin-input" placeholder="Prénom" value={currentItem.firstName} onChange={e => setCurrentItem({...currentItem, firstName: e.target.value})} /><input className="admin-input" placeholder="Nom" value={currentItem.lastName} onChange={e => setCurrentItem({...currentItem, lastName: e.target.value})} /></div>}
                            
                            {view === 'students' && (<div className="flex gap-4"><input className="admin-input" placeholder="Email Élève" value={currentItem.email} onChange={e => setCurrentItem({...currentItem, email: e.target.value})} /><input className="admin-input" placeholder="Email Parent" value={currentItem.parentEmail || ''} onChange={e => setCurrentItem({...currentItem, parentEmail: e.target.value})} /></div>)}

                            {['teachers', 'staff'].includes(view) && <input className="admin-input" placeholder="Mot de passe" value={currentItem.password} onChange={e => setCurrentItem({...currentItem, password: e.target.value})} />}
                            
                            {['classes', 'groups'].includes(view) && <div className="flex gap-4"><input className="admin-input flex-1" placeholder="Nom (ex: 6A)" value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} /><div className="flex-1 flex flex-col gap-1"><label className="text-[9px] font-black text-slate-400 uppercase ml-2">NIVEAU</label><select className="admin-input" value={currentItem.level || ''} onChange={e => setCurrentItem({...currentItem, level: e.target.value})}><option value="">AUTO</option><option value="6">6ème</option><option value="5">5ème</option><option value="4">4ème</option><option value="3">3ème</option><option value="2">2nde</option><option value="1">1ère</option><option value="TERM">Terminale</option></select></div></div>}

                            {view === 'subjects' && <input className="admin-input" placeholder="Nom" value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} />}
                        </div>
                        
                        {view === 'teachers' && (
                            <div className="grid grid-cols-3 gap-4 border-t pt-6 h-[400px]">
                                <div className="flex flex-col gap-2 overflow-hidden"><h4 className="text-[10px] font-black uppercase text-indigo-500">📚 Matières</h4><div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 bg-slate-50 p-2 rounded-xl">{allSubjects.map(s => <button key={s._id} onClick={() => toggleArrayItem('taughtSubjects', s._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.taughtSubjects?.includes(s._id) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>{s.name}</button>)}</div></div>
                                <div className="flex flex-col gap-2 overflow-hidden"><h4 className="text-[10px] font-black uppercase text-emerald-500">🏫 Classes</h4><div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 bg-slate-50 p-2 rounded-xl">{allClasses.filter(c => c.type === 'CLASS').map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedClasses', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedClasses?.includes(c._id) ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'}`}>{c.name}</button>)}</div></div>
                                <div className="flex flex-col gap-2 overflow-hidden"><h4 className="text-[10px] font-black uppercase text-orange-500">👥 Groupes</h4><div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 bg-slate-50 p-2 rounded-xl">{allClasses.filter(c => c.type === 'GROUP').map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedClasses', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedClasses?.includes(c._id) ? 'bg-orange-500 text-white' : 'bg-white text-slate-400'}`}>{c.name}</button>)}</div></div>
                            </div>
                        )}
                        
                        {view === 'students' && (
                            <div className="grid grid-cols-2 gap-4 border-t pt-6 h-[400px]">
                                <div className="flex flex-col gap-2 overflow-hidden">
                                    <h4 className="text-[10px] font-black uppercase text-emerald-500">🏫 Classe Principale & Niveau</h4>
                                    <div className="mb-2"><label className="text-[8px] font-black text-slate-400 uppercase">NIVEAU</label><select className="admin-input mt-1" value={currentItem.currentLevel || ''} onChange={e => setCurrentItem({...currentItem, currentLevel: e.target.value})}><option value="">-- AUTO --</option><option value="6">6ème</option><option value="5">5ème</option><option value="4">4ème</option><option value="3">3ème</option><option value="2">2nde</option><option value="1">1ère</option><option value="TERM">Terminale</option></select></div>
                                    <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 bg-slate-50 p-2 rounded-xl">
                                        {allClasses.filter(c => c.type === 'CLASS').map(c => <button key={c._id} onClick={() => setCurrentItem({...currentItem, classId: c._id})} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.classId === c._id ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>{c.name}</button>)}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 overflow-hidden"><h4 className="text-[10px] font-black uppercase text-orange-500">👥 Options</h4><div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 bg-slate-50 p-2 rounded-xl">{allClasses.filter(c => c.type === 'GROUP').map(c => <button key={c._id} onClick={() => toggleArrayItem('assignedGroups', c._id)} className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all ${currentItem.assignedGroups?.includes(c._id) ? 'bg-orange-500 text-white' : 'bg-white text-slate-400'}`}>{c.name}</button>)}</div></div>
                            </div>
                        )}
                        <div className="flex gap-4 mt-6"><button onClick={() => setModalMode(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl uppercase text-xs">Annuler</button><button onClick={handleSave} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl uppercase text-xs shadow-xl">Enregistrer</button></div>
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-[30px] shadow-sm">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">{['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => <button key={v} onClick={() => setView(v)} className={`admin-tab ${view === v ? 'active' : ''}`}>{v.toUpperCase()}</button>)}</div>
                    <div className="flex gap-2">
                        {view === 'students' && <button onClick={handleMigration} className="bg-orange-500 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">🧹 NETTOYER BDD</button>}
                        
                        {/* V163 : BOUTON VISIBLE DANS CLASSES ET GROUPES */}
                        {(view === 'classes' || view === 'groups') && <button onClick={() => fileInputRef.current.click()} className="bg-emerald-500 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">📂 IMPORTER CSV</button>}
                        
                        <button onClick={openCreate} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ AJOUTER</button>
                    </div>
                </div>
                {view === 'students' && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-2">
                        <button onClick={() => setActiveClassTab('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${activeClassTab === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>TOUS</button>
                        {allClasses.filter(c => c.type === 'CLASS').map(c => (
                            <button key={c._id} onClick={() => setActiveClassTab(c._id)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border ${activeClassTab === c._id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>{c.name}</button>
                        ))}
                    </div>
                )}
            </div>
            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden min-h-[400px]">
                <table className="admin-table">
                    <tbody>
                        {displayedItems.map(it => {
                            const isTeacher = view === 'teachers';
                            let tSubjects=[], tClasses=[], tGroups=[];
                            if(isTeacher) {
                                tSubjects = (it.taughtSubjects||[]).map(id=>allSubjects.find(s=>s._id===id)).filter(Boolean);
                                const assigned = (it.assignedClasses||[]).map(id=>allClasses.find(c=>c._id===id)).filter(Boolean);
                                tClasses = assigned.filter(c=>c.type==='CLASS');
                                tGroups = assigned.filter(c=>c.type==='GROUP');
                            }
                            return (
                                <tr key={it._id} className="border-t hover:bg-slate-50 transition-colors">
                                    <td className="p-6">
                                        <div className="font-black text-slate-700 uppercase text-sm flex items-center gap-2">
                                            {it.name || `${it.firstName} ${it.lastName}`}
                                            {['classes','groups'].includes(view) && it.level && <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">NIV {it.level}</span>}
                                            {view === 'students' && (
                                                <>
                                                    <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">{it.currentClass || allClasses.find(c=>c._id===it.classId)?.name}</span>
                                                    {it.currentLevel && <span className="text-[8px] bg-fuchsia-600 text-white px-2 py-0.5 rounded font-bold shadow-sm">NIV {it.currentLevel}</span>}
                                                </>
                                            )}
                                        </div>
                                        <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">{it.type || it.role || 'PROFIL'}</span>
                                        {isTeacher && (
                                            <div className="flex flex-col gap-1 mt-2">
                                                {tSubjects.length>0 && <div className="flex flex-wrap gap-1">{tSubjects.map(s=><span key={s._id} style={{backgroundColor:s.color}} className="px-1.5 py-0.5 rounded text-[8px] font-black text-white">{s.name}</span>)}</div>}
                                                {tClasses.length>0 && <div className="flex flex-wrap gap-1">{tClasses.map(c=><span key={c._id} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black">🏫 {c.name}</span>)}</div>}
                                                {tGroups.length>0 && <div className="flex flex-wrap gap-1">{tGroups.map(g=><span key={g._id} className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[8px] font-black">👥 {g.name}</span>)}</div>}
                                            </div>
                                        )}
                                        {view === 'students' && it.assignedGroups?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">{it.assignedGroups.map(gid=>{const g=allClasses.find(c=>c._id===gid); const displayName = g ? g.name.replace(new RegExp(`^${it.currentClass}\\s+`), '') : '?'; return g ? <span key={gid} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[8px] rounded font-bold border border-orange-100">{displayName}</span> : null})}</div>
                                        )}
                                    </td>
                                    <td className="p-6 text-right"><button onClick={() => openEdit(it)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-[10px] hover:bg-slate-200">MODIFIER</button><button onClick={() => handleDelete(it._id)} className="ml-2 w-8 h-8 rounded-lg bg-red-50 text-red-500 font-bold hover:bg-red-100">✕</button></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {loading && <div className="p-20 text-center text-indigo-500 font-black animate-pulse">Chargement...</div>}
            </div>
        </div>
    );
}