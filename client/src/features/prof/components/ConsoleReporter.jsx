// @signatures: ConsoleReporter, generateFullReport, handleKeyDown
import React, { useState, useEffect } from 'react';
import './ConsoleReporter.css';

export default function ConsoleReporter({ user }) {
    const [errors, setErrors] = useState([]);
    const [bannerVisible, setBannerVisible] = useState(false);

    useEffect(() => {
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            if(!msg.includes('snapshot') && !msg.includes('React')) {
                setErrors(prev => [...prev, { msg, time: new Date().toLocaleTimeString() }].slice(-15));
            }
            originalError.apply(console, args);
        };

        const handleKeyDown = async (e) => {
            // Shift + Cmd + L (ou Ctrl sur Windows)
            if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.code === 'KeyL') {
                e.preventDefault();
                await generateFullReport();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            console.error = originalError;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [errors]);

    const generateFullReport = async () => {
        let statusReport = "🟢 SYSTÈME SAIN";
        let oracleVerdict = "N/A";
        let oracleReason = "N/A";
        let techDetails = "Aucun";

        try {
            // 1. Récupérer l'état du moteur
            const resStatus = await fetch('/api/system/apply-status');
            const dataStatus = await resStatus.json();
            
            if (dataStatus.status !== 'OK') {
                statusReport = `🔴 ALERTE [${dataStatus.status}] : ${dataStatus.message}`;
                techDetails = dataStatus.details || "Inconnus";
                
                // 2. Récupérer le verdict de l'Oracle si disponible
                const resOracle = await fetch('/api/system/oracle', { method: 'POST' });
                const dataOracle = await resOracle.json();
                oracleVerdict = dataOracle.verdict;
                oracleReason = dataOracle.reason;
            }
        } catch (e) {}

        const report = `🚨 RAPPORT AUTOMATIQUE (REVERT TRIGGERED)
--------------------------------------------------
👤 Dev: ${user?.firstName || 'Inconnu'}
📅 Date: ${new Date().toLocaleString()}

1️⃣ ÉTAT DU SYSTÈME :
${statusReport}
🔍 Détails techniques : ${techDetails}

2️⃣ JUGEMENT DE L'ORACLE :
⚖️ Verdict : ${oracleVerdict}
🗣️ Raison  : "${oracleReason}"

3️⃣ LOGS CONSOLE :
${errors.length > 0 ? errors.map(e => `[${e.time}] ${e.msg}`).join('\n') : "(Vide)"}

--------------------------------------------------
GEMINI : Le code précédent a causé une régression. Analyse la raison et renvoie le fichier CORRIGÉ.`;

        try {
            await navigator.clipboard.writeText(report);
            setBannerVisible(true);
            setTimeout(() => setBannerVisible(false), 3000);
        } catch (err) {
            alert("Erreur copie : Autorisez l'accès au presse-papier.");
        }
    };

    if (!bannerVisible) return null;

    return (
        <div className="error-banner-minimal show copied">
            <div className="banner-content">
                <span className="banner-icon">📋</span>
                <span className="banner-text">RAPPORT D'INCIDENT COPIÉ !</span>
                <span className="banner-hint">COLLE-LE DANS LE CHAT</span>
            </div>
        </div>
    );
}