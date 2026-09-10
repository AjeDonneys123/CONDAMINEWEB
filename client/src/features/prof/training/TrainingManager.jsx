// @signatures: TrainingManager
import React, { useState, useEffect, useCallback } from 'react';
import './TrainingManager.css';

// ─── Exercices locaux intégrés (identiques à ExamTrainingHub) ───────────────
const LOCAL_EXERCISES = [
    // Paragraphes locaux (3e DNB)
    { id: 'civilians-ww1',   type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Paragraphe · Les civils dans la 1ère Guerre mondiale' },
    { id: 'soldiers-ww1',   type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Paragraphe · Les militaires dans la 1ère Guerre mondiale' },
    { id: 'total-war-ww1',  type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Paragraphe · La 1ère Guerre mondiale, une guerre totale' },
    // Sujets réels paragraphe
    { id: 'civilians-ww1-real',  type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Sujet réel · Les civils dans la guerre (2019)' },
    { id: 'soldiers-ww1-real',   type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Sujet réel · Militaires et violence de masse (2017)' },
    { id: 'total-war-ww1-real',  type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'paragraphe', title: 'Sujet réel · La guerre totale (2018)' },
    // Repères histoire
    { id: 'history-reperes', type: 'local', section: 'HISTOIRE', subject: 'histoire', tab: 'reperes', title: 'Repères · Dates et événements clés (Histoire)' },
    // Repères géo
    { id: 'geo-metropoles',  type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · Métropoles françaises (Carte)' },
    { id: 'geo-regions',     type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · Régions françaises (Carte)' },
    { id: 'geo-espacesp',    type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · Espaces productifs (Carte)' },
    { id: 'geo-dromcom',     type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · DROM-COM (Classification)' },
    { id: 'geo-ue',          type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · Union Européenne (Carte)' },
    { id: 'geo-repartition', type: 'local', section: 'GEO',      subject: 'geo',     tab: 'reperes', title: 'Repères · Répartition population (Carte)' },
];

const SECTION_COLORS = {
    HISTOIRE: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
    GEO:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
    EMC:      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800' },
    GENERAL:  { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
};

const getSectionColor = (section) => {
    const key = String(section || '').toUpperCase();
    if (key.includes('HIST')) return SECTION_COLORS.HISTOIRE;
    if (key.includes('GEO')) return SECTION_COLORS.GEO;
    if (key.includes('EMC')) return SECTION_COLORS.EMC;
    return SECTION_COLORS.GENERAL;
};

export default function TrainingManager({ globalClassId, globalClass, user }) {
    const [chapters, setChapters]         = useState([]);
    const [loading, setLoading]           = useState(false);
    const [saving, setSaving]             = useState(false);
    const [saved, setSaved]               = useState(false);
    const [error, setError]               = useState(null);
    const [selected, setSelected]         = useState(new Set()); // Set of item IDs
    const [currentAssignment, setCurrentAssignment] = useState(null);
    const [expandedSection, setExpandedSection]     = useState(null);

    const teacherId = user?._id || user?.id || null;

    // ── Charger les chapitres du niveau ──────────────────────────────────────
    const loadChapters = useCallback(async () => {
        if (!globalClassId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ classId: globalClassId });
            if (teacherId) params.set('teacherId', teacherId);
            const res = await fetch(`/api/prof/training/chapters?${params}`);
            const data = await res.json();
            setChapters(Array.isArray(data) ? data : []);
        } catch (e) {
            setError('Impossible de charger les chapitres.');
        } finally {
            setLoading(false);
        }
    }, [globalClassId, teacherId]);

    // ── Charger l'entraînement actif ─────────────────────────────────────────
    const loadAssignment = useCallback(async () => {
        if (!globalClassId) return;
        try {
            const res = await fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}/assignment`);
            const data = await res.json();
            if (data?.assignment) {
                setCurrentAssignment(data.assignment);
                // Pré-cocher les items déjà assignés
                setSelected(new Set((data.assignment.items || []).map(i => i.id)));
            }
        } catch (_) {}
    }, [globalClassId]);

    useEffect(() => {
        loadChapters();
        loadAssignment();
    }, [loadChapters, loadAssignment]);

    // ── Toggle sélection ─────────────────────────────────────────────────────
    const toggle = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setSaved(false);
    };

    const selectAll = (items) => {
        setSelected(prev => {
            const next = new Set(prev);
            items.forEach(i => next.add(i.id));
            return next;
        });
        setSaved(false);
    };

    const deselectAll = (items) => {
        setSelected(prev => {
            const next = new Set(prev);
            items.forEach(i => next.delete(i.id));
            return next;
        });
        setSaved(false);
    };

    // ── Envoyer l'entraînement ───────────────────────────────────────────────
    const handleSave = async () => {
        if (!globalClassId || saving) return;
        setSaving(true);
        setError(null);

        // Construire la liste ordonnée des items sélectionnés
        const allItems = [
            ...chapters.map(c => ({
                id: String(c._id),
                type: 'chapter',
                title: c.title,
                section: String(c.section || '').toUpperCase(),
                subject: getSectionSubject(c.section),
            })),
            ...LOCAL_EXERCISES,
        ];
        const items = allItems.filter(i => selected.has(i.id));

        try {
            const res = await fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}/assignment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, teacherId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur serveur');
            setCurrentAssignment(data.assignment);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!globalClassId || saving) return;
        if (!window.confirm('Supprimer l\'entraînement actif ? Les élèves ne verront plus rien.')) return;
        setSaving(true);
        try {
            await fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}/assignment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [], teacherId }),
            });
            setCurrentAssignment(null);
            setSelected(new Set());
        } catch (_) {}
        finally { setSaving(false); }
    };

    // ── Grouper les chapitres par section ────────────────────────────────────
    const chaptersBySection = chapters.reduce((acc, c) => {
        const key = String(c.section || 'GÉNÉRAL').toUpperCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(c);
        return acc;
    }, {});

    // Grouper les exercices locaux par section
    const localBySection = LOCAL_EXERCISES.reduce((acc, ex) => {
        const key = String(ex.section || 'GÉNÉRAL').toUpperCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(ex);
        return acc;
    }, {});

    // Toutes les sections présentes
    const allSections = [...new Set([
        ...Object.keys(chaptersBySection),
        ...Object.keys(localBySection),
    ])].sort();

    if (!globalClassId) {
        return (
            <div className="tm-empty">
                <span className="tm-empty-icon">🏋️</span>
                <span className="tm-empty-label">Sélectionnez une classe</span>
            </div>
        );
    }

    const totalSelected = selected.size;

    return (
        <div className="tm-root">
            {/* ── EN-TÊTE ── */}
            <div className="tm-header">
                <div className="tm-header-left">
                    <span className="tm-header-icon">🏋️</span>
                    <div>
                        <h2 className="tm-title">Entraînement</h2>
                        <p className="tm-subtitle">{globalClass || 'Classe'}</p>
                    </div>
                </div>
                {currentAssignment && (
                    <div className="tm-active-badge">
                        <span className="tm-active-dot" />
                        <span>{(currentAssignment.items || []).length} exo{(currentAssignment.items || []).length > 1 ? 's' : ''} actif{(currentAssignment.items || []).length > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>

            {/* ── INFOS ASSIGNMENT ACTIF ── */}
            {currentAssignment && (
                <div className="tm-current-info">
                    <div className="tm-current-info-header">
                        <span className="tm-current-icon">✅</span>
                        <strong>Entraînement actif</strong>
                        <span className="tm-current-date">
                            {new Date(currentAssignment.assignedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </span>
                    </div>
                    <div className="tm-current-items">
                        {(currentAssignment.items || []).map(item => (
                            <span key={item.id} className={`tm-current-chip ${getSectionColor(item.section).badge}`}>
                                {item.title}
                            </span>
                        ))}
                    </div>
                    <button className="tm-clear-btn" onClick={handleClear} disabled={saving}>
                        🗑️ Supprimer l'entraînement
                    </button>
                </div>
            )}

            {error && <div className="tm-error">⚠️ {error}</div>}

            {/* ── LISTE DES EXERCICES ── */}
            <div className="tm-section-label">
                Cochez les exercices à assigner
                {totalSelected > 0 && (
                    <span className="tm-selected-count">{totalSelected} sélectionné{totalSelected > 1 ? 's' : ''}</span>
                )}
            </div>

            {loading ? (
                <div className="tm-loading">
                    <div className="tm-spinner" />
                    Chargement des exercices…
                </div>
            ) : (
                <div className="tm-sections">
                    {allSections.map(sectionKey => {
                        const sectionChapters = (chaptersBySection[sectionKey] || []).map(c => ({
                            id: String(c._id),
                            type: 'chapter',
                            title: c.title,
                            section: sectionKey,
                            subject: getSectionSubject(sectionKey),
                        }));
                        const sectionLocal = localBySection[sectionKey] || [];
                        const sectionItems = [...sectionChapters, ...sectionLocal];
                        if (sectionItems.length === 0) return null;

                        const colors = getSectionColor(sectionKey);
                        const isExpanded = expandedSection === sectionKey || expandedSection === null;
                        const sectionSelected = sectionItems.filter(i => selected.has(i.id)).length;
                        const allChecked = sectionItems.every(i => selected.has(i.id));

                        return (
                            <div key={sectionKey} className={`tm-section ${colors.bg} ${colors.border}`}>
                                {/* Header section */}
                                <button
                                    className="tm-section-header"
                                    onClick={() => setExpandedSection(prev => prev === sectionKey ? null : sectionKey)}
                                >
                                    <div className="tm-section-header-left">
                                        <span className={`tm-section-dot ${colors.dot}`} />
                                        <span className={`tm-section-name ${colors.text}`}>{sectionKey}</span>
                                        <span className="tm-section-count">
                                            {sectionItems.length} exercice{sectionItems.length > 1 ? 's' : ''}
                                        </span>
                                        {sectionSelected > 0 && (
                                            <span className={`tm-section-selected-badge ${colors.badge}`}>
                                                {sectionSelected} coché{sectionSelected > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                    <div className="tm-section-header-right">
                                        <span className="tm-section-chevron">{isExpanded ? '⌃' : '⌄'}</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <>
                                        {/* Actions rapides */}
                                        <div className="tm-section-actions">
                                            <button
                                                className="tm-quick-btn"
                                                onClick={(e) => { e.stopPropagation(); allChecked ? deselectAll(sectionItems) : selectAll(sectionItems); }}
                                            >
                                                {allChecked ? '☑ Tout décocher' : '☐ Tout cocher'}
                                            </button>
                                        </div>

                                        {/* Items */}
                                        <div className="tm-items">
                                            {/* Chapitres du prof */}
                                            {sectionChapters.length > 0 && (
                                                <div className="tm-subsection-label">📂 Chapitres du cours</div>
                                            )}
                                            {sectionChapters.map(item => (
                                                <ExerciseRow
                                                    key={item.id}
                                                    item={item}
                                                    checked={selected.has(item.id)}
                                                    onToggle={() => toggle(item.id)}
                                                    colors={colors}
                                                />
                                            ))}

                                            {/* Exercices locaux */}
                                            {sectionLocal.length > 0 && (
                                                <div className="tm-subsection-label">✏️ Exercices intégrés</div>
                                            )}
                                            {sectionLocal.map(item => (
                                                <ExerciseRow
                                                    key={item.id}
                                                    item={item}
                                                    checked={selected.has(item.id)}
                                                    onToggle={() => toggle(item.id)}
                                                    colors={colors}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {allSections.length === 0 && !loading && (
                        <div className="tm-empty-list">
                            <p>Aucun exercice disponible pour cette classe.</p>
                            <p className="tm-empty-hint">Les exercices apparaîtront une fois que vous aurez créé des chapitres et des devoirs DNB pour cette classe ou ce niveau.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── BOUTON DÉFINIR ENTRAÎNEMENT ── */}
            <div className="tm-footer">
                {saved && (
                    <div className="tm-saved-msg">
                        ✅ Entraînement envoyé aux élèves !
                    </div>
                )}
                <button
                    className={`tm-save-btn${totalSelected === 0 ? ' disabled' : ''}`}
                    onClick={handleSave}
                    disabled={saving || totalSelected === 0}
                >
                    {saving ? (
                        <><span className="tm-btn-spinner" /> Envoi…</>
                    ) : (
                        <>🚀 Définir l'entraînement{totalSelected > 0 ? ` (${totalSelected})` : ''}</>
                    )}
                </button>
                {totalSelected > 0 && (
                    <p className="tm-footer-hint">
                        Les {totalSelected} exercice{totalSelected > 1 ? 's' : ''} sélectionné{totalSelected > 1 ? 's' : ''} apparaîtront sur la page Statut des élèves.
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Sous-composant ligne d'exercice ──────────────────────────────────────────
function ExerciseRow({ item, checked, onToggle, colors }) {
    return (
        <label className={`tm-item${checked ? ' checked' : ''}`} htmlFor={`tm-exo-${item.id}`}>
            <input
                id={`tm-exo-${item.id}`}
                type="checkbox"
                className="tm-checkbox"
                checked={checked}
                onChange={onToggle}
            />
            <span className={`tm-item-type-badge ${item.type === 'chapter' ? 'chapter' : 'local'}`}>
                {item.type === 'chapter' ? '📖' : '✏️'}
            </span>
            <span className="tm-item-title">{item.title}</span>
            {checked && <span className="tm-item-check">✓</span>}
        </label>
    );
}

function getSectionSubject(section) {
    const key = String(section || '').toUpperCase();
    if (key.includes('HIST')) return 'histoire';
    if (key.includes('GEO')) return 'geo';
    if (key.includes('EMC')) return 'emc';
    return 'general';
}
