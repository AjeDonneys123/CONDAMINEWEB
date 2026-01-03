import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [genMode, setGenMode] = useState('manual'); // 'manual' | 'ai'
  const [loadingIA, setLoadingIA] = useState(false);

  // État du niveau complet
  const [formData, setFormData] = useState({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] });
  
  // État de la question en cours
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
            setGenMode('manual');
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
        setIsEditing(false);
        load();
    }
  };

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData({ _id: null, title: '', chapterId: 'ch1-zombie', questions: [] }); setIsEditing(true); }} 
                  className="btn-create-game-v2">➕ CRÉER UN NIVEAU DE JEU</button>
          
          <div className="games-list-v2">
            {levels.map(lvl => (
              <div key={lvl._id} className="game-card-v2">
                <div className="game-info">
                    <h4>{lvl.title}</h4>
                    <span className="game-badge">{lvl.chapterId === 'ch1-zombie' ? '🧟 ZOMBIE' : '🚀 STARSHIP'}</span>
                </div>
                <div className="game-actions">
                    <button onClick={() => { setFormData(lvl); setIsEditing(true); }} className="btn-icon-edit">🖋️</button>
                    <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(`/api/game-levels/${lvl._id}`, {method:'DELETE'}); load(); }}} className="btn-icon-del">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="game-modal-overlay">
          <div className="game-modal animate-in zoom-in duration-200">
            <div className="game-modal-header">
              <h3>{formData._id ? 'MODIFIER LE NIVEAU' : 'NOUVEAU NIVEAU'}</h3>
              <button onClick={() => setIsEditing(false)} className="btn-close">✕</button>
            </div>

            <div className="game-modal-body custom-scrollbar">
                <div className="config-grid">
                    <input className="input-title" placeholder="Titre du niveau..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <select className="select-chapter" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                        <option value="ch1-zombie">🧟 Mode Zombie</option>
                        <option value="ch2-starship">🚀 Mode Starship</option>
                    </select>
                </div>

                <div className="tabs-mode">
                    <button onClick={() => setGenMode('manual')} className={genMode === 'manual' ? 'active-manual' : ''}>✍️ MANUEL</button>
                    <button onClick={() => setGenMode('ai')} className={genMode === 'ai' ? 'active-ai' : ''}>🤖 GÉNÉRER PAR IA</button>
                </div>

                {genMode === 'ai' ? (
                    <div className="ai-box shadow-inner">
                        <textarea placeholder="Sujet du quiz (ex: Les participes passés)..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                        <div className="ai-actions">
                            <label className="font-bold text-purple-700 uppercase text-xs">Questions: {numQuestions}</label>
                            <input type="range" min="1" max="20" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} />
                            <button onClick={handleAiGenerate} disabled={loadingIA} className="btn-ai-generate">
                                {loadingIA ? "TRAVAIL EN COURS..." : "GÉNÉRER LE QUIZ ✨"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="manual-box shadow-inner">
                        <input className="q-input" placeholder="La question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                        <div className="opts-grid">
                            {currentQ.options.map((opt, i) => (
                                <div key={i} className={`opt-row ${currentQ.a === i ? 'correct' : ''}`}>
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

                <div className="preview-section">
                    <p className="preview-title">Liste des questions ({formData.questions.length})</p>
                    <div className="preview-scroll custom-scrollbar">
                        {formData.questions.map((q, i) => (
                            <div key={i} onClick={() => { setCurrentQ(q); setEditingIdx(i); setGenMode('manual'); }} className={`q-item ${editingIdx === i ? 'editing' : ''}`}>
                                <div className="q-item-header">
                                    <span className="q-num">{i+1}</span>
                                    <span className="q-text">{q.q}</span>
                                    <button onClick={(e) => { e.stopPropagation(); const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n}); }} className="btn-del-q">✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="modal-footer">
                <button onClick={handleSaveLevel} className="btn-save-db">💾 SAUVEGARDER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}