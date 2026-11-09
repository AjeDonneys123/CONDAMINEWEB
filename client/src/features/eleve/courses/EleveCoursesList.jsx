import React, { useEffect, useMemo, useState } from 'react';
import './EleveCoursesList.css';

const buildSlidesThumbnailUrl = (presentationId = '', objectId = '', slideNumber = '') => {
  const params = new URLSearchParams();
  params.set('presentationId', String(presentationId || ''));
  if (objectId) params.set('pageObjectId', String(objectId));
  if (slideNumber) params.set('slideNumber', String(slideNumber));
  return `/api/learning/slides/thumbnail?${params.toString()}`;
};

const extractPresentationId = (raw = '') => {
  const value = String(raw || '').trim();
  return value.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)?.[1] || (/^[a-zA-Z0-9_-]+$/.test(value) ? value : '');
};

const buildSlidesReadUrl = (raw = '', objectId = '') => {
  const presentationId = extractPresentationId(raw);
  if (!presentationId) return '';
  const slide = objectId ? `#slide=id.${encodeURIComponent(String(objectId))}` : '';
  return `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/present?start=false&loop=false&delayms=60000${slide}`;
};

const buildSlidesEmbedUrl = (raw = '', objectId = '') => {
  const presentationId = extractPresentationId(raw);
  if (!presentationId) return '';
  const slide = objectId ? `#slide=id.${encodeURIComponent(String(objectId))}` : '';
  return `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/embed?start=false&loop=false&delayms=60000${slide}`;
};

