import React, { useState, useEffect } from 'react';

export default function TrainingManager({ globalClassId, globalClass }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!globalClassId) return;

        setLoading(true);
        setError(null);

        fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}`)
            .then(res => {
                if (!res.ok) throw new Error('Erreur réseau');
                return res.json();
            })
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [globalClassId]);

    if (!globalClassId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-300">
                <span className="font-black text-xl uppercase">SÉLECTIONNEZ UNE CLASSE</span>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <h2 className="text-2xl font-black text-indigo-600 mb-6">
                Entraînements de la classe : {globalClass}
            </h2>

            {loading ? (
                <div className="text-slate-400 font-bold animate-pulse">Chargement des données...</div>
            ) : error ? (
                <div className="text-red-500 font-bold bg-red-50 p-4 rounded-xl border border-red-200">
                    ⚠️ Impossible de charger les données : {error}
                </div>
            ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-slate-600 mb-4">
                        Voici les statistiques d'entraînement pour les élèves de la classe sélectionnée.
                    </p>
                    <pre className="text-xs bg-white p-4 rounded-lg overflow-auto border border-slate-100 max-h-96">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
