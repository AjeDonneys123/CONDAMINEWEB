import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

/**
 * ⚙️ DASHBOARD ADMINISTRATEUR V97
 * Fix : Chargement résilient des données et restauration des référentiels.
 */
export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [zoomItem, setZoomItem] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    
    // Forms
    const [fClass, setFClass] = useState({ name: '', type: 'CLASS' });
    const [fSubject, setFSubject] = useState({ name: '', color: '#6366f1' });
    const [fUser, setFUser] = useState({ firstName: '', lastName: '', password: 'A' });
    const [fStudent, setFStudent] = useState({ firstName: '', lastName: '', classId: '' });

    const myId = user.id || user._id;

    const loadData = async () => {
        setLoading(true);
        try {
            // Chargement des référentiels indispensables
            const [rC, rS, rSt] = await Promise.all([
                fetch('/api/admin/classrooms').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/subjects').then(r => r.ok ? r.json() : []),
                fetch('/api/admin/students').then(r => r.ok ? r.json() : [])
            ]);
            
            setAllClasses(rC);
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
        } catch (e) { console.error("❌ Dashboard Error:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); setShowAddForm(false); }, [view]);

    const handleCreate = async (e) => {
        e.preventDefault();
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' };
        let body = fUser;
        if (view === 'classes') body = fClass;
        if (view === 'groups') body = { ...fClass, type: 'GROUP' };
        if (view === 'subjects') body = fSubject;
        if (view === 'students') body = fStudent;

        const res = await fetch(`/api/admin/${map[view]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { 
            setShowAddForm(false); 
            loadData(); 
            if(view === 'classes' || view === 'groups') onRefresh(); 
        }
    };

    const handleToggleMapping = async (targetId, type) => {
        if (!zoomItem) return;
        let updated = { ...zoomItem };
        const listField = type === 'subject' ? 'taughtSubjects' : 'assignedClasses';
        updated[listField] = (updated[listField] || []).includes(targetId) 
            ? updated[listField].filter(id => id !== targetId) 
            : [...(updated[listField] || []), targetId];

        setZoomItem(updated);
        await fetch('/api/admin/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        loadData();
    };

    const handleTestSwitch = async (it, type) => {
        let tid = it._id;
        if (type === 'STUDENT') {
            const ts = allStudents.find(s => String(s.classId) === String(it._id) && s.isTestAccount);
            if (!ts) return alert("Élève test non provisionné.");
            tid = ts._id;
        }
        const res = await fetch('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role: type, studentId: tid, firstName: it.firstName, lastName: it.lastName, password: 'A' }) });
        if (res.ok) {
            const d = await res.json();
            localStorage.setItem('player', JSON.stringify(d.user));
            window.location.reload();
        }
    };

    const handleDelete = async (id) => {
        if (id === myId || !confirm("Supprimer ?")) return;
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'subjects': 'subjects', 'students': 'students' };
        await fetch(`/api/admin/${map[view]}/${id}`, { method: 'DELETE' });
        loadData();
    };

    return (
        <div className="admin-container animate-in fade-in">
            {/* MODAL AFFECTATION */}
            {zoomItem && (
                <div className="zoom-overlay" onClick={() => setZoomItem(null)}>
                    <div className="zoom-card !max-w-[800px]" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black mb-6 uppercase">Affectations : {zoomItem.firstName}</h2>
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-[10px] font-black text-indigo-500 mb-3 border-b pb-2 uppercase tracking-widest">📚 Matières</h4>
                                <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {allSubjects.map(s => (
                                        <button key={s._id} onClick={() => handleToggleMapping(s._id, 'subject')} className={`w-full p-2 rounded-lg text-left text-[10px] font-black border transition-all ${zoomItem.taughtSubjects?.includes(s._id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-300'}`}>{s.name}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-emerald-500 mb-3 border-b pb-2 uppercase tracking-widest">🏫 Classes / Groupes</h4>
                                <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {allClasses.map(c => (
                                        <button key={c._id} onClick={() => handleToggleMapping(c._id, 'class')} className={`w-full p-2 rounded-lg text-left text-[10px] font-black border transition-all ${zoomItem.assignedClasses?.includes(c._id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-300'}`}>{c.name}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setZoomItem(null)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-xl uppercase text-xs">Fermer</button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-[30px] shadow-sm">
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {['classes', 'groups', 'subjects', 'teachers', 'students', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`admin-tab ${view === v ? 'active' : ''}`}>{v.toUpperCase()}</button>
                    ))}
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">
                    {showAddForm ? 'FERMER' : `+ AJOUTER`}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-10 p-10 bg-indigo-600 rounded-[45px] shadow-2xl text-white">
                    <form onSubmit={handleCreate} className="flex flex-wrap gap-6 items-end">
                        {view === 'subjects' ? (
                            <input className="admin-input !bg-white/10" placeholder="Nom Matière" value={fSubject.name} onChange={e=>setFSubject({...fSubject, name:e.target.value})} required />
                        ) : (view === 'classes' || view === 'groups') ? (
                            <input className="admin-input !bg-white/10" placeholder="Nom" value={fClass.name} onChange={e=>setFClass({...fClass, name:e.target.value})} required />
                        ) : (
                            <><input className="admin-input flex-1 !bg-white/10" placeholder="Prénom" value={fUser.firstName} onChange={e=>setFUser({...fUser, firstName:e.target.value})} required />
                            <input className="admin-input flex-1 !bg-white/10" placeholder="Nom" value={fUser.lastName} onChange={e=>setFUser({...fUser, lastName:e.target.value})} required /></>
                        )}
                        <button className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-xs shadow-2xl uppercase">Enregistrer 🚀</button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden min-h-[400px]">
                <table className="admin-table">
                    <tbody>
                        {items.map(it => {
                            const isMe = String(it._id) === String(myId);
                            const isTest = it.isTestAccount === true;
                            return (
                                <tr key={it._id} className={`border-t hover:bg-slate-50 transition-colors ${isTest ? 'bg-amber-50/30' : ''}`}>
                                    <td className="p-6">
                                        <div className="font-black text-slate-700 uppercase">{it.name || `${it.firstName} ${it.lastName}`}</div>
                                        <span className="text-[8px] font-black text-slate-300 uppercase">{it.type || it.role || 'PROFIL'}</span>
                                    </td>
                                    <td className="p-6">
                                        {view === 'subjects' && <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm" style={{background: it.color}}></div>}
                                        {view === 'teachers' && (
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {it.taughtSubjects?.map(id => <span key={id} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8px] font-black">{allSubjects.find(s=>s._id===id)?.name}</span>)}
                                                </div>
                                                <button onClick={() => setZoomItem(it)} className="text-[8px] font-black text-indigo-500 hover:underline">MODIFIER</button>
                                            </div>
                                        )}
                                        {view === 'students' && <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{allClasses.find(c => c._id === it.classId)?.name}</span>}
                                    </td>
                                    <td className="p-6 text-right flex justify-end gap-2">
                                        {(isTest || view === 'classes' || view === 'groups') && (
                                            <button onClick={() => handleTestSwitch(it, view === 'teachers' ? 'TEACHER' : (view === 'staff' ? 'ADMIN' : 'STUDENT'))} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[10px] hover:bg-emerald-600 transition-all shadow-md">🚀 TESTER</button>
                                        )}
                                        {!isMe && <button onClick={() => handleDelete(it._id)} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-100 transition-all">✕</button>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {loading && <div className="p-20 text-center text-indigo-500 font-black animate-pulse">Chargement...</div>}
            </div>
            <div className="fixed bottom-4 left-4 bg-indigo-600 text-white font-black text-[10px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V97</div>
        </div>
    );
}