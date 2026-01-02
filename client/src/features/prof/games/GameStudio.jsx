import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] });
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [aiPrompt, setAiPrompt] = useState('');
  const [loadingIA, setLoadingIA] = useState(false);

  const load = async () => {
    const data = await fetch('/api/game-levels/all').then(r => r.json());
    setLevels(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleAi = async () => {
    setLoadingIA(true);
    const questions = await fetch('/api/generate-game-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiPrompt, numQuestions: 5 })
    }).then(r => r.json());
    if (Array.isArray(questions)) setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
    setLoadingIA(false);
  };

  return (
    <div className="game-studio-wrapper">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] }); setIsEditing(true); }} 
                  className="btn-launch-editor">➕ CRÉER UN NIVEAU DE JEU</button>
          <div className="grid gap-4">
            {levels.map(lvl => (
              <div key={lvl._id} className="game-level-card">
                <div><b>{lvl.title}</b><p>{lvl.chapterId}</p></div>
                <button onClick={() => { setFormData(lvl); setIsEditing(true); }} className="btn-edit-lvl">🖋️</button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="editor-view">
          <div className="editor-header"><h3>Configuration Jeu</h3><button onClick={() => setIsEditing(false)}>✕</button></div>
          <div className="input-group-row">
            <input placeholder="Titre..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}><option value="ch1-zombie">🧟 Zombie</option><option value="ch2-starship">🚀 Starship</option></select>
          </div>
          <div className="ai-box">
              <textarea placeholder="Sujet IA..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
              <button onClick={handleAi} disabled={loadingIA}>{loadingIA ? "Attente..." : "GÉNÉRER PAR IA"}</button>
          </div>
          <div className="manual-q-box">
              <input placeholder="Question manuelle..." value={currentQ.q} onChange={e=>setCurrentQ({...currentQ, q: e.target.value})} />
              <button onClick={()=>{setFormData(p=>({...p, questions: [...p.questions, currentQ]})); setCurrentQ({q:'', options:['','','',''], a:0});}}>Ajouter</button>
          </div>
          <button onClick={async ()=>{ await fetch('/api/game-levels', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(formData)}); setIsEditing(false); load(); }} className="btn-save-game">💾 SAUVEGARDER LE QUIZ</button>
        </div>
      )}
    </div>
  );
}