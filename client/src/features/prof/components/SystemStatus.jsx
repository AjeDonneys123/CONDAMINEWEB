// @signatures: SystemStatus, askOracle, handleRevert
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('...');
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    
    // MÉMOIRE ANTI-BOUCLE
    // On stocke le timestamp de la dernière alerte traitée
    const lastTimestampRef = useRef(0);
    const fetchingRef = useRef(false);

    useEffect(() => { fetch('/api/system/version').then(r => r.json()).then(d => setVersion(d.hash)); }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                // Si tout va bien, on cache
                if (data.status === 'OK') {
                    if (visible) setTimeout(() => setVisible(false), 2000);
                    return;
                }

                // SI ALERTE
                setStatusData(data);
                setVisible(true);

                // LOGIQUE INTELLIGENTE :
                // On appelle l'Oracle SEULEMENT si c'est une NOUVELLE alerte (Timestamp différent)
                // OU si on n'a pas encore de verdict (cas redémarrage page) ET qu'on ne cherche pas déjà
                if (data.timestamp !== lastTimestampRef.current) {
                    console.log("⚡ Nouvelle alerte détectée !");
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null); // Reset visuel
                    askOracle();
                } else if (!verdict && !fetchingRef.current) {
                    // Cas où on a rechargé la page mais l'alerte est toujours active côté serveur
                    askOracle();
                }

            } catch (e) {}
        }, 1000);
        return () => clearInterval(interval);
    }, [visible, verdict]);

    const askOracle = async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        
        try {
            const res = await fetch('/api/system/oracle', { method: 'POST' });
            if (res.ok) {
                const d = await res.json();
                console.log("✅ Verdict reçu :", d.verdict);
                setVerdict(d);
            }
        } catch (e) { 
            console.warn("Oracle injoignable, nouvel essai au prochain tick...");
        }
        fetchingRef.current = false;
    };

    const handleRevert = async () => {
        if(!confirm("⚠️ ANNULER TOUT ? (Retour au dernier Snapshot)")) return;
        setReverting(true);
        try { await fetch('/api/system/revert', { method: 'POST' }); setTimeout(() => window.location.reload(), 1000); } catch(e) { setReverting(false); }
    };

    if (!visible) return <div className="fixed top-2 right-2 z-[9999] opacity-30 hover:opacity-100 transition-opacity bg-black text-white text-[8px] px-2 py-1 rounded font-mono cursor-default">v.{version}</div>;

    let bgClass = "bg-orange-500 border-orange-700"; 
    let messageIA = "🔮 L'Oracle analyse la régression...";
    
    if (verdict) {
        if (verdict.verdict === "DANGER") bgClass = "bg-red-600 border-red-800";
        if (verdict.verdict === "SAFE") bgClass = "bg-green-600 border-green-800";
        messageIA = `🤖 Juge : "${verdict.reason}"`;
    }

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex flex-col gap-2 border-b-4 transition-all duration-300 transform translate-y-0 ${bgClass}`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                            {!verdict ? '⏳ ANALYSE EN COURS...' : (verdict.verdict === 'SAFE' ? '✅ VALIDÉ' : '⛔ ALERTE CRITIQUE')}
                        </span>
                        <span className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono">v.{version}</span>
                    </div>
                    <span className="text-md font-bold mt-1">{statusData.message}</span>
                    <span className="text-xs font-mono opacity-80">{statusData.details}</span>
                </div>
                
                {verdict?.verdict !== 'SAFE' && (
                    <div className="flex gap-2">
                        <button onClick={handleRevert} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg animate-pulse">{reverting ? '...' : '🔙 REVERT'}</button>
                        <button onClick={() => setVisible(false)} className="bg-white/20 hover:bg-white/40 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                    </div>
                )}
            </div>

            <div className="mt-2 p-3 bg-black/20 rounded-lg border-l-4 border-white/50 text-sm italic font-serif leading-relaxed animate-in fade-in">
                {messageIA}
            </div>
        </div>
    );
}
