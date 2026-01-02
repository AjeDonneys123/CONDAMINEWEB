import React, { useState, useEffect, useRef } from 'react';

const HomeworkWorkspace = ({ homework, user }) => {
  const [pageIdx, setPageIdx] = useState(0);
  const [docIdx, setDocIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const viewTop = useRef({ x: 0, y: 0, scale: 1 });
  const viewBottom = useRef({ x: 0, y: 0, scale: 1 });
  const topContentRef = useRef(null);
  const bottomContentRef = useRef(null);

  const currentPage = homework.levels[pageIdx] || { instruction: '', attachmentUrls: [], questionImage: null };
  const docs = currentPage.attachmentUrls || [];

  const fitImage = (img, container, viewRef, contentRef) => {
    if (!img || !container || !contentRef.current) return;
    const scale = Math.min(container.offsetWidth / img.naturalWidth, container.offsetHeight / img.naturalHeight) * 0.98;
    viewRef.current = { x: 0, y: 0, scale: scale };
    contentRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
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

  const handleZoom = (delta, viewRef, contentRef) => {
      viewRef.current.scale = Math.min(Math.max(0.1, viewRef.current.scale + delta), 5);
      contentRef.current.style.transform = `translate(-50%, -50%) translate(${viewRef.current.x}px, ${viewRef.current.y}px) scale(${viewRef.current.scale})`;
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
                playerId: user.id || user._id 
            })
        });
        const data = await res.json();
        setAiResult(data);
    } catch(e) { alert("Erreur IA"); }
    setSubmitting(false);
  };

  return (
    <div className="flex flex-col h-[90vh] bg-slate-900 rounded-[40px] overflow-hidden border-4 border-slate-800 shadow-2xl select-none">
      
      {/* VISIONNEUSE HAUT */}
      <div id="top-container" onMouseDown={(e) => handleDrag(e, viewTop, topContentRef)} className="flex-[7] relative overflow-hidden bg-[#0a0f1a] cursor-grab active:cursor-grabbing">
        <div ref={topContentRef} className="absolute top-1/2 left-1/2 pointer-events-none transition-transform duration-75">
            {docs.length > 0 && <img src={docs[docIdx]} draggable="false" onLoad={(e) => fitImage(e.target, document.getElementById('top-container'), viewTop, topContentRef)} className="max-w-none pointer-events-auto" />}
        </div>
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-2 rounded-full text-white text-xs font-black">DOCUMENT {docIdx + 1} / {docs.length}</div>
        <div className="absolute bottom-6 right-6 flex gap-3 z-10">
            <button onClick={(e) => { e.stopPropagation(); handleZoom(-0.2, viewTop, topContentRef); }} className="w-12 h-12 bg-black/60 rounded-2xl text-white font-bold border border-white/10">➖</button>
            <button onClick={(e) => { e.stopPropagation(); handleZoom(0.2, viewTop, topContentRef); }} className="w-12 h-12 bg-black/60 rounded-2xl text-white font-bold border border-white/10">➕</button>
        </div>
      </div>

      {/* ZONE BAS */}
      <div className="flex-[3] bg-white flex border-t-4 border-orange-500">
        <div className="w-1/3 p-4 border-r flex flex-col bg-slate-50 relative">
            <p className="font-black text-slate-800 text-xs leading-tight mb-2 uppercase">{currentPage.instruction}</p>
            <div id="bot-container" onMouseDown={(e) => handleDrag(e, viewBottom, bottomContentRef)} className="flex-1 relative bg-black rounded-3xl overflow-hidden cursor-grab">
                <div ref={bottomContentRef} className="absolute top-1/2 left-1/2 pointer-events-none transition-transform duration-75">
                    {currentPage.questionImage && <img src={currentPage.questionImage} draggable="false" onLoad={(e) => fitImage(e.target, document.getElementById('bot-container'), viewBottom, bottomContentRef)} className="max-w-none pointer-events-auto" />}
                </div>
                {/* ZOOM QUESTION RAJOUTÉ ICI */}
                <div className="absolute bottom-2 right-2 flex gap-1 scale-75">
                    <button onClick={(e) => { e.stopPropagation(); handleZoom(-0.2, viewBottom, bottomContentRef); }} className="w-8 h-8 bg-white/20 rounded-lg text-white">➖</button>
                    <button onClick={(e) => { e.stopPropagation(); handleZoom(0.2, viewBottom, bottomContentRef); }} className="w-8 h-8 bg-white/20 rounded-lg text-white">➕</button>
                </div>
            </div>
        </div>

        <div className="w-2/3 p-6 flex flex-col gap-4">
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} className="flex-1 w-full p-5 rounded-[24px] border-2 border-slate-100 outline-none focus:border-blue-500 font-medium text-lg resize-none shadow-inner" placeholder="Écris ta réponse ici..." />
            <button onClick={submitToIA} disabled={submitting} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 disabled:opacity-50">
                {submitting ? "ANALYSE..." : "ENVOYER À L'IA 🤖"}
            </button>
        </div>
      </div>

      {/* MODALE DOUBLE CORRECTION */}
      {aiResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md overflow-y-auto">
            <div className="bg-white w-full max-w-3xl rounded-[50px] shadow-2xl p-10 flex flex-col my-auto">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800 uppercase">Analyse du Professeur IA</h2>
                    <div className="mt-4 text-4xl font-black text-blue-600 bg-blue-50 px-8 py-3 rounded-3xl border-4 border-blue-100 inline-block">{aiResult.grade}</div>
                </div>

                <div className="space-y-6 overflow-y-auto max-h-[50vh] pr-2">
                    <div className="bg-slate-50 p-6 rounded-3xl border shadow-inner">
                        <h3 className="font-black text-blue-600 mb-2 uppercase text-sm">📝 Avis sur le fond :</h3>
                        <div className="text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} />
                    </div>

                    {aiResult.corrections?.length > 0 && (
                        <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100">
                            <h3 className="font-black text-red-600 mb-4 uppercase text-sm">✍️ Corrections d'orthographe :</h3>
                            <table className="w-full text-sm">
                                <thead><tr className="text-left text-red-400"><th>Mot faux</th><th>Correction</th><th>Règle</th></tr></thead>
                                <tbody>
                                    {aiResult.corrections.map((c, i) => (
                                        <tr key={i} className="border-t border-red-100">
                                            <td className="py-2 text-red-600 line-through">{c.wrong}</td>
                                            <td className="py-2 text-green-600 font-bold">{c.correct}</td>
                                            <td className="py-2 text-slate-500 italic text-xs">{c.rule}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 mt-8">
                    <button onClick={() => setAiResult(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase">✍️ Améliorer</button>
                    <button onClick={() => window.location.reload()} className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase">Terminer 🎉</button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
export default HomeworkWorkspace;