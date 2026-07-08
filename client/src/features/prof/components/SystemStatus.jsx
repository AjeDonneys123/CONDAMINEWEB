import React, { useState, useEffect } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [status, setStatus] = useState({ status: 'OK' });
    const [aiStatus, setAiStatus] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let tick = 0;
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                if (data.status !== 'OK') {
                    setStatus(data);
                    setVisible(true);
                } else if (visible) {
                    setTimeout(() => setVisible(false), 2000);
                }

                tick += 1;
                if (tick === 1 || tick % 10 === 0) {
                    const aiRes = await fetch('/api/system/ai-status');
                    const aiData = aiRes.ok ? await aiRes.json() : null;
                    setAiStatus(aiData);
                    if (aiData?.localAi && aiData?.status === 'ERROR') {
                        setStatus({
                            status: 'WARNING',
                            message: 'IA locale indisponible',
                            details: aiData.message
                        });
                        setVisible(true);
                    }
                }
            } catch (e) {}
        }, 1000); // Check chaque seconde

        return () => clearInterval(interval);
    }, [visible]);

    const colors = {
        'ERROR': 'bg-red-600 border-red-800',
        'WARNING': 'bg-yellow-500 border-yellow-600',
        'OK': 'bg-green-600 border-green-800'
    };

    return (
        <>
            {visible && (
                <div className={`fixed top-0 left-0 right-0 z-[100000] p-4 text-white font-black shadow-2xl flex items-center justify-between border-b-4 transition-all duration-300 transform translate-y-0 ${colors[status.status] || 'bg-slate-800'}`}>
                    <div className="flex flex-col">
                        <span className="text-lg uppercase tracking-widest">{status.status === 'ERROR' ? '⛔ BLOCAGE SYSTÈME' : '⚠️ AVERTISSEMENT'}</span>
                        <span className="text-sm opacity-90">{status.message}</span>
                        {status.details && <span className="text-xs font-mono bg-black/20 p-1 mt-1 rounded">{status.details}</span>}
                    </div>
                    <button onClick={() => setVisible(false)} className="bg-white/20 hover:bg-white/40 rounded-full w-10 h-10 flex items-center justify-center font-bold">✕</button>
                </div>
            )}
            {aiStatus?.localAi && aiStatus?.status === 'OK' && (
                <div className="fixed bottom-3 left-3 z-[99999] rounded-2xl bg-emerald-600 text-white shadow-xl border border-emerald-400/60 px-4 py-3 font-black text-[10px] uppercase tracking-widest flex flex-col gap-1 max-w-[280px]">
                    <span>🧠 IA locale active</span>
                    <span className="font-mono opacity-80 normal-case tracking-normal truncate">{aiStatus.defaultModel || aiStatus.url}</span>
                </div>
            )}
        </>
    );
}
