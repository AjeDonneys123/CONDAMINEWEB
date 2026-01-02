import React, { useState } from 'react';
import { api } from '../services/api';

const Login = ({ onLoginSuccess }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classroom, setClassroom] = useState('6D');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isProf = firstName.toLowerCase() === 'jean' && lastName.toLowerCase() === 'vuillet';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await api.post('/register', { firstName, lastName, classroom, password });
    if (res.ok) onLoginSuccess(res);
    else setError(res.message || "Accès refusé");
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border-t-8 border-blue-600">
        <h2 className="text-3xl font-black text-center mb-6">Condamine</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-4 rounded-xl border-2" placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          <input className="w-full p-4 rounded-xl border-2" placeholder="Nom" value={lastName} onChange={e => setLastName(e.target.value)} required />
          
          {isProf ? (
            <input type="password" title="Mdp Prof" className="w-full p-4 rounded-xl border-2 border-orange-400" placeholder="Mot de passe Maître" value={password} onChange={e => setPassword(e.target.value)} required />
          ) : (
            <select className="w-full p-4 rounded-xl border-2" value={classroom} onChange={e => setClassroom(e.target.value)}>
                <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                <option value="2A">2de A</option><option value="2CD">2de CD</option>
            </select>
          )}

          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">
            {loading ? 'Vérification...' : 'ENTRER'}
          </button>
        </form>
      </div>
    </div>
  );
};
export default Login;