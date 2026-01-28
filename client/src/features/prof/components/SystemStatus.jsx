// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [version, setVersion] = useState('1');
    
    // ÉTATS VISUELS DISTINCTS
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    
    const lastTimestampRef = useRef(0);

    useEffect(() => { fetch('/api/system/version').then(r => r.json()).then(d => setVersion(d.hash)); }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                // 1. SI TOUT EST OK CÔTÉ SERVEUR
                if (data.status === 'OK') {
                    // On ne ferme que si on n'est pas en train d'afficher un DANGER
                    if (visible && verdict?.verdict !== 'DANGER' && !isAnalyzing) {
                        setVisible(false);
                        setVerdict(null);
                    }
                    return;
                }

                // 2. SI NOUVELLE ALERTE
                if (data.timestamp !== lastTimestampRef.current) {
                    console.log("⚡ Nouvelle alerte détectée -> Lancement enquête");
                    lastTimestampRef.current = data.timestamp;
                    setStatusData(data);
                    
                    // Reset immédiat pour affichage propre
                    setVisible(true);
                    setVerdict(null);
                    setIsAnalyzing(true);
                    
                    // Appel Oracle
                    askOracle();
                }

            } catch (e) {}
        }, 1000);
        return () => clearInterval(interval);
    }, [visible, verdict, isAnalyzing]);

    const askOracle = async () => {
        try {
            const res = await fetch('/api/system/oracle', { method: 'POST' });
            if (res.ok) {
                const d = await res.json();
                
                // MÀJ DE L'AFFICHAGE
                setVerdict(d);
                setIsAnalyzing(false);

                // Si SAFE, on ferme après lecture (3s)
                if (d.verdict === "SAFE") {
                    setTimeout(() => {
                        setVisible(false);
                    }, 3000);
                }
            }
        } catch (e) {
            setIsAnalyzing(false); // On arrête de charger même si erreur
        }
    };

    const handleRevertAndReport = async () => {
        setReverting(true);
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { setReverting(false); }
    };

    if (!visible) return <div className="fixed top-2 right-2 z-[9999] opacity-50 hover:opacity-100 transition-opacity bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-black cursor-default shadow-sm">v.{version}</div>;

    // --- LOGIQUE D'AFFICHAGE PRIORITAIRE ---
    let bgClass = "bg-orange-500 border-orange-700";
    let title = "ANALYSE EN COURS...";
    let message = "L'Oracle vérifie l'intégrité du code...";
    
    // Si on a un verdict, c'est lui qui commande, peu importe le serveur
    if (verdict) {
        if (verdict.verdict === "DANGER") {
            bgClass = "bg-red-600 border-red-800";
            title = "⛔ ALERTE CRITIQUE";
            message = `IA : "${verdict.reason}"`;
        } else if (verdict.verdict === "SAFE") {
            bgClass = "bg-green-600 border-green-800";
            title = "✅ VALIDÉ";
            message = `IA : "${verdict.reason}"`;
        }
    } else if (isAnalyzing) {
        // Mode chargement
        bgClass = "bg-orange-500 border-orange-700 animate-pulse";
    }

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex flex-col gap-2 border-b-4 transition-all duration-300 transform translate-y-0 ${bgClass}`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                            {title}
                        </span>
                        <span className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono">v.{version}</span>
                    </div>
                    {/* On affiche le message de l'IA s'il existe, sinon le message technique */}
                    <span className="text-md font-bold mt-1">
                        {verdict ? message : statusData.message}
                    </span>
                    {/* Détails techniques seulement si pas de verdict IA */}
                    {!verdict && statusData.details && <span className="text-xs font-mono opacity-80">{statusData.details}</span>}
                </div>
                
                {/* BOUTON REVERT : Présent si Danger ou si Analyse en cours (au cas où ça bloque) */}
                {(verdict?.verdict === 'DANGER' || isAnalyzing) && (
                    <div className="flex gap-2">
                        <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg flex items-center gap-2">
                            {reverting ? 'RESTAURATION...' : '🔙 REVERT'}
                        </button>
                        <button onClick={() => setVisible(false)} className="bg-white/20 hover:bg-white/40 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
                    </div>
                )}
            </div>
        </div>
    );
}
