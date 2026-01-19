import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager({ globalClassId }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // CORRECTION ICI : Utilisation de la route Admin V2
    fetch('/api/admin/students')
        .then(r => r.ok ? r.json() : [])
        .then(setStudents)
        .catch(e => console.error("Erreur chargement élèves", e))
        .finally(() => setLoading(false));
  }, []);

  // Filtrage robuste sur l'ID de la classe
  const filtered = students.filter(s => String(s.classId) === String(globalClassId));

  if (loading) return <div className="p-8 text-center text-slate-400 font-black animate-pulse">CHARGEMENT LISTE...</div>;

  return (
    <div className="bg-white rounded-[30px] border overflow-hidden shadow-sm animate-in">
        <table className="students-table">
            <thead>
                <tr className="bg-slate-50 text-left">
                    <th className="p-6 text-xs font-black text-slate-400 uppercase">Identité</th>
                    <th className="p-6 text-xs font-black text-slate-400 uppercase text-right">Actions</th>
                </tr>
            </thead>
            <tbody>
                {filtered.length > 0 ? filtered.map(s => (
                    <tr key={s._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-6">
                            <div className="font-bold text-slate-700">{s.firstName} {s.lastName}</div>
                            <div className="text-[10px] text-slate-400">{s.email || "Pas d'email"}</div>
                        </td>
                        <td className="p-6 text-right">
                            <button className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg font-black text-[10px] hover:bg-indigo-100 transition-colors">
                                DOSSIER
                            </button>
                        </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan="2" className="p-10 text-center text-slate-300 font-bold italic">
                            Aucun élève inscrit dans cette classe.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    </div>
  );
}