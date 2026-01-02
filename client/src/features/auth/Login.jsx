import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const isProf = fName.toLowerCase() === 'jean' && lName.toLowerCase() === 'vuillet';

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: fName, lastName: lName, password })
    }).then(r => r.json());

    if (res.ok) {
        localStorage.setItem('player', JSON.stringify(res));
        onLoginSuccess(res);
    } else alert("Accès refusé");
  };

  return (
    <div className="login-screen">
      <form onSubmit={handleLogin} className="login-card">
        <h2 className="login-title">Condamine</h2>
        <input className="login-input" placeholder="Prénom" value={fName} onChange={e => setFName(e.target.value)} />
        <input className="login-input" placeholder="Nom" value={lName} onChange={e => setLName(e.target.value)} />
        {isProf && <input type="password" placeholder="Mot de passe Maître" className="login-input prof-border" value={password} onChange={e => setPassword(e.target.value)} />}
        <button className="login-btn">ENTRER</button>
      </form>
    </div>
  );
}