import React, { useState } from 'react';

export default function GameStudio({ initialData, chapters, classFilter, onClose }) {
  const [formData, setFormData] = useState(initialData || { 
      title: '', 
      chapterId: '', 
      classroom: classFilter || '', 
      questions: [] 
  });
  
  const [numQuestions, setNumQuestions] = useState(5);
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAiGen = async () => {
      if(!aiPrompt) return;
      console.log(`🌐 [FRONT] Génération de ${numQuestions} questions...`);
      setLoading(true);
      try {
          const res = await fetch('/api/games/generate', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ topic: aiPrompt, count: numQuestions })
          });
          
          const rawText = await res.text();
          if (!res.ok) throw new Error("Erreur serveur : " + rawText);
          
          const data = JSON.parse(rawText);
          setFormData(prev => ({...prev, questions: [...prev.questions, ...data]}));
          setAiPrompt("");
      } catch(e) { 
          console.error("🔥 Erreur IA Studio:", e.message);
          alert("Erreur IA : " + e.message); 
      }
      setLoading(false);
  };

  const save = async () => {
    if(!formData.title) return alert("⚠️ Veuillez donner un titre à votre quiz.");
    if(!formData.chapterId) return alert("⚠️ Veuillez sélectionner un dossier (chapitre) pour enregistrer ce jeu.");
    if(formData.questions.length === 0) return alert("⚠️ Le quiz est vide. Générez des questions avant d'enregistrer.");

    try {
        const res = await fetch('/api/games', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify(formData) 
        });
        if(res.ok) {
            onClose();
        } else {
            alert("Erreur lors de l'enregistrement BDD.");
        }
    } catch(e) { alert("Erreur technique de sauvegarde."); }
  };

  return (
    <div className="fixed inset-0 bg-white z-[6000] flex flex-col animate-in zoom-in duration-300">
        {/* HEADER BAR */}
        <div className="p-8 bg-purple-700 text-white flex justify-between items-center shadow-xl">
            <div className="flex-1">
                <input 
                    className="text-3xl font-black bg-transparent outline-none w-full placeholder:text-purple-300 uppercase tracking-tighter" 
                    value={formData.title} 
                    onChange={e=>setFormData({...formData, title:e.target.value})} 
                    placeholder="NOM DU JEU..." 
                />
            </div>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-2xl font-black">✕</button>
        </div>

        <div className="flex-1 p-10 overflow-y-auto bg-slate-50 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                
                {/* 1. CONFIGURATION DU DOSSIER CIBLE */}
                <div className="p-8 bg-white rounded-[35px] border-2 border-slate-200 shadow-sm">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">📁 Dossier d'enregistrement (Obligatoire)</label>
                    <select 
                        className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-700 focus:border-purple-500 outline-none transition-all"
                        value={formData.chapterId}
                        onChange={e => setFormData({...formData, chapterId: e.target.value})}
                    >
                        <option value="">-- SÉLECTIONNEZ UN CHAPITRE --</option>
                        {chapters.map(c => (
                            <option key={c._id} value={c._id}>
                                {c.section ? `[${c.section}] ` : ''}{c.title}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 2. GÉNÉRATEUR IA */}
                <div className="p-10 bg-purple-900 rounded-[45px] shadow-2xl border-4 border-purple-800 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h4 className="font-black text-[11px] uppercase tracking-[0.3em] mb-6 text-purple-300">Générateur Magique Gemini 2.0</h4>
                        
                        <textarea 
                            className="w-full p-6 rounded-3xl bg-white/10 border-2 border-white/10 text-white font-bold placeholder:text-white/30 mb-6 outline-none focus:border-white/30 transition-all h-32" 
                            placeholder="Décrivez le sujet du quiz... (ex: L'empire de Charlemagne, les fractions, le cycle de l'eau...)" 
                            value={aiPrompt} 
                            onChange={e=>setAiPrompt(e.target.value)} 
                        />

                        <div className="flex flex-col md:flex-row items-center gap-8 mb-8 bg-black/20 p-6 rounded-3xl">
                            <div className="flex-1 w-full">
                                <div className="flex justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-200">Nombre de questions</span>
                                    <span className="text-xl font-black text-white">{numQuestions}</span>
                                </div>
                                <input 
                                    type="range" min="1" max="20" step="1" 
                                    value={numQuestions} 
                                    onChange={e => setNumQuestions(parseInt(e.target.value))}
                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                                />
                            </div>
                            <button 
                                onClick={handleAiGen} 
                                disabled={loading || !aiPrompt} 
                                className="w-full md:w-auto px-10 py-5 bg-white text-purple-900 font-black rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 uppercase text-[11px] tracking-widest"
                            >
                                {loading ? "Magie en cours..." : "Générer les questions 🤖"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. LISTE DES QUESTIONS GÉNÉRÉES */}
                <div className="space-y-4 pb-10">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">Questions du Quiz ({formData.questions.length})</h3>
                    {formData.questions.map((q, i) => (
                        <div key={i} className="group p-8 bg-white border-2 border-slate-100 rounded-[35px] shadow-sm hover:border-purple-200 transition-all animate-in slide-in-from-bottom-4">
                            <div className="flex justify-between items-start mb-6">
                                <p className="font-black text-slate-800 text-lg leading-tight flex-1"><span className="text-purple-500 mr-2">#{i+1}</span> {q.q}</p>
                                <button 
                                    onClick={() => setFormData({...formData, questions: formData.questions.filter((_, idx) => idx !== i)})}
                                    className="text-slate-300 hover:text-red-500 font-bold transition-colors ml-4"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className={`p-4 rounded-2xl text-xs font-black uppercase tracking-tight transition-all ${q.a === oi ? 'bg-green-500 text-white shadow-lg scale-[1.02]' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                        <span className="opacity-50 mr-2">{String.fromCharCode(65 + oi)}.</span> {opt}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {formData.questions.length === 0 && (
                        <div className="text-center py-20 bg-white border-4 border-dashed border-slate-200 rounded-[40px] opacity-30">
                            <span className="text-4xl">❓</span>
                            <p className="font-black text-slate-400 mt-4 uppercase text-xs">Aucune question générée</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-8 border-t bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)] flex gap-4">
            <button onClick={onClose} className="px-10 py-6 bg-slate-100 text-slate-500 font-black text-xs rounded-[25px] hover:bg-slate-200 transition-all uppercase tracking-widest">Annuler</button>
            <button 
                onClick={save} 
                className="flex-1 p-6 bg-purple-700 text-white font-black text-xl rounded-[25px] shadow-2xl shadow-purple-200 hover:bg-purple-800 transition-all active:scale-95 uppercase tracking-tighter"
            >
                Enregistrer le Jeu dans la BDD
            </button>
        </div>
    </div>
  );
}