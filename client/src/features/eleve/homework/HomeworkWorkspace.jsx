import React, { useState, useEffect, useRef } from 'react';
import './Homework.css';

export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [docIdx, setDocIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const viewTop = useRef({ x: 0, y: 0, scale: 1 });
  const viewBottom = useRef({ x: 0, y: 0, scale: 1 });
  const topContentRef = useRef(null);
  const bottomContentRef = useRef(null);

  const currentPage = homework.levels[pageIdx] || { instruction: '', attachmentUrls: [], questionImage: null };
  const docs = currentPage.attachmentUrls || [];

  const fitImage = (img, containerId, viewRef, contentRef) => {
    const container = document.getElementById(containerId);
    if (!img || !container || !contentRef.current) return;
    const scale = Math.min(container.offsetWidth / img.naturalWidth, container.offsetHeight / img.naturalHeight) * 0.98;
    viewRef.current = { x: 0, y: 0, scale: scale };
    contentRef.current.style.transform = `translate(-50%, -50%) translate(0px, 0px) scale(${scale})`;
  };

  const handleDrag = (e, viewRef, contentRef) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX - viewRef.current.x;
    const startY = e.clientY - viewRef.current.y;
    const move = (m) => {
      viewRef.current.x = m.clientX - startX; viewRef.current.y = m.clientY - startY;
      contentRef.current.style.transform = `translate(-50%, -50%) translate(${viewRef.current.x}px, ${viewRef.current.y}px) scale(${viewRef.current.scale})`;
    };
    const stop = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
  };

  const submitToIA = async () => {
    if (!answer.trim()) return alert("Écris ta réponse !");
    setSubmitting(true);
    try {
        const res = await fetch('/api/analyze-homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

  if (isFinished) {
      return (
          <div className="flex items-center justify-center min-h-[60vh]">
              <div className="bg-white p-12 rounded-[50px] shadow-2xl text-center border-4 border-green-500 animate-in zoom-in duration-300">
                  <span className="text-6xl">🎉</span>
                  <h2 className="text-3xl font-black mt-4 uppercase">Travail Terminé !</h2>
                  <p className="text-slate-400 font-bold mt-2">Tes réponses ont été envoyées au Maître.</p>
                  <button onClick={onQuit} className="mt-8 bg-green-500 text-white px-10 py-4 rounded-3xl font-black shadow-lg shadow-green-100 hover:scale-105 transition-all">RETOURNER AUX DEVOIRS</button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-[88vh] rounded-[40px] overflow-hidden border-4 border-slate-800 shadow-2xl select-none relative homework-container">
      <div id="top-container" onMouseDown={(e) => handleDrag(e, viewTop, topContentRef)} className="flex-[7] relative overflow-hidden viewer-dark-bg cursor-grab active:cursor-grabbing">
        <div ref={topContentRef} className="absolute top-1/2 left-1/2 pointer-events-none transition-transform duration-75">
            {docs.length > 0 && <img src={docs[docIdx]} draggable="false" onLoad={(e) => fitImage(e.target, 'top-container', viewTop, topContentRef)} className="max-w-none draggable-img pointer-events-auto" />}
        </div>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-6 pointer-events-none z-20">
            <button onClick={() => docIdx > 0 && setDocIdx(docIdx-1)} className={`w-14 h-14 rounded-full bg-blue-600 text-white font-black text-2xl nav-arrow-btn pointer-events-auto ${docIdx === 0 ? 'opacity-0' : 'opacity-100'}`}>❮</button>
            <button onClick={() => docIdx < docs.length - 1 && setDocIdx(docIdx+1)} className={`w-14 h-14 rounded-full bg-blue-600 text-white font-black text-2xl nav-arrow-btn pointer-events-auto ${docIdx === docs.length - 1 ? 'opacity-0' : 'opacity-100'}`}>❯</button>
        </div>
      </div>

      <div className="flex-[3] bg-white flex border-t-4 border-orange-500 min-h-[250px]">
        <div className="w-1/3 p-4 border-r flex flex-col bg-slate-50 relative">
            <p className="font-black text-slate-800 text-[10px] uppercase mb-2">Question {pageIdx + 1} / {homework.levels.length}</p>
            <div id="bot-container" onMouseDown={(e) => handleDrag(e, viewBottom, bottomContentRef)} className="flex-1 relative bg-black rounded-3xl overflow-hidden cursor-grab shadow-inner">
                <div ref={bottomContentRef} className="absolute top-1/2 left-1/2 pointer-events-none transition-transform duration-75">
                    {currentPage.questionImage && <img src={currentPage.questionImage} draggable="false" onLoad={(e) => fitImage(e.target, 'bot-container', viewBottom, bottomContentRef)} className="max-w-none draggable-img pointer-events-auto" />}
                </div>
            </div>
        </div>
        <div className="w-2/3 p-6 flex flex-col gap-4 bg-white">
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} className="flex-1 w-full p-5 rounded-[24px] border-2 border-slate-100 outline-none focus:border-blue-500 font-medium text-lg resize-none shadow-inner bg-slate-50/50" placeholder="Écris ta réponse ici..." />
            <button onClick={submitToIA} disabled={submitting} className="bg-blue-600 text-white py-5 rounded-[20px] font-black shadow-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50 uppercase tracking-widest">{submitting ? "Analyse en cours..." : "Envoyer à l'IA 🤖"}</button>
        </div>
      </div>

      {aiResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 ai-modal-glass">
            <div className="bg-white w-full max-w-3xl rounded-[50px] shadow-2xl p-10 flex flex-col my-auto animate-in zoom-in duration-300">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 uppercase">Analyse du Maître IA</h2>
                    <div className="mt-4 text-4xl font-black text-blue-600 bg-blue-50 px-8 py-3 rounded-3xl border-4 border-blue-100 inline-block">{aiResult.grade}</div>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 p-8 rounded-[32px] border shadow-inner mb-8 text-lg" dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} />
                <div className="flex gap-4">
                    <button onClick={() => setAiResult(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase tracking-widest">✍️ Corriger</button>
                    {pageIdx < homework.levels.length - 1 ? (
                        <button onClick={() => { setAiResult(null); setAnswer(''); setPageIdx(pageIdx+1); setDocIdx(0); }} className="flex-1 py-5 bg-green-500 text-white rounded-3xl font-black uppercase tracking-widest shadow-lg shadow-green-200">Suivant ➔</button>
                    ) : (
                        <button onClick={() => setIsFinished(true)} className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black shadow-lg shadow-blue-200 uppercase tracking-widest">Terminer 🎉</button>
                    )}
                </div>
            </div>
          </div>
      )}
    </div>
  );
}