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

  // IA PARAMS
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiFile, setAiFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(5);

  const load = async () => {
    const data = await api.get('/game-levels/all');
    if (data) setLevels(data);
  };
  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    setLoadingIA(true);
    try {
        let docUrl = null;
        if (aiFile) {
            const fd = new FormData(); fd.append('file', aiFile);
            const up = await fetch('/api/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (up.ok) docUrl = up.imageUrl;
        }

        const questions = await api.post('/generate-game-content', { 
            topic: aiPrompt, 
            docUrl: docUrl,
            numQuestions: numQuestions 
        });

        if (Array.isArray(questions)) {
            setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
            setGenMode('manual');
        } else {
            alert("L'IA a renvoyé un format incorrect.");
        }
    } catch (e) { alert("Erreur IA"); }
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
                  className="w-full bg-purple-600 text-white py-6 rounded-[30px] font-black text-xl shadow-xl border-b-8 border-purple-800 transition-all">
            ➕ CRÉER UN NOUVEAU NIVEAU
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
            <h3 className="text-2xl font-black text-purple-600 italic">Configuration</h3>
            <button onClick={() => setIsEditing(false)} className="bg-slate-100 px-4 py-2 rounded-xl font-bold text-slate-400">FERMER ✕</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold" placeholder="Titre du Niveau" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="p-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-purple-600" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                <option value="ch1-zombie">🧟 Mode Zombie (Quiz)</option>
                <option value="ch2-starship">🚀 Mode Starship (Vitesse)</option>
            </select>
          </div>

          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            <button onClick={() => setGenMode('manual')} className={`flex-1 py-3 rounded-xl font-bold ${genMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>✍️ MANUEL</button>
            <button onClick={() => setGenMode('ai')} className={`flex-1 py-3 rounded-xl font-bold ${genMode === 'ai' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400'}`}>🤖 GÉNÉRER PAR IA</button>
          </div>

          {genMode === 'ai' ? (
            <div className="bg-purple-50 p-6 rounded-[30px] border border-purple-200 space-y-4">
                <textarea className="w-full p-4 rounded-2xl border-none outline-none h-24 shadow-inner" placeholder="Décris le sujet ou laisse vide si tu joins un fichier..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                
                <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-purple-100">
                    <div className="flex-1">
                        <label className="text-xs font-black text-slate-400 uppercase block mb-1">Nombre de questions : {numQuestions}</label>
                        <input type="range" min="1" max="20" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" />
                    </div>
                    <label className="flex-1 bg-purple-100 p-3 rounded-xl text-center cursor-pointer hover:bg-purple-200 transition-all">
                        <span className="text-purple-700 font-bold text-sm truncate block w-full">{aiFile ? `📄 ${aiFile.name}` : "📎 Joindre Fiche (PDF/Img)"}</span>
                        <input type="file" className="hidden" onChange={e => setAiFile(e.target.files[0])} />
                    </label>
                </div>

                <button onClick={handleAiGenerate} disabled={loadingIA} className="w-full bg-purple-600 text-white py-5 rounded-[25px] font-black text-xl shadow-lg disabled:opacity-50">
                    {loadingIA ? "🪄 IA EN TRAVAIL..." : "GÉNÉRER LE QUIZ ✨"}
                </button>
            </div>
          ) : (
            <div className="bg-blue-50 p-6 rounded-[30px] border border-blue-100 space-y-4">
                <input className="w-full p-4 rounded-2xl border-none shadow-inner font-bold" placeholder="Ta question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                <div className="grid grid-cols-2 gap-3">
                    {currentQ.options.map((opt, i) => (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all ${currentQ.a === i ? 'border-green-500 bg-white' : 'border-transparent bg-blue-100/50'}`}>
                            <input type="radio" checked={currentQ.a === i} onChange={() => setCurrentQ({...currentQ, a: i})} />
                            <input className="bg-transparent border-none outline-none w-full text-sm font-bold" placeholder={`Réponse ${i+1}`} value={opt} onChange={e => { const n = [...currentQ.options]; n[i] = e.target.value; setCurrentQ({...currentQ, options: n}); }} />
                        </div>
                    ))}
                </div>
                <button onClick={addOrUpdateQuestion} className={`w-full py-4 ${editingIdx !== null ? 'bg-orange-500' : 'bg-blue-600'} text-white rounded-2xl font-black shadow-lg`}>
                    {editingIdx !== null ? '💾 METTRE À JOUR' : '➕ AJOUTER AU QUIZ'}
                </button>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-slate-400 font-black text-xs uppercase tracking-widest ml-2">Questions du niveau ({formData.questions.length})</p>
            <div className="grid gap-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {formData.questions.map((q, i) => (
                    <div key={i} onClick={() => { setCurrentQ(q); setEditingIdx(i); setGenMode('manual'); }} 
                         className={`p-5 rounded-3xl border cursor-pointer transition-all ${editingIdx === i ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm'}`}>
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
              if (res.ok) { alert("Niveau sauvegardé !"); setIsEditing(false); load(); }
          }} className="w-full bg-green-500 text-white py-6 rounded-[30px] font-black text-2xl shadow-xl border-b-8 border-green-700 active:translate-y-1 active:border-b-0 transition-all">
            💾 {formData._id ? 'ENREGISTRER LES MODIFICATIONS' : 'SAUVEGARDER LE NIVEAU EN BDD'}
          </button>
        </div>
      )}
    </div>
  );
}