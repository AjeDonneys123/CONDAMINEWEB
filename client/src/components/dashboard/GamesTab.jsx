import React, { useState, useEffect } from 'react';

export default function GamesTab() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [generationMode, setGenerationMode] = useState('manual'); // 'manual' | 'ai'
  const [aiLoading, setAiLoading] = useState(false);
  
  // FORMULAIRE PRINCIPAL
  const [formData, setFormData] = useState({
    title: '', chapterId: 'ch1-zombie', classroom: '6e', questions: [] 
  });

  // MINI-FORMULAIRE (MANUEL)
  const [newQ, setNewQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });

  // MINI-FORMULAIRE (IA)
  const [aiParams, setAiParams] = useState({ topic: '', file: null });

  useEffect(() => { loadLevels(); }, []);

  const loadLevels = () => {
    fetch('/api/game-levels/Toutes').then(res => res.json()).then(data => setLevels(data || [])).catch(console.error);
  };

  const handleSaveLevel = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Titre et questions requis !");
    await fetch('/api/game-levels', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData)
    });
    alert("Niveau sauvegardé !");
    setIsEditing(false); loadLevels(); setFormData({ title: '', chapterId: 'ch1-zombie', classroom: '6e', questions: [] });
  };

  const addQuestion = () => {
    if (!newQ.q || newQ.options.some(o => !o.trim())) return alert("Tout remplir !");
    setFormData(prev => ({ ...prev, questions: [...prev.questions, { ...newQ }] }));
    setNewQ({ q: '', options: ['', '', '', ''], a: 0 });
  };

  const deleteLevel = async (id) => {
      if(!confirm("Supprimer ?")) return;
      await fetch(`/api/game-levels/${id}`, { method: 'DELETE' });
      loadLevels();
  };

  const handleAiGeneration = async () => {
      if (!aiParams.topic && !aiParams.file) return alert("Il faut un sujet ou une image !");
      setAiLoading(true);
      
      let docUrl = null;
      // 1. Upload si fichier présent
      if (aiParams.file) {
          const fd = new FormData();
          fd.append('file', aiParams.file);
          try {
              const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
              const uploadData = await uploadRes.json();
              if (uploadData.ok) docUrl = uploadData.imageUrl;
          } catch(e) { console.error(e); }
      }

      // 2. Appel IA
      try {
          const res = await fetch('/api/generate-game-content', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ topic: aiParams.topic, docUrl: docUrl, gameType: 'quiz' })
          });
          const questions = await res.json();
          if (Array.isArray(questions)) {
              setFormData(prev => ({ ...prev, questions: [...prev.questions, ...questions] }));
              alert(`Succès ! ${questions.length} questions générées.`);
              setGenerationMode('manual'); // Retour au tableau pour voir le résultat
          }
      } catch(e) { alert("Erreur IA"); }
      setAiLoading(false);
  };

  return (
    <div>
      {!isEditing ? (
        <>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <h3>🎮 Studio de Jeux</h3>
                <button className="btn-primary" style={{width:'auto', backgroundColor:'#7c3aed'}} onClick={() => setIsEditing(true)}>➕ Créer un Niveau</button>
            </div>
            {levels.map(lvl => (
                <div key={lvl._id || Math.random()} style={{background:'white', padding:'15px', border:'1px solid #e2e8f0', borderRadius:'8px', marginBottom:'10px', display:'flex', justifyContent:'space-between'}}>
                    <div><strong>{lvl.title}</strong><br/><small>{lvl.questions.length} questions</small></div>
                    <button onClick={() => deleteLevel(lvl._id)} style={{background:'#fee2e2', color:'red', border:'none', borderRadius:'5px'}}>🗑️</button>
                </div>
            ))}
        </>
      ) : (
        <div className="card" style={{border:'2px solid #7c3aed'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                <h3>Nouveau Niveau</h3>
                <button onClick={() => setIsEditing(false)} style={{background:'none', border:'none', fontSize:'1.2em', cursor:'pointer'}}>❌</button>
            </div>
            
            <div className="row">
                <div className="col form-group"><label className="form-label">Titre</label><input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Les volcans" /></div>
                <div className="col form-group"><label className="form-label">Chapitre</label><select className="form-select" value={formData.chapterId} onChange={e => setFormData({...formData, chapterId: e.target.value})}><option value="ch1-zombie">🧟 Zombie</option><option value="ch2-starship">🚀 Starship</option></select></div>
            </div>

            {/* TAB SELECTOR: MANUEL ou IA */}
            <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                <button 
                    onClick={() => setGenerationMode('manual')}
                    style={{flex:1, padding:'10px', border:'none', background: generationMode==='manual'?'#dbeafe':'#f1f5f9', color: generationMode==='manual'?'#1e40af':'#64748b', fontWeight:'bold', borderRadius:'8px', cursor:'pointer'}}
                >
                    ✍️ Ajout Manuel
                </button>
                <button 
                    onClick={() => setGenerationMode('ai')}
                    style={{flex:1, padding:'10px', border:'none', background: generationMode==='ai'?'#fce7f3':'#f1f5f9', color: generationMode==='ai'?'#9d174d':'#64748b', fontWeight:'bold', borderRadius:'8px', cursor:'pointer'}}
                >
                    🤖 Générer avec l'IA
                </button>
            </div>

            {generationMode === 'manual' ? (
                <div style={{background:'#f8fafc', padding:'15px', borderRadius:'8px', border:'1px solid #e2e8f0', marginBottom:'20px'}}>
                    <input className="form-input" placeholder="Question ?" style={{marginBottom:'10px'}} value={newQ.q} onChange={e => setNewQ({...newQ, q: e.target.value})} />
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                        {newQ.options.map((opt, idx) => (
                            <input key={idx} className="form-input" placeholder={`Réponse ${String.fromCharCode(65+idx)}`} value={opt} onChange={e => {const n=[...newQ.options]; n[idx]=e.target.value; setNewQ({...newQ, options:n})}} style={newQ.a===idx?{borderColor:'#16a34a', borderWidth:'2px'}:{}} />
                        ))}
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                        <select className="form-select" style={{flex:1}} value={newQ.a} onChange={e=>setNewQ({...newQ, a:parseInt(e.target.value)})}>
                            <option value={0}>Bonne réponse : A</option><option value={1}>Bonne réponse : B</option><option value={2}>Bonne réponse : C</option><option value={3}>Bonne réponse : D</option>
                        </select>
                        <button className="btn-primary" style={{flex:1, backgroundColor:'#16a34a'}} onClick={addQuestion}>Ajouter</button>
                    </div>
                </div>
            ) : (
                <div style={{background:'#fff1f2', padding:'15px', borderRadius:'8px', border:'1px solid #fda4af', marginBottom:'20px'}}>
                    <p style={{marginTop:0}}>Envoyez une photo de cours ou un sujet, l'IA va créer 5 questions.</p>
                    <div className="form-group">
                        <label className="form-label">Photo du cours (optionnel)</label>
                        <input type="file" onChange={e => setAiParams({...aiParams, file: e.target.files[0]})} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Sujet / Thème</label>
                        <input className="form-input" placeholder="Ex: La Révolution Française" value={aiParams.topic} onChange={e => setAiParams({...aiParams, topic: e.target.value})} />
                    </div>
                    <button className="btn-primary" style={{backgroundColor:'#be185d'}} disabled={aiLoading} onClick={handleAiGeneration}>
                        {aiLoading ? "⏳ Génération..." : "✨ Générer les questions"}
                    </button>
                </div>
            )}

            {/* TABLEAU DES QUESTIONS */}
            <div style={{marginBottom:'20px'}}>
                <label className="form-label">Questions ({formData.questions.length})</label>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9em', marginTop:'10px'}}>
                    <thead>
                        <tr style={{background:'#eee', textAlign:'left'}}>
                            <th style={{padding:'8px'}}>Question</th>
                            <th style={{padding:'8px'}}>Options (La verte est la bonne)</th>
                            <th style={{padding:'8px'}}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {formData.questions.map((q, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #ddd', background:'white'}}>
                                <td style={{padding:'8px', verticalAlign:'top'}}><strong>{i+1}.</strong> {q.q}</td>
                                <td style={{padding:'8px'}}>
                                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                                        {q.options.map((opt, idx) => (
                                            <div key={idx} style={{
                                                padding:'4px', borderRadius:'4px', 
                                                background: idx === q.a ? '#dcfce7' : '#f1f5f9',
                                                color: idx === q.a ? '#166534' : '#64748b',
                                                border: idx === q.a ? '1px solid #22c55e' : '1px solid #e2e8f0'
                                            }}>
                                                {String.fromCharCode(65+idx)}. {opt}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td style={{padding:'8px', textAlign:'center', verticalAlign:'top'}}>
                                    <button onClick={() => {
                                        const n = [...formData.questions]; n.splice(i, 1); setFormData({...formData, questions: n});
                                    }} style={{color:'red', border:'none', background:'none', cursor:'pointer', fontSize:'1.2em'}}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="btn-primary" onClick={handleSaveLevel}>💾 Sauvegarder le niveau</button>
        </div>
      )}
    </div>
  );
}