import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function GamesTab() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [genMode, setGenMode] = useState('manual');
  const [loadingIA, setLoadingIA] = useState(false);

  const [formData, setFormData] = useState({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [editingIdx, setEditingIdx] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');

  const load = async () => {
    const data = await api.get('/game-levels/all');
    if (data) setLevels(data);
  };
  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    setLoadingIA(true);
    const questions = await api.post('/generate-game-content', { topic: aiPrompt });
    if (Array.isArray(questions)) {
        setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
        setGenMode('manual');
    } else {
        alert("L'IA a eu un problème technique. Vérifie ton terminal.");
    }
    setLoadingIA(false);
  };

  const addOrUpdateQuestion = () => {
    if (!currentQ.q) return;
    const newQuestions = [...formData.questions];
    if (editingIdx !== null) newQuestions[editingIdx] = currentQ;
    else newQuestions.push(currentQ);
    setFormData({ ...formData, questions: newQuestions });
    setCurrentQ({ q: '', options: ['', '', '', ''], a: 0 });
    setEditingIdx(null);
  };

  return (
    <div className="space-y-6">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] }); setIsEditing(true); }} 
                  className="w-full bg-purple-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl">
            ➕ CRÉER UN NIVEAU
          </button>
          <div className="grid gap-4">
            {levels.map(lvl => (
              <div key={lvl._id} className="bg-white p-6 rounded-3xl border flex justify-between items-center shadow-sm">
                <div><b>{lvl.title}</b><p className="text-xs text-slate-400 font-bold uppercase">{lvl.chapterId}</p></div>
                <div className="flex gap-2">
                    <button onClick={() => { setFormData(lvl); setIsEditing(true); }} className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl font-bold">🖋️</button>
                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/game-levels/${lvl._id}`, {method:'DELETE'}); load(); }}} className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl font-bold">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-[40px] border-2 border-purple-100 p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-2xl font-black text-purple-600 italic">{formData._id ? 'Modifier le Niveau' : 'Nouveau Niveau'}</h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 font-bold">FERMER ✕</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Titre" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-purple-600" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                <option value="ch1-zombie">🧟 Zombie</option><option value="ch2-starship">🚀 Starship</option>
            </select>
          </div>

          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            <button onClick={() => setGenMode('manual')} className={`flex-1 py-3 rounded-xl font-bold ${genMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>✍️ MANUEL</button>
            <button onClick={() => setGenMode('ai')} className={`flex-1 py-3 rounded-xl font-bold ${genMode === 'ai' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'}`}>🤖 GÉNÉRER PAR IA</button>
          </div>

          <div className="min-h-[200px]">
            {genMode === 'ai' ? (
                <div className="bg-purple-50 p-6 rounded-[30px] border border-purple-200 space-y-4 animate-in slide-in-from-top-4">
                    <textarea className="w-full p-4 rounded-2xl border-none outline-none h-24" placeholder="Sujet du quiz..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                    <button onClick={handleAiGenerate} disabled={loadingIA} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg">
                        {loadingIA ? "🪄 IA EN TRAVAIL..." : "GÉNÉRER ✨"}
                    </button>
                </div>
            ) : (
                <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 space-y-4 animate-in slide-in-from-top-4">
                    <input className="w-full p-4 rounded-2xl border-none shadow-inner font-bold" placeholder="Ta question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                        {currentQ.options.map((opt, i) => (
                            <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${currentQ.a === i ? 'border-green-500 bg-white' : 'border-transparent bg-blue-100/50'}`}>
                                <input type="radio" checked={currentQ.a === i} onChange={() => setCurrentQ({...currentQ, a: i})} />
                                <input className="bg-transparent border-none outline-none w-full text-sm font-bold" placeholder={`Rép ${i+1}`} value={opt} onChange={e => { const n = [...currentQ.options]; n[i] = e.target.value; setCurrentQ({...currentQ, options: n}); }} />
                            </div>
                        ))}
                    </div>
                    <button onClick={addOrUpdateQuestion} className={`w-full py-4 ${editingIdx !== null ? 'bg-orange-500' : 'bg-blue-600'} text-white rounded-2xl font-black shadow-lg`}>
                        {editingIdx !== null ? '💾 METTRE À JOUR' : '➕ AJOUTER AU QUIZ'}
                    </button>
                </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest ml-2">Surveillance Questions ({formData.questions.length})</p>
            <div className="grid gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {formData.questions.map((q, i) => (
                    <div key={i} onClick={() => { setCurrentQ(q); setEditingIdx(i); setGenMode('manual'); }} 
                         className={`p-5 rounded-3xl border cursor-pointer transition-all ${editingIdx === i ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-slate-800 leading-tight">{i+1}. {q.q}</span>
                            <button onClick={(e) => { e.stopPropagation(); const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n}); }} className="text-red-300 hover:text-red-500 font-bold">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => (
                                <div key={optIdx} className={`text-[10px] p-2 rounded-xl border ${optIdx === q.a ? 'bg-green-100 border-green-400 text-green-700 font-bold' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                    <span className="opacity-50 mr-1">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                                    {optIdx === q.a && " ✓"}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </div>

          <button onClick={async () => {
              const res = await api.post('/game-levels', formData);
              if (res.ok) { alert("Niveau enregistré !"); setIsEditing(false); load(); }
          }} className="w-full bg-green-500 text-white py-6 rounded-[30px] font-black text-2xl shadow-xl border-b-8 border-green-700 active:translate-y-1 active:border-b-0 transition-all">
            💾 {formData._id ? 'ENREGISTRER LES MODIFICATIONS' : 'SAUVEGARDER LE NIVEAU'}
          </button>
        </div>
      )}
    </div>
  );
}