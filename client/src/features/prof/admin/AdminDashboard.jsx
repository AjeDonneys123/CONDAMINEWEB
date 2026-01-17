import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';

export default function AdminDashboard({ user, onRefresh }) {
    const [view, setView] = useState('classes');
    const [items, setItems] = useState([]);
    const [name, setName] = useState('');
    const [classType, setClassType] = useState('CLASS');
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

    // OUTILS
    const handleFixIndexes = async () => { if(confirm("Nettoyer ?")) try { await fetch('/api/admin/maintenance/fix-admins', { method: 'POST' }); alert("Fait"); } catch(e){} };
    const handleResync = async () => { if(confirm("Resync ?")) try { await fetch('/api/admin/maintenance/resync-classes', { method: 'POST' }); onRefresh(); } catch(e){} };
    const handlePurge = async () => { if(confirm("Purger Orphelins ?")) try { await fetch('/api/admin/maintenance/purge-orphans', { method: 'POST' }); onRefresh(); } catch(e){} };
    const handleTotalSync = async () => { if(confirm("⚡ SYNC & KILL ?")) try { await fetch('/api/admin/maintenance/total-sync', { method: 'POST' }); onRefresh(); } catch(e){} };

    const handleAnalyze = async () => {
        setLoadingAI(true);
        try {
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
            alert("Succès");
            setImportingClass(null); setAnalyzedStudents(null); setImportText(""); setImportImage(null);
        } catch (e) { alert("Erreur"); }
        setLoadingAI(false);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const endpoint = ROUTES_MAP[view];
            let body = {};
            if (view === 'classes') body = { name, type: classType };
            else if (view === 'subjects') body = { name };
            else body = form;
            const res = await fetch(`/api/admin/${endpoint}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) { setName(''); setForm({ firstName: '', lastName: '', password: '', role: 'admin' }); loadData(); onRefresh(); }
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

            {/* CONTENU (Liste des classes, etc.) */}
            {/* Je te laisse la structure HTML existante, le JS est à jour */}
            {/* ... */}
        </div>
    );
}