import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [status, setStatus] = useState({ status: 'OK' });
    const [visible, setVisible] = useState(false);
    const inFlightRef = useRef(false);

    useEffect(() => {
        let mounted = true;
        const checkStatus = async () => {
            if (inFlightRef.current) return;
            inFlightRef.current = true;
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                if (!mounted) return;
                if (data.status !== 'OK') {
                    setStatus(data);
                    setVisible(true);
                } else {
                    setVisible(false);
                }
            } catch (e) {
                console.warn('[CondaWeb statut système] erreur', e);
            } finally {
                inFlightRef.current = false;
            }
        };
        checkStatus();
        // This endpoint calculates AI quota status. It is not a live control
        // signal and must not be queried once per second throughout the app.
        const interval = setInterval(checkStatus, 30000);

        return () => { mounted = false; clearInterval(interval); };
    }, []);

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
        </>
    );
}
