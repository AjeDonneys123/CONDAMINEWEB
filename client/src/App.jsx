import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import StudentView from './components/StudentView';
import TeacherView from './components/TeacherView';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('player');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed._id)) setUser(parsed);
      } catch (e) { localStorage.removeItem('player'); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('player');
    setUser(null);
  };

  const backToProf = () => {
    const prof = { id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" };
    localStorage.setItem('player', JSON.stringify(prof));
    setUser(prof);
  };

  if (!user) return <Login onLoginSuccess={(u) => { localStorage.setItem('player', JSON.stringify(u)); setUser(u); }} />;

  const isTestEleve = user.firstName === "Eleve" && user.lastName === "Test";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-blue-600">Condamine</h1>
          {isTestEleve && (
            <button onClick={backToProf} className="bg-orange-500 text-white px-4 py-2 rounded-xl font-black flex items-center gap-2 animate-bounce shadow-lg shadow-orange-200">
              🎓 RETOUR PROF
            </button>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
            {user.firstName} {user.lastName} ({user.classroom})
          </span>
          <button onClick={handleLogout} className="text-slate-400 text-xs font-bold hover:text-red-500 transition-all uppercase tracking-tighter">Déconnexion</button>
        </div>
      </header>

      <main className="p-4">
        {user.id === 'prof' ? <TeacherView onLogout={handleLogout} /> : <StudentView user={user} />}
      </main>
    </div>
  );
}
export default App;