import React, { useState, useRef } from 'react';
import './Homework.css';

export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [docIdx, setDocIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const viewTop = useRef({ x: 0, y: 0, scale: 1 });
  const viewBot = useRef({ x: 0, y: 0, scale: 1 });
  const topRef = useRef(null);
  const botRef = useRef(null);

  const currentPage = homework.levels[pageIdx];
  
  // CORRECTION V8.3 : Gère les docs ressources qu'ils soient String ou Objet {url, label}
  const rawDocs = currentPage.attachmentUrls || [];
  const docs = rawDocs.map(d => typeof d === 'string' ? d : d.url);
  const currentLabel = typeof rawDocs[docIdx] === 'object' ? rawDocs[docIdx].label : '';
  
  const updateTransform = (refData, refEl) => {
      if(refEl.current) {
          refEl.current.style.transform = `translate(-50%, -50%) translate(${refData.current.x}px, ${refData.current.y}px) scale(${refData.current.scale})`;
      }
  };

  const fitImage = (img, containerId, refData, refEl) => {
      const container = document.getElementById(containerId);
      if(!img || !container || !refEl.current) return;
      const scale = Math.min(container.offsetWidth / img.naturalWidth, container.offsetHeight / img.naturalHeight);
      refData.current = { x: 0, y: 0, scale: scale };
      updateTransform(refData, refEl);
  };

  const handleDrag = (e, refData, refEl) => {
      e.preventDefault();
      const startX = e.clientX - refData.current.x;
      const startY = e.clientY - refData.current.y;
      const move = (m) => {
          refData.current.x = m.clientX - startX;
          refData.current.y = m.clientY - startY;
          updateTransform(refData, refEl);
      };
      const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
  };

  const handleZoom = (delta, refData, refEl) => {
      refData.current.scale = Math.max(0.1, Math.min(5, refData.current.scale + delta));
      updateTransform(refData, refEl);
  };

  const submitToIA = async () => {
      if(!answer.trim()) return alert("Réponse vide !");
      setSubmitting(true);
      try {
          const res = await fetch('/api/analyze-homework', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                  userText: answer,
                  homeworkInstruction: currentPage.instruction,
                  classroom: user.classroom,
                  playerId: user.id || user._id,
                  homeworkId: homework._id,
                  levelIndex: pageIdx
              })
          });
          const data = await res.json();
          setAiResult(data);
      } catch(e) { alert("Erreur IA"); }
      setSubmitting(false);
  };

  return (
    <div className="homework-container">
      <div id="top-container" className="viewer-top-area" onMouseDown={(e) => handleDrag(e, viewTop, topRef)}>
          <div className="floating-question-badge">
              QUESTION {pageIdx+1} / {homework.levels.length} {currentLabel && `| ${currentLabel}`}
          </div>
          {docs.length > 0 && (
              <img 
                  ref={topRef}
                  src={docs[docIdx]} 
                  className="main-doc-img"
                  draggable="false"
                  onLoad={(e) => fitImage(e.target, 'top-container', viewTop, topRef)}
              />
          )}
          <div className="absolute bottom-4 right-4 flex gap-2 z-10" onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => handleZoom(-0.2, viewTop, topRef)} className="w-8 h-8 bg-black/50 text-white rounded font-bold">➖</button>
              <button onClick={() => handleZoom(0.2, viewTop, topRef)} className="w-8 h-8 bg-black/50 text-white rounded font-bold">➕</button>
          </div>
          {docs.length > 1 && (
              <div className="absolute top-1/2 w-full flex justify-between px-4 z-10" onMouseDown={e => e.stopPropagation()}>
                  <button onClick={() => setDocIdx(d => Math.max(0, d-1))} className="w-10 h-10 bg-black/50 text-white rounded-full">◀</button>
                  <button onClick={() => setDocIdx(d => Math.min(docs.length-1, d+1))} className="w-10 h-10 bg-black/50 text-white rounded-full">▶</button>
              </div>
          )}
      </div>

      <div className="interaction-bottom-area">
          <div className="question-panel">
              {currentPage.questionImage ? (
                  <div id="bot-container" className="q-visual-frame" onMouseDown={(e) => handleDrag(e, viewBot, botRef)}>
                      <img 
                          ref={botRef}
                          src={currentPage.questionImage} 
                          draggable="false"
                          onLoad={(e) => fitImage(e.target, 'bot-container', viewBot, botRef)}
                      />
                  </div>
              ) : (
                  <div className="q-text-scroll-area custom-scrollbar">
                      {currentPage.instruction || "Consigne."}
                  </div>
              )}
          </div>

          <div className="answer-panel">
              <textarea 
                  className="answer-input" 
                  placeholder="Écris ta réponse ici..." 
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
              />
              <button onClick={submitToIA} disabled={submitting} className="btn-send-ai">
                  {submitting ? "..." : "ENVOYER 🤖"}
              </button>
          </div>
      </div>

      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box animate-in zoom-in duration-300">
                  <div className="text-center">
                      <span className="text-4xl font-black text-blue-600 block mb-2">{aiResult.grade}</span>
                      <h2 className="text-xl font-bold uppercase">Analyse terminée</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto my-4 custom-scrollbar pr-2">
                      <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="text-slate-700 text-sm leading-relaxed" />
                      {aiResult.corrections?.length > 0 && (
                          <div className="mt-4 bg-red-50 p-4 rounded-xl border border-red-100">
                              <h4 className="text-red-600 font-bold text-xs uppercase mb-2">Corrections :</h4>
                              {aiResult.corrections.map((c, i) => (
                                  <div key={i} className="flex justify-between py-1 border-b border-red-100 last:border-0 text-sm">
                                      <span><span className="line-through text-red-500 font-bold">{c.wrong}</span> ➔ <span className="text-green-600 font-black">{c.correct}</span></span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setAiResult(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm">Améliorer</button>
                      {pageIdx < homework.levels.length - 1 ? (
                          <button onClick={() => { setAiResult(null); setAnswer(''); setPageIdx(pageIdx+1); setDocIdx(0); }} className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl text-sm">Suivant</button>
                      ) : (
                          <button onClick={onQuit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm">Terminer</button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}