import React, { useState, useEffect } from 'react';

export default function ProductionsList({ user }) {
    const [submissions, setSubmissions] = useState([]);

    useEffect(() => {
        fetch(`/api/player-submissions/${user.id || user._id}`)
            .then(r => r.json())
            .then(data => setSubmissions(data || []));
    }, []);

    return (
        <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in">
            <h2 className="font-black text-pink-500 uppercase tracking-widest text-center mb-8">Mes Travaux Corrigés ✍️</h2>
            {submissions.map(sub => (
                <a 
                    key={sub._id} 
                    href={sub.driveLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block bg-white p-6 rounded-[35px] border-2 border-pink-50 hover:border-pink-300 transition-all shadow-sm"
                >
                    <div className="flex justify-between items-center">
                        <div>
                            <b className="text-slate-700 text-lg block">{sub.homeworkTitle || "Devoir Scanner"}</b>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correction du {new Date(sub.createdAt).toLocaleDateString()}</span>
                        </div>
                        <span className="text-pink-400 font-black text-2xl">➔</span>
                    </div>
                </a>
            ))}
            {submissions.length === 0 && (
                <div className="text-center py-20 text-slate-300 font-black uppercase">Aucune copie corrigée pour le moment</div>
            )}
        </div>
    );
}