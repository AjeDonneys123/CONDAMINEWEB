import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function GamesTab() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ title: '', chapterId: 'ch1-zombie', classroom: '6e', questions: [] });
  const [newQ, setNewQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });

  const load = async () => {
    const data = await api.get('/game-levels/Toutes');
    setLevels(data || []);
  };

  useEffect(() => { load(); }, []);

  const addQuestion = () => {
    if (!newQ.q || newQ.options.filter(o => o.trim()).length < 2) return alert("Question incomplète !");
    setFormData(prev => ({ ...prev, questions: [...prev.questions, { ...newQ }] }));
    setNewQ({ q: '', options: ['', '', '', ''], a: 0 });
  };

  const handleSave = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Niveau vide !");
    const res = await api.post('/game-levels', formData);
    if(res.ok) { alert("Niveau enregistré !"); setIsEditing(false); load(); }
  };

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <>
          <button onClick={() => setIsEditing(true)} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg">+ CRÉER UN NIVEAU</button>
          <div className="grid gap-3">
            {levels.map(lvl => (
              <div key={lvl._id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border">
                <div><b className="text-purple-700">{lvl.title}</b> <small className="text-slate-400 ml-2">({lvl.questions.length} questions)</small></div>
                <button onClick={async () => { if(confirm("Suppr ?")) { await fetch(`/api/game-levels/${lvl._id}`, {method:'DELETE'}); load(); }}} className="text-red-400">🗑️</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white border-2 border-purple-200 p-6 rounded-3xl space-y-4">
          <div className="flex gap-4">
            <input className="flex-1 p-3 border rounded-xl" placeholder="Titre du niveau" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-3 border rounded-xl" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                <option value="ch1-zombie">🧟 Zombie</option>
                <option value="ch2-starship">🚀 Starship</option>
            </select>
          </div>

          <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
            <p className="font-bold text-purple-600 mb-2">Nouvelle Question :</p>
            <input className="w-full p-3 mb-3 border rounded-xl" placeholder="Énoncé..." value={newQ.q} onChange={e => setNewQ({...newQ, q: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              {newQ.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input type="radio" checked={newQ.a === i} onChange={() => setNewQ({...newQ, a: i})} />
                    <input className="flex-1 p-2 border rounded-lg text-sm" placeholder={`Réponse ${i+1}`} value={opt} onChange={e => { const n = [...newQ.options]; n[i] = e.target.value; setNewQ({...newQ, options: n}); }} />
                </div>
              ))}
            </div>
            <button onClick={addQuestion} className="mt-4 bg-purple-200 text-purple-700 px-6 py-2 rounded-xl font-bold w-full">Ajouter à la liste</button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-2xl divide-y">
            {formData.questions.map((q, i) => (
              <div key={i} className="p-3 text-sm flex justify-between">
                <span>{i+1}. {q.q}</span>
                <span className="text-green-600 font-bold">✓ {q.options[q.a]}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-500">Annuler</button>
            <button onClick={handleSave} className="flex-2 py-3 bg-green-600 text-white rounded-xl font-black shadow-lg">💾 SAUVEGARDER LE NIVEAU</button>
          </div>
        </div>
      )}
    </div>
  );
}