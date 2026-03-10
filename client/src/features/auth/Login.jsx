// @signatures: Login, handleLogin, handleReset, handleSelectSuggestion
import React, { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [allUsersData, setAllUsersData] = useState([]);
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const clean = (str) => (str || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  useEffect(() => {
    setLoading(true);
    fetch('/api/auth/finder-data')
      .then(res => res.json())
      .then(data => {
        setAllUsersData(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProfile) return;
    const sClass = clean(inputClass);
    const sLast = clean(inputLast);
    const sFirst = clean(inputFirst);

    if (!sClass && !sLast && !sFirst) {
      setSuggestions([]);
      return;
    }

    // Suggestions visibles: élèves uniquement (les profs ne sont jamais listés).
    const matches = allUsersData.filter(s => {
      if (s.type !== 'student') return false;
      const matchClass = s.className ? clean(s.className).includes(sClass) : !sClass;
      const matchLast = s.lastName ? clean(s.lastName).includes(sLast) : true;
      const matchFirst = s.firstName ? clean(s.firstName).includes(sFirst) : true;
      return matchClass && matchLast && matchFirst;
    });

    setSuggestions(matches.slice(0, 10));
  }, [inputClass, inputLast, inputFirst, allUsersData, selectedProfile]);

  const handleSelectSuggestion = (profile) => {
    setSelectedProfile(profile);
    setInputClass(profile.className || '');
    setInputLast(profile.lastName || '');
    setInputFirst(profile.firstName || '');
    setSuggestions([]);
    setPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedProfile) {
      // Détection silencieuse d'un prof saisi à la main (sans suggestion affichée).
      const typedFirst = clean(inputFirst);
      const typedLast = clean(inputLast);
      const teacherMatch = allUsersData.find(p =>
        p.type === 'teacher' &&
        clean(p.firstName) === typedFirst &&
        clean(p.lastName) === typedLast
      );
      if (teacherMatch) {
        handleSelectSuggestion(teacherMatch);
      }
      return;
    }
    setLoading(true);

    const isTeacher = selectedProfile.type === 'teacher';
    const loginUrl = isTeacher ? '/api/auth/login' : '/api/eleve/auth/login';
    const body = isTeacher
      ? { firstName: selectedProfile.firstName, lastName: selectedProfile.lastName, password }
      : { studentId: selectedProfile.id, password };

    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('player', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        alert(data.message || "Identifiants incorrects");
      }
    } catch (e2) {
      alert("Le serveur est injoignable.");
    }
    setLoading(false);
  };

  const isTeacherProfile = selectedProfile?.type === 'teacher';
  const isStudentProfile = selectedProfile?.type === 'student';
  const isTestStudentProfile = isStudentProfile && clean(selectedProfile?.lastName) === 'test';
  const hasTypedIdentity = clean(inputLast).length > 0 && clean(inputFirst).length > 0;
  const canSubmit = selectedProfile
    ? (isTestStudentProfile || password.trim().length > 0)
    : hasTypedIdentity;

  return (
    <div className="login-screen">
      <div className="login-card narrow">
        <h2 className="app-logo">Connexion</h2>
        <p className="app-subtitle">Nom, prénom, classe. Le profil est détecté automatiquement.</p>

        <form onSubmit={handleLogin} className="login-inputs mt-6">
          <div className="finder-wrapper">
            <input
              className="login-field"
              placeholder="Classe (élève uniquement, ex: 6A)"
              value={inputClass}
              onChange={e => {
                setInputClass(e.target.value);
                if (selectedProfile) { setSelectedProfile(null); setPassword(''); }
              }}
            />

            <div className="finder-row">
              <div className="finder-col-name">
                <input
                  className="login-field"
                  placeholder="Nom"
                  value={inputLast}
                  onChange={e => {
                    setInputLast(e.target.value);
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); }
                  }}
                />
              </div>
              <div className="finder-col-name">
                <input
                  className="login-field"
                  placeholder="Prénom"
                  value={inputFirst}
                  onChange={e => {
                    setInputFirst(e.target.value);
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); }
                  }}
                />
              </div>
            </div>

            {!isTeacherProfile && suggestions.length > 0 && (
              <div className="suggestions-box custom-scrollbar">
                {suggestions.map(s => (
                  <div key={`${s.type}-${s.id}`} className="suggestion-item" onClick={() => handleSelectSuggestion(s)}>
                    <span>{s.firstName} <strong>{s.lastName}</strong></span>
                    <span className="suggestion-detail">{s.className || ''}</span>
                  </div>
                ))}
              </div>
            )}
            {!selectedProfile && suggestions.length === 0 && (inputClass || inputLast || inputFirst) && !loading && (
              <div className="text-xs text-slate-400 text-center italic">Aucun profil trouvé.</div>
            )}
          </div>

          {(isTeacherProfile || isStudentProfile) && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="login-field"
                placeholder={isStudentProfile
                  ? (isTestStudentProfile ? "Aucun mot de passe requis (profil TEST)" : "Date de naissance ex: 05/03/2004")
                  : "Mot de passe professeur"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required={!isTestStudentProfile}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-black text-slate-400"
              >
                {showPassword ? "Cacher" : "Voir"}
              </button>
            </div>
          )}

          <button className="login-submit-btn" disabled={loading || !canSubmit}>
            {loading ? 'Connexion...' : 'Entrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
