// @signatures: Login, handleLogin, handleReset, handleSelectSuggestion
import React, { useState, useEffect, useRef } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [allUsersData, setAllUsersData] = useState([]);
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordActionLoading, setPasswordActionLoading] = useState(false);
  const [showStudentPasswordSetup, setShowStudentPasswordSetup] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef(null);
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
    fetch('/api/auth/google-client-config')
      .then(res => res.json())
      .then(data => {
        const cid = String(data?.clientId || '').trim();
        if (cid) setGoogleClientId(cid);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const clientId = String(googleClientId || '').trim();
    if (!clientId) return;
    let cancelled = false;
    const boot = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => handleGoogleLogin(response?.credential || '')
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 320
      });
      setGoogleReady(true);
    };
    const existing = document.getElementById('google-identity-script');
    if (existing) {
      boot();
      return () => { cancelled = true; };
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = boot;
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [googleClientId]);

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
    setConfirmPassword('');
    setShowStudentPasswordSetup(false);
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

  const handleGoogleLogin = async (credential) => {
    if (!credential) return;
    setLoading(true);
    try {
      const targetFirstName = selectedProfile?.firstName || inputFirst;
      const targetLastName = selectedProfile?.lastName || inputLast;
      const targetClassName = selectedProfile?.className || inputClass;
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential,
          targetUserId: selectedProfile?.id || '',
          targetFirstName,
          targetLastName,
          targetClassName
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('player', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        alert(data.message || "Connexion Google impossible.");
      }
    } catch (_) {
      alert("Le serveur est injoignable.");
    }
    setLoading(false);
  };

  const isTeacherProfile = selectedProfile?.type === 'teacher';
  const isStudentProfile = selectedProfile?.type === 'student';
  const isTestStudentProfile = isStudentProfile && clean(selectedProfile?.lastName) === 'test';
  const hasStudentPassword = selectedProfile?.hasStudentPassword === true;
  const hasTypedIdentity = clean(inputLast).length > 0 && clean(inputFirst).length > 0;
  const canSubmit = selectedProfile
    ? (isTestStudentProfile || password.trim().length > 0)
    : hasTypedIdentity;

  const handleStudentPasswordSetup = async () => {
    if (!selectedProfile?.id) return;
    setPasswordActionLoading(true);
    try {
      const res = await fetch('/api/eleve/auth/student-password/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedProfile.id,
          password,
          confirmPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Création impossible.");
      setSelectedProfile((prev) => ({ ...prev, hasStudentPassword: true }));
      setShowStudentPasswordSetup(false);
      setConfirmPassword('');
      alert("Mot de passe créé.");
    } catch (e) {
      alert(e.message || "Création impossible.");
    }
    setPasswordActionLoading(false);
  };

  const handleStudentPasswordRecover = async () => {
    if (!selectedProfile?.id) return;
    setPasswordActionLoading(true);
    try {
      const res = await fetch('/api/eleve/auth/student-password/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedProfile.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Récupération impossible.");
      alert(data?.message || "Mot de passe envoyé par email.");
    } catch (e) {
      alert(e.message || "Récupération impossible.");
    }
    setPasswordActionLoading(false);
  };

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
                if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); }
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
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); }
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
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); }
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
                  ? (isTestStudentProfile ? "Aucun mot de passe requis (profil TEST)" : (hasStudentPassword ? "Mot de passe élève" : `Prénom par défaut: ${selectedProfile?.firstName || ''}`))
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

          {isStudentProfile && !isTestStudentProfile && (
            <div className="student-password-tools">
              {hasStudentPassword ? (
                <button type="button" onClick={handleStudentPasswordRecover} className="student-password-btn" disabled={passwordActionLoading}>
                  {passwordActionLoading ? 'Envoi...' : 'Récupérer mon mot de passe'}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowStudentPasswordSetup((prev) => !prev)} className="student-password-btn" disabled={passwordActionLoading}>
                    {showStudentPasswordSetup ? 'Annuler la création' : 'Créer mon mot de passe'}
                  </button>
                  {showStudentPasswordSetup && (
                    <div className="student-password-panel">
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          className="login-field"
                          placeholder="Nouveau mot de passe"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="login-field"
                          placeholder="Confirmer le mot de passe"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] uppercase font-black text-slate-400"
                        >
                          {showConfirmPassword ? "Cacher" : "Voir"}
                        </button>
                      </div>
                      <button type="button" onClick={handleStudentPasswordSetup} className="student-password-btn primary" disabled={passwordActionLoading}>
                        {passwordActionLoading ? 'Création...' : 'Valider mon mot de passe'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <button className="login-submit-btn" disabled={loading || !canSubmit}>
            {loading ? 'Connexion...' : 'Entrer'}
          </button>
          {googleClientId && (
            <div className="login-google-wrap">
              <div ref={googleBtnRef} />
              {!googleReady && (
                <button type="button" className="login-google-btn" disabled>
                  Chargement Google...
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
