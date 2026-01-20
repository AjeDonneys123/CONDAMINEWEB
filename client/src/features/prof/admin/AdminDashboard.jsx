import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

/**
 * ⚙️ DASHBOARD ADMINISTRATEUR V52
 * Interface bi-colone pour les affectations Profs : Classes vs Groupes.
 */
export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [zoomItem, setZoomItem] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    
    // Form states
    const [fClass, setFClass] = useState({ name: '', type: 'CLASS' });
    const [fStudent, setFStudent] = useState({ firstName: '', lastName: '', classId: '' });
    const [fUser, setFUser] = useState({ firstName: '', lastName: '', password: 'A' });

    const myId = user.id || user._id;

    const loadData = async () => {
        setLoading(true);
        try {
            const resCls = await fetch(`/api/admin/classrooms`);
            const clsData = await resCls.json();
            setAllClasses(clsData);

            if (view === 'classes') setItems(clsData.filter(c => c.type === 'CLASS'));
            else if (view === 'groups') setItems(clsData.filter(c => c.type === 'GROUP'));
            else {
                const map = { 'teachers': 'teachers', 'students': 'students', 'staff': 'admins' };
                const r = await fetch(`/api/admin/${map[view]}`);
                setItems(await r.json());
            }
        } catch (e) {}
        setLoading(false);
    };

    useEffect(() => { loadData(); setShowAddForm(false); }, [view]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'students': 'students' };
        const body = view === 'classes' ? fClass : (view === 'groups' ? { ...fClass, type: 'GROUP' } : fUser);
        if (view === 'students') body = fStudent;

        const res = await fetch(`/api/admin/${map[view]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { loadData(); setShowAddForm(false); onRefresh(); }
    };

    const handleToggleMapping = async (targetId) => {
        let updated;
        let endpoint = '/api/admin/classrooms';

        if (view === 'groups') {
            const current = zoomItem.associatedClasses || [];
            const next = current.includes(targetId) ? current.filter(id => id !== targetId) : [...current, targetId];
            updated = { ...zoomItem, associatedClasses: next };
        } else if (view === 'teachers') {
            const current = zoomItem.assignedClasses || [];
            const next = current.includes(targetId) ? current.filter(id => id !== targetId) : [...current, targetId];
            updated = { ...zoomItem, assignedClasses: next };
            endpoint = '/api/admin/teachers';
        }

        setZoomItem(updated);
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
        loadData();
    };

    const handleDelete = async (id) => {
        if (id === myId || !confirm("Supprimer ?")) return;
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'students': 'students' };
        await fetch(`/api/admin/${map[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };

    return (
        <div className="admin-container animate-in fade-in">
            
            {/* MODAL BI-COLONE V52 */}
            {zoomItem && (
                <div className="zoom-overlay" onClick={() => setZoomItem(null)}>
                    <div className="zoom-card !max-w-[900px] w-[95%]" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black mb-1 uppercase tracking-tight">Affectations : {zoomItem.name || zoomItem.firstName}</h2>
                        <p className="text-[10px] text-slate-400 font-black mb-8 uppercase tracking-[0.2em]">Configuration du périmètre Cloud & BDD</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            
                            {/* COLONNE 1 : CLASSES (ADMIN) */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-indigo-500 uppercase border-b-2 border-indigo-50 pb-2 flex items-center gap-2">
                                    <span>🏫</span> CLASSES (DIVISIONS)
                                </h3>
                                <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {allClasses.filter(c => c.type === 'CLASS').map(c => {
                                        const isLinked = view === 'groups' ? zoomItem.associatedClasses?.includes(c._id) : zoomItem.assignedClasses?.includes(c._id);
                                        return (
                                            <button key={c._id} onClick={() => handleToggleMapping(c._id)} className={`p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${isLinked ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-[1.02]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                                <span className="font-black text-xs uppercase">{c.name}</span>
                                                {isLinked && <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* COLONNE 2 : GROUPES (PEDAGOGIE) */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black text-orange-500 uppercase border-b-2 border-orange-50 pb-2 flex items-center gap-2">
                                    <span>👥</span> GROUPES & OPTIONS
                                </h3>
                                <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {allClasses.filter(c => c.type === 'GROUP').map(c => {
                                        // On ne peut pas lier un groupe à un autre groupe dans cette vue pour l'instant
                                        if (view === 'groups') return null;
                                        const isLinked = zoomItem.assignedClasses?.includes(c._id);
                                        return (
                                            <button key={c._id} onClick={() => handleToggleMapping(c._id)} className={`p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${isLinked ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md scale-[1.02]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                                                <span className="font-black text-xs uppercase">{c.name}</span>
                                                {isLinked && <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">✓</span>}
                                            </button>
                                        );
                                    })}
                                    {view === 'groups' && <div className="p-10 text-center text-slate-300 font-bold italic text-xs uppercase">La liaison inter-groupes n'est pas autorisée.</div>}
                                </div>
                            </div>

                        </div>

                        <button onClick={() => setZoomItem(null)} className="w-full mt-10 py-5 bg-slate-900 text-white font-black rounded-3xl uppercase text-[12px] tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95">
                            Valider & Synchroniser le Cloud 🚀
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-[30px] shadow-sm">
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {['classes', 'groups', 'students', 'teachers', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`admin-tab ${view === v ? 'active' : ''}`}>
                            {v === 'classes' && '🏫 CLASSES'}
                            {v === 'groups' && '👥 GROUPES'}
                            {v === 'students' && '👨‍🎓 ÉLÈVES'}
                            {v === 'teachers' && '👨‍🏫 PROFS'}
                            {v === 'staff' && '🛡️ DIRECTION'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg ml-4">
                    {showAddForm ? 'FERMER' : `+ AJOUTER`}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-10 p-10 bg-indigo-600 rounded-[45px] shadow-2xl animate-in slide-in-from-top-4 text-white">
                    <form onSubmit={handleCreate} className="flex flex-wrap gap-6 items-end">
                        {(view === 'classes' || view === 'groups') && (
                            <div className="flex-1 min-w-[200px]"><label className="v1-label-mini !text-indigo-200">Nom du dossier</label><input className="admin-input !bg-white/10" value={fClass.name} onChange={e=>setFClass({...fClass, name:e.target.value})} placeholder="Ex: 2C ou LATIN..." required /></div>
                        )}
                        {view === 'students' && (
                            <>
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Prénom" value={fStudent.firstName} onChange={e=>setFStudent({...fStudent, firstName:e.target.value})} required />
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Nom" value={fStudent.lastName} onChange={e=>setFStudent({...fStudent, lastName:e.target.value})} required />
                                <select className="admin-input w-[200px] !bg-white/10" value={fStudent.classId} onChange={e=>setFStudent({...fStudent, classId:e.target.value})} required>
                                    <option value="">-- CLASSE --</option>
                                    {allClasses.filter(c=>c.type==='CLASS').map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </>
                        )}
                        {(view === 'teachers' || view === 'staff') && (
                            <>
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Prénom" value={fUser.firstName} onChange={e=>setFUser({...fUser, firstName:e.target.value})} required />
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Nom" value={fUser.lastName} onChange={e=>setFUser({...fUser, lastName:e.target.value})} required />
                            </>
                        )}
                        <button className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-xs shadow-2xl">CRÉER & PROVISIONNER 🚀</button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                <table className="admin-table">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="p-6 text-[10px] font-black uppercase text-slate-400">Élément</th>
                            <th className="p-6 text-[10px] font-black uppercase text-slate-400">Composition / Affectations</th>
                            <th className="p-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(it => (
                            <tr key={it._id} className="border-t hover:bg-slate-50 transition-colors">
                                <td className="p-6">
                                    <div className="font-black text-slate-700 uppercase">{it.name || `${it.firstName} ${it.lastName}`}</div>
                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{it.type === 'CLASS' ? 'DIVISION' : (it.type === 'GROUP' ? 'GROUPE' : 'PROFIL')}</span>
                                </td>
                                <td className="p-6">
                                    {view === 'groups' && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-wrap gap-1">
                                                {it.associatedClasses?.map(id => <span key={id} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8px] font-black border border-indigo-100">{allClasses.find(c => c._id === id)?.name}</span>)}
                                            </div>
                                            <button onClick={() => setZoomItem(it)} className="text-[9px] font-black text-indigo-500 hover:underline">+ LIER CLASSES</button>
                                        </div>
                                    )}
                                    {view === 'teachers' && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-wrap gap-1">
                                                {it.assignedClasses?.map(id => {
                                                    const c = allClasses.find(x => x._id === id);
                                                    if(!c) return null;
                                                    return <span key={id} className={`px-2 py-0.5 rounded text-[8px] font-black border ${c.type === 'GROUP' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{c.name}</span>
                                                })}
                                            </div>
                                            <button onClick={() => setZoomItem(it)} className="text-[9px] font-black text-indigo-500 hover:underline uppercase">+ Affecter</button>
                                        </div>
                                    )}
                                    {view === 'students' && <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{allClasses.find(c => c._id === it.classId)?.name}</span>}
                                    {view === 'classes' && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Administrative</span>}
                                </td>
                                <td className="p-6 text-right">
                                    {String(it._id) !== String(myId) && <button onClick={() => handleDelete(it._id)} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">✕</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="fixed bottom-4 left-4 bg-indigo-600 text-white font-black text-[10px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V52</div>
        </div>
    );
}