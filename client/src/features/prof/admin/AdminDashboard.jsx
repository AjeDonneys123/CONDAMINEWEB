import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [editingId, setEditingId] = useState(null);
    const [zoomedItem, setZoomedItem] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);

    const [formClass, setFormClass] = useState({ name: '', type: 'CLASS' });
    const [formSubject, setFormSubject] = useState({ name: '', color: '#6366f1' });
    const [formUser, setFormUser] = useState({ firstName: '', lastName: '', password: '', role: 'admin', taughtSubjects: [], assignedClasses: [] });
    const [formStudent, setFormStudent] = useState({ firstName: '', lastName: '', fullName: '', email: '', classId: '', birthDate: '', gender: '' });

    const getEndpoint = (v) => {
        if (v === 'classes') return 'classrooms';
        if (v === 'staff') return 'admins';
        if (v === 'students') return 'students';
        return v;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const endpoint = getEndpoint(view);
            const res = await fetch(`/api/admin/${endpoint}`);
            if (res.ok) setItems(await res.json());
            
            if (view === 'students' || view === 'teachers') {
                const resClasses = await fetch('/api/admin/classrooms');
                if (resClasses.ok) setAllClasses(await resClasses.json());
            }
            
            if (view === 'teachers') {
                const resSubjects = await fetch('/api/admin/subjects');
                if (resSubjects.ok) setAllSubjects(await resSubjects.json());
            }

        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { 
        loadData(); 
        cancelEdit(); 
        setZoomedItem(null);
    }, [view]);

    // --- LOGIQUE D'ÉDITION ---
    const startEdit = (item) => {
        setEditingId(item._id);
        if (view === 'classes') setFormClass({ name: item.name, type: item.type });
        if (view === 'subjects') setFormSubject({ name: item.name, color: item.color });
        if (view === 'teachers') {
            setFormUser({ 
                firstName: item.firstName, 
                lastName: item.lastName, 
                password: item.password, 
                role: 'admin',
                taughtSubjects: item.taughtSubjects || [],
                assignedClasses: item.assignedClasses || []
            });
        }
        if (view === 'staff') setFormUser({ firstName: item.firstName, lastName: item.lastName, password: item.password, role: item.role || 'admin' });
        
        if (view === 'students') {
            setFormStudent({ 
                firstName: item.firstName, 
                lastName: item.lastName,
                fullName: item.fullName || '',
                email: item.email || '', 
                classId: item.classId || '',
                birthDate: item.birthDate ? item.birthDate.split('T')[0] : '',
                gender: item.gender || ''
            });
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormClass({ name: '', type: 'CLASS' });
        setFormSubject({ name: '', color: '#6366f1' });
        setFormUser({ firstName: '', lastName: '', password: '', role: 'admin', taughtSubjects: [], assignedClasses: [] });
        setFormStudent({ firstName: '', lastName: '', fullName: '', email: '', classId: '', birthDate: '', gender: '' });
    };

    const toggleSubject = (subId) => {
        const current = formUser.taughtSubjects || [];
        setFormUser({ ...formUser, taughtSubjects: current.includes(subId) ? current.filter(id => id !== subId) : [...current, subId] });
    };

    const toggleClass = (clsId) => {
        const current = formUser.assignedClasses || [];
        setFormUser({ ...formUser, assignedClasses: current.includes(clsId) ? current.filter(id => id !== clsId) : [...current, clsId] });
    };

    // --- GESTIONNAIRE DE REQUÊTES ---
    const submitData = async (endpointBase, body) => {
        try {
            const method = editingId ? 'PATCH' : 'POST';
            const url = editingId ? `${endpointBase}/${editingId}` : endpointBase;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) {
                const err = await res.json();
                alert("⚠️ " + (err.error || "Erreur inconnue"));
                return false;
            }
            return true;
        } catch (e) { return false; }
    };

    // --- HANDLERS ---
    const handleClassSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/classrooms', formClass)) { cancelEdit(); loadData(); onRefresh(); }};
    const handleSubjectSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/subjects', formSubject)) { cancelEdit(); loadData(); }};
    const handleUserSubmit = async (e) => { e.preventDefault(); const ep = view === 'teachers' ? '/api/admin/teachers' : '/api/admin/admins'; if (await submitData(ep, formUser)) { cancelEdit(); loadData(); }};
    const handleStudentSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/students', formStudent)) { cancelEdit(); loadData(); }};
    const handleDelete = async (id) => { if (confirm("Supprimer ?")) { await fetch(`/api/admin/${getEndpoint(view)}/${id}`, { method: 'DELETE' }); loadData(); if(view==='classes') onRefresh(); }};
    const handleFixBug = async (id) => { await fetch(`/api/admin/bugs/${id}`, { method: 'PATCH' }); loadData(); };

    return (
        <div className="admin-container animate-in fade-in">
            {/* OVERLAY ZOOM */}
            {zoomedItem && (
                <div className="zoom-overlay" onClick={() => setZoomedItem(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        
                        {/* ZOOM TEACHER */}
                        {view === 'teachers' && (
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-20 h-20 bg-indigo-100 rounded-full mx-auto flex items-center justify-center text-3xl mb-4">🎓</div>
                                    <h2 className="text-2xl font-black uppercase text-slate-800">{zoomedItem.firstName} {zoomedItem.lastName}</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Fiche Enseignant</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b pb-2">Matières</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {zoomedItem.taughtSubjects && zoomedItem.taughtSubjects.length > 0 ? zoomedItem.taughtSubjects.map(subId => {
                                                const sub = allSubjects.find(s => s._id === subId);
                                                return sub ? <span key={sub._id} className="px-3 py-1 rounded-lg text-xs font-bold text-white shadow-sm" style={{backgroundColor: sub.color}}>{sub.name}</span> : null;
                                            }) : <span className="text-xs text-slate-400 italic">Aucune</span>}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-2xl">
                                        <h4 className="text-[10px] font-black uppercase text-blue-400 mb-2 border-b border-blue-200 pb-2">Classes Assignées</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {zoomedItem.assignedClasses && zoomedItem.assignedClasses.length > 0 ? zoomedItem.assignedClasses.map(clsId => {
                                                const cls = allClasses.find(c => c._id === clsId);
                                                return cls ? <span key={cls._id} className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-500 text-white shadow-sm">{cls.name}</span> : null;
                                            }) : <span className="text-xs text-blue-400 italic">Aucune</span>}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ZOOM STUDENT */}
                        {view === 'students' && (
                            <>
                                <div className="text-center mb-6">
                                    <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl mb-4 ${zoomedItem.gender === 'F' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                                        {zoomedItem.gender === 'F' ? '👧' : '👦'}
                                    </div>
                                    <h2 className="text-2xl font-black uppercase text-slate-800">{zoomedItem.firstName} {zoomedItem.lastName}</h2>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{zoomedItem.fullName || "Nom complet non renseigné"}</p>
                                    <div className="mt-3">
                                        <span className="px-4 py-1 bg-orange-500 text-white rounded-full text-xs font-black shadow-md">
                                            {zoomedItem.currentClass || "AUCUNE CLASSE"}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl space-y-3 text-left">
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Email</span>
                                        <span className="text-xs font-black text-slate-700">{zoomedItem.email || "-"}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Naissance</span>
                                        <span className="text-xs font-black text-slate-700">
                                            {zoomedItem.birthDate ? new Date(zoomedItem.birthDate).toLocaleDateString() : "-"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Sexe</span>
                                        <span className="text-xs font-black text-slate-700">
                                            {zoomedItem.gender === 'M' ? 'GARÇON' : (zoomedItem.gender === 'F' ? 'FILLE' : '-')}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pt-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Dernière Connexion</span>
                                        <span className="text-xs font-black text-slate-700">
                                            {zoomedItem.lastLogin ? new Date(zoomedItem.lastLogin).toLocaleDateString() : "Jamais"}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}

                        <button onClick={() => setZoomedItem(null)} className="w-full py-3 mt-6 rounded-xl bg-slate-800 text-white font-black text-xs uppercase">Fermer</button>
                    </div>
                </div>
            )}

            {/* NAVIGATION TABS */}
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl mb-8 w-fit overflow-x-auto no-scrollbar">
                <button onClick={() => setView('classes')} className={`admin-tab ${view === 'classes' ? 'active' : ''}`}>🏫 CLASSES</button>
                <button onClick={() => setView('subjects')} className={`admin-tab ${view === 'subjects' ? 'active' : ''}`}>📚 MATIÈRES</button>
                <button onClick={() => setView('students')} className={`admin-tab ${view === 'students' ? 'active' : ''}`}>👥 ÉLÈVES</button>
                <button onClick={() => setView('teachers')} className={`admin-tab ${view === 'teachers' ? 'active' : ''}`}>👨‍🏫 PROFS</button>
                <button onClick={() => setView('staff')} className={`admin-tab ${view === 'staff' ? 'active' : ''}`}>🛡️ ADMINS</button>
                <button onClick={() => setView('bugs')} className={`admin-tab ${view === 'bugs' ? 'active' : ''}`}>🪲 BUGS</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FORMULAIRE */}
                {view !== 'bugs' && (
                    <div className="lg:col-span-1">
                        <div className={`p-6 rounded-[30px] border shadow-sm sticky top-8 transition-colors ${editingId ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`font-black text-xs uppercase ${editingId ? 'text-amber-600' : 'text-slate-400'}`}>{editingId ? '✏️ MODIFICATION' : `AJOUTER ${view}`}</h3>
                                {editingId && <button onClick={cancelEdit} className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border">ANNULER</button>}
                            </div>
                            
                            {view === 'classes' && <form onSubmit={handleClassSubmit} className="space-y-4">
                                <input className="admin-input" placeholder="NOM DE LA CLASSE" value={formClass.name} onChange={e => setFormClass({...formClass, name: e.target.value})} required />
                                <select className="admin-input" value={formClass.type} onChange={e => setFormClass({...formClass, type: e.target.value})}><option value="CLASS">CLASSE ADMINISTRATIVE</option><option value="GROUP">GROUPE PÉDAGOGIQUE</option></select>
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'CRÉER CLASSE'}</button>
                            </form>}

                            {view === 'subjects' && <form onSubmit={handleSubjectSubmit} className="space-y-4">
                                <input className="admin-input" placeholder="NOM MATIÈRE" value={formSubject.name} onChange={e => setFormSubject({...formSubject, name: e.target.value})} required />
                                <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={formSubject.color} onChange={e => setFormSubject({...formSubject, color: e.target.value})} />
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'AJOUTER MATIÈRE'}</button>
                            </form>}

                            {view === 'students' && <form onSubmit={handleStudentSubmit} className="space-y-4">
                                <div className="flex gap-2">
                                    <input className="admin-input" placeholder="Prénom" value={formStudent.firstName} onChange={e => setFormStudent({...formStudent, firstName: e.target.value})} required />
                                    <input className="admin-input" placeholder="Nom" value={formStudent.lastName} onChange={e => setFormStudent({...formStudent, lastName: e.target.value})} required />
                                </div>
                                <input className="admin-input" placeholder="Nom Complet (Optionnel)" value={formStudent.fullName} onChange={e => setFormStudent({...formStudent, fullName: e.target.value})} />
                                <input className="admin-input" placeholder="Email" value={formStudent.email} onChange={e => setFormStudent({...formStudent, email: e.target.value})} />
                                
                                <div className="flex gap-2">
                                    <input type="date" className="admin-input" value={formStudent.birthDate} onChange={e => setFormStudent({...formStudent, birthDate: e.target.value})} />
                                    <select className="admin-input w-1/3" value={formStudent.gender} onChange={e => setFormStudent({...formStudent, gender: e.target.value})}>
                                        <option value="">Sexe</option>
                                        <option value="M">Garçon</option>
                                        <option value="F">Fille</option>
                                    </select>
                                </div>

                                <select className="admin-input" value={formStudent.classId} onChange={e => setFormStudent({...formStudent, classId: e.target.value})} required>
                                    <option value="">-- CLASSE --</option>
                                    {allClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'INSCRIRE ÉLÈVE'}</button>
                            </form>}

                            {(view === 'teachers' || view === 'staff') && <form onSubmit={handleUserSubmit} className="space-y-4">
                                <input className="admin-input" placeholder="Prénom" value={formUser.firstName} onChange={e => setFormUser({...formUser, firstName: e.target.value})} required />
                                <input className="admin-input" placeholder="Nom" value={formUser.lastName} onChange={e => setFormUser({...formUser, lastName: e.target.value})} required />
                                <input className="admin-input" type="password" placeholder="Mot de passe" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} required />
                                
                                {view === 'teachers' && (
                                    <>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Matières :</label>
                                            <div className="flex flex-wrap gap-2">
                                                {allSubjects.map(s => (
                                                    <button type="button" key={s._id} onClick={() => toggleSubject(s._id)} className={`px-2 py-1 rounded text-[9px] font-bold border ${formUser.taughtSubjects.includes(s._id) ? 'text-white' : 'bg-white text-slate-400'}`} style={{backgroundColor: formUser.taughtSubjects.includes(s._id) ? s.color : 'white', borderColor: s.color}}>{s.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-xl border border-dashed border-blue-200">
                                            <label className="text-[10px] font-black uppercase text-blue-400 mb-2 block">Classes :</label>
                                            <div className="flex flex-wrap gap-2">
                                                {allClasses.map(c => (
                                                    <button type="button" key={c._id} onClick={() => toggleClass(c._id)} className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${formUser.assignedClasses.includes(c._id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-300 border-blue-200'}`}>{c.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {view === 'staff' && <select className="admin-input" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}><option value="admin">ADMINISTRATEUR</option><option value="developer">DÉVELOPPEUR</option></select>}
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'CRÉER COMPTE'}</button>
                            </form>}
                        </div>
                    </div>
                )}

                {/* LISTE */}
                <div className={view === 'bugs' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden">
                        <table className="admin-table">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nom / Identité</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-slate-400">Rôle / Détails</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(it => (
                                    <tr key={it._id} className={`border-t transition-colors ${editingId === it._id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                                        <td className="p-4">
                                            <div className="font-black text-slate-700 uppercase">
                                                {it.fullName || it.name || `${it.firstName} ${it.lastName}`}
                                            </div>
                                            {view === 'subjects' && <div className="text-[10px] font-bold" style={{color: it.color}}>{it.color}</div>}
                                            {view === 'students' && (
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-[10px] text-slate-400">{it.email}</div>
                                                    {it.gender && <span className={`text-[9px] font-bold px-1 rounded w-fit ${it.gender === 'M' ? 'text-blue-500 bg-blue-50' : 'text-pink-500 bg-pink-50'}`}>{it.gender === 'M' ? 'GARÇON' : 'FILLE'}</span>}
                                                </div>
                                            )}
                                            
                                            {view === 'teachers' && it.taughtSubjects && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {it.taughtSubjects.map(subId => {
                                                        const sub = allSubjects.find(s => s._id === subId);
                                                        return sub ? <span key={sub._id} className="w-2 h-2 rounded-full" style={{backgroundColor: sub.color}}></span> : null;
                                                    })}
                                                    {it.assignedClasses && it.assignedClasses.length > 0 && <span className="text-[9px] font-bold text-blue-400 ml-1">+{it.assignedClasses.length} Cls</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {view === 'classes' && <span className={`px-2 py-1 rounded text-[9px] font-black ${it.type === 'GROUP' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{it.type}</span>}
                                            {view === 'staff' && <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.role === 'developer' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>{it.role}</span>}
                                            {view === 'students' && <span className="px-2 py-1 rounded bg-orange-100 text-orange-600 text-[9px] font-black uppercase">{it.currentClass || 'AUCUNE'}</span>}
                                            {view === 'bugs' && <div className="max-w-md"><div className="text-xs font-bold text-slate-600 mb-1">{it.description}</div><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.status === 'fixed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{it.status}</span></div>}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            {view === 'bugs' && it.status === 'open' && <button onClick={() => handleFixBug(it._id)} className="text-emerald-500 font-black text-[10px] uppercase">RÉSOLU ?</button>}
                                            
                                            {(view === 'teachers' || view === 'students') && (
                                                <button onClick={() => setZoomedItem(it)} className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold hover:bg-teal-100">🔍</button>
                                            )}

                                            {view !== 'bugs' && (
                                                <button onClick={() => startEdit(it)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold hover:bg-indigo-100">✎</button>
                                            )}
                                            <button onClick={() => handleDelete(it._id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center font-bold hover:bg-red-100">✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}