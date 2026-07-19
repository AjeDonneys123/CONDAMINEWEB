import React, { useEffect, useMemo, useState } from 'react';
import './EleveCoursesList.css';

const buildSlidesThumbnailUrl = (presentationId = '', objectId = '', slideNumber = '') => {
  const params = new URLSearchParams();
  params.set('presentationId', String(presentationId || ''));
  if (objectId) params.set('pageObjectId', String(objectId));
  if (slideNumber) params.set('slideNumber', String(slideNumber));
  return `/api/learning/slides/thumbnail?${params.toString()}`;
};

export default function EleveCoursesList({ user }) {
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [slides, setSlides] = useState([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [error, setError] = useState('');
  const [slidesError, setSlidesError] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course._id) === String(selectedId)) || courses[0] || null,
    [courses, selectedId]
  );
  const activeSlide = slides[activeSlideIdx] || null;

  useEffect(() => {
    const studentId = user?._id || user?.id || '';
    if (!studentId) return;
    let cancelled = false;
    const loadCourses = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/eleve/courses/list/${encodeURIComponent(studentId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Chargement des cours impossible.');
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        setCourses(rows);
        setSelectedId((current) => current || String(rows[0]?._id || ''));
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Chargement des cours impossible.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadCourses();
    return () => { cancelled = true; };
  }, [user?._id, user?.id]);

  useEffect(() => {
    if (!selectedCourse?.presentationId) {
      setSlides([]);
      return;
    }
    let cancelled = false;
    const loadSlides = async () => {
      setSlidesLoading(true);
      setSlidesError('');
      setActiveSlideIdx(0);
      try {
        const limit = Math.max(0, Number(selectedCourse.publishedUntilSlide || 0));
        const res = await fetch('/api/learning/slides/manifest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presentationId: selectedCourse.presentationId,
            slideSelection: limit > 0 ? `1-${limit}` : ''
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Chargement des slides impossible.');
        if (!cancelled) setSlides(Array.isArray(data?.slides) ? data.slides : []);
      } catch (loadError) {
        if (!cancelled) setSlidesError(loadError.message || 'Chargement des slides impossible.');
      } finally {
        if (!cancelled) setSlidesLoading(false);
      }
    };
    loadSlides();
    return () => { cancelled = true; };
  }, [selectedCourse?._id, selectedCourse?.presentationId, selectedCourse?.publishedUntilSlide]);

  return (
    <section className="eleve-courses-page">
      <header className="eleve-courses-head">
        <div>
          <div className="eleve-courses-kicker">Cours de classe</div>
          <h2>Slides du cours</h2>
        </div>
        {selectedCourse && (
          <div className="eleve-courses-limit">
            Disponible jusqu&apos;à la slide {selectedCourse.publishedUntilSlide}
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
                <small>{course.description || `Slides 1 à ${course.publishedUntilSlide}`}</small>
              </button>
            ))}
          </aside>

          <main className="eleve-course-viewer">
            <div className="eleve-course-viewer-title">
              <div>
                <h3>{selectedCourse?.title || 'Cours'}</h3>
                {selectedCourse?.description && <p>{selectedCourse.description}</p>}
              </div>
              <span>{slides.length} slide{slides.length > 1 ? 's' : ''}</span>
            </div>

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
                    <img
                      src={buildSlidesThumbnailUrl(selectedCourse.presentationId, activeSlide.objectId, activeSlide.slideNumber)}
                      alt={`Slide ${activeSlide.slideNumber || activeSlideIdx + 1}`}
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
                <div className="eleve-course-rail">
                  {slides.map((slide, idx) => (
                    <button
                      key={String(slide.objectId || idx)}
                      type="button"
                      className={`eleve-course-chip ${idx === activeSlideIdx ? 'active' : ''}`}
                      onClick={() => setActiveSlideIdx(idx)}
                    >
                      <img
                        src={buildSlidesThumbnailUrl(selectedCourse.presentationId, slide.objectId, slide.slideNumber)}
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
