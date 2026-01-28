// @signatures: SystemStatus, askAI, handleRevert
import React, { useState, useEffect } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [status, setStatus] = useState({ status: 'OK' });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('...');
    const [aiExplanation, setAiExplanation] = useState(null);
    const [reverting, setReverting] = useState(false);
    const [serverOffline, setServerOffline] = useState(false);

    // 1. Version
    useEffect(() => {
        fetch('/api/system/version')
            .then(r => r.json())
            .then(d => setVersion(d.hash))
            .catch(() => setVersion('OFFLINE'));
    }, []);

    // 2. Monitoring ROBUSTE
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                setServerOffline(false);

                // LOGIQUE D'AFFICHAGE
                if (data.status !== 'OK') {
                    // Si c'est une erreur/warning, on l'affiche et on ne l'enlève pas
                    setStatus(data);
                    setVisible(true);
                    
                    // Si on a du contexte et pas d'explication, on demande à l'IA
                    // (Seulement si on n'a pas déjà une explication pour ce timestamp)
                    if (data.context && (!aiExplanation || data.timestamp !== status.timestamp)) {
                        askAI(data.context);
                    }
                } else {
                    // Si le serveur dit OK, on cache
                    if (visible) {
                        setTimeout(() => {
                            setVisible(false);
                            setAiExplanation(null);
                        }, 2000);
                    }
                }
            } catch (e) {
                // Si le serveur est éteint (redémarrage), ON GARDE LE BANDEAU SI IL ÉTAIT LÀ
                setServerOffline(true);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [visible, status, aiExplanation]);

    const askAI = async (context) => {
        setAiExplanation("⏳ L'IA analyse l'impact...");
        try {
            const res = await fetch('/api/system/analyze-risk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(context)
            });
            if(res.ok) {
                const d = await res.json();
                setAiExplanation("🤖 " + d.analysis);
            }
        } catch (e) { /* On réessaiera au prochain cycle */ }
    };

    const handleRevert = async () => {
        if(!confirm("⚠️ ANNULER les derniers changements et restaurer la version stable ?")) return;
        setReverting(true);
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            // On force un reload après 1s pour être sûr que le serveur a fini
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { alert("Erreur Revert (Serveur injoignable ?)"); setReverting(false); }
    };

    if (!visible) return (
        <div className="fixed top-2 right-2 z-[9999] opacity-30 hover:opacity-100 transition-opacity bg-black text-white text-[8px] px-2 py-1 rounded font-mono cursor-default">
            v.{version} {serverOffline && '🔴'}
        </div>
    );

    const colors = {
        'ERROR': 'bg-red-600 border-red-800',
        'WARNING': 'bg-yellow-500 border-yellow-600',
        'OK': 'bg-green-600 border-green-800'
    };

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex flex-col gap-2 border-b-4 transition-all duration-300 transform translate-y-0 ${colors[status.status] || 'bg-slate-800'}`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                            {status.status === 'ERROR' ? '⛔ BLOCAGE SYSTÈME' : '⚠️ AVERTISSEMENT'}
                            {serverOffline && <span className="text-[10px] bg-black/50 px-2 py-1 rounded animate-pulse">RESTARTING...</span>}
                        </span>
                        <span className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono">v.{version}</span>
                    </div>
                    <span className="text-md font-bold mt-1">{status.message}</span>
                    <span className="text-xs font-mono opacity-80">{status.details}</span>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={handleRevert} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg">
                        {reverting ? 'RESTAURATION...' : '🔙 REVERT (ANNULER)'}
                    </button>
                    <button onClick={() => setVisible(false)} className="bg-white/20 hover:bg-white/40 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                </div>
            </div>

            {/* ZONE IA */}
            {aiExplanation && (
                <div className="mt-2 p-3 bg-black/40 rounded-lg border-l-4 border-white/50 text-sm italic font-serif leading-relaxed animate-in fade-in">
                    {aiExplanation}
                </div>
            )}
        </div>
    );
}
