import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('');
  const [step, setStep] = useState('name'); // name, password, subject
  const [loading, setLoading] = useState(false);

  const checkUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/login-step-1', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ firstName: fName, lastName: lName })
    }).then(r => r.json());

    if (res.isTeacher || res.isNew) {
        setStep('password');
    } else if (res.isStudent) {
        localStorage.setItem('player', JSON.stringify(res.user));
        onLoginSuccess(res.user);
    } else {
        alert("Utilisateur inconnu");
    }
    setLoading(false);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/login-step-2', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ firstName: fName, lastName: lName, password, subject })
    }).then(r => r.json());

    if (res.ok) {
        if (res.needsSubject) {
            setStep('subject');
        } else {
            localStorage.setItem('player', JSON.stringify(res.user));
            onLoginSuccess(res.user);
        }
    } else {
        alert(res.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-card animate-in zoom-in">
        <h2 className="login-title">CONDACLASSE</h2>
        
        {step === 'name' && (
            <form onSubmit={checkUser} className="login-inputs">
                <input className="login-field" placeholder="Prénom" value={fName} onChange={e=>setFName(e.target.value)} required />
                <input className="login-field" placeholder="Nom" value={lName} onChange={e=>setLName(e.target.value)} required />
                <button className="login-submit-btn">Continuer</button>
            </form>
        )}

        {step === 'password' && (
            <form onSubmit={handleAuth} className="login-inputs">
                <p className="text-xs font-bold text-indigo-500 uppercase mb-2">Code d'accès requis</p>
                <input type="password" autofocus className="login-field" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
                <button className="login-submit-btn">Se connecter</button>
                <button type="button" onClick={()=>setStep('name')} className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Retour</button>
            </form>
        )}

        {step === 'subject' && (
            <form onSubmit={handleAuth} className="login-inputs">
                <p className="text-xs font-bold text-indigo-500 uppercase mb-2">Bienvenue ! Ta matière ?</p>
                <input autofocus className="login-field" placeholder="ex: Mathématiques, Histoire..." value={subject} onChange={e=>setSubject(e.target.value)} required />
                <button className="login-submit-btn">Commencer</button>
            </form>
        )}
      </div>
    </div>
  );
}