import React, { useState, useEffect } from 'react';

export default function ConsoleHUD() {
    const [logs, setLogs] = useState([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const originalError = console.error;
        const originalLog = console.log;

        console.error = (...args) => {
            setLogs(prev => [...prev, { type: 'error', text: args.join(' '), time: new Date().toLocaleTimeString() }].slice(-20));
            setIsVisible(true);
            originalError.apply(console, args);
        };

        console.log = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('[API]')) {
                setLogs(prev => [...prev, { type: 'info', text: args.join(' '), time: new Date().toLocaleTimeString() }].slice(-20));
            }
            originalLog.apply(console, args);
        };

        return () => {
            console.error = originalError;
            console.log = originalLog;
        };
    }, []);

    if (!isVisible && logs.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] pointer-events-none">
            <div className="max-w-xl bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10 pointer-events-auto max-h-60 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Console HUD (Dernières erreurs)</span>
                    <button onClick={() => setLogs([])} className="text-[10px] text-red-400 font-bold uppercase">Vider</button>
                </div>
                <div className="space-y-1">
                    {logs.map((log, i) => (
                        <div key={i} className={`text-[11px] font-mono p-1 rounded ${log.type === 'error' ? 'bg-red-500/20 text-red-300' : 'text-emerald-300'}`}>
                            <span className="opacity-40 mr-2">[{log.time}]</span>
                            {log.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}