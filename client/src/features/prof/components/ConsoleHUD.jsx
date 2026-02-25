// @signatures: ConsoleHUD
import React, { useState, useEffect } from 'react';

export default function ConsoleHUD() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const originalLog = console.log;
        const originalError = console.error;

        const addLog = (msg, type = 'info') => {
            setLogs(prev => [...prev, { id: Date.now() + Math.random(), text: String(msg), type }].slice(-8));
        };

        // Capture des logs standards
        console.log = (...args) => {
            addLog(args.join(' '), 'info');
            originalLog.apply(console, args);
        };

        // Capture des erreurs console
        console.error = (...args) => {
            addLog(args.join(' '), 'error');
            originalError.apply(console, args);
        };

        // Capture des erreurs fatales système (Moteur dynamique)
        const handleGlobalError = (event) => {
            addLog(`💥 SYSTÈME : ${event.message}`, 'error');
        };

        window.addEventListener('error', handleGlobalError);

        return () => {
            console.log = originalLog;
            console.error = originalError;
            window.removeEventListener('error', handleGlobalError);
        };
    }, []);

    if (logs.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 flex flex-col gap-1 z-[20000] pointer-events-none">
            {logs.map((l) => (
                <div key={l.id} className={`px-3 py-1 rounded text-[9px] font-mono shadow-lg border-l-4 ${
                    l.type === 'error' ? 'bg-red-900/90 text-red-200 border-red-500' : 'bg-black/80 text-green-400 border-green-500'
                }`}>
                    {l.text}
                </div>
            ))}
        </div>
    );
}