import React, { useEffect, useState, useRef } from 'react';
import './LiveControlCheatAlert.css';

// Synthétiseur audio Web Audio API pour bip d'alerte sans fichier externe
function playCheatAlarmSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, now); // La5
    osc1.frequency.setValueAtTime(440, now + 0.15); // La4
    osc1.frequency.setValueAtTime(880, now + 0.3); // La5

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.55);
  } catch (_) {}
}

export default function LiveControlCheatAlert() {
  const [alerts, setAlerts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastKnownAlertIdRef = useRef('');

  useEffect(() => {
    let mounted = true;

    const pollAlerts = async () => {
      try {
        const res = await fetch('/api/controls/live-alerts');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted || !Array.isArray(data)) return;

        setAlerts(data);

        // Si une nouvelle alerte arrive qu'on n'a pas encore vue
        if (data.length > 0) {
          const newestId = data[0].id;
          if (newestId && newestId !== lastKnownAlertIdRef.current) {
            lastKnownAlertIdRef.current = newestId;
            if (soundEnabled) {
              playCheatAlarmSound();
            }
          }
        }
      } catch (_) {}
    };

    pollAlerts();
    const interval = setInterval(pollAlerts, 1500);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [soundEnabled]);

  const handleAcknowledge = async (alertId) => {
    try {
      await fetch(`/api/controls/alerts/${encodeURIComponent(alertId)}/ack`, { method: 'POST' });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setCurrentIndex(0);
    } catch (_) {}
  };

  const handleClearAll = async () => {
    try {
      await fetch('/api/controls/alerts/clear-all', { method: 'POST' });
      setAlerts([]);
      setCurrentIndex(0);
    } catch (_) {}
  };

  if (!alerts || alerts.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, alerts.length - 1);
  const alert = alerts[safeIndex] || alerts[0];

  return (
    <aside
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="fixed inset-x-3 top-3 z-[9999] max-w-5xl mx-auto control-cheat-alert-bounce transition-all pointer-events-auto"
    >
      <div className="relative rounded-3xl border-4 border-red-500 bg-gradient-to-r from-red-950 via-rose-950 to-red-950 text-white p-5 md:p-8 shadow-[0_0_60px_rgba(239,68,68,0.7)] flex flex-col gap-4">
        {/* En-tête d'alerte */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-800/80 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl md:text-4xl animate-pulse">🚨</span>
            <div>
              <span className="text-xs md:text-sm font-black tracking-widest uppercase text-red-300 bg-red-900/60 px-3 py-1 rounded-full border border-red-700">
                SIGNALEMENT IMMÉDIAT AU TABLEAU · CONTRÔLE SUR MOBILE
              </span>
              <div className="text-xs text-red-200 mt-1 font-semibold">
                Tentative de triche ou sortie de l'écran détectée en direct
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Désactiver le son d’alerte' : 'Activer le son d’alerte'}
              className="text-xs font-bold px-3 py-1 rounded-xl bg-red-900/70 hover:bg-red-800 text-red-200 border border-red-700 transition"
            >
              {soundEnabled ? '🔔 Bip ON' : '🔕 Bip OFF'}
            </button>
            {alerts.length > 1 && (
              <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
                {safeIndex + 1} / {alerts.length} alertes
              </span>
            )}
          </div>
        </div>

        {/* Cœur du message : NOM DE L'ÉLÈVE EN TRÈS GRAND */}
        <div className="text-center py-2 flex flex-col items-center">
          <div className="text-xs md:text-sm font-black text-amber-300 uppercase tracking-widest mb-1">
            ÉLÈVE PRIS SUR LE FAIT :
          </div>
          <div className="text-3xl md:text-6xl font-black text-amber-300 tracking-wide uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] px-4 py-2 rounded-2xl bg-black/40 border border-amber-400/40 inline-block">
            {alert.studentName || 'Élève (Nom non renseigné)'}
          </div>

          <div className="text-lg md:text-2xl font-black text-white mt-3 flex items-center justify-center gap-2">
            <span className="text-red-400">⚠️</span>
            <span>{alert.reason || "Sortie du plein écran / Changement d'application"}</span>
          </div>

          <div className="text-xs md:text-sm text-slate-300 mt-2 font-medium">
            Épreuve : <strong className="text-white">{alert.controlTitle}</strong> · Signalé à{' '}
            <strong className="text-amber-200">
              {new Date(alert.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </strong>
          </div>
        </div>

        {/* Boutons d'action professeur */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-red-800/80">
          <div className="flex items-center gap-2">
            {alerts.length > 1 && (
              <>
                <button
                  type="button"
                  disabled={safeIndex <= 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="px-3 py-2 rounded-xl bg-red-900 hover:bg-red-800 disabled:opacity-40 text-xs font-black text-white transition"
                >
                  ◀ Précédente
                </button>
                <button
                  type="button"
                  disabled={safeIndex >= alerts.length - 1}
                  onClick={() => setCurrentIndex((i) => Math.min(alerts.length - 1, i + 1))}
                  className="px-3 py-2 rounded-xl bg-red-900 hover:bg-red-800 disabled:opacity-40 text-xs font-black text-white transition"
                >
                  Suivante ▶
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {alerts.length > 1 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black transition"
              >
                Tout acquitter ({alerts.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => handleAcknowledge(alert.id)}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black shadow-lg shadow-amber-400/30 transition transform active:scale-95 flex items-center gap-2"
            >
              <span>✓</span>
              <span>ACQUITTER CETTE ALERTE</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
