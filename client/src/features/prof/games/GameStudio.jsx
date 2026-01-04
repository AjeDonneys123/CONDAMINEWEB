/* STUDIO JEUX CORRIGÉ */
import React, { useState, useEffect } from 'react';
import './GameStudio.css';

export default function GameStudio() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [genMode, setGenMode] = useState('manual');
  const [loadingIA, setLoadingIA] = useState(false);

  // Formulaire par défaut
  const defaultForm = { _id: null, title: '', chapterId: 'ch1-zombie', classroom: 'Toutes', questions: [] };
  const [formData, setFormData] = useState(defaultForm);
  
  const [currentQ, setCurrentQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [editingIdx, setEditingIdx] = useState(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);

  // Chargement
  const load = async () => {
    try {
        const res = await fetch('/api/game-levels/all');
        const data = await res.json();
        setLevels(data || []);
    } catch (e) {
        console.error("Erreur chargement liste:", e);
    }
  };
  useEffect(() => { load(); }, []);

  // Génération IA
  const handleAiGenerate = async () => {
    if(!aiPrompt) return alert("Saisis un sujet !");
    setLoadingIA(true);
    try {
        const res = await fetch('/api/generate-game-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: aiPrompt, numQuestions })
        });
        const questions = await res.json();

        if (Array.isArray(questions)) {
            setFormData(prev => ({ 
                ...prev, 
                questions: [...prev.questions, ...questions] 
            }));
            setGenMode('manual'); // On bascule pour voir le résultat
            alert(`✨ ${questions.length} questions ajoutées !`);
        } else {
            alert("Erreur IA : " + (questions.error || "Format invalide"));
        }
    } catch (e) { alert("Erreur connexion IA"); }
    setLoadingIA(false);
  };

  // Gestion Questions Manuelles
  const addOrUpdateQuestion = () => {
    if (!currentQ.q) return;
    const newQuestions = [...formData.questions];
    if (editingIdx !== null) newQuestions[editingIdx] = currentQ;
    else newQuestions.push(currentQ);
    
    setFormData({ ...formData, questions: newQuestions });
    setCurrentQ({ q: '', options: ['', '', '', ''], a: 0 });
    setEditingIdx(null);
  };

  // Sauvegarde Finale
  const handleSaveLevel = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Titre et questions requis !");
    
    try {
        const res = await fetch('/api/game-levels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const json = await res.json();

        if (json.ok) {
            setIsEditing(false);
            load(); // Rafraîchissement crucial
        } else {
            alert("Erreur sauvegarde.");
        }
    } catch (e) { alert("Erreur réseau."); }
  };

  const handleEdit = (lvl) => {
      setFormData(lvl); // Charge les données existantes
      setIsEditing(true);
  };

  const handleDelete = async (id) => {
      if(!confirm("Supprimer ce niveau ?")) return;
      await fetch(`/api/game-levels/${id}`, {method:'DELETE'});
      load();
  };

  return (
    <div className="studio-container">
      {!isEditing ? (
        <>
          <button onClick={() => { setFormData(defaultForm); setIsEditing(true); }} 
                  className="btn-create-game-v2">➕ CRÉER UN NIVEAU DE JEU</button>
          
          <div className="games-list-v2">
            {levels.length === 0 && <p style={{textAlign:'center', color:'#94a3b8'}}>Aucun niveau créé.</p>}
            
            {levels.map(lvl => (
              <div key={lvl._id} className="game-card-v2">
                <div className="game-info">
                    <h4>{lvl.title}</h4>
                    <span className="game-badge">{lvl.chapterId === 'ch1-zombie' ? '🧟 ZOMBIE' : '🚀 STARSHIP'}</span>
                    <span className="class-badge" style={{marginLeft:'5px'}}>{lvl.classroom || 'Toutes'}</span>
                    <span style={{fontSize:'0.7rem', color:'#cbd5e1', marginLeft:'10px'}}>({lvl.questions.length} questions)</span>
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
              <h3>{formData._id ? 'MODIFIER' : 'NOUVEAU'}</h3>
              <button onClick={() => setIsEditing(false)} className="btn-close">✕</button>
            </div>

            <div className="game-modal-body custom-scrollbar">
                <div className="config-grid">
                    <input className="input-title" placeholder="Titre du niveau..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    
                    <select className="select-chapter" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}>
                        <option value="ch1-zombie">🧟 Mode Zombie</option>
                        <option value="ch2-starship">🚀 Mode Starship</option>
                    </select>

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
                        <textarea placeholder="Sujet du quiz (ex: Les capitales, la conjugaison...)" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
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
                        <input className="q-input" placeholder="Question..." value={currentQ.q} onChange={e => setCurrentQ({...currentQ, q: e.target.value})} />
                        <div className="opts-grid">
                            {currentQ.options.map((opt, i) => (
                                <div key={i} className={`opt-row ${currentQ.a === i ? 'correct' : ''}`} onClick={() => setCurrentQ({...currentQ, a: i})}>
                                    <input type="radio" checked={currentQ.a === i} readOnly />
                                    <input placeholder={`Réponse ${i+1}`} value={opt} onChange={e => { const n = [...currentQ.options]; n[i] = e.target.value; setCurrentQ({...currentQ, options: n}); }} />
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
                                    <div className="flex items-center gap-3">
                                        <span className="q-num">{i+1}</span>
                                        <span className="q-text">{q.q}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n}); }} className="btn-del-q">✕</button>
                                </div>
                                <div className="game-preview-options">
                                    {q.options.map((opt, oi) => (
                                        <span key={oi} className={oi === q.a ? 'is-good' : ''}>{opt}</span>
                                    ))}
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