import React, { useState } from 'react';

export default function GameStudio({ initialData, chapters, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: 'none', classroom: '6D', targetGrade: 'Tous', questions: [] 
  });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });

  const save = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Données manquantes");
    await fetch('/api/game-levels', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...formData, chapterId: formData.chapterId === 'none' ? null : formData.chapterId }) 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-white flex flex-col animate-in zoom-in">
        <div className="p-8 bg-purple-600 text-white flex justify-between items-center shadow-xl">
            <input className="text-3xl font-black bg-transparent outline-none w-full placeholder:text-purple-300" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="NOM DU QUIZ" />
            <button onClick={onClose} className="text-3xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-2 gap-6">
                    <div className="assign-card"><label>CHAPITRE</label>
                        <select className="w-full p-2" value={formData.chapterId} onChange={e=>setFormData({...formData, chapterId: e.target.value})}>
                            <option value="none">-- Aucun --</option>
                            {chapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                        </select>
                    </div>
                    <div className="assign-card"><label>CLASSE</label>
                        <select className="w-full p-2" value={formData.classroom} onChange={e=>setFormData({...formData, classroom:e.target.value})}>
                            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                        </select>
                    </div>
                </div>

                <div className="p-8 bg-white rounded-[40px] border-2">
                    <input className="w-full p-4 mb-4 border-b-2 font-black text-xl outline-none" placeholder="Question..." value={currentQ.q} onChange={e=>setCurrentQ({...currentQ, q:e.target.value})} />
                    <div className="grid grid-cols-2 gap-4">
                        {currentQ.options.map((opt, i) => (
                            <div key={i} className={`flex items-center gap-2 p-3 rounded-2xl border-2 ${currentQ.a === i ? 'border-green-500 bg-green-50' : ''}`}>
                                <input type="radio" checked={currentQ.a === i} onChange={()=>setCurrentQ({...currentQ, a:i})} />
                                <input className="w-full bg-transparent outline-none font-bold" value={opt} onChange={e=>{const n=[...currentQ.options]; n[i]=e.target.value; setCurrentQ({...currentQ, options:n});}} placeholder={`Réponse ${i+1}`} />
                            </div>
                        ))}
                    </div>
                    <button onClick={()=>{ if(!currentQ.q) return; setFormData({...formData, questions:[...formData.questions, currentQ]}); setCurrentQ({q:'', options:['','','',''], a:0}); }} className="w-full mt-6 p-4 bg-purple-100 text-purple-600 rounded-2xl font-black uppercase">Ajouter la question</button>
                </div>

                <div className="space-y-4">
                    {formData.questions.map((q, i) => (
                        <div key={i} className="p-4 bg-white border rounded-2xl flex justify-between items-center shadow-sm">
                            <b>{i+1}. {q.q}</b>
                            <button onClick={()=>{const n=[...formData.questions]; n.splice(i,1); setFormData({...formData, questions:n});}} className="text-red-400">✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="p-8 border-t"><button onClick={save} className="w-full p-8 bg-purple-600 text-white font-black text-2xl rounded-[40px] shadow-2xl">💾 ENREGISTRER LE QUIZ</button></div>
    </div>
  );
}