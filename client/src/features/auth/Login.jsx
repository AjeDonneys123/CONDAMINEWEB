import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [classroom, setClassroom] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isProfAttempt = fName.toLowerCase().trim() === 'jean' && lName.toLowerCase().trim() === 'vuillet';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: fName, lastName: lName, classroom, password })
        }).then(r => r.json());

        if (res.ok) {
            localStorage.setItem('player', JSON.stringify(res));
            onLoginSuccess(res);
        } else {
            alert(res.message || "Accès refusé");
        }
    } catch (err) {
        alert("Serveur hors-ligne.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <form onSubmit={handleLogin} className="login-card">
        <h2 className="login-title">CONDAMINE</h2>
        
        <div className="login-inputs">
            <input className="login-field" placeholder="Ton Prénom" value={fName} onChange={e => setFName(e.target.value)} required />
            <input className="login-field" placeholder="Ton Nom" value={lName} onChange={e => setLName(e.target.value)} required />
            
            {isProfAttempt ? (
                <input type="password" placeholder="Mot de passe Maître" className="login-field prof-focus" value={password} onChange={e => setPassword(e.target.value)} required />
            ) : (
                <select className="login-field" value={classroom} onChange={e => setClassroom(e.target.value)} required>
                    <option value="">-- Choisis ta classe --</option>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                    <option value="2A">2de A</option><option value="2CD">2de CD</option>
                </select>
            )}
        </div>

        <button type="submit" className="login-submit-btn" disabled={loading}>
            {loading ? 'CHARGEMENT...' : 'CONNEXION'}
        </button>
      </form>
    </div>
  );
}