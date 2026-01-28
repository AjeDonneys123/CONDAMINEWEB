// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('...');
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    
    // MÉMOIRE ANTI-BOUCLE
    const lastTimestampRef = useRef(0);
    const fetchingRef = useRef(false);

    useEffect(() => { fetch('/api/system/version').then(r => r.json()).then(d => setVersion(d.hash)); }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                if (data.status === 'OK') {
                    if (visible) setTimeout(() => setVisible(false), 2000);
                    return;
                }

                setStatusData(data);
                setVisible(true);

                if (data.timestamp !== lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null); 
                    askOracle();
                } else if (!verdict && !fetchingRef.current) {
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
            }
        } catch (e) {}
        fetchingRef.current = false;
    };

    // --- LE "ONE CLICK FIX" ---
    const handleRevertAndReport = async () => {
        if(!confirm("⚠️ COPIER LE RAPPORT ET RESTAURER ?")) return;
        setReverting(true);

        // 1. GÉNÉRATION DU RAPPORT
        const report = `🚨 RAPPORT AUTOMATIQUE (REVERT TRIGGERED)
--------------------------------------------------
📅 Date: ${new Date().toLocaleString()}
🔍 Version: ${version}

1️⃣ ALERTES SYSTÈME :
${statusData.message}
${statusData.details || ''}

2️⃣ JUGEMENT ORACLE :
⚖️ Verdict : ${verdict?.verdict || 'Inconnu'}
🗣️ Raison  : "${verdict?.reason || 'Non spécifié'}"

--------------------------------------------------
GEMINI : Analyse ce rapport. Le code précédent était défectueux. Corrige-le.`;

        // 2. COPIE DANS LE PRESSE-PAPIER
        try {
            await navigator.clipboard.writeText(report);
            console.log("📋 Rapport copié !");
        } catch (err) {
            console.error("Échec copie", err);
        }

        // 3. REVERT (Retour vers le futur)
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            // On laisse un peu de temps pour voir le feedback visuel du bouton
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { 
            alert("Erreur Revert"); 
            setReverting(false); 
        }
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
                        <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg animate-pulse flex items-center gap-2">
                            {reverting ? 'RESTAURATION...' : '📋 COPIER & REVERT'}
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
