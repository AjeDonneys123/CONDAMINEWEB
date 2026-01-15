import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager({ globalClass }) {
  const [players, setPlayers] = useState([]);
  useEffect(() => { fetch('/api/players').then(r => r.json()).then(setPlayers); }, []);
  const filtered = players.filter(p => p.classroom === globalClass);

  return (
    <div className="bg-white rounded-[30px] border overflow-hidden">
        <table className="students-table">
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id}>
                        <td>{p.firstName} {p.lastName}</td>
                        <td className="text-right"><button className="text-indigo-600 font-black text-[10px]">DOSSIER</button></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
}