import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // --- ÉTATS IMPORT IA ---
    const [showImportModal, setShowImportModal] = useState(false);
    const [importType, setImportType] = useState('students'); 
    const [importText, setImportText] = useState("");
    const [importClassId, setImportClassId] = useState("");
    const [analyzedData, setAnalyzedData] = useState(null);
    const [importing, setImporting] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [zoomedItem, setZoomedItem] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);

    const [formClass, setFormClass] = useState({ name: '', type: 'CLASS' });
    const [formSubject, setFormSubject] = useState({ name: '', color: '#6366f1' });
    const [formUser, setFormUser] = useState({ firstName: '', lastName: '', password: '', role: 'admin', taughtSubjects: [], assignedClasses: [] });
    const [formStudent, setFormStudent] = useState({ firstName: '', lastName: '', fullName: '', email: '', classId: '', birthDate: '', gender: '' });

    // --- [NOUVEAU] LOGIQUE DE BASCULE RAPIDE (SHORTCUTS) ---
    const handleQuickSwitch = async (targetRole) => {
        let credentials = {};
        
        try {
            if (targetRole === 'JEAN') {
                credentials = { role: 'ADMIN', firstName: 'Jean', lastName: 'Vuillet', password: 'Clemenceau1919' };
            }
            else if (targetRole === 'ADMIN_TEST') {
                // On s'assure que le compte existe ou on tente le login direct via backdoor
                credentials = { role: 'ADMIN', firstName: 'Admin', lastName: 'Test', password: 'A' };
            }
            else if (targetRole === 'PROF_TEST') {
                credentials = { role: 'TEACHER', firstName: 'Prof', lastName: 'Test', password: 'A' };
            }
            else if (targetRole === 'ELEVE_TEST') {
                // Pour l'élève, on doit trouver son ID réel
                // On cherche "Eleve TEST" ou on prend le premier élève trouvé pour tester
                const res = await fetch('/api/admin/students');
                const students = await res.json();
                
                // Priorité à "Eleve Test", sinon le premier
                let targetStudent = students.find(s => s.firstName.toLowerCase() === 'eleve' && s.lastName.toLowerCase() === 'test');
                
                if (!targetStudent) {
                    // Création à la volée si inexistant pour faciliter la vie
                    if(confirm("Compte 'Eleve Test' introuvable. Voulez-vous utiliser le premier élève de la liste ?")) {
                         targetStudent = students[0];
                    } else return;
                }

                if (!targetStudent) return alert("Aucun élève dans la base.");
                credentials = { role: 'STUDENT', studentId: targetStudent._id };
            }

            // Exécution du Login
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(credentials)
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('player', JSON.stringify(data.user));
                window.location.reload(); // Rechargement pour basculer l'interface
            } else {
                alert("Erreur switch : " + data.message);
                // Si le compte n'existe pas, on propose de le créer
                if (targetRole === 'ADMIN_TEST' || targetRole === 'PROF_TEST') {
                    if(confirm(`Le compte ${targetRole} n'existe pas. Le créer ?`)) {
                        const ep = targetRole === 'PROF_TEST' ? '/api/admin/teachers' : '/api/admin/admins';
                        await fetch(ep, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                firstName: targetRole === 'PROF_TEST' ? 'Prof' : 'Admin',
                                lastName: 'Test',
                                password: 'A',
                                role: targetRole === 'PROF_TEST' ? undefined : 'admin'
                            })
                        });
                        handleQuickSwitch(targetRole); // On réessaie
                    }
                }
            }
        } catch (e) {
            console.error(e);
            alert("Erreur technique lors du switch.");
        }
    };

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
            
            const resClasses = await fetch('/api/admin/classrooms');
            if (resClasses.ok) setAllClasses(await resClasses.json());
            
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

    // ... (Logique Import inchangée) ...
    const openImportModal = (type) => {
        setImportType(type);
        setImportText("");
        setAnalyzedData(null);
        setShowImportModal(true);
    };
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => { setImportText(evt.target.result); };
        reader.readAsText(file);
        e.target.value = '';
    };
    const handleAnalyzeImport = async () => {
        if (!importText) return alert("Texte requis");
        if (importType === 'students' && !importClassId) return alert("Classe cible requise");
        setImporting(true);
        try {
            const res = await fetch('/api/admin/import/analyze', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ text: importText, type: importType })
            });
            const data = await res.json();
            setAnalyzedData(data);
        } catch(e) { alert("Erreur analyse IA"); }
        setImporting(false);
    };
    const handleExecuteImport = async () => {
        setImporting(true);
        try {
            const res = await fetch('/api/admin/import/execute', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ type: importType, classId: importClassId, data: analyzedData })
            });
            const report = await res.json();
            alert(`Import terminé : ${report.added} ajoutés, ${report.updated} mis à jour.`);
            setShowImportModal(false);
            setAnalyzedData(null);
            setImportText("");
            loadData();
            if(importType === 'classes') onRefresh(); 
        } catch(e) { alert("Erreur import"); }
        setImporting(false);
    };

    // ... (Logique Edit inchangée) ...
    const startEdit = (item) => {
        setEditingId(item._id);
        if (view === 'classes') setFormClass({ name: item.name, type: item.type });
        if (view === 'subjects') setFormSubject({ name: item.name, color: item.color });
        if (view === 'teachers') {
            setFormUser({ firstName: item.firstName, lastName: item.lastName, password: item.password, role: 'admin', taughtSubjects: item.taughtSubjects || [], assignedClasses: item.assignedClasses || [] });
        }
        if (view === 'staff') setFormUser({ firstName: item.firstName, lastName: item.lastName, password: item.password, role: item.role || 'admin' });
        if (view === 'students') {
            setFormStudent({ firstName: item.firstName, lastName: item.lastName, fullName: item.fullName || '', email: item.email || '', classId: item.classId || '', birthDate: item.birthDate ? item.birthDate.split('T')[0] : '', gender: item.gender || '' });
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
    const submitData = async (endpointBase, body) => {
        try {
            const method = editingId ? 'PATCH' : 'POST';
            const url = editingId ? `${endpointBase}/${editingId}` : endpointBase;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!res.ok) { const err = await res.json(); alert("⚠️ " + (err.error || "Erreur")); return false; }
            return true;
        } catch (e) { return false; }
    };

    const handleClassSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/classrooms', formClass)) { cancelEdit(); loadData(); onRefresh(); }};
    const handleSubjectSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/subjects', formSubject)) { cancelEdit(); loadData(); }};
    const handleUserSubmit = async (e) => { e.preventDefault(); const ep = view === 'teachers' ? '/api/admin/teachers' : '/api/admin/admins'; if (await submitData(ep, formUser)) { cancelEdit(); loadData(); }};
    const handleStudentSubmit = async (e) => { e.preventDefault(); if (await submitData('/api/admin/students', formStudent)) { cancelEdit(); loadData(); }};
    const handleDelete = async (id) => { if (confirm("Supprimer ?")) { await fetch(`/api/admin/${getEndpoint(view)}/${id}`, { method: 'DELETE' }); loadData(); if(view==='classes') onRefresh(); }};
    const handleFixBug = async (id) => { await fetch(`/api/admin/bugs/${id}`, { method: 'PATCH' }); loadData(); };

    return (
        <div className="admin-container animate-in fade-in">
            {/* [NOUVEAU] BARRE DEVOPS QUICK SWITCH */}
            {user.isDeveloper && (
                <div className="dev-shortcuts">
                    <span className="dev-label">🚀 SWITCH RAPIDE :</span>
                    <button onClick={() => handleQuickSwitch('JEAN')} className="btn-shortcut sc-jean">🦸‍♂️ JEAN (DEV)</button>
                    <div className="w-[1px] h-[20px] bg-slate-600 mx-2"></div>
                    <button onClick={() => handleQuickSwitch('ADMIN_TEST')} className="btn-shortcut sc-admin">🛡️ ADMIN TEST</button>
                    <button onClick={() => handleQuickSwitch('PROF_TEST')} className="btn-shortcut sc-prof">👨‍🏫 PROF TEST</button>
                    <button onClick={() => handleQuickSwitch('ELEVE_TEST')} className="btn-shortcut sc-eleve">👦 ÉLÈVE TEST</button>
                </div>
            )}

            {/* OVERLAY IMPORT IA (Inchangé) */}
            {showImportModal && (
                <div className="zoom-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="zoom-card w-[600px] max-w-full" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black text-indigo-600 mb-4">
                            IMPORTATION IA : {importType === 'students' ? 'ÉLÈVES' : 'CLASSES'}
                        </h2>
                        {!analyzedData ? (
                            <div className="space-y-4">
                                {importType === 'students' && (
                                    <select className="admin-input" value={importClassId} onChange={e => setImportClassId(e.target.value)}>
                                        <option value="">-- CHOISIR CLASSE CIBLE --</option>
                                        {allClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                )}
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase">Données brutes ou CSV</label>
                                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1">
                                        <span>📁 CHARGER CSV</span>
                                        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                </div>
                                <textarea 
                                    className="w-full h-40 p-3 rounded-xl border-2 border-slate-200 text-xs font-mono"
                                    placeholder={importType === 'students' ? "Collez la liste ou chargez un CSV..." : "Collez les classes (6A, 6B...) ou chargez un CSV"}
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                />
                                <button onClick={handleAnalyzeImport} disabled={importing} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg">
                                    {importing ? "ANALYSE..." : "DÉCHIFFRER 🤖"}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                        {importType === 'students' ? (
                                            <>
                                                <thead><tr className="text-left text-slate-400"><th>Nom</th><th>Email</th></tr></thead>
                                                <tbody>{analyzedData.map((s, i) => <tr key={i}><td className="py-2 font-bold">{s.firstName} {s.lastName}</td><td className="py-2">{s.email}</td></tr>)}</tbody>
                                            </>
                                        ) : (
                                            <>
                                                <thead><tr className="text-left text-slate-400"><th>Classe</th><th>Type</th></tr></thead>
                                                <tbody>{analyzedData.map((c, i) => <tr key={i}><td className="py-2 font-bold">{c.name}</td><td className="py-2">{c.type}</td></tr>)}</tbody>
                                            </>
                                        )}
                                    </table>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAnalyzedData(null)} className="flex-1 py-3 bg-slate-200 text-slate-600 rounded-xl font-bold">RETOUR</button>
                                    <button onClick={handleExecuteImport} disabled={importing} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black shadow-lg">
                                        {importing ? "IMPORTATION..." : "VALIDER ✅"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ZOOM OVERLAY (Inchangé) */}
            {zoomedItem && (
                <div className="zoom-overlay" onClick={() => setZoomedItem(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black uppercase text-slate-800 mb-4">{zoomedItem.firstName} {zoomedItem.lastName}</h2>
                        {view === 'students' && (
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>📧 {zoomedItem.email}</p>
                                <p>🏫 {zoomedItem.currentClass}</p>
                            </div>
                        )}
                        {view === 'teachers' && (
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>📚 {zoomedItem.taughtSubjects?.length || 0} Matières</p>
                                <p>🎓 {zoomedItem.assignedClasses?.length || 0} Classes</p>
                            </div>
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
                {/* FORMULAIRE (Inchangé) */}
                {view !== 'bugs' && (
                    <div className="lg:col-span-1">
                        <div className={`p-6 rounded-[30px] border shadow-sm sticky top-8 transition-colors ${editingId ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className={`font-black text-xs uppercase ${editingId ? 'text-amber-600' : 'text-slate-400'}`}>{editingId ? '✏️ MODIFICATION' : `AJOUTER ${view}`}</h3>
                                {view === 'students' && !editingId && (
                                    <button onClick={() => openImportModal('students')} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-md hover:bg-indigo-500 animate-pulse">✨ IMPORT ÉLÈVES</button>
                                )}
                                {view === 'classes' && !editingId && (
                                    <button onClick={() => openImportModal('classes')} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-md hover:bg-emerald-500 animate-pulse">✨ IMPORT CLASSES</button>
                                )}
                                {editingId && <button onClick={cancelEdit} className="text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded border">ANNULER</button>}
                            </div>
                            
                            {view === 'classes' && <form onSubmit={handleClassSubmit} className="space-y-4">
                                <input className="admin-input" placeholder="NOM DE LA CLASSE" value={formClass.name} onChange={e => setFormClass({...formClass, name: e.target.value})} required />
                                <select className="admin-input" value={formClass.type} onChange={e => setFormClass({...formClass, type: e.target.value})}><option value="CLASS">CLASSE ADMINISTRATIVE</option><option value="GROUP">GROUPE PÉDAGOGIQUE</option></select>
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'CRÉER CLASSE'}</button>
                            </form>}
                            {/* ... Reste des formulaires identiques ... */}
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
                                {view === 'staff' && <select className="admin-input" value={formUser.role} onChange={e => setFormUser({...formUser, role: e.target.value})}><option value="admin">ADMINISTRATEUR</option><option value="developer">DÉVELOPPEUR</option></select>}
                                <button className={`admin-btn-submit ${editingId ? 'bg-amber-500' : ''}`}>{editingId ? 'METTRE À JOUR' : 'CRÉER COMPTE'}</button>
                            </form>}
                        </div>
                    </div>
                )}

                {/* LISTE (Inchangée) */}
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
                                            {view === 'students' && <div className="text-[10px] text-slate-400">{it.email}</div>}
                                        </td>
                                        <td className="p-4">
                                            {view === 'classes' && <span className={`px-2 py-1 rounded text-[9px] font-black ${it.type === 'GROUP' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{it.type}</span>}
                                            {view === 'staff' && <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.role === 'developer' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>{it.role}</span>}
                                            {view === 'students' && <span className="px-2 py-1 rounded bg-orange-100 text-orange-600 text-[9px] font-black uppercase">{it.currentClass || 'AUCUNE'}</span>}
                                            {view === 'bugs' && <div className="max-w-md"><div className="text-xs font-bold text-slate-600 mb-1">{it.description}</div><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.status === 'fixed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{it.status}</span></div>}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            {view === 'bugs' && it.status === 'open' && <button onClick={() => handleFixBug(it._id)} className="text-emerald-500 font-black text-[10px] uppercase">RÉSOLU ?</button>}
                                            {(view === 'teachers' || view === 'students') && <button onClick={() => setZoomedItem(it)} className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold hover:bg-teal-100">🔍</button>}
                                            {view !== 'bugs' && <button onClick={() => startEdit(it)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold hover:bg-indigo-100">✎</button>}
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