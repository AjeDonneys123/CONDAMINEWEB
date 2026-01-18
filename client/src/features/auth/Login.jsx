import React, { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState(null); // 'student', 'teacher', 'admin'
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Student Form
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinder, setShowFinder] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Staff Form
  const [fName, setFName] = useState('');
  const [lName, setLName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/config')
        .then(res => res.ok ? res.json() : { classrooms: [] })
        .then(data => setClasses(data.classrooms || []))
        .catch(e => console.error("Config fail", e));
  }, []);

  useEffect(() => {
    if (selectedClassId) {
        fetch(`/api/auth/students/${selectedClassId}`)
            .then(res => res.ok ? res.json() : [])
            .then(setStudents)
            .catch(() => setStudents([]));
        setSelectedStudent(null);
        setSearchTerm('');
    }
  }, [selectedClassId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // MODIF CRUCIALE : On envoie le rôle exact (TEACHER ou ADMIN)
    // Au lieu de grouper tout le monde sous 'PROF'
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
            // Message d'erreur spécifique du backend
            alert(data.message || "Identifiants incorrects");
        }
    } catch(e) { alert("Le serveur est injoignable."); }
    setLoading(false);
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

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

  // 2. FORMULAIRES DE CONNEXION
  return (
    <div className="login-screen">
      <div className="login-card narrow">
        <button onClick={() => { setMode(null); setSelectedClassId(''); setFName(''); }} className="back-btn">
            ⬅ Changer de rôle
        </button>
        
        <h2 className="app-logo">
            {mode === 'student' ? 'Espace Élève' : (mode === 'teacher' ? 'Espace Prof' : 'Administration')}
        </h2>

        <form onSubmit={handleLogin} className="login-inputs mt-6">
            
            {/* --- MODE ÉLÈVE --- */}
            {mode === 'student' && (
                <>
                    <select className="login-field" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} required>
                        <option value="">-- CHOISIR MA CLASSE --</option>
                        {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>

                    {selectedClassId && (
                        <div>
                            {!selectedStudent ? (
                                <>
                                    <input className="login-field" placeholder="🔎 Chercher mon nom..." value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setShowFinder(true); }}
                                        onFocus={() => setShowFinder(true)}
                                    />
                                    {showFinder && searchTerm.length > 0 && (
                                        <div className="finder-results">
                                            {filteredStudents.map(s => (
                                                <div key={s.id} className="finder-item" onClick={() => { setSelectedStudent(s); setShowFinder(false); }}>
                                                    {s.name}
                                                </div>
                                            ))}
                                            {filteredStudents.length === 0 && <div className="p-4 text-slate-400 text-sm">Aucun élève trouvé.</div>}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-orange-50 p-4 rounded-xl flex justify-between items-center border border-orange-100">
                                    <span className="font-bold text-orange-700">👤 {selectedStudent.name}</span>
                                    <button type="button" onClick={() => setSelectedStudent(null)} className="font-black text-orange-400 hover:text-orange-600">✕</button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* --- MODE STAFF (PROF & ADMIN) --- */}
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