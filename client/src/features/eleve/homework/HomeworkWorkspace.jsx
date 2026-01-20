import React, { useState, useEffect } from 'react';
import './Homework.css';

/**
 * 📖 LISEUSE ÉLÈVE V102
 * Affichage robuste via Proxy interne.
 */
export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const currentPage = homework.levels[pageIdx];
  const instrDocs = currentPage.instructionUrls || [];
  const workDocs = currentPage.attachmentUrls || [];

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setActiveDocIdx(0);
  }, [pageIdx]);

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
      } catch(e) { alert("Erreur serveur IA"); }
      setSubmitting(false);
  };

  return (
    <div className="homework-container v8-liseuse">
      <div 
        className="viewer-top-area" 
        onMouseDown={(e) => { setIsDragging(true); setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y }); }}
        onMouseMove={(e) => { if (isDragging) setOffset({ x: e.clientX - startPos.x, y: e.clientY - startPos.y }); }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
          {workDocs.length > 1 && (
            <>
                <button className="v8-nav-arrow left" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(prev => Math.max(0, prev - 1)); }}>❮</button>
                <button className="v8-nav-arrow right" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(prev => Math.min(workDocs.length - 1, prev + 1)); }}>❯</button>
                <div className="v8-doc-counter">{activeDocIdx + 1} / {workDocs.length}</div>
            </>
          )}

          <div className="v8-pan-container" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
              {workDocs.length > 0 ? (
                  <img key={workDocs[activeDocIdx]} src={workDocs[activeDocIdx]} className="v8-main-img" draggable="false" alt="Support" />
              ) : <div className="text-slate-700 font-black opacity-20">AUCUN SUPPORT DE TRAVAIL</div>}
          </div>
      </div>

      <div className="interaction-bottom-area">
          <div className="question-panel custom-scrollbar">
              <div className="v8-page-badge">CONSIGNE ÉTAPE {pageIdx + 1}</div>
              <p className="v8-instruction-text">{currentPage.instruction}</p>
              <div className="v8-instruction-gallery">
                  {instrDocs.map((url, i) => (
                      <img key={i} src={url} className="v8-mini-thumb" onClick={() => window.open(url)} alt="Consigne" />
                  ))}
              </div>
          </div>

          <div className="answer-panel">
              <textarea className="answer-input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Votre réponse ici..." />
              <div className="v8-footer-actions">
                  <div className="v8-progress">PAGE {pageIdx + 1} / {homework.levels.length}</div>
                  <button onClick={submitToIA} disabled={submitting} className="btn-send-ai">{submitting ? 'ANALYSE...' : 'ENVOYER 🤖'}</button>
              </div>
          </div>
      </div>

      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box">
                  <div className="v8-grade-badge">{aiResult.grade}</div>
                  <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="v8-feedback-content custom-scrollbar" />
                  <button onClick={() => {
                      setAiResult(null); 
                      if(pageIdx < homework.levels.length - 1) { setPageIdx(pageIdx + 1); setAnswer(''); }
                      else onQuit();
                  }} className="v8-next-page-btn">
                      {pageIdx < homework.levels.length - 1 ? 'PAGE SUIVANTE' : 'TERMINER'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}