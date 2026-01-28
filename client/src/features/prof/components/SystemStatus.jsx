// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('...');
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    
    const lastTimestampRef = useRef(0);
    const fetchingRef = useRef(false);

    useEffect(() => { fetch('/api/system/version').then(r => r.json()).then(d => setVersion(d.hash)); }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                // RESET AUTO SI OK
                if (data.status === 'OK') {
                    if (visible && verdict?.verdict !== 'DANGER') { setVisible(false); setVerdict(null); }
                    return;
                }

                // SI ALERTE
                setStatusData(data);
                setVisible(true);

                // NOUVEAU BATCH DÉTECTÉ ?
                if (data.timestamp !== lastTimestampRef.current) {
                    console.log("📦 Nouveau Batch détecté !");
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null); 
                    // Si le moteur demande un jugement ("JUDGING"), on appelle l'Oracle
                    if (data.status === 'JUDGING') askOracle();
                } 
                else if (data.status === 'JUDGING' && !verdict && !fetchingRef.current) {
                    askOracle(); // Retry si pas de réponse
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
                setVerdict(d);
                if (d.verdict === "SAFE") setTimeout(() => setVisible(false), 2500);
            }
        } catch (e) {}
        fetchingRef.current = false;
    };

    const handleRevertAndReport = async () => {
        setReverting(true);
        const report = `🚨 RAPPORT:\n${statusData.message}\nIA: ${verdict?.reason}`;
        try { await navigator.clipboard.writeText(report); } catch (err) {}

        try {
            await fetch('/api/system/revert', { method: 'POST' });
            setTimeout(() => window.location.reload(), 500);
        } catch(e) { setReverting(false); }
    };

    if (!visible) return <div className="fixed top-2 right-2 z-[9999] opacity-50 hover:opacity-100 transition-opacity bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-black cursor-default shadow-sm">v.{version}</div>;

    let bgClass = "bg-orange-500 border-orange-700"; 
    let messageIA = "🔮 Analyse Globale en cours...";
    
    if (statusData.status === 'ERROR') {
        bgClass = "bg-red-600 border-red-800";
        messageIA = "⛔ Blocage Moteur (Fichier rejeté)";
    }
    else if (verdict) {
        if (verdict.verdict === "DANGER") {
            bgClass = "bg-red-600 border-red-800";
            messageIA = `⛔ ALERTE : "${verdict.reason}"`;
        }
        if (verdict.verdict === "SAFE") {
            bgClass = "bg-green-600 border-green-800";
            messageIA = `✅ VALIDÉ : "${verdict.reason}"`;
        }
    }

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex flex-col gap-2 border-b-4 transition-all duration-300 transform translate-y-0 ${bgClass}`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                            {statusData.status === 'ERROR' ? '⛔ ECHEC BATCH' : (!verdict ? '⏳ AUDIT...' : verdict.verdict)}
                        </span>
                        <span className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono">v.{version}</span>
                    </div>
                    <span className="text-md font-bold mt-1">{statusData.message}</span>
                    {statusData.details && <span className="text-xs font-mono opacity-80">{statusData.details}</span>}
                </div>
                
                {/* BOUTON REVERT : Annule TOUT le batch car c'était un seul commit */}
                {(verdict?.verdict === 'DANGER' || statusData.status === 'ERROR') && (
                    <div className="flex gap-2">
                        <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg animate-pulse flex items-center gap-2">
                            {reverting ? 'ANNULATION...' : '🔙 REVERT BATCH'}
                        </button>
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
