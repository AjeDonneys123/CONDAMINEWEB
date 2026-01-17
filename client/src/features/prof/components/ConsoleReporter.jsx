import React, { useState, useEffect } from 'react';
import './ConsoleReporter.css';

export default function ConsoleReporter({ user }) {
    const [errors, setErrors] = useState([]);
    const [bannerVisible, setBannerVisible] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    useEffect(() => {
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
            // Filtre les bruits React habituels
            if(!msg.includes('snapshot') && !msg.includes('React') && !msg.includes('key')) {
                handleNewError(`CONSOLE: ${msg}`);
            }
            originalError.apply(console, args);
        };

        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const res = await originalFetch(...args);
                
                // INTERCEPTION INTELLIGENTE DES ERREURS
                if (!res.ok && !args[0].includes('report-')) {
                    const method = args[1]?.method || 'GET';
                    let detail = "";
                    
                    try {
                        // On clone la réponse pour lire le JSON sans la consommer pour l'app
                        const clone = res.clone();
                        const json = await clone.json();
                        detail = json.error || json.message || "";
                    } catch (e) {
                        detail = "Erreur inconnue";
                    }

                    handleNewError(`ERR ${res.status}: ${detail} (${method} ${args[0]})`);
                }
                return res;
            } catch (err) {
                if (!args[0].includes('report-')) handleNewError(`CRASH RÉSEAU: ${args[0]}`);
                throw err;
            }
        };

        const handleKeyDown = (e) => {
            if (e.metaKey && e.shiftKey && e.code === 'KeyL') {
                e.preventDefault();
                copyToClipboard();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            console.error = originalError;
            window.fetch = originalFetch;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [errors]);

    const handleNewError = (msg) => {
        // On évite les doublons visuels
        setErrors(prev => {
            const isDuplicate = prev.length > 0 && prev[prev.length - 1].msg === msg;
            if (isDuplicate) return prev;
            return [...prev, { msg, time: new Date().toLocaleTimeString() }].slice(-15);
        });
        setBannerVisible(true);
    };

    const copyToClipboard = () => {
        if (errors.length === 0) return;
        const payload = `[REPORT_MAC_TURBO]\nPage: ${window.location.href}\nStaff: ${user?.firstName}\n\nLOGS D'ERREURS :\n${errors.map(e => `[${e.time}] ${e.msg}`).join('\n')}\n\nGemini, répare mon code via snapshot.txt.`;
        navigator.clipboard.writeText(payload).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    if (!bannerVisible && errors.length === 0) return null;

    // Récupération de la dernière erreur pour l'affichage
    const lastError = errors.length > 0 ? errors[errors.length - 1] : { msg: '' };

    return (
        <div className={`error-banner-minimal ${bannerVisible ? 'show' : ''} ${copySuccess ? 'copied' : ''}`} onClick={() => setBannerVisible(false)}>
            <div className="banner-content">
                <span className="banner-icon">{copySuccess ? '✅' : '🚨'}</span>
                <span className="banner-text">
                    {copySuccess ? 'RAPPORT COPIÉ ! COLLE-LE DANS GEMINI' : `${lastError.msg}`}
                </span>
                {!copySuccess && <span className="banner-hint">⌘+⇧+L</span>}
            </div>
        </div>
    );
}