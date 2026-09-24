import React, { useState } from 'react';

export default function DidakbotViewer({ botUrl, studentName = '', hwTitle = '' }) {
  const [copied, setCopied] = useState(false);

  // Normalisation de l'URL : si l'utilisateur a collé un code <iframe> ou une URL relative
  let cleanUrl = String(botUrl || '').trim();
  const iframeMatch = cleanUrl.match(/src=["'](.*?)["']/);
  if (iframeMatch && iframeMatch[1]) {
    cleanUrl = iframeMatch[1];
  }
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  }

  const handleCopyName = async () => {
    if (!studentName) return;
    try {
      await navigator.clipboard.writeText(studentName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {}
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
      {/* HEADER BAR CONDAWEB */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950 border-b border-slate-800 shadow-md flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
              Assistant Didak'bot
            </span>
          </div>
          {hwTitle && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 font-bold border-l border-slate-700 pl-3">
              <span className="text-slate-500">Devoir :</span>
              <span className="text-white truncate max-w-xs">{hwTitle}</span>
            </div>
          )}
        </div>

        {/* IDENTIFIANT ÉLÈVE POUR LE CHAT */}
        {studentName && (
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-300">
              👤 Ton pseudo pour le chat :
            </span>
            <strong className="text-xs text-cyan-300 font-black tracking-wide">
              {studentName}
            </strong>
            <button
              type="button"
              onClick={handleCopyName}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
              }`}
              title="Copier mon nom pour le coller dans le chat"
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-amber-300/90 font-medium">
          <span className="hidden md:inline">
            ⚠️ Le copier-coller vers votre devoir est bloqué. Rédigez avec vos mots.
          </span>
          <button
            type="button"
            onClick={() => window.close()}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-700"
          >
            Fermer ✕
          </button>
        </div>
      </header>

      {/* ZONE IFRAME DU CHATBOT */}
      <main className="flex-1 w-full h-full relative bg-slate-950">
        {cleanUrl ? (
          <iframe
            src={cleanUrl}
            className="w-full h-full border-0"
            title="Assistant Didak'bot"
            allow="clipboard-read; clipboard-write; microphone"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
            <div className="text-4xl">⚠️</div>
            <div className="text-base font-bold text-slate-300">
              Aucun lien Didak'bot configuré pour ce devoir.
            </div>
            <p className="text-xs text-slate-500 max-w-sm">
              Votre professeur n'a pas encore associé de chatbot à cette épreuve.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
