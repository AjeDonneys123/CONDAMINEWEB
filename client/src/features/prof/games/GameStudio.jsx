import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [genMode, setGenMode] = useState('manual'); // 'manual' | 'ai'
  const [loadingIA, setLoadingIA] = useState(false);

  // État du niveau complet
  const [formData, setFormData] = useState({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] });
  
  // État de la question en cours de saisie
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [editingIdx, setEditingIdx] = useState(null);

  // Params IA
  const [aiPrompt, setAiPrompt] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);

  const load = async () => {
    const data = await fetch('/api/game-levels/all').then(r => r.json());
    setLevels(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    if(!aiPrompt) return alert("Saisis un sujet !");
    setLoadingIA(true);
    try {
        const questions = await fetch('/api/generate-game-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: aiPrompt, numQuestions })
        }).then(r => r.json());

        if (Array.isArray(questions)) {
            setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
            setGenMode('manual'); // Pour vérification
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

  const handleSaveLevel = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Titre et questions requis !");
    const res = await fetch('/api/game-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    }).then(r => r.json());

    if (res.ok) {
        alert("Niveau enregistré !");
        setIsEditing(false);
        load();
    }
  };

  return (
    <div className="game-studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] }); setIsEditing(true); }} 
                  className="btn-main-action purple">➕ CRÉER UN NIVEAU DE JEU</button>
          
          <div className="levels-grid">
            {levels.map(lvl => (
              <div key={lvl._id} className="level-card">
                <div className="info">
                    <b>{lvl.title}</b>
                    <span className="badge">{lvl.chapterId === 'ch1-zombie' ? '🧟 ZOMBIE' : '🚀 STARSHIP'}</span>
                </div>
                <div className="actions">
                    <button onClick={() => { setFormData(lvl); setIsEditing(true); }} className="btn-icon blue">🖋️</button>
                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/game-levels/${lvl._id}`, {method:'DELETE'}); load(); }}} className="btn-icon red">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="editor-modal">
          <div className="editor-header">
            <h3>{formData._id ? 'MODIFIER LE NIVEAU' : 'NOUVEAU NIVEAU'}</h3>
            <button onClick={() => setIsEditing(false)} className="close-btn">✕</button>
          </div>

          <div className="config-row">
            <input className="input-premium" placeholder="Titre du niveau..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <select className="input-premium purple-text" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                <option value="ch1-zombie">🧟 Mode Zombie</option>
                <option value="ch2-starship">🚀 Mode Starship</option>
            </select>
          </div>

          <div className="mode-switcher">
            <button onClick={() => setGenMode('manual')} className={genMode === 'manual' ? 'active' : ''}>✍️ MANUEL</button>
            <button onClick={() => setGenMode('ai')} className={genMode === 'ai' ? 'active-ai' : ''}>🤖 GÉNÉRER PAR IA</button>
          </div>

          {genMode === 'ai' ? (
            <div className="ai-zone">
                <textarea placeholder="Sujet du quiz (ex: Les participes passés)..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                <div className="ai-controls">
                    <div className="slider-group">
                        <label>Questions : {numQuestions}</label>
                        <input type="range" min="1" max="20" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} />
                    </div>
                    <button onClick={handleAiGenerate} disabled={loadingIA} className="btn-ia-exec">
                        {loadingIA ? "🪄 IA EN COURS..." : "GÉNÉRER ✨"}
                    </button>
                </div>
            </div>
          ) : (
            <div className="manual-zone">
                <input className="q-input" placeholder="Ta question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                <div className="options-grid">
                    {currentQ.options.map((opt, i) => (
                        <div key={i} className={`option-field ${currentQ.a === i ? 'correct' : ''}`}>
                            <input type="radio" checked={currentQ.a === i} onChange={() => setCurrentQ({...currentQ, a: i})} />
                            <input placeholder={`Réponse ${i+1}`} value={opt} onChange={e => { const n = [...currentQ.options]; n[i] = e.target.value; setCurrentQ({...currentQ, options: n}); }} />
                        </div>
                    ))}
                </div>
                <button onClick={addOrUpdateQuestion} className="btn-add-q">
                    {editingIdx !== null ? '💾 METTRE À JOUR' : '➕ AJOUTER AU QUIZ'}
                </button>
            </div>
          )}

          <div className="questions-preview">
            <p className="section-title">Questions dans le niveau ({formData.questions.length})</p>
            <div className="preview-list scroll-custom">
                {formData.questions.map((q, i) => (
                    <div key={i} onClick={() => { setCurrentQ(q); setEditingIdx(i); setGenMode('manual'); }} className={`preview-item ${editingIdx === i ? 'editing' : ''}`}>
                        <div className="preview-header">
                            <span className="num">{i+1}</span>
                            <span className="txt">{q.q}</span>
                            <button onClick={(e) => { e.stopPropagation(); const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n}); }} className="del-q">✕</button>
                        </div>
                        <div className="preview-options">
                            {q.options.map((opt, oi) => (
                                <span key={oi} className={oi === q.a ? 'good' : ''}>{opt}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </div>

          <button onClick={handleSaveLevel} className="btn-save-final">💾 SAUVEGARDER LE NIVEAU EN BDD</button>
        </div>
      )}
    </div>
  );
}