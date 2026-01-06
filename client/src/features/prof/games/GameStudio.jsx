import React, { useState } from 'react';
import './GameStudio.css';

export default function GameStudio({ initialData, chapters, classFilter, onClose }) {
  const defaultChapter = (chapters && chapters.length > 0) ? chapters[0]._id : 'none';

  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: defaultChapter, classroom: classFilter || '6D', targetGrade: 'Tous', questions: [] 
  });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [genMode, setGenMode] = useState('manual');
  const [loadingIA, setLoadingIA] = useState(false);

  const handleAiGen = async () => {
      if(!aiPrompt) return;
      setLoadingIA(true);
      const fd = new FormData(); fd.append('topic', aiPrompt); fd.append('numQuestions', 5);
      const res = await fetch('/api/generate-game-content', { method:'POST', body:fd }).then(r=>r.json());
      if(Array.isArray(res)) setFormData({...formData, questions:[...formData.questions, ...res]});
      setLoadingIA(false); setGenMode('manual');
  };

  const save = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Quiz incomplet");
    await fetch('/api/game-levels', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...formData, chapterId: formData.chapterId === 'none' ? null : formData.chapterId }) 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-50 flex flex-col animate-in zoom-in">
        <div className="p-8 bg-purple-600 text-white flex justify-between items-center shadow-xl">
            <input className="text-3xl font-black bg-transparent outline-none w-full placeholder:text-purple-300" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU QUIZ" />
            <button onClick={onClose} className="text-3xl font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="grid grid-cols-2 gap-6">
                    <div className="assign-card"><label>DOSSIER</label>
                        <select className="w-full font-bold outline-none" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun dossier --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title || `Dossier ${c.subject}`}</option>)}
                        </select>
                    </div>
                    <div className="assign-card"><label>CLASSE</label>
                        <select className="w-full font-bold outline-none" value={formData.classroom} onChange={e=>setFormData({...formData, classroom: e.target.value})}>
                            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={()=>setGenMode('manual')} className={`flex-1 p-4 rounded-2xl font-black ${genMode==='manual'?'bg-purple-600 text-white shadow-lg':'bg-white text-slate-400'}`}>✍️ MANUEL</button>
                    <button onClick={()=>setGenMode('ai')} className={`flex-1 p-4 rounded-2xl font-black ${genMode==='ai'?'bg-purple-600 text-white shadow-lg':'bg-white text-slate-400'}`}>🤖 IA GÉNÉRATEUR</button>
                </div>

                {/* RESTAURATION : Div pour écrire les questions manuellement */}
                {genMode === 'manual' ? (
                    <div className="p-10 bg-white rounded-[50px] border shadow-sm">
                        <input className="w-full p-4 mb-6 border-b-2 font-black text-xl outline-none" placeholder="Question..." value={currentQ.q} onChange={e=>setCurrentQ({...currentQ, q:e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            {currentQ.options.map((opt, i) => (
                                <div key={i} className={`flex items-center gap-2 p-3 rounded-2xl border-2 ${currentQ.a === i ? 'border-green-500 bg-green-50' : ''}`}>
                                    <input type="radio" checked={currentQ.a === i} onChange={()=>setCurrentQ({...currentQ, a:i})} />
                                    <input className="w-full bg-transparent outline-none font-bold" value={opt} onChange={e=>{const n=[...currentQ.options]; n[i]=e.target.value; setCurrentQ({...currentQ, options:n});}} placeholder={`Réponse ${i+1}`} />
                                </div>
                            ))}
                        </div>
                        <button onClick={()=>{ if(!currentQ.q) return; setFormData({...formData, questions:[...formData.questions, currentQ]}); setCurrentQ({q:'', options:['','','',''], a:0}); }} className="w-full mt-6 p-4 bg-purple-100 text-purple-600 rounded-3xl font-black uppercase">Ajouter la question</button>
                    </div>
                ) : (
                    <div className="p-10 bg-purple-50 rounded-[50px] border-4 border-dashed border-purple-200">
                        <textarea className="w-full p-6 h-32 rounded-3xl border-none shadow-inner mb-4" placeholder="Sujet du Quiz..." value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} />
                        <button onClick={handleAiGen} disabled={loadingIA} className="w-full p-6 bg-purple-600 text-white font-black text-xl rounded-3xl">{loadingIA?'GÉNÉRATION...':'GÉNÉRER LE QUIZ ✨'}</button>
                    </div>
                )}

                <div className="space-y-4">
                    {formData.questions.map((q, i) => (
                        <div key={i} className="p-6 bg-white border rounded-[30px] shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <b className="text-slate-700">{i+1}. {q.q}</b>
                                <button onClick={()=>{const n=[...formData.questions]; n.splice(i,1); setFormData({...formData, questions:n});}} className="text-red-400 font-black p-2 hover:scale-110">✕</button>
                            </div>
                            <div className="game-preview-options">
                                {q.options.map((opt, optIdx) => (
                                    <span key={optIdx} className={optIdx === q.a ? 'is-good' : ''}>
                                        {optIdx === q.a ? '✅ ' : ''}{opt}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="p-8 bg-white border-t">
            <button onClick={save} className="w-full p-8 bg-purple-600 text-white font-black text-3xl rounded-[40px] shadow-2xl hover:scale-[1.01] active:scale-95 transition-all">
                💾 ENREGISTRER LE QUIZ
            </button>
        </div>
    </div>
  );
}