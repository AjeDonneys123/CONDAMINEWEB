import React, { useState, useEffect } from 'react';
import './SystemStatus.css';

export default function SystemStatus() {
    const [statusData, setStatusData] = useState({ status: 'OK' });
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/system/apply-status');
                const data = await res.json();
                
                if (data.status !== 'OK') {
                    setStatusData(data);
                    setVisible(true);
                } else if (visible) {
                    setTimeout(() => setVisible(false), 2000);
                }
            } catch (e) {}
        };
        const interval = setInterval(checkStatus, 1000);
        return () => clearInterval(interval);
    }, [visible]);

    let statusClass = 'status-ok';
    if (statusData.status === 'ERROR') statusClass = 'status-error';
    if (statusData.status === 'REJECTED') statusClass = 'status-rejected';
    if (statusData.status === 'WARNING') statusClass = 'status-warning';

    const title = statusData.status === 'REJECTED' ? 'CODE REFUSÉ (HERMÉTICITÉ)' : 
                  statusData.status === 'ERROR' ? 'ERREUR SYSTÈME' : 'ATTENTION';

    return (
        <div className={`system-status-banner-flow ${visible ? 'show' : 'hide'} ${statusClass}`}>
            <div className="system-status-content-wrapper">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{statusData.status === 'REJECTED' ? '🛡️' : '⚠️'}</span>
                        <span className="text-lg font-black uppercase tracking-widest">{title}</span>
                    </div>
                    <span className="text-sm font-bold opacity-90 mt-1">{statusData.message}</span>
                </div>
                <button onClick={() => setVisible(false)} className="bg-white/20 hover:bg-white/40 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
            </div>
        </div>
    );
}
