import React, { useState, useEffect } from 'react';
import './Homework.css';

export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [activeInstrIdx, setActiveInstrIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showCheatAlert, setShowCheatAlert] = useState(false);

  // Moteurs graphiques
  const [docState, setDocState] = useState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const [instrState, setInstrState] = useState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });

  const currentPage = homework.levels[pageIdx];
  const instrDocs = currentPage.instructionUrls || [];
  const workDocs = currentPage.attachmentUrls || [];

  useEffect(() => {
    setDocState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
    setInstrState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
    setActiveDocIdx(0);
    setActiveInstrIdx(0);
  }, [pageIdx]);

  // --- LOGIQUE NOTE & COMPORTEMENT ---
  const handleModalAction = () => {
      if (!aiResult) return;
      const g = aiResult.grade;

      // CAS C : INSUFFISANT -> ON EFFACE ET ON RECOMMENCE
      if (g === 'C' || g.includes('C')) {
          setAnswer(''); // Efface le texte
          setAiResult(null); // Ferme la modale
      }
      // CAS B : À REPRENDRE -> ON GARDE LE TEXTE ET ON RETOURNE ÉDITER
      else if (g === 'B' || g.includes('B')) {
          setAiResult(null); // Ferme la modale, texte conservé
      }
      // CAS A / A+ : SUCCÈS -> PAGE SUIVANTE
      else {
          setAiResult(null); 
          if(pageIdx < homework.levels.length - 1) { 
              setPageIdx(pageIdx + 1); 
              setAnswer(''); 
          } else {
              onQuit();
          }
      }
  };

  // Helper pour le titre et le bouton de la modale
  const getModalConfig = () => {
      if (!aiResult) return {};
      const g = aiResult.grade;
      if (g === 'C' || g.includes('C')) return { title: "TRAVAIL INSUFFISANT 🛑", btn: "RECOMMENCER À ZÉRO ↺", color: "#ef4444" };
      if (g === 'B' || g.includes('B')) return { title: "À COMPLÉTER ⚠️", btn: "CORRIGER MA RÉPONSE ✏️", color: "#eab308" };
      if (g === 'A+' || g.includes('+')) return { title: "EXCELLENT ! 🌟", btn: "PAGE SUIVANTE ➔", color: "#14532d" };
      return { title: "BON TRAVAIL ✅", btn: "PAGE SUIVANTE ➔", color: "#22c55e" };
  };

  const modalConfig = getModalConfig();

  // ... (Le reste des fonctions handleZoom, handleMouseDown, submitToIA reste identique) ...
  const handleZoom = (type, delta) => { if (type === 'doc') { setDocState(prev => ({ ...prev, scale: Math.max(0.5, Math.min(4, prev.scale + delta)) })); } else { setInstrState(prev => ({ ...prev, scale: Math.max(0.5, Math.min(4, prev.scale + delta)) })); } };
  const handleMouseDown = (e, type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; setState({ ...state, dragging: true, startX: e.clientX - state.x, startY: e.clientY - state.y }); };
  const handleMouseMove = (e, type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; if (state.dragging) { setState({ ...state, x: e.clientX - state.startX, y: e.clientY - state.startY }); } };
  const handleMouseUp = (type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; setState({ ...state, dragging: false }); };
  const handleInputCheck = (e) => { const newValue = e.target.value; if (newValue.length - answer.length > 5) { setShowCheatAlert(true); setTimeout(() => setShowCheatAlert(false), 4000); } setAnswer(newValue); };
  const submitToIA = async () => { if(!answer.trim()) return; setSubmitting(true); try { const res = await fetch('/api/homework/analyze-homework', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userText: answer, homeworkId: homework._id, levelIndex: pageIdx, playerId: user._id || user.id }) }).then(r => r.json()); setAiResult(res); } catch(e) { alert("Erreur serveur IA"); } setSubmitting(false); };

  return (
    <div className="homework-container v8-liseuse">
      
      {showCheatAlert && <div className="cheat-alert-box">🚨 TRICHER, C'EST MAL ! 😡</div>}
      <button onClick={onQuit} className="v8-quit-btn">⬅ QUITTER</button>

      {/* --- ZONE SUJET (HAUT) --- */}
      <div className="viewer-top-area" onMouseDown={(e) => handleMouseDown(e, 'doc')} onMouseMove={(e) => handleMouseMove(e, 'doc')} onMouseUp={() => handleMouseUp('doc')} onMouseLeave={() => handleMouseUp('doc')}>
          <div className="v8-zoom-controls">
              <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('doc', 0.2); }}>+</button>
              <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('doc', -0.2); }}>-</button>
          </div>
          {workDocs.length > 1 && (<><button className="v8-nav-arrow left" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(Math.max(0, activeDocIdx - 1)); }}>❮</button><button className="v8-nav-arrow right" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(Math.min(workDocs.length - 1, activeDocIdx + 1)); }}>❯</button><div className="v8-doc-counter">{activeDocIdx + 1} / {workDocs.length}</div></>)}
          <div className="v8-pan-container" style={{ transform: `translate(${docState.x}px, ${docState.y}px) scale(${docState.scale})` }}>
              {workDocs.length > 0 ? (<img src={workDocs[activeDocIdx]} className="v8-main-img" draggable="false" />) : <div className="text-slate-700 font-black opacity-20">AUCUN DOCUMENT</div>}
          </div>
      </div>

      {/* --- ZONE BAS --- */}
      <div className="interaction-bottom-area">
          <div className="question-panel">
              <div className="question-header"><div className="v8-page-badge">ÉTAPE {pageIdx + 1}</div><div className="v8-instruction-text-mini">{currentPage.instruction || "Observez le document."}</div></div>
              <div className="v8-instruction-viewer" onMouseDown={(e) => handleMouseDown(e, 'instr')} onMouseMove={(e) => handleMouseMove(e, 'instr')} onMouseUp={() => handleMouseUp('instr')} onMouseLeave={() => handleMouseUp('instr')}>
                  <div className="v8-zoom-controls" style={{ bottom: '10px', right: '10px' }}><button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('instr', 0.2); }}>+</button><button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('instr', -0.2); }}>-</button></div>
                  <div className="v8-pan-container" style={{ transform: `translate(${instrState.x}px, ${instrState.y}px) scale(${instrState.scale})` }}>{instrDocs.length > 0 ? (<img src={instrDocs[activeInstrIdx]} className="v8-instr-img" draggable="false" />) : <div className="flex items-center justify-center h-full text-slate-300 font-bold text-xs uppercase">Aucune image consigne</div>}</div>
              </div>
              {instrDocs.length > 1 && (<div className="flex gap-2 p-2 bg-white border-t border-slate-100 overflow-x-auto">{instrDocs.map((url, i) => (<img key={i} src={url} onClick={() => setActiveInstrIdx(i)} className={`w-10 h-10 object-cover rounded border-2 cursor-pointer ${activeInstrIdx === i ? 'border-blue-500' : 'border-slate-200'}`} />))}</div>)}
          </div>

          <div className="answer-panel">
              <textarea className="answer-input" value={answer} onChange={handleInputCheck} placeholder="Votre réponse ici..." />
              <div className="v8-footer-actions">
                  <div className="v8-progress">PAGE {pageIdx + 1} / {homework.levels.length}</div>
                  <button onClick={submitToIA} disabled={submitting} className="btn-send-ai">{submitting ? 'ANALYSE...' : 'ENVOYER 🤖'}</button>
              </div>
          </div>
      </div>

      {/* FEEDBACK MODAL DYNAMIQUE */}
      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box">
                  <div className="v8-grade-badge" style={{backgroundColor: modalConfig.color}}>{aiResult.grade}</div>
                  <h2 style={{color: modalConfig.color, fontWeight:900, marginBottom: '15px', textTransform:'uppercase'}}>{modalConfig.title}</h2>
                  
                  <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="v8-feedback-content custom-scrollbar" />
                  
                  <button onClick={handleModalAction} className="v8-next-page-btn" style={{backgroundColor: modalConfig.color}}>
                      {modalConfig.btn}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}