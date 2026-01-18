import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Pour le dropdown des classes
    const [allClasses, setAllClasses] = useState([]);

    // Form states
    const [formClass, setFormClass] = useState({ name: '', type: 'CLASS' });
    const [formSubject, setFormSubject] = useState({ name: '', color: '#6366f1' });
    const [formUser, setFormUser] = useState({ firstName: '', lastName: '', password: '', role: 'admin' });
    const [formStudent, setFormStudent] = useState({ firstName: '', lastName: '', email: '', classId: '' });

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
            
            if (view !== 'classes') {
                const resClasses = await fetch('/api/admin/classrooms');
                if (resClasses.ok) setAllClasses(await resClasses.json());
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [view]);

    const safePost = async (url, body) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.json();
                alert("⚠️ " + (err.error || "Erreur inconnue"));
                return false;
            }
            return true;
        } catch (e) {
            alert("Erreur réseau");
            return false;
        }
    };

    const handleCreateClass = async (e) => {
        e.preventDefault();
        const success = await safePost('/api/admin/classrooms', formClass);
        if (success) {
            setFormClass({ name: '', type: 'CLASS' });
            loadData();
            onRefresh();
        }
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        const success = await safePost('/api/admin/subjects', formSubject);
        if (success) {
            setFormSubject({ name: '', color: '#6366f1' });
            loadData();
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const endpoint = view === 'teachers' ? 'teachers' : 'admins';
        const success = await safePost(`/api/admin/${endpoint}`, formUser);
        if (success) {
            setFormUser({ firstName: '', lastName: '', password: '', role: 'admin' });
            loadData();
        }
    };

    const handleCreateStudent = async (e) => {
        e.preventDefault();
        const success = await safePost('/api/admin/students', formStudent);
        if (success) {
            setFormStudent({ firstName: '', lastName: '', email: '', classId: '' });
            loadData();
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Supprimer définitivement ?")) return;
        const endpoint = getEndpoint(view);
        await fetch(`/api/admin/${endpoint}/${id}`, { method: 'DELETE' });
        loadData();
        if(view === 'classes') onRefresh();
    };

    const handleFixBug = async (id) => {
        await fetch(`/api/admin/bugs/${id}`, { method: 'PATCH' });
        loadData();
    };

    return (
        <div className="admin-container animate-in fade-in">
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
                {/* FORMULAIRE D'AJOUT (Sauf pour Bugs) */}
                {view !== 'bugs' && (
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-[30px] border shadow-sm sticky top-8">
                            <h3 className="font-black text-xs uppercase mb-6 text-slate-400">
                                {view === 'staff' ? 'CRÉER UN ADMINISTRATEUR' : `AJOUTER ${view}`}
                            </h3>
                            
                            {view === 'classes' && (
                                <form onSubmit={handleCreateClass} className="space-y-4">
                                    <input className="admin-input" placeholder="NOM DE LA CLASSE (Ex: 6B)" value={formClass.name} onChange={e => setFormClass({...formClass, name: e.target.value})} required />
                                    <select className="admin-input" value={formClass.type} onChange={e => setFormClass({...formClass, type: e.target.value})}>
                                        <option value="CLASS">CLASSE ADMINISTRATIVE</option>
                                        <option value="GROUP">GROUPE PÉDAGOGIQUE</option>
                                    </select>
                                    <button className="admin-btn-submit">CRÉER CLASSE</button>
                                </form>
                            )}

                            {view === 'subjects' && (
                                <form onSubmit={handleCreateSubject} className="space-y-4">
                                    <input className="admin-input" placeholder="NOM MATIÈRE (Ex: HISTOIRE)" value={formSubject.name} onChange={e => setFormSubject({...formSubject, name: e.target.value})} required />
                                    <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={formSubject.color} onChange={e => setFormSubject({...formSubject, color: e.target.value})} />
                                    <button className="admin-btn-submit">AJOUTER MATIÈRE</button>
                                </form>
                            )}

                            {view === 'students' && (
                                <form onSubmit={handleCreateStudent} className="space-y-4">
                                    <input className="admin-input" placeholder="Prénom" value={formStudent.firstName} onChange={e => setFormStudent({...formStudent, firstName: e.target.value})} required />
                                    <input className="admin-input" placeholder="Nom" value={formStudent.lastName} onChange={e => setFormStudent({...formStudent, lastName: e.target.value})} required />
                                    <input className="admin-input" placeholder="Email (Optionnel)" value={formStudent.email} onChange={e => setFormStudent({...formStudent, email: e.target.value})} />
                                    
                                    <select className="admin-input" value={formStudent.classId} onChange={e => setFormStudent({...formStudent, classId: e.target.value})} required>
                                        <option value="">-- CHOISIR CLASSE (OBLIGATOIRE) --</option>
                                        {(allClasses.length ? allClasses : items).map(c => (
                                            <option key={c._id} value={c._id}>{c.name}</option>
                                        ))}
                                    </select>

                                    <button className="admin-btn-submit">INSCRIRE ÉLÈVE</button>
                                </form>
                            )}

                            {(view === 'teachers' || view === 'staff') && (
                                <form onSubmit={handleCreateUser} className="space-y-4">
                                    <input className="admin-input" placeholder="Prénom" value={formUser.firstName} onChange={e => setFormUser({...formUser, firstName: e.target.value})} required />
                                    <input className="admin-input" placeholder="Nom" value={formUser.lastName} onChange={e => setFormUser({...formUser, lastName: e.target.value})} required />
                                    <input className="admin-input" type="password" placeholder="Mot de passe" value={formUser.password} onChange={e => setFormUser({...formUser, password: e.target.value})} required />
                                    {view === 'staff' && (
                                        <select className="admin-input" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}>
                                            <option value="admin">ADMINISTRATEUR (Accès Complet)</option>
                                            <option value="developer">DÉVELOPPEUR (Accès Technique)</option>
                                        </select>
                                    )}
                                    <button className="admin-btn-submit">
                                        {view === 'staff' ? 'CRÉER ADMIN' : 'CRÉER PROF'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* LISTE DES ÉLÉMENTS */}
                <div className={view === 'bugs' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden">
                        <table className="admin-table">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nom / Identité</th>
                                    <th className="p-4 text-[10px] font-black uppercase text-slate-400">Rôle / Détails</th>
                                    <th className="p-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="3" className="p-20 text-center font-black text-slate-300 animate-pulse">CHARGEMENT...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan="3" className="p-20 text-center font-black text-slate-300">AUCUNE DONNÉE</td></tr>
                                ) : items.map(it => (
                                    <tr key={it._id} className="border-t hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-black text-slate-700 uppercase">
                                                {it.name || `${it.firstName} ${it.lastName}`}
                                            </div>
                                            {view === 'subjects' && <div className="text-[10px] font-bold" style={{color: it.color}}>{it.color}</div>}
                                            {view === 'students' && <div className="text-[10px] text-slate-400">{it.email}</div>}
                                        </td>
                                        <td className="p-4">
                                            {view === 'classes' && <span className={`px-2 py-1 rounded text-[9px] font-black ${it.type === 'GROUP' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{it.type}</span>}
                                            {view === 'staff' && <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.role === 'developer' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>{it.role}</span>}
                                            {view === 'students' && <span className="px-2 py-1 rounded bg-orange-100 text-orange-600 text-[9px] font-black uppercase">{it.currentClass || 'AUCUNE'}</span>}
                                            {view === 'bugs' && (
                                                <div className="max-w-md">
                                                    <div className="text-xs font-bold text-slate-600 mb-1">{it.description}</div>
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.status === 'fixed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{it.status}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {view === 'bugs' && it.status === 'open' ? (
                                                <button onClick={() => handleFixBug(it._id)} className="text-emerald-500 font-black text-[10px] mr-4 uppercase">RÉSOLU ?</button>
                                            ) : null}
                                            <button onClick={() => handleDelete(it._id)} className="text-red-300 hover:text-red-500 font-black text-[10px] uppercase">Supprimer</button>
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