// @signatures: ConsoleReporter, generateFullReport, handleKeyDown
import React, { useState, useEffect } from 'react';
import './ConsoleReporter.css';

export default function ConsoleReporter({ user }) {
    const [errors, setErrors] = useState([]);
    const [bannerVisible, setBannerVisible] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        // 1. CAPTURE DES ERREURS CONSOLE (Local)
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            if(!msg.includes('snapshot') && !msg.includes('React') && !msg.includes('key')) {
                setErrors(prev => [...prev, { msg, time: new Date().toLocaleTimeString() }].slice(-15));
            }
            originalError.apply(console, args);
        };

        const handleKeyDown = async (e) => {
            if (e.metaKey && e.shiftKey && e.code === 'KeyL') {
                e.preventDefault();
                await generateFullReport();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            console.error = originalError;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [errors]); // Dépendance errors pour avoir les logs à jour

    const generateFullReport = async () => {
        let statusReport = "Inconnu";
        let oracleVerdict = "Non sollicité";
        let oracleReason = "";

        // 2. RÉCUPÉRATION DES DONNÉES SERVEUR (Ce que voit le HUD)
        try {
            const resStatus = await fetch('/api/system/apply-status');
            const dataStatus = await resStatus.json();
            
            if (dataStatus.status !== 'OK') {
                statusReport = `[${dataStatus.status}] ${dataStatus.message} (${dataStatus.details})`;
                
                // Si alerte, on récupère ce que dit l'Oracle (depuis le cache serveur)
                const resOracle = await fetch('/api/system/oracle', { method: 'POST' });
                const dataOracle = await resOracle.json();
                oracleVerdict = dataOracle.verdict;
                oracleReason = dataOracle.reason;
            } else {
                statusReport = "🟢 SYSTÈME SAIN (OK)";
            }
        } catch (e) {
            statusReport = "🔴 SERVEUR OFF/INJOIGNABLE";
        }

        // 3. CONSTRUCTION DU RAPPORT
        const payload = `🚨 RAPPORT D'INCIDENT (V14)
--------------------------------------------------
👤 Dev: ${user?.firstName || 'Inconnu'}
📅 Date: ${new Date().toLocaleString()}

1️⃣ ÉTAT DU SYSTÈME (HUD) :
${statusReport}

2️⃣ JUGEMENT DE L'ORACLE (IA) :
⚖️ Verdict : ${oracleVerdict}
🗣️ Raison  : "${oracleReason}"

3️⃣ LOGS CONSOLE (Derniers 15) :
${errors.length > 0 ? errors.map(e => `[${e.time}] ${e.msg}`).join('\n') : "(Aucune erreur console)"}

--------------------------------------------------
GEMINI : Analyse ce rapport. Si le verdict est DANGER, corrige le code manquant décrit par l'Oracle.`;

        // 4. COPIE
        try {
            await navigator.clipboard.writeText(payload);
            setCopySuccess(true);
            setBannerVisible(true);
            setTimeout(() => { setCopySuccess(false); setBannerVisible(false); }, 3000);
        } catch (err) {
            console.error("Échec copie presse-papier", err);
        }
    };

    if (!bannerVisible && !copySuccess) return null;

    return (
        <div className={`error-banner-minimal show copied`} onClick={() => setBannerVisible(false)}>
            <div className="banner-content">
                <span className="banner-icon">📋</span>
                <span className="banner-text">
                    RAPPORT COMPLET COPIÉ ! (STATUS + ORACLE + LOGS)
                </span>
                <span className="banner-hint">COLLE-LE DANS LE CHAT</span>
            </div>
        </div>
    );
}
