import React, { useState, useEffect } from 'react';

export default function StudentsTab() {
  const [players, setPlayers] = useState([]);
  const [filterClass, setFilterClass] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/players').then(res => res.json()).then(setPlayers).catch(console.error);
  }, []);

  const handleReset = async (id) => {
    if(!window.confirm("Supprimer cet élève ?")) return;
    try {
        await fetch(`/api/players/${id}`, { method: 'DELETE' });
        setPlayers(prev => prev.filter(p => p._id !== id));
    } catch(e) { alert("Erreur suppression"); }
  };

  const handleTestClass = async () => {
    const targetClass = filterClass === 'all' ? '6D' : filterClass;
    const dummyData = { firstName: "Élève", lastName: "Test", classroom: targetClass };
    
    // On crée un compte temporaire
    const res = await fetch('/api/register', {
        method: 'POST', 
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(dummyData)
    });
    const data = await res.json();
    if(data.ok) {
        localStorage.setItem("player", JSON.stringify(data));
        // On force le rechargement pour passer en mode élève
        window.location.href = '/dashboard';
    }
  };

  const filteredPlayers = players.filter(p => {
    const matchClass = filterClass === 'all' || p.classroom === filterClass;
    const matchName = (p.firstName + ' ' + p.lastName).toLowerCase().includes(search.toLowerCase());
    return matchClass && matchName;
  });

  return (
    <div>
      <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'center'}}>
        <select 
            className="form-select" style={{flex:1}}
            value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
        >
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2de A</option>
        </select>
        
        <button 
            className="btn-primary" 
            style={{flex:1, backgroundColor:'#3b82f6'}}
            onClick={handleTestClass}
        >
            🎮 Tester la classe
        </button>
      </div>
      
      <input 
        className="form-input" 
        style={{marginBottom:'15px'}}
        placeholder="Rechercher un élève..." 
        value={search} onChange={(e) => setSearch(e.target.value)}
      />

      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead style={{background:'#f8fafc'}}>
            <tr>
                <th style={{padding:'10px', textAlign:'left'}}>Nom</th>
                <th style={{padding:'10px', textAlign:'left'}}>Classe</th>
                <th style={{padding:'10px', textAlign:'center'}}>Actions</th>
            </tr>
        </thead>
        <tbody>
            {filteredPlayers.map(p => (
                <tr key={p._id} style={{borderBottom:'1px solid #eee'}}>
                    <td style={{padding:'10px'}}><strong>{p.firstName}</strong> {p.lastName}</td>
                    <td style={{padding:'10px'}}>{p.classroom}</td>
                    <td style={{padding:'10px', textAlign:'center'}}>
                        <button 
                            onClick={() => handleReset(p._id)}
                            style={{color:'#dc2626', background:'#fee2e2', border:'none', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}
                        >
                            Supprimer
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

