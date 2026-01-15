import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('name');

  const checkUser = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login-step-1', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ firstName: fName, lastName: lName })
    }).then(r => r.json());

    if (res.isTeacher || res.isNew) setStep('password');
    else if (res.isStudent) {
        localStorage.setItem('player', JSON.stringify(res.user));
        onLoginSuccess(res.user);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login-step-2', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ firstName: fName, lastName: lName, password })
    }).then(r => r.json());

    if (res.ok) {
        localStorage.setItem('player', JSON.stringify(res.user));
        onLoginSuccess(res.user);
    } else alert("Erreur d'accès");
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h2 className="login-title">CONDACLASSE</h2>
        {step === 'name' ? (
            <form onSubmit={checkUser} className="login-inputs">
                <input className="login-field" placeholder="Prénom" value={fName} onChange={e=>setFName(e.target.value)} required />
                <input className="login-field" placeholder="Nom" value={lName} onChange={e=>setLName(e.target.value)} required />
                <button className="login-submit-btn">Continuer</button>
            </form>
        ) : (
            <form onSubmit={handleAuth} className="login-inputs">
                <input type="password" className="login-field" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
                <button className="login-submit-btn">Se connecter</button>
            </form>
        )}
      </div>
    </div>
  );
}