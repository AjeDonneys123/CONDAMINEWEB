import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager() {
  const [players, setPlayers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const data = await fetch('/api/players').then(r => r.json());
    setPlayers(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleTest = async () => {
    if(filter === 'all') return alert("Classe ?");
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ firstName: "Eleve", lastName: "Test", classroom: filter })
    }).then(r => r.json());
    if (res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); }
  };

  const filtered = players.filter(p => (filter === 'all' || p.classroom === filter) && (p.firstName + p.lastName).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="manager-container">
      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
        </select>
        <button onClick={handleTest} className="btn-test-class">🎮 TESTER LA CLASSE</button>
      </div>
      <input className="search-input" placeholder="🔍 Chercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="table-wrapper">
        <table className="students-table">
            <thead><tr><th>Nom</th><th>Classe</th><th>Actions</th></tr></thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id}>
                        <td className="name-cell">{p.firstName} {p.lastName}</td>
                        <td className="class-cell"><span>{p.classroom}</span></td>
                        <td className="action-cell">
                            <button onClick={async () => { if(confirm("Reset ?")) { await fetch('/api/reset-player', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({playerId: p._id})}); load(); } }}>Reset</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}