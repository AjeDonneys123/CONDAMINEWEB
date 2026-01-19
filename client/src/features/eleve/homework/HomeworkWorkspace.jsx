import React, { useState, useRef, useEffect } from 'react';
import './Homework.css';

/**
 * 📖 LISEUSE ÉLÈVE PROFESSIONNELLE - VERSION 8
 * Gère le Drag & Slide, la navigation multi-docs et le plein écran hauteur.
 */
export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // --- LOGIQUE DE DRAG & SLIDE (PAN) ---
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const viewerRef = useRef(null);

  const currentPage = homework.levels[pageIdx];
  const instrDocs = currentPage.instructionUrls || [];
  const workDocs = currentPage.attachmentUrls || [];

  // Reset du pan et du document quand on change de page
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setActiveDocIdx(0);
  }, [pageIdx]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const submitToIA = async () => {
      if(!answer.trim()) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/homework/analyze-homework', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                userText: answer,
                homeworkId: homework._id,
                levelIndex: pageIdx,
                playerId: user._id || user.id
            })
        }).then(r => r.json());
        setAiResult(res);
      } catch(e) { alert("Erreur réseau"); }
      setSubmitting(false);
  };

  return (
    <div className="homework-container v8-liseuse">
      
      {/* 1. ZONE NOIRE : DOCUMENTS DE TRAVAIL (75% Hauteur) */}
      <div 
        className="viewer-top-area" 
        ref={viewerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
          {/* Navigation Doc Suivant/Précédent */}
          {workDocs.length > 1 && (
            <>
                <button className="v8-nav-arrow left" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(prev => Math.max(0, prev - 1)); setOffset({x:0, y:0}); }}>❮</button>
                <button className="v8-nav-arrow right" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(prev => Math.min(workDocs.length - 1, prev + 1)); setOffset({x:0, y:0}); }}>❯</button>
                <div className="v8-doc-counter">{activeDocIdx + 1} / {workDocs.length}</div>
            </>
          )}

          {/* Affichage du document avec Pan */}
          <div 
            className="v8-pan-container"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
          >
              {workDocs.length > 0 ? (
                  <img 
                    src={workDocs[activeDocIdx]} 
                    className="v8-main-img" 
                    draggable="false" 
                    alt="Work" 
                  />
              ) : (
                  <div className="text-slate-700 font-black text-3xl opacity-20">AUCUN SUPPORT</div>
              )}
          </div>
      </div>

      {/* 2. ZONE BLANCHE : INTERACTION (25% Hauteur) */}
      <div className="interaction-bottom-area">
          
          {/* COLONNE GAUCHE : QUESTIONS & MINIATURES */}
          <div className="question-panel custom-scrollbar">
              <div className="v8-page-badge">CONSIGNE PAGE {pageIdx + 1}</div>
              <p className="v8-instruction-text">{currentPage.instruction}</p>
              
              <div className="v8-instruction-gallery">
                  {instrDocs.map((url, i) => (
                      <img key={i} src={url} className="v8-mini-thumb" onClick={() => window.open(url)} alt="Instr" />
                  ))}
              </div>
          </div>

          {/* COLONNE DROITE : RÉPONSE & ENVOI */}
          <div className="answer-panel">
              <textarea 
                className="answer-input" 
                value={answer} 
                onChange={e => setAnswer(e.target.value)} 
                placeholder="Rédigez votre analyse ici..." 
              />
              <div className="v8-footer-actions">
                  <div className="v8-progress">ÉTAPE {pageIdx + 1} / {homework.levels.length}</div>
                  <button onClick={submitToIA} disabled={submitting} className="btn-send-ai">
                    {submitting ? 'CORRECTION...' : 'ENVOYER MA RÉPONSE 🤖'}
                  </button>
              </div>
          </div>
      </div>

      {/* MODALE DE FEEDBACK IA */}
      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box animate-in zoom-in">
                  <div className="v8-grade-badge">{aiResult.grade}</div>
                  <h3 className="text-xl font-black text-slate-800 mb-4 uppercase tracking-tighter">Retour de votre correcteur</h3>
                  <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="v8-feedback-content custom-scrollbar" />
                  
                  <button onClick={() => {
                      setAiResult(null); 
                      if(pageIdx < homework.levels.length - 1) { 
                          setPageIdx(pageIdx + 1); 
                          setAnswer(''); 
                      } else {
                          onQuit();
                      }
                  }} className="v8-next-page-btn">
                      {pageIdx < homework.levels.length - 1 ? 'PASSER À LA PAGE SUIVANTE' : 'TERMINER LE DEVOIR'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}