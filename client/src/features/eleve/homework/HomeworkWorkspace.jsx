import React, { useState, useRef } from 'react';
import './Homework.css';

export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const currentPage = homework.levels[pageIdx];
  const docs = currentPage.attachmentUrls || [];

  const submitToIA = async () => {
      if(!answer.trim()) return;
      setSubmitting(true);
      const res = await fetch('/api/homework/analyze-homework', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
              userText: answer,
              homeworkInstruction: currentPage.instruction,
              classroom: user.classroom,
              playerId: user._id || user.id,
              homeworkId: homework._id,
              levelIndex: pageIdx
          })
      }).then(r => r.json());
      setAiResult(res);
      setSubmitting(false);
  };

  return (
    <div className="homework-container">
      <div className="viewer-top-area">
          {docs[0] && <img src={docs[0]} className="main-doc-img" alt="document" />}
      </div>
      <div className="interaction-bottom-area">
          <div className="question-panel">{currentPage.instruction}</div>
          <div className="answer-panel">
              <textarea className="answer-input" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Ta réponse..." />
              <button onClick={submitToIA} className="btn-send-ai">{submitting ? 'ANALYSE...' : 'ENVOYER 🤖'}</button>
          </div>
      </div>
      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box">
                  <h2 className="text-3xl font-black text-blue-600 mb-4">{aiResult.grade}</h2>
                  <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="mb-6 text-slate-600" />
                  <button onClick={() => {setAiResult(null); onQuit();}} className="btn-send-ai">TERMINER</button>
              </div>
          </div>
      )}
    </div>
  );
}