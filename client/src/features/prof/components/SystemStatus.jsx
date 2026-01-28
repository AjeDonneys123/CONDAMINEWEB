// @signatures: SystemStatus, askOracle, handleRevertAndReport, isVisible
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    // L'état 'visible' ne sert plus qu'à masquer manuellement le bandeau DANGER/JUDGING.
    const [isManuallyHidden, setIsManuallyHidden] = useState(false);
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
                
                // Si le statut est OK, on réinitialise le verdict et on annule le masquage manuel
                if (data.status === 'OK') {
                    setStatusData(data);
                    setVerdict(null); 
                    setIsManuallyHidden(false); 
                    return;
                }
                
                // --- LOGIQUE EN COURS/ERREUR ---
                
                // Si l'état a changé (nouveau batch), on affiche, on réinitialise le verdict
                if (data.timestamp !== lastTimestampRef.current) {
                    console.log("📦 Nouvelle alerte Batch");
                    lastTimestampRef.current = data.timestamp;
                    setVerdict(null); 
                    setIsManuallyHidden(false); // Affiche pour la nouvelle alerte
                    
                    if (data.status === 'JUDGING') askOracle();
                } 
                // Sinon, si on est en JUDGING sans verdict, on relance l'Oracle (pour le cas où le premier appel a échoué)
                else if (data.status === 'JUDGING' && !verdict && !fetchingRef.current) {
                    askOracle();
                }

                setStatusData(data);

            } catch (e) {
                // En cas d'erreur de communication, on garde le statut précédent (souvent OK)
            }
        }, 1000);
        return () => { 
            clearInterval(interval); 
        };
    }, [verdict]);

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

    const handleRevertAndReport = async () => {
        setReverting(true);
        
        const report = `🚨 RAPPORT D'INCIDENT (V16)
--------------------------------------------------
📅 Date: ${new Date().toLocaleString()}
🔍 Version: ${version}

1️⃣ VERDICT ORACLE (IA) :
${verdict?.reason || 'Non spécifié'}

2️⃣ DÉTAILS TECHNIQUES (FICHIERS TOUCHÉS) :
${statusData.details || '(Aucun détail technique disponible)'}

--------------------------------------------------
GEMINI : Analyse ce rapport. Corrige TOUS les fichiers listés.`;

        try { await navigator.clipboard.writeText(report); } catch (err) {}

        try {
            await fetch('/api/system/revert', { method: 'POST' });
            setTimeout(() => window.location.reload(), 1000);
        } catch(e) { setReverting(false); }
    };
    
    // --- DÉCISION D'AFFICHAGE ---
    const isErrorOrJudging = statusData.status !== 'OK';
    
    // Si l'état est OK et masqué, on ne l'affiche pas (mais l'état OK est affiché par défaut)
    if (isManuallyHidden && statusData.status !== 'ERROR' && verdict?.verdict !== 'DANGER') return null;
    
    // Si nous ne sommes pas en état d'erreur/judging ET que nous sommes masqués manuellement, on masque.
    // SINON : on doit afficher l'état OK
    if (!isErrorOrJudging && isManuallyHidden) return null;


    let bgClass = "bg-blue-600 border-blue-800"; 
    let messageDisplay = `✅ SYSTÈME OPÉRATIONNEL`;
    let icon = '🛠️';
    let showActions = false;

    if (statusData.status === 'ERROR') {
        bgClass = "bg-red-600 border-red-800";
        messageDisplay = `⛔ BLOCAGE TECHNIQUE : ${statusData.message}`;
        icon = '🚨';
        showActions = true;
    }
    else if (statusData.status === 'JUDGING') {
        bgClass = "bg-orange-500 border-orange-700";
        messageDisplay = `⏳ AUDIT en cours... (${statusData.message})`;
        icon = '🔮';
        showActions = true;
    }
    
    if (verdict) {
        if (verdict.verdict === "DANGER") {
            bgClass = "bg-red-600 border-red-800";
            messageDisplay = `🤖 ALERTE R. : "${verdict.reason}"`;
            icon = '🔥';
            showActions = true;
        }
        if (verdict.verdict === "SAFE") {
            bgClass = "bg-green-600 border-green-800";
            messageDisplay = `✅ VALIDÉ : "${verdict.reason}"`;
            icon = '✨';
            // Pas de masquage auto, on revient à l'état 'OK' après la synchro suivante
        }
    }
    
    // Si l'état est SAFE (vert) mais qu'il y a des détails, on affiche les détails.
    if (statusData.status === 'JUDGING' && verdict?.verdict === 'SAFE') {
        // La validation réussie remplace l'état JUDGING par l'état OK
    }
    
    const isVisible = (statusData.status === 'OK' && !isManuallyHidden) || isErrorOrJudging;

    if (!isVisible) {
         // Retour à la version discrète en bas à droite
         return <div className="fixed top-2 right-2 z-[9999] opacity-50 hover:opacity-100 transition-opacity bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-black cursor-default shadow-sm">v.{version}</div>;
    }


    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex flex-col gap-2 border-b-4 transition-all duration-300 transform translate-y-0 ${bgClass}`}>
            <div className="flex justify-between items-start">
                <div className="flex flex-col flex-1 mr-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xl uppercase tracking-widest flex items-center gap-2">
                            {icon} {messageDisplay}
                        </span>
                        <span className="text-[10px] bg-black/30 px-2 py-1 rounded font-mono">v.{version}</span>
                    </div>
                    
                    {/* AFFICHAGE DES DÉTAILS (Liste des fichiers) */}
                    {statusData.details && isErrorOrJudging && (
                        <div className="mt-2 p-2 bg-black/20 rounded text-[10px] font-mono whitespace-pre-wrap max-h-[100px] overflow-y-auto border border-white/10">
                            {statusData.details}
                        </div>
                    )}
                </div>
                
                {/* ACTIONS & BOUTON FERMER */}
                <div className="flex flex-col gap-2 shrink-0">
                    {showActions && (verdict?.verdict === 'DANGER' || statusData.status === 'ERROR') && (
                        <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-3 rounded-lg font-bold text-xs uppercase border border-white/20 transition-colors shadow-lg animate-pulse flex items-center gap-2 justify-center">
                            {reverting ? '...' : '📋 COPIER & REVERT'}
                        </button>
                    )}
                    <button onClick={() => setIsManuallyHidden(true)} className="bg-white/20 hover:bg-white/40 rounded-lg py-1 text-[10px] font-bold">✕ FERMER</button>
                </div>
            </div>
        </div>
    );
}
