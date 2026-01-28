// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [isManuallyHidden, setIsManuallyHidden] = useState(false); 
    const [version, setVersion] = useState('1');
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    const [retryCount, setRetryCount] = useState(0); // Compteur de tentatives
    
    const lastTimestampRef = useRef(0);
    const fetchingRef = useRef(false);

    useEffect(() => { fetch('/api/system/version').then(r => r.json()).then(d => setVersion(d.hash)); }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                if (data.status === 'OK') {
                    if (visible) { 
                        setVisible(false); setVerdict(null); 
                        setIsManuallyHidden(false); setRetryCount(0);
                    }
                    return;
                }

                setStatusData(data);
                
                // NOUVEAU CHANGEMENT : Reset et Lancement
                if (data.timestamp !== lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null);
                    setRetryCount(0);
                    setIsManuallyHidden(false); 
                    setVisible(true);
                    askOracle();
                } 
                // RETRY LOGIC : Si toujours en JUDGING, pas de verdict, et pas de requête en cours
                else if (data.status === 'JUDGING' && !verdict && !fetchingRef.current) {
                    // On laisse passer 2 cycles de polling avant de retenter pour ne pas spammer
                    askOracle();
                }
            } catch (e) {}
        }, 2000);
        return () => clearInterval(interval);
    }, [visible, verdict, retryCount]);

    const askOracle = async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            const res = await fetch('/api/system/oracle', { method: 'POST' });
            if (res.ok) {
                const d = await res.json();
                setVerdict(d);
                setRetryCount(0);
                if (d.verdict === "SAFE") setTimeout(() => setVisible(false), 2500);
            } else {
                // Erreur serveur (500 ou autre) -> On incrémente pour le Retry
                setRetryCount(prev => prev + 1);
            }
        } catch (e) {
            // Erreur réseau (Socket hang up) -> On incrémente pour le Retry
            setRetryCount(prev => prev + 1);
        } finally {
            fetchingRef.current = false;
        }
    };

    const handleRevertAndReport = async () => {
        setReverting(true);
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            window.location.reload();
        } catch(e) { setReverting(false); }
    };

    const shouldShow = visible && !isManuallyHidden;
    let bgClass = "bg-orange-500 border-orange-700"; 
    let messageIA = retryCount > 0 ? `🔄 TENTATIVE D'AUDIT (${retryCount})...` : "🔮 AUDIT IA EN COURS...";
    
    // Si on a échoué trop de fois, on change l'UI pour prévenir
    if (retryCount >= 5 && !verdict) {
        bgClass = "bg-red-500 border-red-700";
        messageIA = "⚠️ IA INDISPONIBLE (VÉRIFIEZ VOTRE CONNEXION)";
    }

    if (statusData.status === 'ERROR') {
        bgClass = "bg-red-600 border-red-800";
        messageIA = "⛔ BLOCAGE TECHNIQUE";
    }
    else if (verdict) {
        if (verdict.verdict === "DANGER") {
            bgClass = "bg-red-600 border-red-800";
            messageIA = `🤖 DANGER : ${verdict.reason}`;
        }
        if (verdict.verdict === "SAFE") {
            bgClass = "bg-green-600 border-green-800";
            messageIA = `✅ SAIN : ${verdict.reason}`;
        }
    }

    return (
        <div className={`system-status-banner-flow ${bgClass} ${shouldShow ? 'show' : 'hide'}`}>
            <div className="system-status-content-wrapper">
                <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded font-black tracking-widest">SYSTEM V.{version}</span>
                        <span className="text-[11px] font-black uppercase">{messageIA}</span>
                    </div>
                    {statusData.details && (
                        <div className="mt-1 text-[9px] font-mono opacity-80 whitespace-nowrap overflow-hidden text-ellipsis max-w-4xl italic">
                            {statusData.details}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                    {(verdict?.verdict === 'DANGER' || statusData.status === 'ERROR' || retryCount >= 5) && (
                        <div className="flex gap-1">
                            <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-black text-[10px] uppercase border border-white/20 shadow-lg animate-pulse">
                                {reverting ? 'REVERT...' : '🚑 REVERT D\'URGENCE'}
                            </button>
                        </div>
                    )}
                    <button onClick={() => setIsManuallyHidden(true)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all">✕</button>
                </div>
            </div>
        </div>
    );
}
