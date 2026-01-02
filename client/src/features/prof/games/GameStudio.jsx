import React, { useState, useEffect } from 'react';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingIA, setLoadingIA] = useState(false);
  const [formData, setFormData] = useState({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [aiPrompt, setAiPrompt] = useState('');

  const load = async () => {
    const data = await fetch('/api/game-levels/all').then(r => r.json());
    setLevels(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    if (!aiPrompt) return alert("Sujet requis !");
    setLoadingIA(true);
    try {
        const questions = await fetch('/api/generate-game-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: aiPrompt, numQuestions: 5 })
        }).then(r => r.json());
        if (Array.isArray(questions)) {
            setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
        }
    } catch(e) { alert("Erreur IA"); }
    setLoadingIA(false);
  };

  const handleSave = async () => {
    await fetch('/api/game-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
    alert("Niveau sauvegardé !"); setIsEditing(false); load();
  };

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] }); setIsEditing(true); }} 
                  className="w-full bg-purple-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl border-b-8 border-purple-800 transition-all uppercase tracking-widest">
            ➕ Créer Niveau de Jeu
          </button>
          <div className="grid gap-4">
            {levels.map(lvl => (
              <div key={lvl._id} className="bg-white p-6 rounded-3xl border flex justify-between items-center shadow-sm">
                <div><b className="text-lg text-slate-800">{lvl.title}</b><p className="text-xs text-slate-400 font-bold uppercase">{lvl.chapterId}</p></div>
                <button onClick={() => { setFormData(lvl); setIsEditing(true); }} className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl font-bold">🖋️</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[40px] border-2 border-purple-100 p-8 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-2xl font-black text-purple-600 italic">Studio de Jeu</h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Titre" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-purple-600" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                <option value="ch1-zombie">🧟 Zombie</option><option value="ch2-starship">🚀 Starship</option>
            </select>
          </div>
          <div className="bg-purple-50 p-6 rounded-[30px] border border-purple-200 space-y-4">
              <textarea className="w-full p-4 rounded-2xl border-none outline-none h-24 shadow-inner" placeholder="Sujet IA..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
              <button onClick={handleAiGenerate} disabled={loadingIA} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg uppercase">{loadingIA ? "🪄 IA EN TRAVAIL..." : "GÉNÉRER PAR IA ✨"}</button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {formData.questions.map((q, i) => (
                <div key={i} className="p-4 bg-white rounded-2xl border flex justify-between items-center shadow-sm">
                    <span className="font-bold text-sm truncate mr-4">{i+1}. {q.q}</span>
                    <button onClick={()=>{const n=[...formData.questions]; n.splice(i,1); setFormData({...formData, questions:n});}} className="text-red-300">✕</button>
                </div>
            ))}
          </div>
          <button onClick={handleSave} className="w-full bg-green-500 text-white py-6 rounded-[30px] font-black text-2xl shadow-xl shadow-green-100 border-b-8 border-green-700 uppercase tracking-tighter">💾 Sauvegarder</button>
        </div>
      )}
    </div>
  );
}