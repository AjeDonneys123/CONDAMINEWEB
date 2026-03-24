import React, { useEffect, useRef, useState } from 'react';

const MAX_PHOTOS = 6;

export default function ControlRecoveryMobileCapture({ token }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [session, setSession] = useState(null);
  const [student, setStudent] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  const loadSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/eleve/control-recovery/mobile-session/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || 'Session mobile introuvable'));
      setSession(data.item || null);
      setStudent(data.student || null);
    } catch (e) {
      setCameraError(String(e?.message || 'Session mobile introuvable'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSession(); }, [token]);

  useEffect(() => {
    const startCamera = async () => {
      setCameraReady(false);
      setCameraError('');
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Caméra non supportée sur ce navigateur.");
        return;
      }
      const host = window?.location?.hostname || '';
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!window.isSecureContext && !isLocalhost) {
        setCameraError("Caméra bloquée: ouvre ce site en HTTPS.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
            setCameraReady(true);
          };
        }
      } catch (e) {
        setCameraError("Impossible d'ouvrir la caméra.");
      }
    };
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if ((session?.uploadedPhotoUrls?.length || 0) + captures.length >= MAX_PHOTOS) {
      setStatus('Maximum 6 photos atteint.');
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setCaptures((prev) => [...prev, { id: `${Date.now()}_${prev.length}`, blob, url }].slice(0, MAX_PHOTOS));
      setStatus('');
    }, 'image/jpeg', 0.92);
  };

  const removeCapture = (id) => {
    setCaptures((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleSend = async () => {
    if (captures.length === 0) {
      setStatus('Ajoute au moins une photo.');
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      captures.forEach((item, index) => fd.append('files', item.blob, `recovery_${index + 1}.jpg`));
      const res = await fetch(`/api/eleve/control-recovery/mobile-upload/${encodeURIComponent(token)}`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(data?.error || 'Envoi impossible'));
      setStatus('Photos envoyées. Tu peux revenir sur l’ordinateur.');
      captures.forEach((item) => item?.url && URL.revokeObjectURL(item.url));
      setCaptures([]);
      await loadSession();
    } catch (e) {
      setStatus(String(e?.message || 'Envoi impossible'));
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-black">Chargement...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="rounded-[28px] bg-slate-900 border border-slate-800 p-5">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">Recup controle mobile</div>
          <div className="mt-2 text-2xl font-black">{session?.title || 'Récupération'}</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">{student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : ''}</div>
          <div className="mt-3 text-xs font-bold text-slate-400">Phase 1 uniquement. Maximum {MAX_PHOTOS} photos.</div>
        </div>

        <div className="rounded-[28px] overflow-hidden border border-slate-800 bg-black">
          <video ref={videoRef} playsInline muted autoPlay className="w-full aspect-[3/4] object-cover bg-black" />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {cameraError && <div className="rounded-2xl border border-red-800 bg-red-950/70 p-4 text-sm font-bold text-red-200">{cameraError}</div>}

        <div className="grid grid-cols-3 gap-3">
          {(session?.uploadedPhotoUrls || []).map((url, index) => (
            <div key={`uploaded_${index}`} className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
              <img src={url} alt={`Photo envoyée ${index + 1}`} className="w-full aspect-square object-cover" />
            </div>
          ))}
          {captures.map((item, index) => (
            <button key={item.id} type="button" onClick={() => removeCapture(item.id)} className="rounded-2xl overflow-hidden border border-emerald-700 bg-slate-900 relative">
              <img src={item.url} alt={`Capture ${index + 1}`} className="w-full aspect-square object-cover" />
              <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black">✕</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={handleCapture} disabled={!cameraReady || sending || ((session?.uploadedPhotoUrls?.length || 0) + captures.length >= MAX_PHOTOS)} className="flex-1 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-slate-950 disabled:opacity-40">
            Prendre une photo
          </button>
          <button onClick={handleSend} disabled={sending || captures.length === 0} className="flex-1 rounded-2xl bg-white px-4 py-4 text-sm font-black text-slate-950 disabled:opacity-40">
            {sending ? 'Envoi...' : 'Envoyer'}
          </button>
        </div>

        {status && <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm font-bold text-slate-200">{status}</div>}
      </div>
    </div>
  );
}
