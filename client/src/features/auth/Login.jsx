import React, { useState, useEffect } from 'react';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFinder, setShowFinder] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
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
    if (selectedClassId && selectedClassId !== 'PROF') {
        fetch(`/api/auth/students/${selectedClassId}`)
            .then(res => res.ok ? res.json() : [])
            .then(setStudents)
            .catch(() => setStudents([]));
        setSelectedStudent(null);
        setSearchTerm('');
    }
  }, [selectedClassId]);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const body = selectedClassId === 'PROF' 
        ? { role: 'PROF', firstName: fName, lastName: lName, password }
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
            alert(data.message || "Erreur d'accès");
        }
    } catch(e) { alert("Le serveur est injoignable."); }
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h2 className="login-title">CONDACLASSE</h2>
        <form onSubmit={handleLogin} className="login-inputs">
            <select className="login-field" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} required>
                <option value="">CHOISIR TA CLASSE...</option>
                {classes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                <option value="PROF" className="font-black text-indigo-600">🎓 ENSEIGNANT / ADMIN</option>
            </select>

            {selectedClassId && selectedClassId !== 'PROF' && (
                <div>
                    {!selectedStudent ? (
                        <>
                            <input className="login-field" placeholder="Tape ton nom..." value={searchTerm}
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
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center">
                            <span className="font-bold">{selectedStudent.name}</span>
                            <button type="button" onClick={() => setSelectedStudent(null)}>✕</button>
                        </div>
                    )}
                </div>
            )}

            {selectedClassId === 'PROF' && (
                <div className="space-y-2">
                    <input className="login-field" placeholder="Prénom" value={fName} onChange={e=>setFName(e.target.value)} required />
                    <input className="login-field" placeholder="Nom" value={lName} onChange={e=>setLName(e.target.value)} required />
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} className="login-field" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] uppercase font-black">
                            {showPassword ? "Cacher" : "Voir"}
                        </button>
                    </div>
                </div>
            )}

            <button className="login-submit-btn" disabled={loading || (!selectedStudent && selectedClassId !== 'PROF')}>
                {loading ? 'CHARGEMENT...' : 'ENTRER'}
            </button>
        </form>
      </div>
    </div>
  );
}