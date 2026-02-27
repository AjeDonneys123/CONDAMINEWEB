import React, { useState } from 'react';
import './BugReportWidget.css';

export default function BugReportWidget({ user, isDeveloperMode = false, onOpenDeveloperBugs }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [bugCount, setBugCount] = useState(0);

  React.useEffect(() => {
    if (!isDeveloperMode) return;
    let mounted = true;
    const loadBugCount = async () => {
      try {
        const userId = user?.id || user?._id;
        const res = await fetch(`/api/admin/bug-reports?userId=${encodeURIComponent(userId || '')}`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data)) setBugCount(data.length);
      } catch (e) {}
    };
    loadBugCount();
    const it = setInterval(loadBugCount, 15000);
    return () => {
      mounted = false;
      clearInterval(it);
    };
  }, [isDeveloperMode, user?.id, user?._id]);

  const handleSend = async () => {
    const text = String(description || '').trim();
    if (text.length < 6) return;
    setSending(true);
    setDone(false);
    try {
      const payload = {
        userId: user?.id || user?._id,
        description: text,
        page: typeof window !== 'undefined' ? window.location.pathname : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      };
      const res = await fetch('/api/admin/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('send_failed');
      setDescription('');
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 900);
    } catch (e) {
      alert("Impossible d'envoyer le bug.");
    }
    setSending(false);
  };

  return (
    <>
      <button
        className={"bug-fab " + (isDeveloperMode ? 'dev' : '')}
        onClick={() => {
          if (isDeveloperMode) {
            if (onOpenDeveloperBugs) onOpenDeveloperBugs();
            return;
          }
          setOpen(true);
        }}
        title={isDeveloperMode ? 'Voir les bugs reportés' : 'Signaler un bug'}
      >
        {isDeveloperMode ? `🐞 BUGS ${bugCount > 0 ? `(${bugCount})` : ''}` : '🐞 BUG'}
      </button>

      {!isDeveloperMode && open && (
        <div className="bug-modal-overlay" onClick={() => setOpen(false)}>
          <div className="bug-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bug-modal-head">
              <div className="bug-title">Signaler un bug</div>
              <button className="bug-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <textarea
              className="bug-textarea"
              placeholder="Décris le bug (ce qui s'est passé, où, depuis quand...)."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="bug-actions">
              <button className="bug-cancel" onClick={() => setOpen(false)}>Annuler</button>
              <button
                className="bug-send"
                onClick={handleSend}
                disabled={sending || String(description || '').trim().length < 6}
              >
                {done ? 'Envoyé' : (sending ? 'Envoi...' : 'Envoyer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
