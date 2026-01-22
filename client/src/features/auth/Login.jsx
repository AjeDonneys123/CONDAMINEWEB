import React, { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState(null);
  
  // --- FINDER STATE ---
  const [allStudentsData, setAllStudentsData] = useState([]); // Données brutes légères
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeField, setActiveField] = useState(null);

  // --- STAFF STATE ---
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);

  // Charger la liste légère au montage si mode élève
  useEffect(() => {
    if (mode === 'student') {
        setLoading(true);
        fetch('/api/auth/finder-data')
            .then(res => res.json())
            .then(data => {
                setAllStudentsData(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }
  }, [mode]);

  // --- MOTEUR DE RECHERCHE CROISÉ ---
  useEffect(() => {
    if (selectedStudent) return; // Si déjà choisi, pas de suggestions

    const clean = (str) => str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const sClass = clean(inputClass);
    const sLast = clean(inputLast);
    const sFirst = clean(inputFirst);

    if (!sClass && !sLast && !sFirst) {
        setSuggestions([]);
        return;
    }

    const matches = allStudentsData.filter(s => {
        const matchClass = s.className ? clean(s.className).includes(sClass) : true;
        const matchLast = s.lastName ? clean(s.lastName).includes(sLast) : true;
        const matchFirst = s.firstName ? clean(s.firstName).includes(sFirst) : true;
        return matchClass && matchLast && matchFirst;
    });

    setSuggestions(matches.slice(0, 8)); // Max 8 suggestions
  }, [inputClass, inputLast, inputFirst, allStudentsData, selectedStudent]);

  const handleSelectSuggestion = (s) => {
      setSelectedStudent(s);
      setInputClass(s.className || '');
      setInputLast(s.lastName);
      setInputFirst(s.firstName);
      setSuggestions([]);
  };

  const handleReset = () => {
      setSelectedStudent(null);
      setInputClass('');
      setInputLast('');
      setInputFirst('');
      setSuggestions([]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let roleToSend = 'STUDENT';
    if (mode === 'teacher') roleToSend = 'TEACHER';
    if (mode === 'admin') roleToSend = 'ADMIN';
    
    const body = (roleToSend === 'TEACHER' || roleToSend === 'ADMIN')
        ? { role: roleToSend, firstName: fName, lastName: lName, password }
        : { role: 'STUDENT', studentId: selectedStudent?.id };

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('player', JSON.stringify(data.user));
            onLoginSuccess(data.user);
        } else {
            alert(data.message || "Identifiants incorrects");
        }
    } catch(e) { alert("Le serveur est injoignable."); }
    setLoading(false);
  };

  // 1. ÉCRAN DE SÉLECTION DU RÔLE
  if (!mode) {
    return (
        <div className="login-screen">
            <div className="login-card">
                <h1 className="app-logo">Condamine Pro</h1>
                <p className="app-subtitle">Choisissez votre espace de connexion</p>
                <div className="role-grid">
                    <div className="role-card role-student" onClick={() => setMode('student')}>
                        <span className="role-icon">👨‍🎓</span>
                        <span className="role-label">Élève</span>
                    </div>
                    <div className="role-card role-teacher" onClick={() => setMode('teacher')}>
                        <span className="role-icon">👨‍🏫</span>
                        <span className="role-label">Enseignant</span>
                    </div>
                    <div className="role-card role-admin" onClick={() => setMode('admin')}>
                        <span className="role-icon">🛡️</span>
                        <span className="role-label">Administrateur</span>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // 2. FORMULAIRES
  return (
    <div className="login-screen">
      <div className="login-card narrow">
        <button onClick={() => { setMode(null); handleReset(); }} className="back-btn">⬅ Changer de rôle</button>
        
        <h2 className="app-logo">
            {mode === 'student' ? 'Espace Élève' : (mode === 'teacher' ? 'Espace Prof' : 'Administration')}
        </h2>

        <form onSubmit={handleLogin} className="login-inputs mt-6">
            
            {/* --- MODE ÉLÈVE (NOUVEAU FINDER 3 CHAMPS) --- */}
            {mode === 'student' && (
                <>
                    {!selectedStudent ? (
                        <div className="finder-wrapper">
                            {/* LIGNE 1 : CLASSE */}
                            <input 
                                className="login-field" 
                                placeholder="Classe (ex: 6A)" 
                                value={inputClass}
                                onChange={e => setInputClass(e.target.value)}
                                onFocus={() => setActiveField('class')}
                            />
                            
                            {/* LIGNE 2 : NOM & PRENOM */}
                            <div className="finder-row">
                                <div className="finder-col-name">
                                    <input 
                                        className="login-field" 
                                        placeholder="Nom" 
                                        value={inputLast}
                                        onChange={e => setInputLast(e.target.value)}
                                        onFocus={() => setActiveField('last')}
                                    />
                                </div>
                                <div className="finder-col-name">
                                    <input 
                                        className="login-field" 
                                        placeholder="Prénom" 
                                        value={inputFirst}
                                        onChange={e => setInputFirst(e.target.value)}
                                        onFocus={() => setActiveField('first')}
                                    />
                                </div>
                            </div>

                            {/* LISTE DE SUGGESTIONS INTELLIGENTE */}
                            {suggestions.length > 0 && (
                                <div className="suggestions-box custom-scrollbar">
                                    {suggestions.map(s => (
                                        <div key={s.id} className="suggestion-item" onClick={() => handleSelectSuggestion(s)}>
                                            <span>{s.firstName} <strong>{s.lastName}</strong></span>
                                            <span className="suggestion-detail">{s.className}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {suggestions.length === 0 && (inputClass || inputLast || inputFirst) && (
                                <div className="text-xs text-slate-400 text-center italic">Aucun élève trouvé.</div>
                            )}
                        </div>
                    ) : (
                        <div className="selected-student-card animate-in">
                            <span>✅ {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.className})</span>
                            <button type="button" onClick={handleReset} className="reset-selection-btn">✕</button>
                        </div>
                    )}
                </>
            )}

            {/* --- MODE STAFF --- */}
            {(mode === 'teacher' || mode === 'admin') && (
                <div className="space-y-4">
                    <input className="login-field" placeholder="Prénom" value={fName} onChange={e=>setFName(e.target.value)} required />
                    <input className="login-field" placeholder="Nom" value={lName} onChange={e=>setLName(e.target.value)} required />
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} className="login-field" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-black text-slate-400">
                            {showPassword ? "Cacher" : "Voir"}
                        </button>
                    </div>
                </div>
            )}

            <button className="login-submit-btn" disabled={loading || (mode === 'student' && !selectedStudent)}>
                {loading ? 'Connexion...' : 'Entrer'}
            </button>
        </form>
      </div>
    </div>
  );
}