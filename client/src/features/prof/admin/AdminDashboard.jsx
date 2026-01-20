import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

/**
 * ⚙️ DASHBOARD ADMINISTRATEUR V59
 * Fix de la boucle de test : Création et Login immédiat.
 */
export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes'); 
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [zoomItem, setZoomItem] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    
    const [fClass, setFClass] = useState({ name: '', type: 'CLASS' });
    const [fStudent, setFStudent] = useState({ firstName: '', lastName: '', classId: '' });
    const [fUser, setFUser] = useState({ firstName: '', lastName: '', password: 'A' });

    const isSuperUser = user.firstName === 'Jean' && user.lastName === 'Vuillet';
    const myId = user.id || user._id;

    const loadData = async () => {
        setLoading(true);
        try {
            const resCls = await fetch(`/api/admin/classrooms`);
            const clsData = await resCls.json();
            setAllClasses(clsData);

            const resSt = await fetch(`/api/admin/students`);
            const stData = await resSt.json();
            setAllStudents(stData);

            if (view === 'classes') setItems(clsData.filter(c => c.type === 'CLASS'));
            else if (view === 'groups') setItems(clsData.filter(c => c.type === 'GROUP'));
            else {
                const map = { 'teachers': 'teachers', 'students': 'students', 'staff': 'admins' };
                const r = await fetch(`/api/admin/${map[view]}`);
                if (r.ok) setItems(await r.json());
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); setShowAddForm(false); }, [view]);

    // --- LOGIQUE DE TEST V59 : INSTANTANÉ ---
    const handleTestAsStudent = async (classItem) => {
        let testStudent = allStudents.find(s => String(s.classId) === String(classItem._id) && s.isTestAccount);
        
        // 1. Si l'élève manque, on le crée et on récupère son ID direct depuis le retour JSON
        if (!testStudent) {
            if (confirm(`Provisionner l'élève test pour ${classItem.name} et s'y connecter ?`)) {
                setLoading(true);
                try {
                    const res = await fetch('/api/admin/classrooms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(classItem)
                    });
                    const data = await res.json();
                    if (data.testStudent) {
                        testStudent = data.testStudent;
                    } else {
                        throw new Error("Échec création");
                    }
                } catch (e) {
                    alert("Erreur de provisionnement");
                    setLoading(false);
                    return;
                }
            } else return;
        }

        // 2. Connexion immédiate avec l'ID (qu'il vienne de la liste ou de la création fraîche)
        try {
            const resLogin = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ role: 'STUDENT', studentId: testStudent._id || testStudent.id })
            });
            const loginData = await resLogin.json();
            if (resLogin.ok) {
                localStorage.setItem('player', JSON.stringify(loginData.user));
                window.location.reload();
            }
        } catch (e) { alert("Erreur de connexion élève"); }
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        const map = { 'classes': 'classrooms', 'groups': 'classrooms', 'teachers': 'teachers', 'staff': 'admins', 'students': 'students' };
        let body = fUser;
        if (view === 'classes') body = fClass;
        if (view === 'groups') body = { ...fClass, type: 'GROUP' };
        if (view === 'students') body = fStudent;

        const res = await fetch(`/api/admin/${map[view]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (res.ok) { loadData(); setShowAddForm(false); onRefresh(); }
    };

    const handleToggleMapping = async (targetId) => {
        const current = zoomItem.associatedClasses || [];
        const next = current.includes(targetId) ? current.filter(id => id !== targetId) : [...current, targetId];
        const updated = { ...zoomItem, associatedClasses: next };
        setZoomItem(updated);
        await fetch('/api/admin/classrooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
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
            {zoomItem && (
                <div className="zoom-overlay" onClick={() => setZoomItem(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black mb-6 uppercase">Lier le Groupe : {zoomItem.name}</h2>
                        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
                            {allClasses.filter(c => c.type === 'CLASS').map(c => {
                                const isLinked = zoomItem.associatedClasses?.includes(c._id);
                                return (
                                    <button key={c._id} onClick={() => handleToggleMapping(c._id)} className={`p-3 rounded-xl border-2 text-[10px] font-black transition-all ${isLinked ? 'border-indigo-500 bg-indigo-50 text-indigo-600 shadow-md' : 'border-slate-100 text-slate-300'}`}>
                                        {c.name}
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setZoomItem(null)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl uppercase text-xs">Terminer</button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-[30px] shadow-sm">
                <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {['classes', 'groups', 'students', 'teachers', 'staff'].map(v => (
                        <button key={v} onClick={() => setView(v)} className={`admin-tab ${view === v ? 'active' : ''}`}>
                            {v === 'classes' ? '🏫 CLASSES' : v === 'groups' ? '👥 GROUPES' : v === 'students' ? '👨‍🎓 ÉLÈVES' : v === 'teachers' ? '👨‍🏫 PROFS' : '🛡️ DIRECTION'}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase shadow-lg">
                    {showAddForm ? 'FERMER' : `+ AJOUTER`}
                </button>
            </div>

            {showAddForm && (
                <div className="mb-10 p-10 bg-indigo-600 rounded-[45px] shadow-2xl animate-in slide-in-from-top-4 text-white">
                    <form onSubmit={handleCreate} className="flex flex-wrap gap-6 items-end">
                        {(view === 'classes' || view === 'groups') && (
                            <div className="flex-1 min-w-[200px]"><label className="v1-label-mini !text-indigo-200">Nom</label><input className="admin-input !bg-white/10" value={fClass.name} onChange={e=>setFClass({...fClass, name:e.target.value})} required /></div>
                        )}
                        {view === 'students' && (
                            <>
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Prénom" value={fStudent.firstName} onChange={e=>setFStudent({...fStudent, firstName:e.target.value})} required />
                                <input className="admin-input flex-1 !bg-white/10" placeholder="Nom" value={fStudent.lastName} onChange={e=>setFStudent({...fStudent, lastName:e.target.value})} required />
                                <select className="admin-input w-[200px] !bg-white/10" value={fStudent.classId} onChange={e=>setFStudent({...fStudent, classId:e.target.value})} required>
                                    <option value="">-- CLASSE MAISON --</option>
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
                        <button className="bg-white text-indigo-600 px-10 py-4 rounded-2xl font-black text-xs shadow-2xl uppercase">CRÉER & PROVISIONNER DRIVE 🚀</button>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
                <table className="admin-table">
                    <tbody>
                        {items.map(it => (
                            <tr key={it._id} className="border-t hover:bg-slate-50 transition-colors">
                                <td className="p-6">
                                    <div className="font-black text-slate-700 uppercase">{it.name || `${it.firstName} ${it.lastName}`}</div>
                                    <span className="text-[8px] font-black text-slate-300 uppercase">{it.type || it.role || 'PROFIL'}</span>
                                </td>
                                <td className="p-6">
                                    {view === 'groups' && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-wrap gap-1">
                                                {it.associatedClasses?.map(id => <span key={id} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8px] font-black border border-indigo-100">{allClasses.find(c => c._id === id)?.name}</span>)}
                                            </div>
                                            <button onClick={() => setZoomItem(it)} className="text-[8px] font-black text-indigo-500 hover:underline">+ LIER CLASSES</button>
                                        </div>
                                    )}
                                    {view === 'students' && <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{allClasses.find(c => c._id === it.classId)?.name}</span>}
                                    {view === 'classes' && <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unité Administrative</span>}
                                </td>
                                <td className="p-6 text-right">
                                    <div className="flex justify-end gap-2">
                                        {user.isDeveloper && (view === 'classes' || view === 'groups') && (
                                            <button onClick={() => handleTestAsStudent(it)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-[10px] hover:bg-emerald-600 transition-all shadow-md active:scale-95">
                                                🚀 TESTER
                                            </button>
                                        )}
                                        {String(it._id) !== String(myId) && (
                                            <button onClick={() => handleDelete(it._id)} className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all">✕</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="fixed bottom-4 left-4 bg-indigo-600 text-white font-black text-[10px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V59</div>
        </div>
    );
}