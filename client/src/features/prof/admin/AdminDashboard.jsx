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

    // --- ÉTAT POUR LISTE ÉLÈVES D'UNE CLASSE ---
    const [viewingClassRoster, setViewingClassRoster] = useState(null);

    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);

    const [formClass, setFormClass] = useState({ name: '', type: 'CLASS' });
    const [formSubject, setFormSubject] = useState({ name: '', color: '#6366f1' });
    const [formUser, setFormUser] = useState({ firstName: '', lastName: '', password: '', role: 'admin', taughtSubjects: [], assignedClasses: [] });
    const [formStudent, setFormStudent] = useState({ firstName: '', lastName: '', fullName: '', email: '', classId: '', birthDate: '', gender: '' });

    // --- LOGIQUE DE BASCULE RAPIDE (SHORTCUTS) ---
    const handleQuickSwitch = async (targetRole) => {
        let credentials = {};
        try {
            if (targetRole === 'JEAN') {
                credentials = { role: 'ADMIN', firstName: 'Jean', lastName: 'Vuillet', password: 'Clemenceau1919' };
            }
            else if (targetRole === 'ADMIN_TEST') {
                credentials = { role: 'ADMIN', firstName: 'Admin', lastName: 'Test', password: 'A' };
            }
            else if (targetRole === 'PROF_TEST') {
                credentials = { role: 'TEACHER', firstName: 'Prof', lastName: 'Test', password: 'A' };
            }
            else if (targetRole === 'ELEVE_TEST') {
                const res = await fetch('/api/admin/students');
                const students = await res.json();
                let targetStudent = students.find(s => s.firstName.toLowerCase() === 'eleve' && s.lastName.toLowerCase() === 'test');
                if (!targetStudent) {
                    if(confirm("Compte 'Eleve Test' introuvable. Voulez-vous utiliser le premier élève de la liste ?")) targetStudent = students[0];
                    else return;
                }
                if (!targetStudent) return alert("Aucun élève dans la base.");
                credentials = { role: 'STUDENT', studentId: targetStudent._id };
            }

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(credentials)
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('player', JSON.stringify(data.user));
                window.location.reload(); 
            } else {
                alert("Erreur switch : " + data.message);
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
                        handleQuickSwitch(targetRole); 
                    }
                }
            }
        } catch (e) { console.error(e); alert("Erreur technique lors du switch."); }
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
            
            // On charge toujours les référentiels pour faire les liens
            const resClasses = await fetch('/api/admin/classrooms');
            if (resClasses.ok) setAllClasses(await resClasses.json());
            
            const resSubjects = await fetch('/api/admin/subjects');
            if (resSubjects.ok) setAllSubjects(await resSubjects.json());

        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { 
        loadData(); 
        cancelEdit(); 
        setZoomedItem(null);
    }, [view]);

    // --- CHARGEMENT TROMBINOSCOPE CLASSE ---
    const handleViewRoster = async (cls) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/students');
            const allStudents = await res.json();
            const roster = allStudents.filter(s => s.classId === cls._id || s.currentClass === cls.name);
            setViewingClassRoster({ ...cls, students: roster });
        } catch(e) { console.error(e); alert("Erreur chargement liste"); }
        setLoading(false);
    };


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

    // HELPER POUR LES BADGES PROFS
    const getSubjectBadge = (id) => allSubjects.find(s => s._id === id);
    const getClassBadge = (id) => allClasses.find(c => c._id === id);

    return (
        <div className="admin-container animate-in fade-in">
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

            {/* OVERLAY IMPORT IA */}
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

            {/* OVERLAY LISTE ÉLÈVES (TROMBINOSCOPE) */}
            {viewingClassRoster && (
                <div className="zoom-overlay" onClick={() => setViewingClassRoster(null)}>
                    <div className="zoom-card" style={{width: '800px', maxWidth: '95%'}} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Classe {viewingClassRoster.name}</h2>
                                <span className="text-xs font-bold text-slate-400 uppercase">{viewingClassRoster.students.length} Élèves inscrits</span>
                            </div>
                            <button onClick={() => setViewingClassRoster(null)} className="w-10 h-10 rounded-full bg-slate-100 font-black text-slate-400 hover:bg-red-50 hover:text-red-500">✕</button>
                        </div>
                        
                        <div className="overflow-y-auto custom-scrollbar flex-1 bg-slate-50 rounded-2xl p-4">
                            {viewingClassRoster.students.length === 0 ? (
                                <div className="text-center py-10 text-slate-300 font-bold italic">Aucun élève dans cette classe.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-400 uppercase text-[10px]">
                                            <th className="pb-2 pl-2">Nom</th>
                                            <th className="pb-2 text-right pr-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingClassRoster.students.map(s => (
                                            <tr key={s._id} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors rounded-lg">
                                                <td className="py-3 pl-2 font-bold text-slate-700">
                                                    {s.firstName} <span className="uppercase">{s.lastName}</span>
                                                    <div className="text-[9px] text-slate-400 font-normal">{s.email}</div>
                                                </td>
                                                <td className="py-3 text-right pr-2">
                                                    <button onClick={() => setZoomedItem(s)} className="bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-black text-[10px] hover:bg-indigo-50 shadow-sm flex items-center gap-1 ml-auto">
                                                        <span>🔍</span> ZOOM
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ZOOM OVERLAY (FICHE DÉTAIL) */}
            {zoomedItem && (
                <div className="zoom-overlay level-2" onClick={() => setZoomedItem(null)}>
                    <div className="zoom-card" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black uppercase text-slate-800 mb-4">{zoomedItem.firstName} {zoomedItem.lastName}</h2>
                        
                        {view === 'teachers' ? (
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Matières Enseignées</p>
                                    <div className="flex flex-wrap gap-2">
                                        {zoomedItem.taughtSubjects?.length > 0 ? zoomedItem.taughtSubjects.map(id => {
                                            const sub = getSubjectBadge(id);
                                            return sub ? (
                                                <span key={id} className="px-2 py-1 rounded-md text-[10px] font-black text-white" style={{background: sub.color}}>
                                                    {sub.name}
                                                </span>
                                            ) : null;
                                        }) : <span className="text-slate-400 italic text-sm">Aucune matière</span>}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Classes Assignées</p>
                                    <div className="flex flex-wrap gap-2">
                                        {zoomedItem.assignedClasses?.length > 0 ? zoomedItem.assignedClasses.map(id => {
                                            const cls = getClassBadge(id);
                                            return cls ? (
                                                <span key={id} className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-slate-200 text-slate-700">
                                                    {cls.name}
                                                </span>
                                            ) : null;
                                        }) : <span className="text-slate-400 italic text-sm">Aucune classe</span>}
                                    </div>
                                </div>
                            </div>
                        ) : (view === 'students' || zoomedItem.email !== undefined) ? (
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Email</p>
                                    <p className="font-bold text-slate-700">{zoomedItem.email || "Non renseigné"}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Classe Actuelle</p>
                                    <p className="font-bold text-slate-700">{zoomedItem.currentClass || "Aucune"}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Santé / Info</p>
                                    <p className="text-sm text-slate-600">{zoomedItem.healthInfo || "RAS"}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 text-sm text-slate-600">
                                <p>Rôle : {zoomedItem.role}</p>
                            </div>
                        )}
                        <button onClick={() => setZoomedItem(null)} className="w-full py-3 mt-6 rounded-xl bg-slate-800 text-white font-black text-xs uppercase hover:bg-slate-700 transition-colors">Fermer</button>
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
                                            {view === 'students' && <div className="text-[10px] text-slate-400">{it.email}</div>}
                                        </td>
                                        <td className="p-4">
                                            {view === 'classes' && <span className={`px-2 py-1 rounded text-[9px] font-black ${it.type === 'GROUP' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{it.type}</span>}
                                            {view === 'staff' && <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.role === 'developer' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>{it.role}</span>}
                                            {view === 'students' && <span className="px-2 py-1 rounded bg-orange-100 text-orange-600 text-[9px] font-black uppercase">{it.currentClass || 'AUCUNE'}</span>}
                                            {view === 'bugs' && <div className="max-w-md"><div className="text-xs font-bold text-slate-600 mb-1">{it.description}</div><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${it.status === 'fixed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{it.status}</span></div>}
                                            
                                            {/* AFFICHAGE SPÉCIFIQUE PROFS DANS LA LISTE */}
                                            {view === 'teachers' && (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {it.taughtSubjects?.map(id => {
                                                            const sub = getSubjectBadge(id);
                                                            return sub ? <span key={id} className="text-[9px] font-black px-1.5 rounded text-white" style={{background:sub.color}}>{sub.name}</span> : null;
                                                        })}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {it.assignedClasses?.map(id => {
                                                            const cls = getClassBadge(id);
                                                            return cls ? <span key={id} className="text-[9px] font-bold px-1.5 rounded bg-slate-100 text-slate-600 border border-slate-200">{cls.name}</span> : null;
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            {view === 'classes' && (
                                                <button onClick={() => handleViewRoster(it)} className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold hover:bg-cyan-100" title="Voir les élèves">👥</button>
                                            )}
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