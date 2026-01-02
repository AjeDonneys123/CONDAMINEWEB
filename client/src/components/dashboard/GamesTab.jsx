import React, { useState, useEffect } from 'react';

export default function GamesTab() {
  const [levels, setLevels] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [generationMode, setGenerationMode] = useState('manual');
  const [aiLoading, setAiLoading] = useState(false);
  
  const [formData, setFormData] = useState({ title: '', chapterId: 'ch1-zombie', classroom: '6e', questions: [] });
  const [newQ, setNewQ] = useState({ q: '', options: ['', '', '', ''], a: 0 });
  const [aiParams, setAiParams] = useState({ topic: '', file: null });

  useEffect(() => { loadLevels(); }, []);

  const loadLevels = () => {
    fetch('/api/game-levels/Toutes').then(res => res.json()).then(data => setLevels(data || [])).catch(console.error);
  };

  const handleSaveLevel = async () => {
    if (!formData.title || formData.questions.length === 0) return alert("Ajoute au moins une question !");
    await fetch('/api/game-levels', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(formData) });
    alert("Niveau sauvegardé !");
    setIsEditing(false); loadLevels(); 
    setFormData({ title: '', chapterId: 'ch1-zombie', classroom: '6e', questions: [] });
  };

  const addQuestion = () => {
    // Validation souple : 2 options min
    const filledOptions = newQ.options.filter(o => o.trim() !== "");
    if (!newQ.q || filledOptions.length < 2) {
        return alert("Il faut une question et au moins 2 options (A et B) !");
    }
    setFormData(prev => ({ ...prev, questions: [...prev.questions, { ...newQ }] }));
    setNewQ({ q: '', options: ['', '', '', ''], a: 0 });
  };

  const handleAiGeneration = async () => {
      if (!aiParams.topic && !aiParams.file) return alert("Sujet ou image requis !");
      setAiLoading(true);
      let docUrl = null;
      if (aiParams.file) {
          const fd = new FormData(); fd.append('file', aiParams.file);
          try { const r = await fetch('/api/upload', { method: 'POST', body: fd }); const d = await r.json(); if(d.ok) docUrl = d.imageUrl; } catch(e){}
      }
      try {
          const res = await fetch('/api/generate-game-content', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ topic: aiParams.topic, docUrl }) });
          const qs = await res.json();
          if (Array.isArray(qs)) {
              setFormData(prev => ({ ...prev, questions: [...prev.questions, ...qs] }));
              setGenerationMode('manual'); // Pour voir le tableau
          } else { alert("L'IA n'a pas renvoyé de questions valides."); }
      } catch(e) { alert("Erreur serveur IA (Voir logs bleus)"); }
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
                <div key={lvl._id} style={{background:'white', padding:'15px', border:'1px solid #e2e8f0', borderRadius:'8px', marginBottom:'10px', display:'flex', justifyContent:'space-between'}}>
                    <div><strong>{lvl.title}</strong> <small>({lvl.questions.length} questions)</small></div>
                    <button style={{background:'#fee2e2', color:'red', border:'none', borderRadius:'5px'}}>🗑️</button>
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
                <div className="col form-group"><label className="form-label">Titre</label><input className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Titre du niveau" /></div>
            </div>

            <div style={{display:'flex', gap:'10px', marginBottom:'15px', background:'#f8fafc', padding:'10px', borderRadius:'8px'}}>
                <button onClick={() => setGenerationMode('manual')} style={{flex:1, padding:'8px', border:'none', borderRadius:'5px', background: generationMode==='manual'?'#2563eb':'#e2e8f0', color: generationMode==='manual'?'white':'#64748b', cursor:'pointer', fontWeight:'bold'}}>✍️ Manuel</button>
                <button onClick={() => setGenerationMode('ai')} style={{flex:1, padding:'8px', border:'none', borderRadius:'5px', background: generationMode==='ai'?'#db2777':'#e2e8f0', color: generationMode==='ai'?'white':'#64748b', cursor:'pointer', fontWeight:'bold'}}>🤖 IA Générative</button>
            </div>

            {generationMode === 'manual' ? (
                <div style={{background:'#f0f9ff', padding:'15px', borderRadius:'8px', border:'1px solid #bae6fd', marginBottom:'20px'}}>
                    <input className="form-input" placeholder="Question ?" style={{marginBottom:'10px'}} value={newQ.q} onChange={e => setNewQ({...newQ, q: e.target.value})} />
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
                        {newQ.options.map((opt, idx) => (
                            <input key={idx} className="form-input" placeholder={`Réponse ${String.fromCharCode(65+idx)}`} value={opt} onChange={e => {const n=[...newQ.options]; n[idx]=e.target.value; setNewQ({...newQ, options:n})}} style={newQ.a===idx?{borderColor:'#16a34a', borderWidth:'3px', background:'#dcfce7'}:{}} />
                        ))}
                    </div>
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <select className="form-select" style={{flex:1}} value={newQ.a} onChange={e=>setNewQ({...newQ, a:parseInt(e.target.value)})}>
                            <option value={0}>Bonne réponse : A</option><option value={1}>Bonne réponse : B</option><option value={2}>Bonne réponse : C</option><option value={3}>Bonne réponse : D</option>
                        </select>
                        <button className="btn-primary" style={{flex:1, backgroundColor:'#16a34a'}} onClick={addQuestion}>Ajouter cette question</button>
                    </div>
                </div>
            ) : (
                <div style={{background:'#fff1f2', padding:'15px', borderRadius:'8px', border:'1px solid #fda4af', marginBottom:'20px'}}>
                    <p style={{marginTop:0, fontWeight:'bold', color:'#9d174d'}}>Génération Automatique</p>
                    <input type="file" style={{marginBottom:'10px'}} onChange={e => setAiParams({...aiParams, file: e.target.files[0]})} />
                    <input className="form-input" style={{marginBottom:'10px'}} placeholder="Sujet (ex: La conjugaison)" value={aiParams.topic} onChange={e => setAiParams({...aiParams, topic: e.target.value})} />
                    <button className="btn-primary" style={{backgroundColor:'#db2777'}} disabled={aiLoading} onClick={handleAiGeneration}>{aiLoading ? "Génération en cours..." : "Lancer l'IA"}</button>
                </div>
            )}

            {/* LE FAMEUX TABLEAU VISUEL */}
            <div style={{marginTop:'20px'}}>
                <h4>Aperçu du niveau ({formData.questions.length} questions)</h4>
                {formData.questions.length > 0 ? (
                    <div style={{border:'1px solid #cbd5e1', borderRadius:'8px', overflow:'hidden'}}>
                        {formData.questions.map((q, i) => (
                            <div key={i} style={{padding:'15px', borderBottom:'1px solid #eee', background:'white'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                                    <strong style={{color:'#2563eb'}}>Q{i+1}: {q.q}</strong>
                                    <button onClick={() => {const n=[...formData.questions]; n.splice(i, 1); setFormData({...formData, questions:n})}} style={{background:'none', border:'none', color:'red', cursor:'pointer'}}>Supprimer</button>
                                </div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'5px'}}>
                                    {q.options.map((opt, idx) => (
                                        <div key={idx} style={{
                                            padding:'8px', borderRadius:'6px', fontSize:'0.9em', textAlign:'center',
                                            background: idx === q.a ? '#16a34a' : '#f1f5f9',
                                            color: idx === q.a ? 'white' : '#64748b',
                                            fontWeight: idx === q.a ? 'bold' : 'normal',
                                            border: idx === q.a ? 'none' : '1px solid #e2e8f0',
                                            opacity: opt ? 1 : 0.5
                                        }}>
                                            {String.fromCharCode(65+idx)}. {opt || '(Vide)'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p style={{color:'#94a3b8'}}>Aucune question pour l'instant.</p>}
            </div>

            <div style={{marginTop:'20px', textAlign:'right'}}>
                <button className="btn-primary" style={{width:'auto'}} onClick={handleSaveLevel}>💾 Sauvegarder le niveau</button>
            </div>
        </div>
      )}
    </div>
  );
}