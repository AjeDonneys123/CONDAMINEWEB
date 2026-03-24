import React, { useEffect, useMemo, useRef, useState } from 'react';

const extractGoogleSlidesId = (raw = '') => {
    const txt = String(raw || '').trim();
    const match = txt.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
};

export default function ProductionWorkspace({ production, user, onQuit }) {
    const editorRef = useRef(null);
    const [slides, setSlides] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const initialSubmission = production?.studentSubmission || {};
    const [contentHtml, setContentHtml] = useState(String(initialSubmission?.contentHtml || '<h1>Ma production</h1><p></p>'));
    const [answers, setAnswers] = useState(() => {
        const saved = Array.isArray(initialSubmission?.answers) ? initialSubmission.answers : [];
        if (saved.length > 0) return saved;
        return (production?.questions || []).map((row) => ({
            prompt: row?.prompt || '',
            answer: '',
            selectedIndex: -1
        }));
    });

    const productionType = String(production?.productionType || 'fiche');
    const presentationId = useMemo(() => extractGoogleSlidesId(production?.presentationUrl || ''), [production?.presentationUrl]);

    useEffect(() => {
        if (editorRef.current && productionType === 'fiche') editorRef.current.innerHTML = contentHtml;
    }, [contentHtml, productionType]);

    useEffect(() => {
        if (productionType !== 'fiche') return;
        if (!String(production?.presentationUrl || '').trim()) return;
        const ctrl = new AbortController();
        (async () => {
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl: production.presentationUrl,
                        slideSelection: (production.selectedSlides || []).join(','),
                        filterCondition: '',
                        includeThumbnails: false
                    }),
                    signal: ctrl.signal
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) setSlides(Array.isArray(data?.slides) ? data.slides : []);
            } catch (_) {}
        })();
        return () => ctrl.abort();
    }, [productionType, production?.presentationUrl, production?.selectedSlides]);

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                productionId: String(production?._id || ''),
                studentId: String(user?._id || user?.id || '')
            };
            if (productionType === 'fiche') payload.contentHtml = String(editorRef.current?.innerHTML || contentHtml || '');
            else if (productionType === 'questionnaire') payload.answers = answers;
            else payload.answers = answers.map((row) => ({ selectedIndex: Number(row?.selectedIndex ?? -1), prompt: row?.prompt || '' }));

            const res = await fetch('/api/eleve/productions/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(String(data?.error || 'Sauvegarde impossible'));
            setSaveMessage('Production enregistrée.');
        } catch (e) {
            setSaveMessage(String(e?.message || 'Sauvegarde impossible'));
        } finally {
            setSaving(false);
            setTimeout(() => setSaveMessage(''), 2200);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6">
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b bg-gradient-to-r from-lime-50 via-white to-cyan-50 flex items-center justify-between gap-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-widest text-lime-700">Production</div>
                        <div className="text-2xl font-black text-slate-800">{production?.title || 'Production'}</div>
                        <div className="text-sm font-semibold text-slate-500">{productionType.toUpperCase()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saveMessage && <div className="text-[12px] font-black text-emerald-600">{saveMessage}</div>}
                        <button onClick={save} className="px-4 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 font-black text-[12px] text-emerald-700">{saving ? '...' : 'Enregistrer'}</button>
                        <button onClick={onQuit} className="px-4 py-2 rounded-2xl border border-slate-200 bg-white font-black text-[12px] text-slate-500">Fermer</button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {production?.teacherInstructions && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                            {production.teacherInstructions}
                        </div>
                    )}

                    {productionType === 'fiche' && (
                        <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-5">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 max-h-[70vh] overflow-auto space-y-3">
                                {slides.map((slide) => {
                                    const slideNumber = Number(slide?.slideNumber || 0);
                                    const thumbUrl = presentationId
                                        ? `/api/learning/slides/thumbnail?presentationId=${encodeURIComponent(presentationId)}&pageObjectId=${encodeURIComponent(String(slide?.objectId || ''))}&slideNumber=${encodeURIComponent(String(slideNumber || ''))}`
                                        : '';
                                    return (
                                        <div key={String(slide?.objectId || slideNumber)} className="rounded-2xl border border-slate-200 bg-white p-2">
                                            {thumbUrl && <img src={thumbUrl} alt={`Slide ${slideNumber}`} className="w-full rounded-xl border border-slate-100" />}
                                            <div className="mt-2 text-[11px] font-black uppercase text-slate-400">Slide {slideNumber}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => setContentHtml(e.currentTarget.innerHTML)}
                                className="min-h-[70vh] rounded-2xl border border-slate-200 bg-white p-5 outline-none text-slate-700"
                            />
                        </div>
                    )}

                    {productionType === 'questionnaire' && (
                        <div className="space-y-4">
                            {(production.questions || []).map((question, index) => (
                                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                    <div className="text-lg font-black text-slate-800">{question.prompt}</div>
                                    <textarea
                                        className="w-full rounded-2xl border border-slate-200 bg-white p-4 min-h-[130px] outline-none"
                                        value={answers[index]?.answer || ''}
                                        onChange={(e) => setAnswers((prev) => prev.map((row, idx) => idx === index ? { ...row, prompt: question.prompt, answer: e.target.value } : row))}
                                        placeholder="Réponds ici. Tu peux utiliser le micro de ton clavier si tu veux dicter."
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {productionType === 'qcm' && (
                        <div className="space-y-4">
                            {production?.linkedGameTitle && (
                                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-black text-cyan-800">
                                    Jeu associé: {production.linkedGameTitle}
                                </div>
                            )}
                            {(production.questions || []).map((question, index) => (
                                <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                    <div className="text-lg font-black text-slate-800">{question.prompt}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(question.options || []).map((option, optIdx) => {
                                            const active = Number(answers[index]?.selectedIndex ?? -1) === optIdx;
                                            return (
                                                <button
                                                    key={optIdx}
                                                    type="button"
                                                    onClick={() => setAnswers((prev) => prev.map((row, idx) => idx === index ? { ...row, prompt: question.prompt, selectedIndex: optIdx } : row))}
                                                    className={`rounded-2xl border px-4 py-4 text-left font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
