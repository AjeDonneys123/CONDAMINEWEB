import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [genMode, setGenMode] = useState('manual');
  const [loadingIA, setLoadingIA] = useState(false);

  // SUPPRESSION DU CHAPITRE DANS LE FORMULAIRE VISIBLE
  // On garde chapterId en 'generic' en interne pour la BDD
  const defaultForm = { _id: null, title: '', chapterId: 'generic', classroom: 'Toutes', questions: [] };
  const [formData, setFormData] = useState(defaultForm);
  
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [editingIdx, setEditingIdx] = useState(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [aiImages, setAiImages] = useState([]);

  const load = async () => {
    try {
        const res = await fetch('/api/game-levels/all');
        const data = await res.json();
        setLevels(data || []);
    } catch (e) { console.error(e); }
  };
  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    if(!aiPrompt && aiImages.length === 0) return alert("Sujet ou Image requis !");
    setLoadingIA(true);
    try {
        const fd = new FormData();
        fd.append('topic', aiPrompt || "Analyse");
        fd.append('numQuestions', numQuestions);
        for (let i = 0; i < aiImages.length; i++) fd.append('images', aiImages[i]);

        const res = await fetch('/api/generate-game-content', { method: 'POST', body: fd });
        const questions = await res.json();

        if (Array.isArray(questions)) {
            setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
            setGenMode('manual');
            setAiImages([]); setAiPrompt('');
            alert(`✨ ${questions.length} questions générées !`);
        } else { alert("Erreur IA: " + (questions.error || "Format invalide")); }
    } catch (e) { alert("Erreur Réseau"); }
    setLoadingIA(false);
  };

  const addOrUpdateQuestion = () => {
    if (!currentQ.q) return;
    
    const safeQ = { ...currentQ };
    while(safeQ.options.length < 4) safeQ.options.push("");
    safeQ.options = safeQ.options.slice(0, 4);

    const newQuestions = [...formData.questions];
    if (editingIdx !== null) newQuestions[editingIdx] = safeQ;
    else newQuestions.push(safeQ);
    
    setFormData({ ...formData, questions: newQuestions });
    setCurrentQ({ q: '', options: ['', '', '', ''], a: 0 });
    setEditingIdx(null);
  };

  const handleSaveLevel = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Titre requis !");
    const res = await fetch('/api/game-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    }).then(r => r.json());
    if (res.ok) { setIsEditing(false); load(); }
  };

  const handleEdit = (lvl) => { setFormData(lvl); setIsEditing(true); };
  const handleDelete = async (id) => { if(confirm("Supprimer ?")) { await fetch(`/api/game-levels/${id}`, {method:'DELETE'}); load(); }};

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData(defaultForm); setIsEditing(true); }} className="btn-create-game-v2">➕ CRÉER UN QUIZ</button>
          <div className="games-list-v2">
            {levels.map(lvl => (
              <div key={lvl._id} className="game-card-v2">
                <div className="game-info">
                    <h4>{lvl.title}</h4>
                    {/* On n'affiche plus le badge Zombie/Starship ici car ça n'a plus de sens */}
                    <span className="class-badge" style={{marginLeft:'0'}}>{lvl.classroom || 'Toutes'}</span>
                    <span style={{fontSize:'0.7rem', color:'#cbd5e1', marginLeft:'10px'}}>({lvl.questions.length} Q)</span>
                </div>
                <div className="game-actions">
                    <button onClick={() => handleEdit(lvl)} className="btn-icon-edit">🖋️</button>
                    <button onClick={() => handleDelete(lvl._id)} className="btn-icon-del">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="game-modal-overlay">
          <div className="game-modal animate-in zoom-in duration-200">
            <div className="game-modal-header">
              <h3>{formData._id ? 'MODIFIER' : 'NOUVEAU QUIZ'}</h3>
              <button onClick={() => setIsEditing(false)} className="btn-close">✕</button>
            </div>

            <div className="game-modal-body custom-scrollbar">
                {/* GRILLE 2 COLONNES (Titre | Classe) - On a viré le selecteur de jeu */}
                <div className="config-grid">
                    <input className="input-title" placeholder="Titre du Quiz..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    
                    <select className="select-class" value={formData.classroom} onChange={e => setFormData({...formData, classroom: e.target.value})}>
                        <option value="Toutes">Toutes les classes</option>
                        <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        <option value="2A">2nde A</option><option value="2CD">2nde CD</option>
                    </select>
                </div>

                <div className="tabs-mode">
                    <button onClick={() => setGenMode('manual')} className={genMode === 'manual' ? 'active-manual' : ''}>✍️ MANUEL</button>
                    <button onClick={() => setGenMode('ai')} className={genMode === 'ai' ? 'active-ai' : ''}>🤖 IA GÉNÉRATEUR</button>
                </div>

                {genMode === 'ai' ? (
                    <div className="ai-box shadow-inner">
                        <textarea placeholder="Sujet..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                        <div className="ai-upload-row">
                            <label className="btn-upload-ai">📷 Photos <input type="file" multiple accept="image/*" hidden onChange={e => setAiImages(Array.from(e.target.files))} /></label>
                            {aiImages.length > 0 && <span className="file-count">✅ {aiImages.length}</span>}
                        </div>
                        <div className="ai-actions">
                            <label className="font-bold text-purple-700 uppercase text-xs">Questions: {numQuestions}</label>
                            <input type="range" min="1" max="20" value={numQuestions} onChange={e => setNumQuestions(e.target.value)} />
                            <button onClick={handleAiGenerate} disabled={loadingIA} className="btn-ai-generate">{loadingIA ? "..." : "GÉNÉRER ✨"}</button>
                        </div>
                    </div>
                ) : (
                    <div className="manual-box shadow-inner">
                        <input className="q-input" placeholder="Question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                        
                        <div className="opts-grid">
                            {[0, 1, 2, 3].map((idx) => (
                                <div key={idx} className={`opt-row ${currentQ.a === idx ? 'correct' : ''}`} onClick={() => setCurrentQ({...currentQ, a: idx})}>
                                    <input type="radio" checked={currentQ.a === idx} readOnly />
                                    <input 
                                        placeholder={`Réponse ${String.fromCharCode(65+idx)}`} 
                                        value={currentQ.options[idx] || ''} 
                                        onChange={e => { 
                                            const n = [...currentQ.options];
                                            while(n.length < 4) n.push("");
                                            n[idx] = e.target.value; 
                                            setCurrentQ({...currentQ, options: n}); 
                                        }} 
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={addOrUpdateQuestion} className="btn-add-q">{editingIdx !== null ? 'METTRE À JOUR' : 'AJOUTER'}</button>
                    </div>
                )}

                <div className="preview-section">
                    <p className="preview-title">QUESTIONS ({formData.questions.length})</p>
                    <div className="preview-scroll custom-scrollbar">
                        {formData.questions.map((q, i) => (
                            <div key={i} onClick={() => { setCurrentQ(q); setEditingIdx(i); setGenMode('manual'); }} className={`q-item ${editingIdx === i ? 'editing' : ''}`}>
                                <div className="q-item-header">
                                    <div className="flex items-center gap-3"><span className="q-num">{i+1}</span><span className="q-text">{q.q}</span></div>
                                    <button onClick={(e) => { e.stopPropagation(); const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n}); }} className="btn-del-q">✕</button>
                                </div>
                                <div className="game-preview-options">
                                    {q.options.slice(0, 4).map((opt, oi) => <span key={oi} className={oi === q.a ? 'is-good' : ''}>{opt || "?"}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="modal-footer"><button onClick={handleSaveLevel} className="btn-save-db">💾 SAUVEGARDER</button></div>
          </div>
        </div>
      )}
    </div>
  );
}