export default function EleveCoursesList({ user }) {
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slides, setSlides] = useState([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [resolvedPresentationId, setResolvedPresentationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [error, setError] = useState('');
  const [slidesError, setSlidesError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course._id) === String(selectedId)) || courses[0] || null,
    [courses, selectedId]
  );
  const activeSlide = slides[activeSlideIdx] || null;
  const readUrl = buildSlidesReadUrl(
    selectedCourse?.presentationId || selectedCourse?.embedUrl,
    activeSlide?.objectId
  );

  const copySlideForAi = async () => {
    if (!activeSlide) return;
    const presentationId = extractPresentationId(resolvedPresentationId || selectedCourse?.presentationId || selectedCourse?.embedUrl);
    if (!presentationId) return;
    const params = new URLSearchParams({
      presentationId,
      title: String(selectedCourse?.title || 'Cours')
    });
    const publicUrl = `${window.location.origin}/api/ia/slide?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyStatus('Lien copié : colle-le dans ChatGPT ou Gemini.');
    } catch (_) {
      window.prompt('Copie ce lien pour l’IA :', publicUrl);
      setCopyStatus('Lien prêt à copier.');
    }
    window.setTimeout(() => setCopyStatus(''), 3500);
  };

  useEffect(() => {
    const studentId = user?._id || user?.id || '';
    if (!studentId) return;
    let cancelled = false;
    const loadCourses = async (showLoader = false) => {
      if (showLoader) setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (user?.isVisitorPreview === true) {
          params.set('visitor', '1');
          params.set('level', String(user?.currentClass || ''));
        }
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`/api/eleve/courses/list/${encodeURIComponent(studentId)}${suffix}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Chargement des cours impossible.');
        if (cancelled) return;
        const rows = (Array.isArray(data) ? [...data] : []).sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'fr', { numeric: true, sensitivity: 'base' }));
        setCourses(rows);
        setSelectedId((current) => rows.some((row) => String(row?._id) === String(current)) ? current : String(rows[0]?._id || ''));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Chargement des cours impossible.');
      } finally {
        if (!cancelled && showLoader) setLoading(false);
      }
    };
    loadCourses(true);
    const refresh = () => loadCourses(false);
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [user?._id, user?.id, user?.isVisitorPreview, user?.currentClass]);

  useEffect(() => {
    const presentationSource = selectedCourse?.presentationId || selectedCourse?.embedUrl || '';
    if (!extractPresentationId(presentationSource)) {
      setSlides([]);
      return;
    }
    let cancelled = false;
    const loadSlides = async () => {
      setSlidesLoading(true);
      setSlidesError('');
      setActiveSlideIdx(0);
      setResolvedPresentationId(String(presentationSource));
      try {
        const res = await fetch('/api/learning/slides/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentationUrl: presentationSource,
            slideSelection: ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Chargement des slides impossible.');
        if (!cancelled) {
          setResolvedPresentationId(String(data?.presentationId || presentationSource));
          setSlides(Array.isArray(data?.slides) ? data.slides : []);
        }
      } catch (loadError) {
        if (!cancelled) setSlidesError(loadError.message || 'Chargement des slides impossible.');
      } finally {
        if (!cancelled) setSlidesLoading(false);
      }
    };
    loadSlides();
    return () => { cancelled = true; };
  }, [selectedCourse?._id, selectedCourse?.presentationId, selectedCourse?.embedUrl, selectedCourse?.publishedUntilSlide]);

  return (
    <section className="eleve-courses-page">
      <header className="eleve-courses-head">
        <div>
          <div className="eleve-courses-kicker">Cours de classe</div>
          <h2>Slides du cours</h2>
        </div>
        {selectedCourse && (
          <div className="eleve-courses-limit">
            Présentation disponible en lecture
          </div>
        )}
      </header>

      {error && <div className="eleve-courses-error">{error}</div>}

      {loading ? (
        <div className="eleve-courses-empty">Chargement des cours...</div>
      ) : courses.length === 0 ? (
        <div className="eleve-courses-empty">
          <strong>Aucun cours disponible pour l&apos;instant.</strong>
          <span>Le professeur publiera les slides au fur et à mesure.</span>
        </div>
      ) : (
        <div className="eleve-courses-layout">
          <aside className="eleve-courses-list">
            {courses.map((course) => (
              <button
                key={course._id}
                type="button"
                className={`eleve-course-card ${String(course._id) === String(selectedCourse?._id) ? 'active' : ''}`}
                onClick={() => setSelectedId(String(course._id))}
              >
                <span>{course.title}</span>
                <small>{course.description || 'Présentation du cours'}</small>
              </button>
            ))}
          </aside>

          <main className="eleve-course-viewer">
            <div className="eleve-course-viewer-title">
              <div>
                <h3>{selectedCourse?.title || 'Cours'}</h3>
                {selectedCourse?.description && <p>{selectedCourse.description}</p>}
              </div>
              <span>{`${slides.length} slide${slides.length > 1 ? 's' : ''}`}</span>
            </div>

            {selectedCourse?.embedUrl && !slidesLoading && slides.length === 0 && (
              <>
              <div className="eleve-course-slide-frame" style={{ width: '100%', aspectRatio: '16 / 9', maxHeight: '72vh' }}>
                <iframe
                  title={`Cours ${selectedCourse.title || ''}`}
                  src={readUrl || selectedCourse.embedUrl}
                  allowFullScreen
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              </div>
              {readUrl && <a className="eleve-course-open-link" href={readUrl} target="_blank" rel="noreferrer">Ouvrir la présentation en lecture ↗</a>}
              </>
            )}
            {slidesLoading && <div className="eleve-courses-empty">Chargement des slides...</div>}
            {!slidesLoading && slidesError && <div className="eleve-courses-error">{slidesError}</div>}
            {!slidesLoading && !slidesError && activeSlide && (
              <>
                <div className="eleve-course-slide-stage">
                  <button
                    type="button"
                    className="eleve-course-arrow"
                    onClick={() => setActiveSlideIdx((idx) => Math.max(0, idx - 1))}
                    disabled={activeSlideIdx === 0}
                    aria-label="Slide précédente"
                  >
                    ‹
                  </button>
                  <div className="eleve-course-slide-frame">
                    <iframe
                      key={String(activeSlide.objectId || activeSlideIdx)}
                      title={`Slide interactive ${activeSlide.slideNumber || activeSlideIdx + 1}`}
                      src={buildSlidesEmbedUrl(resolvedPresentationId || selectedCourse.presentationId || selectedCourse.embedUrl, activeSlide.objectId)}
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  </div>
                  <button
                    type="button"
                    className="eleve-course-arrow"
                    onClick={() => setActiveSlideIdx((idx) => Math.min(slides.length - 1, idx + 1))}
                    disabled={activeSlideIdx >= slides.length - 1}
                    aria-label="Slide suivante"
                  >
                    ›
                  </button>
                </div>
                <div className="eleve-course-slide-meta">
                  Slide {activeSlide.slideNumber || activeSlideIdx + 1} · {activeSlideIdx + 1}/{slides.length}
                </div>
                {readUrl && <a className="eleve-course-open-link" href={readUrl} target="_blank" rel="noreferrer">Ouvrir cette slide en lecture et copier son URL ↗</a>}
                <button type="button" className="eleve-course-ai-link" onClick={copySlideForAi}>✨ Copier toute la présentation pour l’IA fiche</button>
                {copyStatus && <div className="eleve-course-copy-status" role="status">{copyStatus}</div>}
                <div className="eleve-course-rail">
                  {slides.map((slide, idx) => (
                    <button
                      key={String(slide.objectId || idx)}
                      type="button"
                      className={`eleve-course-chip ${idx === activeSlideIdx ? 'active' : ''}`}
                      onClick={() => setActiveSlideIdx(idx)}
                    >
                      <img
                        src={buildSlidesThumbnailUrl(resolvedPresentationId || selectedCourse.presentationId, slide.objectId, slide.slideNumber)}
                        alt={`Slide ${slide.slideNumber || idx + 1}`}
                      />
                      <span>{slide.slideNumber || idx + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </section>
  );
}
