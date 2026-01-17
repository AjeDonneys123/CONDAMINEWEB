

import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes');
    const [items, setItems] = useState([]);
    
    // FORMULAIRES
    const [name, setName] = useState('');
    const [classType, setClassType] = useState('CLASS'); // NOUVEAU STATE
    const [form, setForm] = useState({ firstName: '', lastName: '', password: '', role: 'admin' });
    
    // IMPORT
    const [importingClass, setImportingClass] = useState(null); 
    const [importText, setImportText] = useState("");
    const [importImage, setImportImage] = useState(null);
    const [analyzedStudents, setAnalyzedStudents] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [ecoMode, setEcoMode] = useState(false);

    const ROUTES_MAP = { 'classes': 'classrooms', 'subjects': 'subjects', 'teachers': 'teachers', 'admins': 'admins', 'bugs': 'bugs' };

    const loadData = async () => {
        try {
            const endpoint = ROUTES_MAP[view];
            const res = await fetch(`/api/admin/${endpoint}`);
            if (res.ok) setItems(await res.json());
            else setItems([]);
        } catch (e) { setItems([]); }
    };

    useEffect(() => { loadData(); }, [view]);

    // OUTILS DE MAINTENANCE
    const handleFixIndexes = async () => { if(confirm("Nettoyer index ?")) try { await fetch('/api/admin/maintenance/fix-admins', { method: 'POST' }); alert("OK"); } catch(e){} };
    const handleResync = async () => { if(confirm("Resync ?")) try { await fetch('/api/admin/maintenance/resync-classes', { method: 'POST' }); onRefresh(); } catch(e){} };
    const handlePurge = async () => { if(confirm("Purger orphelins ?")) try { await fetch('/api/admin/maintenance/purge-orphans', { method: 'POST' }); onRefresh(); } catch(e){} };
    const handleTotalSync = async () => { if(confirm("SYNC & KILL ?")) try { await fetch('/api/admin/maintenance/total-sync', { method: 'POST' }); onRefresh(); } catch(e){} };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
            reader.onloadend = () => { setImportImage(reader.result); setImportText(""); };
            reader.readAsDataURL(file);
        } else {
            reader.onloadend = () => { setImportText(reader.result); setImportImage(null); };
            reader.readAsText(file);
        }
    };

    const handleAnalyze = async () => {
        setLoadingAI(true);
        try {
            // Logique Hybride simplifiée pour la snipette
            const res = await fetch('/api/admin/import/analyze', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: importText, image: importImage }) });
            const data = await res.json();
            setAnalyzedStudents(data);
        } catch (e) { alert("Erreur IA"); }
        setLoadingAI(false);
    };

    const handleConfirmImport = async () => {
        setLoadingAI(true);
        try {
            await fetch('/api/admin/import/execute', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ classId: importingClass, students: analyzedStudents }) });
            alert("Import réussi !");
            setImportingClass(null); setAnalyzedStudents(null); setImportText(""); setImportImage(null);
        } catch (e) { alert("Erreur"); }
        setLoadingAI(false);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const endpoint = ROUTES_MAP[view];
            // CONSTRUCTION DU BODY SELON LA VUE
            let body = {};
            if (view === 'classes') body = { name, type: classType };
            else if (view === 'subjects') body = { name };
            else body = form;

            const res = await fetch(`/api/admin/${endpoint}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) {
                setName(''); setForm({ firstName: '', lastName: '', password: '', role: 'admin' });
                loadData(); onRefresh();
            }
        } catch (error) {}
    };

    const handleDelete = async (id) => {
        if (!confirm("Supprimer ?")) return;
        const endpoint = ROUTES_MAP[view];
        const res = await fetch(`/api/admin/${endpoint}/${id}`, { method: 'DELETE' });
        if (res.ok) { loadData(); onRefresh(); }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-8">
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar">
                    <button onClick={() => setView('classes')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${view === 'classes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>🏫 Classes</button>
                    <button onClick={() => setView('subjects')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${view === 'subjects' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>📚 Matières</button>
                    <button onClick={() => setView('teachers')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${view === 'teachers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>👨‍🏫 Profs</button>
                    {user.isDeveloper && (
                        <>
                            <button onClick={() => setView('admins')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${view === 'admins' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>🛡️ Staff</button>
                            <button onClick={() => setView('bugs')} className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase ${view === 'bugs' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>🪲 Bugs</button>
                        </>
                    )}
                </div>
                <div className="flex gap-2">
                    {view === 'admins' && <button onClick={handleFixIndexes} className="bg-amber-100 text-amber-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">🧹 NETTOYER</button>}
                    {view === 'classes' && (
                        <>
                            <button onClick={handleResync} className="bg-blue-100 text-blue-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">🔄 RESYNC</button>
                            <button onClick={handlePurge} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">💀 PURGE</button>
                            <button onClick={handleTotalSync} className="bg-orange-100 text-orange-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase">⚡ SYNC/KILL</button>
                        </>
                    )}
                </div>
            </div>

            {view === 'bugs' ? (
                <div className="space-y-4">
                    {items.map(bug => (
                        <div key={bug._id} className="p-6 rounded-[30px] border-2 flex justify-between items-center bg-slate-50 border-slate-100">
                             <div className="text-left"><span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">{bug.userRole}</span><h4 className="font-bold text-slate-800 mt-2">{bug.description}</h4></div>
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    <div className="bg-white p-8 rounded-[35px] border-2 border-slate-100 shadow-sm">
                        <h3 className="font-black text-slate-400 text-[10px] mb-4 uppercase">Ajouter {view.slice(0,-1)}</h3>
                        {/* FORMULAIRE DYNAMIQUE */}
                        {view === 'teachers' || view === 'admins' ? (
                            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                <input className="bg-slate-50 border p-4 rounded-2xl font-bold" placeholder="Prénom" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
                                <input className="bg-slate-50 border p-4 rounded-2xl font-bold" placeholder="Nom" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
                                <input className="bg-slate-50 border p-4 rounded-2xl font-bold" placeholder="Pass" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
                                {view === 'admins' && <select className="bg-slate-50 border p-4 rounded-2xl font-bold" value={form.role} onChange={e => setForm({...form, role: e.target.value})}><option value="admin">Admin</option><option value="developer">Dev</option></select>}
                                <button type="submit" className="bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase">Créer</button>
                            </form>
                        ) : (
                            <form onSubmit={handleAdd} className="flex gap-4">
                                <input className="flex-1 bg-slate-50 border p-4 rounded-2xl font-bold outline-none" value={name} onChange={e => setName(e.target.value)} placeholder="Nom..." required />
                                
                                {/* SELECTEUR TYPE (CLASSE vs GROUPE) */}
                                {view === 'classes' && (
                                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                                        <button type="button" onClick={() => setClassType('CLASS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${classType==='CLASS' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>🏫 Classe</button>
                                        <button type="button" onClick={() => setClassType('GROUP')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${classType==='GROUP' ? 'bg-purple-500 shadow text-white' : 'text-slate-400'}`}>🏷️ Groupe</button>
                                    </div>
                                )}
                                
                                <button type="submit" className="bg-indigo-600 text-white px-10 rounded-2xl font-black text-xs uppercase">Ajouter</button>
                            </form>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map(it => (
                            <div key={it._id} className={`bg-white p-5 rounded-[25px] border flex flex-col justify-between shadow-sm group min-h-[120px] relative ${it.type === 'GROUP' ? 'border-purple-100 bg-purple-50/30' : 'border-slate-100'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col text-left">
                                        <span className="font-black text-slate-700 text-lg uppercase truncate max-w-[150px]">{it.firstName ? `${it.firstName} ${it.lastName}` : it.name}</span>
                                        {view === 'admins' && <span className="text-[8px] bg-slate-100 px-1 rounded uppercase w-fit">{it.role}</span>}
                                        {/* BADGE GROUPE */}
                                        {it.type === 'GROUP' && <span className="text-[8px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-black uppercase w-fit mt-1">🏷️ Groupe Pédagogique</span>}
                                    </div>
                                    <button onClick={() => handleDelete(it._id)} className="w-6 h-6 rounded-full bg-red-50 text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]">✕</button>
                                </div>
                                
                                {view === 'classes' && (
                                    <button onClick={() => setImportingClass(importingClass === it._id ? null : it._id)} 
                                            className={`w-full py-3 rounded-xl font-black text-[10px] uppercase transition-all border flex items-center justify-center gap-2 ${it.type === 'GROUP' ? 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>
                                        <span>🤖</span> IMPORT LISTE
                                    </button>
                                )}

                                {/* INTERFACE D'IMPORTATION (IDENTIQUE AU PRÉCÉDENT MAIS DANS LA BOUCLE) */}
                                {importingClass === it._id && (
                                    <div className="absolute inset-x-0 bottom-0 top-auto z-50 bg-white shadow-2xl rounded-[25px] p-4 border-2 border-indigo-200 animate-in zoom-in origin-bottom">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-black text-indigo-600 text-[10px] uppercase">Importer dans {it.name}</h3>
                                            <button onClick={() => {setImportingClass(null); setAnalyzedStudents(null);}} className="font-bold text-slate-300 hover:text-red-500">✕</button>
                                        </div>
                                        
                                        {!analyzedStudents ? (
                                            <div className="space-y-2">
                                                <textarea 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px] font-mono h-20 outline-none focus:border-indigo-300"
                                                    placeholder="Jean;Dupont..."
                                                    value={importText}
                                                    onChange={e => setImportText(e.target.value)}
                                                />
                                                <div className="relative">
                                                    <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                    <div className="w-full bg-slate-100 py-2 rounded-xl text-center text-[9px] font-bold text-slate-500 border border-dashed border-slate-300">
                                                        {importImage ? "📸 Image chargée" : (importText ? "📄 Fichier chargé" : "📁 OU FICHIER")}
                                                    </div>
                                                </div>
                                                <button onClick={handleAnalyze} disabled={loadingAI} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-700">
                                                    {loadingAI ? 'Analyse...' : 'Lancer l\'Analyse'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 h-full flex flex-col">
                                                <div className="bg-emerald-50 p-2 rounded-xl flex-1 overflow-y-auto custom-scrollbar max-h-[100px]">
                                                    {analyzedStudents.map((s, i) => (
                                                        <div key={i} className="flex gap-2 text-[9px] font-bold text-emerald-800 border-b border-emerald-100 py-1">
                                                            <span>{i+1}.</span>
                                                            <span>{s.firstName}</span>
                                                            <span className="uppercase">{s.lastName}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button onClick={handleConfirmImport} disabled={loadingAI} className="w-full bg-emerald-500 text-white py-2 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-emerald-600">
                                                    {loadingAI ? '...' : `Valider (${analyzedStudents.length})`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

