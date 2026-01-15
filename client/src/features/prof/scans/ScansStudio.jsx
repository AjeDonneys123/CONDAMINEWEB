import React, { useState, useEffect } from 'react';
import './ScansStudio.css';

export default function ScansStudio({ globalClass }) {
    const [sessions, setSessions] = useState([]);
    useEffect(() => { fetch('/api/scans/sessions').then(r => r.json()).then(setSessions); }, []);
    return (
        <div className="space-y-4">
            {sessions.filter(s => s.classroom === globalClass).map(s => (
                <div key={s._id} className="bg-white p-4 rounded-2xl border flex justify-between items-center">
                    <b className="uppercase">{s.title}</b>
                    <button className="tool-btn">SNAP</button>
                </div>
            ))}
        </div>
    );
}