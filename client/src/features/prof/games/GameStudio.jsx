import React, { useState } from 'react';
import './GameStudio.css';

export default function GameStudio({ initialData, chapters, classFilter, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: 'none', classroom: classFilter || '6D', targetGrade: 'Tous', questions: [] 
  });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [genMode, setGenMode] = useState('manual');
  const [loadingIA, setLoadingIA] = useState(false);

  const handleAiGen = async () => {
      if(!aiPrompt.trim()) return;
      setLoadingIA(true);
      try {
          // Correction de l'endpoint : /api/games/generate est maintenant servi par games.routes.js
          const res = await fetch('/api/games/generate', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ topic: aiPrompt, numQuestions: 5 }) 
          });

          if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.error || "Erreur serveur");
          }

          const data = await res.json();
          if(Array.isArray(data)) {
              setFormData(prev => ({...prev, questions: [...prev.questions, ...data]}));
              setGenMode('manual');
              setAiPrompt('');
          }
      } catch (e) {
          console.error("❌ [GameStudio] Erreur IA:", e.message);
          alert("L'IA n'a pas pu générer les questions : " + e.message);
      }
      setLoadingIA(false); 
  };

  const save = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Titre et questions requis.");
    try {
        const res = await fetch('/api/games', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(formData) 
        });
        if (res.ok) onClose();
    } catch (e) { alert("Erreur sauvegarde."); }
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in zoom-in">
        <div className="p-8 bg-purple-600 text-white flex justify-between items-center shadow-xl">
            <input className="text-3xl font-black bg-transparent outline-none w-full placeholder:text-purple-300" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU QUIZ" />
            <button onClick={onClose} className="text-3xl font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="assign-card"><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Dossier Archive</label>
                        <select className="w-full font-bold outline-none bg-white p-3 rounded-xl border" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun dossier --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={()=>setGenMode('manual')} className={`flex-1 p-4 rounded-2xl font-black transition-all ${genMode==='manual'?'bg-purple-600 text-white shadow-lg':'bg-white text-slate-400 border'}`}>✍️ MANUEL</button>
                    <button onClick={()=>setGenMode('ai')} className={`flex-1 p-4 rounded-2xl font-black transition-all ${genMode==='ai'?'bg-purple-600 text-white shadow-lg':'bg-white text-slate-400 border'}`}>🤖 IA GEMINI 2.0</button>
                </div>

                {genMode === 'manual' ? (
                    <div className="p-10 bg-white rounded-[50px] border shadow-sm">
                        <input className="w-full p-4 mb-6 border-b-2 font-black text-xl outline-none text-slate-700" placeholder="Saisissez la question..." value={currentQ.q} onChange={e=>setCurrentQ({...currentQ, q:e.target.value})} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentQ.options.map((opt, i) => (
                                <div key={i} className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${currentQ.a === i ? 'border-green-500 bg-green-50' : 'border-slate-100'}`}>
                                    <input type="radio" checked={currentQ.a === i} onChange={()=>setCurrentQ({...currentQ, a:i})} />
                                    <input className="w-full bg-transparent outline-none font-bold" value={opt} onChange={e=>{const n=[...currentQ.options]; n[i]=e.target.value; setCurrentQ({...currentQ, options:n});}} placeholder={`Réponse ${i+1}`} />
                                </div>
                            ))}
                        </div>
                        <button onClick={()=>{ if(!currentQ.q) return; setFormData({...formData, questions:[...formData.questions, currentQ]}); setCurrentQ({q:'', options:['','','',''], a:0}); }} className="w-full mt-6 p-4 bg-purple-100 text-purple-600 rounded-3xl font-black uppercase">Ajouter au quiz</button>
                    </div>
                ) : (
                    <div className="p-10 bg-purple-50 rounded-[50px] border-4 border-dashed border-purple-200">
                        <textarea className="w-full p-6 h-32 rounded-3xl border-none shadow-inner mb-4 font-bold text-slate-700" placeholder="Décris le sujet du quiz (ex: L'Empire Romain sous Auguste)..." value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} />
                        <button onClick={handleAiGen} disabled={loadingIA} className="w-full p-6 bg-purple-600 text-white font-black text-xl rounded-3xl shadow-xl">
                            {loadingIA ? '⚡ GÉNÉRATION EN COURS...' : 'GÉNÉRER PAR IA 🚀'}
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {formData.questions.map((q, i) => (
                        <div key={i} className="p-6 bg-white border rounded-[30px] shadow-sm animate-in fade-in flex justify-between">
                            <div>
                                <b className="text-slate-700 text-lg">{i+1}. {q.q}</b>
                                <div className="flex gap-2 mt-2">
                                    {q.options.map((opt, idx) => <span key={idx} className={`px-3 py-1 rounded text-[10px] ${idx===q.a?'bg-green-100 text-green-700 font-bold':'bg-slate-50 text-slate-400'}`}>{opt}</span>)}
                                </div>
                            </div>
                            <button onClick={()=>{const n=[...formData.questions]; n.splice(i,1); setFormData({...formData, questions:n});}} className="text-red-300 hover:text-red-500 font-black">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} className="w-full p-8 bg-purple-600 text-white font-black text-3xl rounded-[40px] shadow-2xl">💾 ENREGISTRER LE QUIZ</button>
        </div>
    </div>
  );
}