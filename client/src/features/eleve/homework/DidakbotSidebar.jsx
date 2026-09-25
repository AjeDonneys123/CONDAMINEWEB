import React, { useState, useMemo } from 'react';
import './DidakbotSidebar.css';

export default function DidakbotSidebar({
  homework,
  user,
  essayText = '',
  topicText = '',
  onCopyForAI,
  onClose
}) {
  const [copiedName, setCopiedName] = useState(false);
  const [copiedEssay, setCopiedEssay] = useState(false);

  const studentFullName = useMemo(() => {
    return String(user?.name || user?.username || `${user?.prenom || user?.firstName || ''} ${user?.nom || user?.lastName || ''}`.trim() || 'Élève').trim();
  }, [user]);

  const assignment = useMemo(() => {
    const studentId = String(user?._id || user?.id || '');
    return (homework?.didakbotAssignments || []).find(item => String(item.studentId) === studentId) || null;
  }, [homework?.didakbotAssignments, user?._id, user?.id]);

  const cleanUrl = useMemo(() => {
    if (assignment?.sessionCode) {
      const pseudo = assignment.studentName || studentFullName;
      return `https://novapeda.eu/didakbot3.php?session=${encodeURIComponent(assignment.sessionCode)}&pseudo=${encodeURIComponent(pseudo)}`;
    }
    let raw = String(homework?.didakbotUrl || '').trim();
    const match = raw.match(/src=["'](.*?)["']/);
    if (match && match[1]) raw = match[1];
    if (raw.startsWith('//')) raw = 'https:' + raw;
    return raw;
  }, [assignment, homework?.didakbotUrl, studentFullName]);

  const handleCopyName = async () => {
    if (!studentFullName) return;
    try {
      await navigator.clipboard.writeText(studentFullName);
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 2200);
    } catch (_) {}
  };

  const handleCopyEssay = async () => {
    if (onCopyForAI) {
      await onCopyForAI();
      setCopiedEssay(true);
      setTimeout(() => setCopiedEssay(false), 2500);
      return;
    }

    const cleanEssay = String(essayText || '').trim();
    if (!cleanEssay) {
      alert("⚠️ Rédigez d'abord votre texte dans CondamineWeb avant de le copier pour l'assistant.");
      return;
    }

    const formattedText = `Sujet : "${topicText || homework?.title || 'Devoir'}"
Élève : ${studentFullName}

--- MON TRAVAIL RÉDIGÉ SUR CONDAMINEWEB ---
${cleanEssay}

Consignes pour Didak'bot :
Donne-moi ton avis bienveillant sur ce travail et des conseils méthodologiques pour progresser (sans jamais rédiger à ma place).`;

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopiedEssay(true);
      setTimeout(() => setCopiedEssay(false), 2500);
    } catch (_) {}
  };

  if (!cleanUrl) return null;

  return (
    <aside className="conda-didakbot-sidebar">
      <div className="conda-didakbot-sidebar-header">
        <div className="conda-didakbot-sidebar-title-area">
          <span className="text-xl">🤖</span>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase text-cyan-400 tracking-wider">
              Didak'bot 3
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[220px]" title={homework?.title}>
              {homework?.title || 'Tuteur'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-xs transition border border-slate-700 flex-shrink-0"
          title="Masquer le volet latéral"
        >
          ✕
        </button>
      </div>

      {/* Barre d'actions rapides (Copier le pseudo + Copier le devoir) */}
      <div className="conda-didakbot-quick-bar">
        {studentFullName && (
          <button
            type="button"
            onClick={handleCopyName}
            className={`conda-quick-btn ${copiedName ? 'is-success' : ''}`}
            title="Copier mon prénom/nom pour le coller comme pseudo dans Didak'bot"
          >
            <span>👤</span>
            <span className="truncate max-w-[120px]">{copiedName ? '✓ Copié !' : studentFullName}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyEssay}
          className={`conda-quick-btn conda-quick-btn-copy ${copiedEssay ? 'is-success' : ''}`}
          title="Copie votre devoir pour le coller facilement dans Didak'bot"
        >
          <span>📋</span>
          <span>{copiedEssay ? '✓ Devoir copié !' : 'Copier mon devoir'}</span>
        </button>
      </div>

      <div className="conda-didakbot-sidebar-body">
        <iframe
          src={cleanUrl}
          className="conda-didakbot-sidebar-iframe"
          title="Assistant Didak'bot"
          allow="clipboard-read; clipboard-write; microphone"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
    </aside>
  );
}
