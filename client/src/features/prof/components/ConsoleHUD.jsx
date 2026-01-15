import React, { useState, useEffect } from 'react';
export default function ConsoleHUD() {
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        const log = console.log;
        console.log = (...args) => { setLogs(prev => [...prev, args.join(' ')].slice(-5)); log.apply(console, args); };
    }, []);
    if (logs.length === 0) return null;
    return <div className="fixed bottom-4 left-4 bg-black/80 text-green-400 p-2 rounded text-[8px] font-mono z-[9999]">{logs.map((l, i) => <div key={i}>{l}</div>)}</div>;
}