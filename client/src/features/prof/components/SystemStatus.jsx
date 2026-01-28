// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('1');
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
                
                if (data.status === 'OK') {
                    if (visible && verdict?.verdict !== 'DANGER') { setVisible(false); setVerdict(null); }
                    return;
                }

                setStatusData(data);
                setVisible(true);

                if (data.timestamp !== lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null); 
                    if (data.status === 'JUDGING') askOracle();
                } 
                else if (data.status === 'JUDGING' && !verdict && !fetchingRef.current) {
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
                setVerdict(d);
                if (d.verdict === "SAFE") setTimeout(() => setVisible(false), 2500);
            }
        } catch (e) {}
        fetchingRef.current = false;
    };

    const handleRevertAndReport = async () => {
        setReverting(true);
        const report = `🚨 RAPPORT D'INCIDENT (V16)\n--------------------------------------------------\n📅 Date: ${new Date().toLocaleString()}\n🔍 Version: ${version}\n\n1️⃣ VERDICT ORACLE (IA) :\n${verdict?.reason || 'Non spécifié'}\n\n2️⃣ DÉTAILS TECHNIQUES :\n${statusData.details || '(Aucun détail)'}\n\n--------------------------------------------------\nGEMINI : Analyse ce rapport. Corrige TOUS les fichiers listés.`;
        try { await navigator.clipboard.writeText(report); } catch (err) {}
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { setReverting(false); }
    };

    // SI RIEN À SIGNALER : On affiche juste un tag discret ou rien
    if (!visible) return null;

    let bgClass = "bg-orange-500 border-orange-700"; 
    let messageIA = "🔮 AUDIT IA EN COURS...";
    
    if (statusData.status === 'ERROR') {
        bgClass = "bg-red-600 border-red-800";
        messageIA = "⛔ BLOCAGE TECHNIQUE";
    }
    else if (verdict) {
        if (verdict.verdict === "DANGER") {
            bgClass = "bg-red-600 border-red-800";
            messageIA = `🤖 DANGER : "${verdict.reason}"`;
        }
        if (verdict.verdict === "SAFE") {
            bgClass = "bg-green-600 border-green-800";
            messageIA = `✅ SAIN : "${verdict.reason}"`;
        }
    }

    return (
        <div className={`system-status-banner-flow ${bgClass} animate-in fade-in`}>
            <div className="system-status-content-wrapper">
                <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded font-black tracking-widest">SYSTEM V.{version}</span>
                        <span className="text-[11px] font-black uppercase">{messageIA}</span>
                    </div>
                    {statusData.details && (
                        <div className="mt-1 text-[9px] font-mono opacity-80 whitespace-nowrap overflow-hidden text-ellipsis max-w-4xl">
                            MODIFS : {statusData.details}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                    {(verdict?.verdict === 'DANGER' || statusData.status === 'ERROR') && (
                        <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-black text-[10px] uppercase border border-white/20 transition-all shadow-lg animate-pulse">
                            {reverting ? 'REVERT...' : '📋 COPIER & REVERT'}
                        </button>
                    )}
                    <button onClick={() => setVisible(false)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all">✕</button>
                </div>
            </div>
        </div>
    );
}
