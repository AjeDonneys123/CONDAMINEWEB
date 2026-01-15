import React, { useState } from 'react';

export default function GameStudio({ initialData, chapters, classFilter, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', chapterId: (chapters && chapters[0]?._id) || '', classroom: classFilter, questions: [] 
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAiGen = async () => {
      if(!aiPrompt) return;
      setLoading(true);
      try {
          const res = await fetch('/api/games/generate', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ topic: aiPrompt })
          }).then(r => r.json());
          setFormData({...formData, questions: [...formData.questions, ...res]});
          setAiPrompt("");
      } catch(e) { alert("Erreur IA"); }
      setLoading(false);
  };

  const save = async () => {
    await fetch('/api/games', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white z-[6000] flex flex-col animate-in zoom-in">
        <div className="p-8 bg-purple-600 text-white flex justify-between items-center shadow-lg">
            <input className="text-2xl font-black bg-transparent outline-none w-full placeholder:text-purple-200" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="NOM DU QUIZ" />
            <button onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="p-8 bg-purple-50 rounded-[40px] border-4 border-dashed border-purple-100">
                    <h4 className="font-black text-purple-400 text-[10px] uppercase mb-4">Générateur Magique (Gemini 2.0 Flash)</h4>
                    <textarea className="w-full p-4 rounded-2xl border-none font-bold shadow-inner mb-4" placeholder="Sujet du quiz (ex: Les conquêtes d'Alexandre le Grand)..." value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} />
                    <button onClick={handleAiGen} disabled={loading} className="w-full p-4 bg-purple-600 text-white font-black rounded-xl shadow-lg">{loading ? "GÉNÉRATION..." : "GÉNÉRER QUESTIONS IA"}</button>
                </div>
            </div>
        </div>
        <div className="p-8 border-t bg-slate-50"><button onClick={save} className="w-full p-6 bg-purple-600 text-white font-black text-2xl rounded-3xl shadow-xl uppercase">SAUVEGARDER LE QUIZ</button></div>
    </div>
  );
}