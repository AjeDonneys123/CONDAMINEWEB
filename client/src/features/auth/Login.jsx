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
  const [studentResetMode, setStudentResetMode] = useState(false);
  const [studentResetToken, setStudentResetToken] = useState('');
  const [studentResetNotice, setStudentResetNotice] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [devFinderEnabled, setDevFinderEnabled] = useState(false);
  const googleBtnRef = useRef(null);
  const devKeysRef = useRef(new Set());
  const devTimerRef = useRef(null);
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
    const DEV_KEYS = ['KeyD', 'KeyE', 'KeyV'];
    const clearDevTimer = () => {
      if (devTimerRef.current) {
        clearTimeout(devTimerRef.current);
        devTimerRef.current = null;
      }
    };
    const maybeArmDev = () => {
      const keys = devKeysRef.current;
      if (devFinderEnabled) return;
      if (DEV_KEYS.every((key) => keys.has(key)) && !devTimerRef.current) {
        devTimerRef.current = setTimeout(() => {
          setDevFinderEnabled(true);
          devTimerRef.current = null;
        }, 1500);
      }
    };
    const onKeyDown = (event) => {
      const keyCode = String(event.code || '').trim();
      if (!DEV_KEYS.includes(keyCode)) return;
      devKeysRef.current.add(keyCode);
      maybeArmDev();
    };
    const onKeyUp = (event) => {
      const keyCode = String(event.code || '').trim();
      if (!DEV_KEYS.includes(keyCode)) return;
      devKeysRef.current.delete(keyCode);
      clearDevTimer();
    };
    const onBlur = () => {
      devKeysRef.current.clear();
      clearDevTimer();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      clearDevTimer();
    };
  }, [devFinderEnabled]);

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

    if (!devFinderEnabled) {
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
    setStudentResetMode(false);
    setStudentResetToken('');
    setStudentResetNotice('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedProfile) {
      // Détection silencieuse d'un compte saisi à la main (sans suggestion affichée).
      const typedFirst = clean(inputFirst);
      const typedLast = clean(inputLast);
      const typedClass = clean(inputClass);
      const teacherMatch = allUsersData.find(p =>
        p.type === 'teacher' &&
        clean(p.firstName) === typedFirst &&
        clean(p.lastName) === typedLast
      );
      if (teacherMatch) {
        handleSelectSuggestion(teacherMatch);
        return;
      }
      const studentMatch = allUsersData.find(p =>
        p.type === 'student' &&
        clean(p.firstName) === typedFirst &&
        clean(p.lastName) === typedLast &&
        (!typedClass || clean(p.className) === typedClass)
      );
      if (studentMatch) {
        handleSelectSuggestion(studentMatch);
      } else {
        alert("Profil élève introuvable. Ajoute la classe exacte, par exemple 6Z.");
      }
      return;
    }
    setLoading(true);

    const isTeacher = selectedProfile.type === 'teacher';
    if (!isTeacher && devFinderEnabled) {
      try {
        const res = await fetch('/api/eleve/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: selectedProfile.id,
            password: '',
            devBypass: true
          })
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('player', JSON.stringify(data.user));
          onLoginSuccess(data.user);
        } else {
          alert(data.message || "Connexion DEV impossible");
        }
      } catch (_) {
        alert("Le serveur est injoignable.");
      }
      setLoading(false);
      return;
    }

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
      if (selectedProfile?.type === 'student' && (studentResetMode || selectedProfile?.hasStudentPassword === true)) {
        const res = await fetch('/api/eleve/auth/student-password/google-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential,
            studentId: selectedProfile?.id || ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Vérification Google impossible.");
        setStudentResetMode(true);
        setStudentResetToken(String(data.resetToken || ''));
        setShowStudentPasswordSetup(true);
        setStudentResetNotice(data.message || "Compte Google vérifié. Définis maintenant ton nouveau mot de passe.");
        setLoading(false);
        return;
      }
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
    ? (isTestStudentProfile || devFinderEnabled || password.trim().length > 0)
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
          confirmPassword,
          resetToken: studentResetToken
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Création impossible.");
      setSelectedProfile((prev) => ({ ...prev, hasStudentPassword: true }));
      setShowStudentPasswordSetup(false);
      setStudentResetMode(false);
      setStudentResetToken('');
      setStudentResetNotice('');
      setConfirmPassword('');
      alert(studentResetToken ? "Mot de passe réinitialisé. Connecte-toi maintenant avec ce nouveau mot de passe." : "Mot de passe créé.");
    } catch (e) {
      alert(e.message || "Création impossible.");
    }
    setPasswordActionLoading(false);
  };

  const handleStudentPasswordRecover = async () => {
    if (!selectedProfile?.id) return;
    setStudentResetMode(true);
    setStudentResetToken('');
    setShowStudentPasswordSetup(false);
    setStudentResetNotice("Pour réinitialiser le mot de passe, connecte-toi d'abord avec Google en utilisant l'email enregistré pour cet élève.");
  };

  return (
    <div className="login-screen">
      <div className="login-card narrow">
        <h2 className="app-logo">Connexion</h2>
        <p className="app-subtitle">Nom, prénom, classe. Le profil est détecté automatiquement.</p>
        {devFinderEnabled && <div className="dev-mode-badge">DEV ON</div>}

        <form onSubmit={handleLogin} className="login-inputs mt-6">
          <div className="finder-wrapper">
            <input
              className="login-field"
              placeholder="Classe (élève uniquement, ex: 6A)"
              value={inputClass}
              onChange={e => {
                setInputClass(e.target.value);
                if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); setStudentResetMode(false); setStudentResetToken(''); setStudentResetNotice(''); }
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
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); setStudentResetMode(false); setStudentResetToken(''); setStudentResetNotice(''); }
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
                    if (selectedProfile) { setSelectedProfile(null); setPassword(''); setConfirmPassword(''); setShowStudentPasswordSetup(false); setStudentResetMode(false); setStudentResetToken(''); setStudentResetNotice(''); }
                  }}
                />
              </div>
            </div>

            {devFinderEnabled && !isTeacherProfile && suggestions.length > 0 && (
              <div className="suggestions-box custom-scrollbar">
                {suggestions.map(s => (
                  <div key={`${s.type}-${s.id}`} className="suggestion-item" onClick={() => handleSelectSuggestion(s)}>
                    <span>{s.firstName} <strong>{s.lastName}</strong></span>
                    <span className="suggestion-detail">{s.className || ''}</span>
                  </div>
                ))}
              </div>
            )}
            {devFinderEnabled && !selectedProfile && suggestions.length === 0 && (inputClass || inputLast || inputFirst) && !loading && (
              <div className="text-xs text-slate-400 text-center italic">Aucun profil trouvé.</div>
            )}
          </div>

          {(isTeacherProfile || (isStudentProfile && !devFinderEnabled)) && (
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
                <>
                  <button type="button" onClick={handleStudentPasswordRecover} className="student-password-btn" disabled={passwordActionLoading}>
                    J&apos;ai oublié mon mot de passe
                  </button>
                  {studentResetMode && (
                    <div className="student-password-panel">
                      <div className="text-xs font-black text-blue-700 uppercase">Réinitialisation par Google</div>
                      <div className="text-xs text-slate-500 font-semibold">
                        {studentResetToken
                          ? "Ton identité Google est validée. Tu peux maintenant choisir un nouveau mot de passe."
                          : "Si tu n'es pas encore connecté avec Google, utilise le bouton Google ci-dessous avec l'email enregistré pour cet élève."}
                      </div>
                      {studentResetNotice && (
                        <div className={`text-xs font-black ${studentResetToken ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {studentResetNotice}
                        </div>
                      )}
                    </div>
                  )}
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
                      <button type="button" onClick={handleStudentPasswordSetup} className="student-password-btn primary" disabled={passwordActionLoading || !studentResetToken}>
                        {passwordActionLoading ? 'Création...' : 'Valider mon nouveau mot de passe'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setShowStudentPasswordSetup((prev) => !prev); setStudentResetMode(false); setStudentResetToken(''); }} className="student-password-btn" disabled={passwordActionLoading}>
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
