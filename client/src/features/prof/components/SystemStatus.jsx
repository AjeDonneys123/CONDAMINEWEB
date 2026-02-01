// @signatures: SystemStatus, askOracle, handleRevertAndReport
import React, { useState, useEffect, useRef } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK', timestamp: 0 });
    const [visible, setVisible] = useState(false);
    const [isManuallyHidden, setIsManuallyHidden] = useState(false); 
    const [version, setVersion] = useState('1');
    const [verdict, setVerdict] = useState(null); 
    const [reverting, setReverting] = useState(false);
    const [retryCount, setRetryCount] = useState(0); 
    
    const lastTimestampRef = useRef(0);
    const fetchingRef = useRef(false);

    useEffect(() => { 
        // On s'assure d'appeler /api/system/version
        fetch('/api/system/version')
            .then(r => r.ok ? r.json() : { hash: '?' })
            .then(d => setVersion(d.hash))
            .catch(() => setVersion('OFFLINE'));
    }, []);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Appel vers la route système
                const res = await fetch('/api/system/apply-status');
                if (!res.ok) {
                    setRetryCount(prev => prev + 1);
                    return;
                }
                
                const data = await res.json();
                if (data.status === 'OK') {
                    if (visible) { 
                        setVisible(false); setVerdict(null); 
                        setIsManuallyHidden(false); setRetryCount(0);
                    }
                    return;
                }

                setStatusData(data);
                if (data.timestamp !== lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    setVisible(true);
                } 
            } catch (e) {
                setRetryCount(prev => prev + 1);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [visible]);

    const handleRevertAndReport = async () => {
        setReverting(true);
        try {
            await fetch('/api/system/revert', { method: 'POST' });
            window.location.reload();
        } catch(e) { setReverting(false); }
    };

    const shouldShow = visible && !isManuallyHidden;
    let bgClass = "bg-orange-500 border-orange-700"; 
    let messageIA = "🔮 AUDIT SYSTÈME...";
    
    if (retryCount >= 5) {
        bgClass = "bg-red-500 border-red-700";
        messageIA = "⚠️ SERVEUR BACKEND INJOIGNABLE";
    }

    if (!shouldShow && retryCount < 5) return null;

    return (
        <div className={`system-status-banner-flow ${bgClass} show`}>
            <div className="system-status-content-wrapper">
                <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded font-black tracking-widest">SYSTEM {version}</span>
                        <span className="text-[11px] font-black uppercase">{messageIA}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                    <button onClick={handleRevertAndReport} disabled={reverting} className="bg-black/40 hover:bg-black/60 px-4 py-2 rounded-lg font-black text-[10px] uppercase border border-white/20 shadow-lg">
                        {reverting ? 'REVERT...' : '🚑 REVERT D\'URGENCE'}
                    </button>
                    <button onClick={() => setIsManuallyHidden(true)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all">✕</button>
                </div>
            </div>
        </div>
    );
}
