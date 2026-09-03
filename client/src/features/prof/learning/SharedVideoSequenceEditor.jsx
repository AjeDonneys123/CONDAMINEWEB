import React, { useEffect, useMemo, useRef, useState } from 'react';

const youtubeId = (value = '') => {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
    return url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || '';
  } catch (_) { return ''; }
};

const normalizeSegment = (item, index = 0) => ({ ...item, id: String(item?.id || `segment_${Date.now()}_${index}`), startSec: Math.max(0, Number(item?.startSec || 0)), endSec: Math.max(0, Number(item?.endSec || 0)) });

export default function SharedVideoSequenceEditor({ video, siblingSegments = [], onClose, onSaveSegments }) {
  const playerRef = useRef(null);
  const sourceSegments = useMemo(() => {
    const matching = (siblingSegments || []).filter((item) => item.url === video?.url).map(normalizeSegment);
    return matching.length ? matching : [normalizeSegment(video)];
  }, [siblingSegments, video]);
  const [segments, setSegments] = useState(sourceSegments);
  const [selectedId, setSelectedId] = useState(String(video?.id || sourceSegments[0]?.id || ''));
  const [duration, setDuration] = useState(0);
  const [playhead, setPlayhead] = useState(Math.max(0, Number(video?.startSec || 0)));
  const [playing, setPlaying] = useState(false);
  const isYoutube = video?.sourceType === 'youtube' || Boolean(youtubeId(video?.url));
  const selected = segments.find((item) => String(item.id) === selectedId) || segments[0];
  const timelineDuration = Math.max(1, Math.ceil(duration || Math.max(...segments.map((item) => Number(item.endSec || 0)), 1)));
  const zones = segments.map((item, index) => {
    const start = Math.max(0, Number(item.startSec || 0));
    const end = Math.max(start + .1, Number(item.endSec || duration || timelineDuration));
    return { ...item, start, end, left: (start / timelineDuration) * 100, width: ((end - start) / timelineDuration) * 100, index };
  });

  useEffect(() => { setSegments(sourceSegments); setSelectedId(String(video?.id || sourceSegments[0]?.id || '')); }, [sourceSegments, video?.id]);
  const seek = (seconds) => { const next = Math.max(0, Math.min(timelineDuration, Number(seconds || 0))); setPlayhead(next); if (playerRef.current) playerRef.current.currentTime = next; };
  const toggle = () => { if (!playerRef.current) return; if (playerRef.current.paused) playerRef.current.play().catch(() => {}); else playerRef.current.pause(); };
  const patchSelected = (patch) => setSegments((current) => current.map((item) => String(item.id) === String(selected?.id) ? { ...item, ...patch } : item));
  const selectSegment = (item) => { setSelectedId(String(item.id)); seek(item.startSec); };
  const cutAtCursor = () => {
    if (!selected) return;
    const start = Math.max(0, Number(selected.startSec || 0));
    const end = Math.max(start + .1, Number(selected.endSec || duration || timelineDuration));
    const boundary = Math.max(start + .1, Math.min(end - .1, Number(playhead || 0)));
    if (!(boundary > start && boundary < end)) return;
    const second = { ...selected, id: `segment_${Date.now()}`, name: `${selected.name || 'Séquence'} — suite`, startSec: Number(boundary.toFixed(1)), endSec: selected.endSec || end, mergeWithNext: false };
    setSegments((current) => current.flatMap((item) => String(item.id) === String(selected.id) ? [{ ...item, endSec: Number(boundary.toFixed(1)) }, second] : [item]));
    setSelectedId(second.id);
  };
  const removeSegment = (id) => {
    if (segments.length <= 1) return;
    const remaining = segments.filter((item) => String(item.id) !== String(id));
    setSegments(remaining);
    if (String(id) === selectedId) { setSelectedId(String(remaining[0]?.id || '')); seek(remaining[0]?.startSec || 0); }
  };

  return <div className="shared-video-editor-backdrop" role="dialog" aria-modal="true">
    <div className="shared-video-editor-window">
      <header><div><strong>ÉDITEUR SÉQUENCES VIDÉO</strong><span>{video?.name || 'Vidéo'}</span></div><div className="shared-video-count">{segments.length} SÉQUENCE{segments.length > 1 ? 'S' : ''}</div><button onClick={onClose}>×</button></header>
      <main>
        <section className="shared-video-editor-main">
          <div className="shared-video-editor-player">{isYoutube ? <iframe src={`https://www.youtube.com/embed/${youtubeId(video.url)}?rel=0&playsinline=1`} title={video.name || 'YouTube'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <video ref={playerRef} src={video?.url} controls onLoadedMetadata={(event) => { const total = Number(event.currentTarget.duration || 0); setDuration(total); seek(selected?.startSec || 0); }} onTimeUpdate={(event) => setPlayhead(Number(event.currentTarget.currentTime || 0))} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />}</div>
          <div className="shared-video-timeline">
            <div className="shared-video-timeline-tools"><button onClick={toggle} disabled={isYoutube}>{playing ? 'Pause' : 'Play'}</button><strong>{playhead.toFixed(1)}s / {timelineDuration}s</strong><button className="cut" onClick={cutAtCursor} disabled={isYoutube || !selected}>✂ COUPER ICI</button></div>
            <input type="range" min="0" max={timelineDuration} step="0.1" value={Math.min(playhead, timelineDuration)} onChange={(event) => seek(event.target.value)} disabled={isYoutube} />
            <div className="shared-video-zones">{zones.map((zone, index) => <button key={zone.id} className={String(zone.id) === selectedId ? 'selected' : ''} style={{ left: `${zone.left}%`, width: `${Math.max(1, zone.width)}%` }} onClick={() => selectSegment(zone)} title={`${zone.name}: ${zone.start}s–${zone.end}s`}><b>{index + 1}</b><span>{zone.start.toFixed(1)}–{zone.end.toFixed(1)}s</span></button>)}</div>
          </div>
        </section>
        <aside className="shared-video-segments-aside">
          <h3>SÉQUENCES <b>{segments.length}</b></h3>
          <div className="shared-video-segment-list">{segments.map((item, index) => <div className={String(item.id) === selectedId ? 'selected' : ''} key={item.id} onClick={() => selectSegment(item)}><span><b>{index + 1}. {item.name || `Séquence ${index + 1}`}</b><small>{Number(item.startSec || 0).toFixed(1)}s → {Number(item.endSec || 0) > 0 ? `${Number(item.endSec).toFixed(1)}s` : 'fin'}</small></span><button onClick={(event) => { event.stopPropagation(); removeSegment(item.id); }} disabled={segments.length <= 1} title="Supprimer cette séquence">×</button></div>)}</div>
          {isYoutube && <p>Pour YouTube, règle les bornes avec les champs numériques.</p>}
          <label>Nom<input value={selected?.name || ''} onChange={(event) => patchSelected({ name: event.target.value })} /></label>
          <label>Début (secondes)<input type="number" min="0" step="0.1" value={selected?.startSec || 0} onChange={(event) => patchSelected({ startSec: Math.max(0, Number(event.target.value || 0)) })} /></label>
          <button onClick={() => patchSelected({ startSec: Number(playhead.toFixed(1)) })} disabled={isYoutube}>Placer le début ici</button>
          <label>Fin (0 = fin)<input type="number" min="0" step="0.1" value={selected?.endSec || 0} onChange={(event) => patchSelected({ endSec: Math.max(0, Number(event.target.value || 0)) })} /></label>
          <button onClick={() => patchSelected({ endSec: Number(playhead.toFixed(1)) })} disabled={isYoutube}>Placer la fin ici</button>
        </aside>
      </main>
      <footer><button onClick={onClose}>Annuler</button><button className="primary" onClick={() => onSaveSegments?.(segments)}>SAUVEGARDER LES {segments.length} SÉQUENCE{segments.length > 1 ? 'S' : ''}</button></footer>
    </div>
  </div>;
}
