// @signatures: TrainingManager, ExerciseViewModal, ExerciseEditorModal, ExerciseRow
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './TrainingManager.css';

// ─── Helpers de niveau et section ───────────────────────────────────────────
function extractLevel(raw) {
    const str = String(raw || '').trim().toUpperCase();
    if (!str) return '';
    if (/^6/.test(str)) return '6';
    if (/^5/.test(str)) return '5';
    if (/^4/.test(str)) return '4';
    if (/^3/.test(str)) return '3';
    if (/^(2|2DE|2NDE|SEC)/.test(str)) return '2';
    if (/^(1|1ERE|PREM)/.test(str)) return '1';
    if (/^(T|TERM)/.test(str)) return 'T';
    return str.replace(/^(\d).*/, '$1') || '';
}

function formatLevelLabel(lvl) {
    if (!lvl) return '';
    if (lvl === '2') return '2nde';
    if (lvl === '1') return '1ère';
    if (lvl === 'T') return 'Terminale';
    return `${lvl}e`;
}

const SECTION_COLORS = {
    HISTOIRE: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
    GEO:      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
    EMC:      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800' },
    GENERAL:  { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
};

function getSectionColor(section) {
    const key = String(section || '').toUpperCase();
    if (key.includes('HIST')) return SECTION_COLORS.HISTOIRE;
    if (key.includes('GEO')) return SECTION_COLORS.GEO;
    if (key.includes('EMC')) return SECTION_COLORS.EMC;
    return SECTION_COLORS.GENERAL;
}

function getQuestionTypeMeta(type) {
    switch (type) {
        case 'fill':
            return { label: 'Texte à trous', icon: '🧩', badgeClass: 'qtype-fill' };
        case 'targeted':
            return { label: 'Question ciblée', icon: '🎯', badgeClass: 'qtype-targeted' };
        case 'qcm':
            return { label: 'QCM', icon: '🔘', badgeClass: 'qtype-qcm' };
        case 'chapter':
            return { label: 'Chapitre cours', icon: '📖', badgeClass: 'qtype-chapter' };
        default:
            return { label: 'Exercice', icon: '✏️', badgeClass: 'qtype-default' };
    }
}

// Extraction automatique des trous pour texte à trous ([mot] ou "mot")
function extractBlanksFromText(text = '') {
    const blanks = [];
    // Détection des [crochets]
    const bracketRegex = /\[([^\]]+)\]/g;
    let match;
    while ((match = bracketRegex.exec(text)) !== null) {
        const item = match[1].trim();
        if (item && !blanks.includes(item)) blanks.push(item);
    }
    // Détection des "guillemets"
    const quoteRegex = /["“«]([^"”»]+)["”»]/g;
    while ((match = quoteRegex.exec(text)) !== null) {
        const item = match[1].trim();
        if (item && !blanks.includes(item)) blanks.push(item);
    }
    return blanks;
}

// ─── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────
export default function TrainingManager({ globalClassId, globalClass, user }) {
    const [exercises, setExercises]               = useState([]);
    const [chapters, setChapters]                 = useState([]);
    const [detectedLevel, setDetectedLevel]       = useState('');
    const [loading, setLoading]                   = useState(false);
    const [saving, setSaving]                     = useState(false);
    const [saved, setSaved]                       = useState(false);
    const [error, setError]                       = useState(null);
    const [selected, setSelected]                 = useState(new Set());
    const [currentAssignment, setCurrentAssignment] = useState(null);
    const [expandedSection, setExpandedSection]     = useState(null);
    const [sectionFilter, setSectionFilter]         = useState('ALL');
    const [searchQuery, setSearchQuery]           = useState('');

    // Modals
    const [viewItem, setViewItem]                 = useState(null);
    const [editItem, setEditItem]                 = useState(null); // null, 'new', or exercise object

    const teacherId = user?._id || user?.id || null;

    // ── Charger les exercices filtrés pour la classe active ──────────────────
    const loadExercises = useCallback(async () => {
        if (!globalClassId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                classId: globalClassId,
                className: globalClass || ''
            });
            if (teacherId) params.set('teacherId', teacherId);

            const res = await fetch(`/api/prof/training/exercises?${params}`);
            if (!res.ok) throw new Error('Erreur chargement exercices');
            const data = await res.json();
            setExercises(Array.isArray(data.exercises) ? data.exercises : []);
            if (data.classLevel) {
                setDetectedLevel(data.classLevel);
            } else if (globalClass) {
                setDetectedLevel(extractLevel(globalClass));
            }
        } catch (e) {
            console.error('Erreur loadExercises:', e);
            setError('Impossible de charger les exercices pour cette classe.');
        } finally {
            setLoading(false);
        }
    }, [globalClassId, globalClass, teacherId]);

    // ── Charger les chapitres filtrés pour la classe active ──────────────────
    const loadChapters = useCallback(async () => {
        if (!globalClassId) return;
        try {
            const params = new URLSearchParams({
                classId: globalClassId,
                className: globalClass || ''
            });
            if (teacherId) params.set('teacherId', teacherId);

            const res = await fetch(`/api/prof/training/chapters?${params}`);
            if (!res.ok) throw new Error('Erreur chargement chapitres');
            const data = await res.json();
            setChapters(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Erreur loadChapters:', e);
        }
    }, [globalClassId, globalClass, teacherId]);

    // ── Charger l'entraînement actif pour la classe ─────────────────────────
    const loadAssignment = useCallback(async () => {
        if (!globalClassId) return;
        try {
            const res = await fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}/assignment`);
            const data = await res.json();
            if (data?.assignment) {
                setCurrentAssignment(data.assignment);
                setSelected(new Set((data.assignment.items || []).map(i => i.id)));
            } else {
                setCurrentAssignment(null);
                setSelected(new Set());
            }
        } catch (_) {}
    }, [globalClassId]);

    useEffect(() => {
        loadExercises();
        loadChapters();
        loadAssignment();
    }, [loadExercises, loadChapters, loadAssignment]);

    // ── Toggle sélection d'un item ──────────────────────────────────────────
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

    // ── Enregistrer l'assignation d'entraînement pour la classe ─────────────
    const handleSaveAssignment = async () => {
        if (!globalClassId || saving) return;
        setSaving(true);
        setError(null);

        // Récupérer les items complets sélectionnés
        const allAvailableItems = [
            ...chapters.map(c => ({
                id: String(c._id),
                type: 'chapter',
                title: c.title,
                section: String(c.section || '').toUpperCase(),
                subject: getSectionSubject(c.section),
                questionType: 'chapter',
                level: detectedLevel || extractLevel(globalClass),
            })),
            ...exercises.map(ex => ({
                id: String(ex.id || ex._id),
                type: ex.type || (ex.isCustom ? 'custom' : 'local'),
                title: ex.title,
                section: String(ex.section || 'HISTOIRE').toUpperCase(),
                subject: getSectionSubject(ex.section),
                level: ex.level || detectedLevel,
                questionType: ex.questionType || 'fill',
                images: ex.images || [],
                content: ex.content || {},
            })),
        ];

        const selectedItems = allAvailableItems.filter(item => selected.has(item.id));

        try {
            const res = await fetch(`/api/prof/training/class/${encodeURIComponent(globalClassId)}/assignment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: selectedItems, teacherId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde');
            setCurrentAssignment(data.assignment);
            setSaved(true);
            setTimeout(() => setSaved(false), 4000);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleClearAssignment = async () => {
        if (!globalClassId || saving) return;
        if (!window.confirm('Supprimer l\'entraînement actif pour cette classe ? Les élèves ne le verront plus.')) return;
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

    // ── Supprimer un exercice personnalisé ──────────────────────────────────
    const handleDeleteExercise = async (exerciseId) => {
        if (!window.confirm('Supprimer définitivement cet entraînement ?')) return;
        try {
            const res = await fetch(`/api/prof/training/exercise/${exerciseId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Échec suppression');
            // Retirer de la sélection et recharger
            setSelected(prev => {
                const next = new Set(prev);
                next.delete(exerciseId);
                return next;
            });
            setViewItem(null);
            loadExercises();
        } catch (e) {
            alert('Erreur : ' + e.message);
        }
    };

    // ── Sauvegarde après création ou modification d'exercice ─────────────────
    const handleSavedExercise = (savedEx) => {
        setEditItem(null);
        setViewItem(null);
        // Cocher automatiquement le nouvel exercice pour faciliter son assignation
        const savedId = String(savedEx._id || savedEx.id);
        setSelected(prev => new Set([...prev, savedId]));
        loadExercises();
    };

    // ── Filtrage et regroupement ─────────────────────────────────────────────
    const activeLevelLabel = detectedLevel ? formatLevelLabel(detectedLevel) : (globalClass ? extractLevel(globalClass) : '');

    // Filtrer par recherche textuelle
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = (item) => {
        if (!query) return true;
        return (item.title || '').toLowerCase().includes(query) ||
               (item.section || '').toLowerCase().includes(query);
    };

    const filteredChapters = chapters.filter(matchesSearch);
    const filteredExercises = exercises.filter(matchesSearch);

    // Grouper les chapitres par section
    const chaptersBySection = filteredChapters.reduce((acc, c) => {
        const key = String(c.section || 'GÉNÉRAL').toUpperCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(c);
        return acc;
    }, {});

    // Grouper les exercices par section
    const exercisesBySection = filteredExercises.reduce((acc, ex) => {
        const key = String(ex.section || 'HISTOIRE').toUpperCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(ex);
        return acc;
    }, {});

    // Toutes les sections
    const rawSections = [...new Set([
        ...Object.keys(chaptersBySection),
        ...Object.keys(exercisesBySection),
    ])].sort();

    const sections = sectionFilter === 'ALL'
        ? rawSections
        : rawSections.filter(s => s.toUpperCase().includes(sectionFilter));

    if (!globalClassId) {
        return (
            <div className="tm-empty">
                <span className="tm-empty-icon">🏋️</span>
                <span className="tm-empty-label">Sélectionnez une classe pour gérer l'entraînement</span>
            </div>
        );
    }

    const totalSelected = selected.size;

    return (
        <div className="tm-root">
            {/* ── EN-TÊTE PRINCIPAL ── */}
            <div className="tm-header">
                <div className="tm-header-left">
                    <span className="tm-header-icon">🏋️</span>
                    <div>
                        <div className="tm-header-title-row">
                            <h2 className="tm-title">Entraînement</h2>
                            {activeLevelLabel && (
                                <span className="tm-level-tag">Niveau {activeLevelLabel}</span>
                            )}
                        </div>
                        <p className="tm-subtitle">
                            🎯 Classe active : <strong>{globalClass || 'Classe'}</strong> · Activités filtrées spécifiquement
                        </p>
                    </div>
                </div>

                <div className="tm-header-right">
                    <button
                        type="button"
                        className="tm-create-btn"
                        onClick={() => setEditItem('new')}
                        title="Créer une nouvelle activité d'entraînement"
                    >
                        <span className="tm-create-btn-icon">✨</span>
                        <span>Nouvel entraînement</span>
                    </button>

                    {currentAssignment && (
                        <div className="tm-active-badge">
                            <span className="tm-active-dot" />
                            <span>{(currentAssignment.items || []).length} actif{(currentAssignment.items || []).length > 1 ? 's' : ''}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BANDEAU ENTRAÎNEMENT ACTIF ── */}
            {currentAssignment && (
                <div className="tm-current-info">
                    <div className="tm-current-info-header">
                        <span className="tm-current-icon">✅</span>
                        <strong>Entraînement actuellement actif pour les élèves ({globalClass})</strong>
                        <span className="tm-current-date">
                            Assigné le {new Date(currentAssignment.assignedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="tm-current-items">
                        {(currentAssignment.items || []).map(item => {
                            const colors = getSectionColor(item.section);
                            const meta = getQuestionTypeMeta(item.questionType || (item.type === 'chapter' ? 'chapter' : ''));
                            return (
                                <span
                                    key={item.id}
                                    className={`tm-current-chip ${colors.badge}`}
                                    onClick={() => {
                                        const found = exercises.find(e => String(e.id || e._id) === item.id) || item;
                                        setViewItem(found);
                                    }}
                                    title="Cliquer pour voir le détail"
                                >
                                    <span>{meta.icon}</span>
                                    <span>{item.title}</span>
                                </span>
                            );
                        })}
                    </div>
                    <div className="tm-current-actions">
                        <button className="tm-clear-btn" onClick={handleClearAssignment} disabled={saving}>
                            🗑️ Supprimer l'entraînement de la classe
                        </button>
                    </div>
                </div>
            )}

            {error && <div className="tm-error">⚠️ {error}</div>}

            {/* ── BARRE D'OUTILS ET FILTRES ── */}
            <div className="tm-toolbar">
                <div className="tm-search-box">
                    <span className="tm-search-icon">🔍</span>
                    <input
                        type="text"
                        className="tm-search-input"
                        placeholder="Rechercher par mot clé ou titre…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="tm-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>

                <div className="tm-filter-pills">
                    {[
                        { id: 'ALL', label: 'Toutes sections' },
                        { id: 'HIST', label: '🏛️ Histoire' },
                        { id: 'GEO', label: '🌍 Géo' },
                        { id: 'EMC', label: '⚖️ EMC' },
                    ].map(f => (
                        <button
                            key={f.id}
                            type="button"
                            className={`tm-filter-pill ${sectionFilter === f.id ? 'active' : ''}`}
                            onClick={() => setSectionFilter(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── EN-TÊTE DE SÉLECTION ── */}
            <div className="tm-section-label">
                <span>Cochez les entraînements à assigner aux élèves de {globalClass} :</span>
                {totalSelected > 0 && (
                    <span className="tm-selected-count">{totalSelected} sélectionné{totalSelected > 1 ? 's' : ''}</span>
                )}
            </div>

            {/* ── CONTENU PRINCIPAL ── */}
            {loading ? (
                <div className="tm-loading">
                    <div className="tm-spinner" />
                    Chargement des entraînements de la classe {globalClass}…
                </div>
            ) : (
                <div className="tm-sections">
                    {sections.map(sectionKey => {
                        const sectionChapters = (chaptersBySection[sectionKey] || []).map(c => ({
                            id: String(c._id),
                            type: 'chapter',
                            title: c.title,
                            section: sectionKey,
                            subject: getSectionSubject(sectionKey),
                            questionType: 'chapter',
                        }));
                        const sectionExercises = exercisesBySection[sectionKey] || [];
                        const totalSectionItems = sectionChapters.length + sectionExercises.length;
                        if (totalSectionItems === 0) return null;

                        const colors = getSectionColor(sectionKey);
                        const isExpanded = expandedSection === sectionKey || expandedSection === null;
                        const allSectionIds = [...sectionChapters.map(i => i.id), ...sectionExercises.map(i => String(i.id || i._id))];
                        const sectionSelectedCount = allSectionIds.filter(id => selected.has(id)).length;
                        const allChecked = totalSectionItems > 0 && sectionSelectedCount === totalSectionItems;

                        return (
                            <div key={sectionKey} className={`tm-section ${colors.bg} ${colors.border}`}>
                                {/* Header section */}
                                <div className="tm-section-header-wrap">
                                    <button
                                        type="button"
                                        className="tm-section-header"
                                        onClick={() => setExpandedSection(prev => prev === sectionKey ? null : sectionKey)}
                                    >
                                        <div className="tm-section-header-left">
                                            <span className={`tm-section-dot ${colors.dot}`} />
                                            <span className={`tm-section-name ${colors.text}`}>{sectionKey}</span>
                                            <span className="tm-section-count">
                                                {totalSectionItems} élément{totalSectionItems > 1 ? 's' : ''}
                                            </span>
                                            {sectionSelectedCount > 0 && (
                                                <span className={`tm-section-selected-badge ${colors.badge}`}>
                                                    {sectionSelectedCount} coché{sectionSelectedCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div className="tm-section-header-right">
                                            <span className="tm-section-chevron">{isExpanded ? '⌃' : '⌄'}</span>
                                        </div>
                                    </button>

                                    {/* Action tout cocher / décocher */}
                                    <div className="tm-section-quick-bar">
                                        <button
                                            type="button"
                                            className="tm-quick-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const itemsToToggle = [
                                                    ...sectionChapters,
                                                    ...sectionExercises.map(ex => ({ id: String(ex.id || ex._id) }))
                                                ];
                                                allChecked ? deselectAll(itemsToToggle) : selectAll(itemsToToggle);
                                            }}
                                        >
                                            {allChecked ? '☑ Tout décocher' : '☐ Tout cocher'}
                                        </button>
                                        <button
                                            type="button"
                                            className="tm-quick-add-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditItem({
                                                    title: '',
                                                    section: sectionKey,
                                                    level: detectedLevel || extractLevel(globalClass),
                                                    questionType: 'fill',
                                                    images: [],
                                                    content: {}
                                                });
                                            }}
                                        >
                                            + Ajouter dans {sectionKey}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="tm-items">
                                        {/* 1. Chapitres de cours de cette classe */}
                                        {sectionChapters.length > 0 && (
                                            <div className="tm-subsection-label">📂 Chapitres de cours du niveau {activeLevelLabel}</div>
                                        )}
                                        {sectionChapters.map(item => (
                                            <ExerciseRow
                                                key={item.id}
                                                item={item}
                                                checked={selected.has(item.id)}
                                                onToggle={() => toggle(item.id)}
                                                onView={() => setViewItem(item)}
                                                colors={colors}
                                            />
                                        ))}

                                        {/* 2. Activités d'entraînement */}
                                        {sectionExercises.length > 0 && (
                                            <div className="tm-subsection-label">✏️ Activités d'entraînement de la classe</div>
                                        )}
                                        {sectionExercises.map(item => {
                                            const itemId = String(item.id || item._id);
                                            return (
                                                <ExerciseRow
                                                    key={itemId}
                                                    item={item}
                                                    checked={selected.has(itemId)}
                                                    onToggle={() => toggle(itemId)}
                                                    onView={() => setViewItem(item)}
                                                    onEdit={() => setEditItem(item)}
                                                    onDelete={item.isCustom ? () => handleDeleteExercise(itemId) : null}
                                                    colors={colors}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {sections.length === 0 && !loading && (
                        <div className="tm-empty-list">
                            <span className="tm-empty-icon">📭</span>
                            <p>Aucun entraînement trouvé pour la classe {globalClass}.</p>
                            <p className="tm-empty-hint">
                                Vous pouvez créer un premier exercice adapté à cette classe en cliquant sur le bouton ci-dessous.
                            </p>
                            <button
                                type="button"
                                className="tm-create-empty-btn"
                                onClick={() => setEditItem('new')}
                            >
                                ✨ Créer un entraînement pour {globalClass}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── FOOTER STICKY DÉFINIR ENTRAÎNEMENT ── */}
            <div className="tm-footer">
                {saved && (
                    <div className="tm-saved-msg">
                        ✅ Entraînement mis à jour et envoyé aux élèves de {globalClass} !
                    </div>
                )}
                <button
                    type="button"
                    className={`tm-save-btn${totalSelected === 0 ? ' disabled' : ''}`}
                    onClick={handleSaveAssignment}
                    disabled={saving || totalSelected === 0}
                >
                    {saving ? (
                        <><span className="tm-btn-spinner" /> Enregistrement en cours…</>
                    ) : (
                        <>🚀 Définir l'entraînement pour {globalClass}{totalSelected > 0 ? ` (${totalSelected} sélectionné${totalSelected > 1 ? 's' : ''})` : ''}</>
                    )}
                </button>
                {totalSelected > 0 && (
                    <p className="tm-footer-hint">
                        Les {totalSelected} activité{totalSelected > 1 ? 's' : ''} cochée{totalSelected > 1 ? 's' : ''} apparaîtront directement sur l'interface d'entraînement des élèves de <strong>{globalClass}</strong>.
                    </p>
                )}
            </div>

            {/* ── MODAL : VOIR UN EXERCICE ── */}
            {viewItem && (
                <ExerciseViewModal
                    item={viewItem}
                    onClose={() => setViewItem(null)}
                    onEdit={() => {
                        const itemToEdit = { ...viewItem };
                        setViewItem(null);
                        setEditItem(itemToEdit);
                    }}
                    onDelete={viewItem.isCustom ? () => handleDeleteExercise(String(viewItem._id || viewItem.id)) : null}
                />
            )}

            {/* ── MODAL : CRÉER / MODIFIER UN EXERCICE ── */}
            {editItem && (
                <ExerciseEditorModal
                    initialData={editItem === 'new' ? null : editItem}
                    globalClass={globalClass}
                    globalClassId={globalClassId}
                    defaultLevel={detectedLevel || extractLevel(globalClass)}
                    teacherId={teacherId}
                    onClose={() => setEditItem(null)}
                    onSaved={handleSavedExercise}
                />
            )}
        </div>
    );
}

// ─── COMPOSANT LIGNE D'EXERCICE ──────────────────────────────────────────────
function ExerciseRow({ item, checked, onToggle, onView, onEdit, onDelete, colors }) {
    const qMeta = getQuestionTypeMeta(item.questionType || (item.type === 'chapter' ? 'chapter' : 'fill'));
    const isCustom = item.isCustom || item.type === 'custom';
    const imagesCount = Array.isArray(item.images) ? item.images.length : 0;

    return (
        <div className={`tm-item-card${checked ? ' checked' : ''}`}>
            {/* Case à cocher pour sélection */}
            <label className="tm-item-check-label" htmlFor={`tm-check-${item.id || item._id}`}>
                <input
                    id={`tm-check-${item.id || item._id}`}
                    type="checkbox"
                    className="tm-checkbox"
                    checked={checked}
                    onChange={onToggle}
                    onClick={(e) => e.stopPropagation()}
                />
            </label>

            {/* Corps cliquable pour ouvrir la vue / modification */}
            <div className="tm-item-body" onClick={onView} title="Cliquer pour voir les détails et modifier">
                <div className="tm-item-badge-row">
                    <span className={`tm-item-qtype-badge ${qMeta.badgeClass}`}>
                        <span>{qMeta.icon}</span>
                        <span>{qMeta.label}</span>
                    </span>

                    {item.level && (
                        <span className="tm-item-level-chip">
                            {formatLevelLabel(item.level)}
                        </span>
                    )}

                    {isCustom && (
                        <span className="tm-item-custom-chip">
                            ⭐ Personnalisé
                        </span>
                    )}

                    {imagesCount > 0 && (
                        <span className="tm-item-img-chip" title={`${imagesCount} image(s) jointe(s)`}>
                            🖼️ {imagesCount}
                        </span>
                    )}
                </div>

                <div className="tm-item-title-row">
                    <span className="tm-item-title">{item.title}</span>
                </div>
            </div>

            {/* Actions rapides */}
            <div className="tm-item-actions">
                <button
                    type="button"
                    className="tm-action-btn view-btn"
                    onClick={(e) => { e.stopPropagation(); onView(); }}
                    title="Voir l'exercice"
                >
                    👁️
                </button>

                <button
                    type="button"
                    className="tm-action-btn edit-btn"
                    onClick={(e) => { e.stopPropagation(); onEdit ? onEdit() : onView(); }}
                    title={isCustom ? "Modifier l'exercice" : "Personnaliser cet exercice"}
                >
                    ✏️
                </button>

                {onDelete && (
                    <button
                        type="button"
                        className="tm-action-btn delete-btn"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        title="Supprimer cet exercice"
                    >
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── MODAL : VISUALISATION D'UN EXERCICE ──────────────────────────────────────
function ExerciseViewModal({ item, onClose, onEdit, onDelete }) {
    const qMeta = getQuestionTypeMeta(item.questionType || (item.type === 'chapter' ? 'chapter' : 'fill'));
    const isCustom = item.isCustom || item.type === 'custom';
    const images = Array.isArray(item.images) ? item.images : [];
    const content = item.content || {};
    const [selectedImg, setSelectedImg] = useState(null);

    return (
        <div className="tm-modal-backdrop" onClick={onClose}>
            <div className="tm-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* En-tête */}
                <div className="tm-modal-header">
                    <div className="tm-modal-header-info">
                        <div className="tm-modal-badges">
                            <span className={`tm-item-qtype-badge ${qMeta.badgeClass}`}>
                                <span>{qMeta.icon}</span>
                                <span>{qMeta.label}</span>
                            </span>
                            <span className="tm-modal-sec-badge">{item.section || 'HISTOIRE'}</span>
                            {item.level && <span className="tm-modal-lvl-badge">Niveau {formatLevelLabel(item.level)}</span>}
                            {isCustom ? (
                                <span className="tm-modal-custom-badge">⭐ Exercice personnalisé</span>
                            ) : (
                                <span className="tm-modal-native-badge">📚 Exercice intégré</span>
                            )}
                        </div>
                        <h3 className="tm-modal-title">{item.title}</h3>
                    </div>
                    <button type="button" className="tm-modal-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Corps */}
                <div className="tm-modal-body">
                    {/* Images attachées */}
                    {images.length > 0 && (
                        <div className="tm-modal-images-box">
                            <div className="tm-modal-subheading">🖼️ Documents / Images d'appui ({images.length})</div>
                            <div className="tm-modal-images-grid">
                                {images.map((img, idx) => (
                                    <div key={idx} className="tm-modal-img-card" onClick={() => setSelectedImg(img.url)}>
                                        <img src={img.url} alt={img.caption || `Image ${idx + 1}`} className="tm-modal-thumb" />
                                        {img.caption && <span className="tm-modal-img-caption">{img.caption}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Aperçu grand format image si cliquée */}
                    {selectedImg && (
                        <div className="tm-lightbox-overlay" onClick={() => setSelectedImg(null)}>
                            <div className="tm-lightbox-card">
                                <img src={selectedImg} alt="Plein format" className="tm-lightbox-img" />
                                <button type="button" className="tm-lightbox-close" onClick={() => setSelectedImg(null)}>✕ Fermer</button>
                            </div>
                        </div>
                    )}

                    {/* Contenu selon le type de question */}
                    {item.type === 'chapter' ? (
                        <div className="tm-view-chapter-box">
                            <p className="tm-view-instruction">
                                📖 <strong>Chapitre de cours</strong> : Ce chapitre sera mis à disposition des élèves dans leur tableau de bord d'entraînement.
                            </p>
                        </div>
                    ) : item.questionType === 'fill' ? (
                        <div className="tm-view-fill-box">
                            <div className="tm-modal-subheading">🧩 Texte de l'entraînement (Texte à trous)</div>
                            <div className="tm-fill-preview-text">
                                {renderBlanksPreview(content.text || '', content.blanks || [])}
                            </div>

                            {/* Banque de mots */}
                            {Array.isArray(content.wordBank) && content.wordBank.length > 0 && (
                                <div className="tm-wordbank-box">
                                    <div className="tm-modal-subheading-sm">Banque de mots mise à disposition des élèves :</div>
                                    <div className="tm-wordbank-chips">
                                        {content.wordBank.map((word, idx) => (
                                            <span key={idx} className="tm-word-chip">{word}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : item.questionType === 'targeted' ? (
                        <div className="tm-view-targeted-box">
                            <div className="tm-modal-subheading">🎯 Énoncé de la question ciblée</div>
                            <div className="tm-targeted-prompt">
                                {content.question || 'Aucun énoncé spécifié.'}
                            </div>

                            {content.sampleAnswer && (
                                <div className="tm-targeted-answer-box">
                                    <div className="tm-modal-subheading-sm">💡 Éléments de réponse attendus :</div>
                                    <div className="tm-sample-answer">{content.sampleAnswer}</div>
                                </div>
                            )}

                            {content.guidelines && (
                                <div className="tm-targeted-guidelines-box">
                                    <div className="tm-modal-subheading-sm">📋 Consignes et critères d'évaluation :</div>
                                    <div className="tm-guidelines-text">{content.guidelines}</div>
                                </div>
                            )}
                        </div>
                    ) : item.questionType === 'qcm' ? (
                        <div className="tm-view-qcm-box">
                            <div className="tm-modal-subheading">🔘 Question du QCM</div>
                            <div className="tm-qcm-prompt">
                                {content.question || 'Aucun énoncé spécifié.'}
                            </div>

                            <div className="tm-qcm-choices-list">
                                {(Array.isArray(content.choices) ? content.choices : []).map((choice, idx) => {
                                    const isCorrect = Number(content.correctIndex) === idx;
                                    const letter = String.fromCharCode(65 + idx);
                                    return (
                                        <div key={idx} className={`tm-qcm-choice-item ${isCorrect ? 'correct' : ''}`}>
                                            <span className="tm-choice-letter">{letter}</span>
                                            <span className="tm-choice-text">{choice}</span>
                                            {isCorrect && <span className="tm-choice-tag">✓ Bonne réponse</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {content.explanation && (
                                <div className="tm-qcm-explanation-box">
                                    <div className="tm-modal-subheading-sm">💡 Explication pédagogique :</div>
                                    <p className="tm-explanation-text">{content.explanation}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="tm-view-generic-box">
                            <p>{content.text || content.question || 'Exercice sans aperçu textuel.'}</p>
                        </div>
                    )}
                </div>

                {/* Actions en bas */}
                <div className="tm-modal-footer">
                    {isCustom && onDelete && (
                        <button type="button" className="tm-modal-delete-btn" onClick={onDelete}>
                            🗑️ Supprimer
                        </button>
                    )}

                    <div className="tm-modal-footer-right">
                        <button type="button" className="tm-modal-cancel-btn" onClick={onClose}>
                            Fermer
                        </button>
                        <button type="button" className="tm-modal-edit-btn" onClick={onEdit}>
                            {isCustom ? '✏️ Modifier cet exercice' : '✨ Personnaliser pour cette classe'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MODAL : CRÉATION / ÉDITION D'UN EXERCICE D'ENTRAÎNEMENT ────────────────
function ExerciseEditorModal({
    initialData,
    globalClass,
    globalClassId,
    defaultLevel,
    teacherId,
    onClose,
    onSaved
}) {
    const isEditing = Boolean(initialData && (initialData._id || initialData.isCustom));
    const [title, setTitle]                   = useState(initialData?.title || '');
    const [section, setSection]               = useState(initialData?.section || 'HISTOIRE');
    const [level, setLevel]                   = useState(initialData?.level || defaultLevel || '5');
    const [questionType, setQuestionType]     = useState(initialData?.questionType || 'fill');
    const [images, setImages]                 = useState(Array.isArray(initialData?.images) ? initialData.images : []);
    const [imageUrlInput, setImageUrlInput]   = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [saving, setSaving]                 = useState(false);
    const [error, setError]                   = useState(null);

    // Contenu spécifique selon le mode
    // 1. Fill (texte à trous)
    const [fillText, setFillText]             = useState(initialData?.content?.text || '');
    const [customWordBank, setCustomWordBank] = useState(initialData?.content?.wordBank || []);
    const [distractorInput, setDistractorInput] = useState('');

    // 2. Targeted (question ciblée)
    const [targetedPrompt, setTargetedPrompt] = useState(initialData?.content?.question || '');
    const [sampleAnswer, setSampleAnswer]     = useState(initialData?.content?.sampleAnswer || '');
    const [guidelines, setGuidelines]         = useState(initialData?.content?.guidelines || '');

    // 3. QCM
    const [qcmPrompt, setQcmPrompt]           = useState(initialData?.content?.question || '');
    const [qcmChoices, setQcmChoices]         = useState(
        Array.isArray(initialData?.content?.choices) && initialData.content.choices.length === 4
            ? initialData.content.choices
            : ['', '', '', '']
    );
    const [qcmCorrectIndex, setQcmCorrectIndex] = useState(
        initialData?.content?.correctIndex !== undefined ? Number(initialData.content.correctIndex) : 0
    );
    const [qcmExplanation, setQcmExplanation] = useState(initialData?.content?.explanation || '');

    const textareaRef = useRef(null);

    // Détection automatique des trous dans fillText
    const detectedBlanks = extractBlanksFromText(fillText);

    // Banque de mots consolidée (trous + distracteurs ajoutés manuellement)
    const consolidatedWordBank = Array.from(new Set([...detectedBlanks, ...customWordBank]));

    // Insérer des crochets `[...]` dans le texte à trous
    const handleInsertHole = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = fillText.slice(start, end);
        let newText = '';
        if (selectedText) {
            newText = fillText.slice(0, start) + `[${selectedText}]` + fillText.slice(end);
        } else {
            newText = fillText.slice(0, start) + '[mot]' + fillText.slice(end);
        }
        setFillText(newText);
        setTimeout(() => {
            textarea.focus();
            if (!selectedText) {
                textarea.setSelectionRange(start + 1, start + 4);
            }
        }, 50);
    };

    // Upload d'image(s)
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploadingImage(true);
        setError(null);

        for (const file of files) {
            const formData = new FormData();
            formData.append('image', file);
            try {
                const res = await fetch('/api/prof/training/upload-image', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (data.ok && data.url) {
                    setImages(prev => [...prev, { url: data.url, caption: file.name.replace(/\.[^/.]+$/, '') }]);
                } else {
                    throw new Error(data.error || 'Erreur upload');
                }
            } catch (err) {
                setError(`Échec de l'upload de ${file.name} : ${err.message}`);
            }
        }
        setUploadingImage(false);
        e.target.value = '';
    };

    // Ajouter une image par URL
    const handleAddImageUrl = () => {
        const url = imageUrlInput.trim();
        if (!url) return;
        setImages(prev => [...prev, { url, caption: '' }]);
        setImageUrlInput('');
    };

    const handleRemoveImage = (idx) => {
        setImages(prev => prev.filter((_, i) => i !== idx));
    };

    const handleUpdateImageCaption = (idx, caption) => {
        setImages(prev => prev.map((img, i) => i === idx ? { ...img, caption } : img));
    };

    // Ajouter un mot perturbateur dans la banque de mots
    const handleAddDistractor = () => {
        const word = distractorInput.trim();
        if (!word) return;
        if (!customWordBank.includes(word)) {
            setCustomWordBank(prev => [...prev, word]);
        }
        setDistractorInput('');
    };

    const handleRemoveDistractor = (word) => {
        setCustomWordBank(prev => prev.filter(w => w !== word));
    };

    // Soumission du formulaire
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('Le titre de l\'exercice est obligatoire.');
            return;
        }

        setSaving(true);
        setError(null);

        // Construire l'objet de contenu selon le mode choisi
        let content = {};
        if (questionType === 'fill') {
            if (!fillText.trim()) {
                setError('Veuillez renseigner le texte de l\'exercice.');
                setSaving(false);
                return;
            }
            content = {
                text: fillText,
                blanks: detectedBlanks,
                wordBank: consolidatedWordBank,
            };
        } else if (questionType === 'targeted') {
            if (!targetedPrompt.trim()) {
                setError('Veuillez renseigner l\'énoncé de la question ciblée.');
                setSaving(false);
                return;
            }
            content = {
                question: targetedPrompt,
                sampleAnswer,
                guidelines,
            };
        } else if (questionType === 'qcm') {
            if (!qcmPrompt.trim()) {
                setError('Veuillez renseigner la question du QCM.');
                setSaving(false);
                return;
            }
            if (qcmChoices.some(c => !c.trim())) {
                setError('Veuillez renseigner les 4 propositions de réponse du QCM.');
                setSaving(false);
                return;
            }
            content = {
                question: qcmPrompt,
                choices: qcmChoices,
                correctIndex: Number(qcmCorrectIndex),
                explanation: qcmExplanation,
            };
        }

        const payload = {
            title: title.trim(),
            section: section.toUpperCase(),
            level: String(level).trim(),
            classrooms: globalClass ? [globalClass] : [],
            teacherId,
            images,
            questionType,
            content,
        };

        try {
            let res;
            if (isEditing && initialData._id) {
                // Modification de l'existant
                res = await fetch(`/api/prof/training/exercise/${initialData._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else {
                // Création (ou duplication)
                res = await fetch('/api/prof/training/exercise', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'enregistrement');
            onSaved(data.exercise);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="tm-modal-backdrop" onClick={onClose}>
            <div className="tm-modal-container tm-editor-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="tm-modal-header">
                    <div className="tm-modal-header-info">
                        <span className="tm-editor-badge">
                            {isEditing ? '✏️ Modification d\'entraînement' : '✨ Nouvel entraînement'}
                        </span>
                        <h3 className="tm-modal-title">
                            {isEditing ? `Modifier : ${title || 'Exercice'}` : `Créer pour la classe ${globalClass}`}
                        </h3>
                    </div>
                    <button type="button" className="tm-modal-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Formulaire */}
                <form className="tm-editor-form" onSubmit={handleSubmit}>
                    {error && <div className="tm-error">⚠️ {error}</div>}

                    {/* Section 1 : Informations Générales */}
                    <div className="tm-editor-card">
                        <div className="tm-editor-card-header">
                            <span className="tm-editor-card-num">1</span>
                            <strong>Informations générales</strong>
                        </div>

                        <div className="tm-form-grid">
                            <div className="tm-form-field full-width">
                                <label className="tm-label">Titre de l'entraînement *</label>
                                <input
                                    type="text"
                                    className="tm-input font-bold"
                                    placeholder="Ex: Les métropoles et leurs dynamiques mondiales"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="tm-form-field">
                                <label className="tm-label">Matière / Discipline</label>
                                <div className="tm-pill-selector">
                                    {[
                                        { id: 'HISTOIRE', label: '🏛️ Histoire' },
                                        { id: 'GEO', label: '🌍 Géo' },
                                        { id: 'EMC', label: '⚖️ EMC' },
                                    ].map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`tm-pill-opt ${section === s.id ? 'active ' + s.id.toLowerCase() : ''}`}
                                            onClick={() => setSection(s.id)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="tm-form-field">
                                <label className="tm-label">Niveau scolaire cible</label>
                                <select
                                    className="tm-select"
                                    value={level}
                                    onChange={(e) => setLevel(e.target.value)}
                                >
                                    <option value="6">6e (Sixième)</option>
                                    <option value="5">5e (Cinquième)</option>
                                    <option value="4">4e (Quatrième)</option>
                                    <option value="3">3e (Troisième / DNB)</option>
                                    <option value="2">2nde (Seconde)</option>
                                    <option value="1">1ère (Première)</option>
                                    <option value="T">Terminale</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2 : Espace Images (Documents d'appui) */}
                    <div className="tm-editor-card">
                        <div className="tm-editor-card-header">
                            <span className="tm-editor-card-num">2</span>
                            <div>
                                <strong>Documents & Images d'appui</strong>
                                <span className="tm-editor-card-sub">Ajoutez une ou plusieurs images (cartes, gravures, graphiques, schémas)</span>
                            </div>
                        </div>

                        <div className="tm-image-uploader-box">
                            <div className="tm-image-actions-bar">
                                <label className="tm-upload-file-btn">
                                    <span>📁 Importer une ou des image(s)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                        disabled={uploadingImage}
                                    />
                                </label>

                                <div className="tm-url-input-group">
                                    <input
                                        type="url"
                                        className="tm-url-input"
                                        placeholder="Ou collez l'URL d'une image web…"
                                        value={imageUrlInput}
                                        onChange={(e) => setImageUrlInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                                    />
                                    <button
                                        type="button"
                                        className="tm-url-add-btn"
                                        onClick={handleAddImageUrl}
                                        disabled={!imageUrlInput.trim()}
                                    >
                                        + Ajouter URL
                                    </button>
                                </div>
                            </div>

                            {uploadingImage && (
                                <div className="tm-uploading-indicator">
                                    <div className="tm-spinner" />
                                    Téléversement de l'image en cours…
                                </div>
                            )}

                            {/* Liste des images sélectionnées */}
                            {images.length > 0 && (
                                <div className="tm-images-preview-grid">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="tm-editor-img-card">
                                            <div className="tm-img-thumb-container">
                                                <img src={img.url} alt={`Document ${idx + 1}`} className="tm-editor-img-thumb" />
                                                <button
                                                    type="button"
                                                    className="tm-remove-img-btn"
                                                    onClick={() => handleRemoveImage(idx)}
                                                    title="Supprimer cette image"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                className="tm-img-caption-input"
                                                placeholder="Légende ou titre (ex: Document 1)"
                                                value={img.caption || ''}
                                                onChange={(e) => handleUpdateImageCaption(idx, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 3 : Espace Type de Question / Exercice */}
                    <div className="tm-editor-card">
                        <div className="tm-editor-card-header">
                            <span className="tm-editor-card-num">3</span>
                            <div>
                                <strong>Type d'activité / Question d'entraînement</strong>
                                <span className="tm-editor-card-sub">Choisissez la mécanique pédagogique souhaitée</span>
                            </div>
                        </div>

                        {/* Onglets sélecteur de mode */}
                        <div className="tm-qtype-tabs">
                            {[
                                { id: 'fill', label: '🧩 Texte à trous', desc: 'Remplissage avec banque de mots' },
                                { id: 'targeted', label: '🎯 Question ciblée', desc: 'Question ouverte avec barème et réponse modèle' },
                                { id: 'qcm', label: '🔘 QCM', desc: 'Choix multiple avec 4 propositions' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`tm-qtype-tab ${questionType === tab.id ? 'active' : ''}`}
                                    onClick={() => setQuestionType(tab.id)}
                                >
                                    <div className="tm-qtype-tab-label">{tab.label}</div>
                                    <div className="tm-qtype-tab-desc">{tab.desc}</div>
                                </button>
                            ))}
                        </div>

                        {/* MODE 1 : TEXTE À TROUS */}
                        {questionType === 'fill' && (
                            <div className="tm-mode-fill-container">
                                <div className="tm-help-banner">
                                    💡 <strong>Astuce :</strong> Tapez votre texte normalement, puis entourez les mots à deviner avec des crochets, par exemple : <code>Le 14 juillet [1789], les Parisiens prennent la [Bastille].</code>. Vous pouvez aussi surligner un mot et cliquer sur le bouton ci-dessous !
                                </div>

                                <div className="tm-fill-actions-bar">
                                    <button
                                        type="button"
                                        className="tm-insert-hole-btn"
                                        onClick={handleInsertHole}
                                    >
                                        ➕ Insérer un trou [ ... ]
                                    </button>
                                    <span className="tm-blanks-count-badge">
                                        {detectedBlanks.length} trou{detectedBlanks.length > 1 ? 's' : ''} détecté{detectedBlanks.length > 1 ? 's' : ''}
                                    </span>
                                </div>

                                <textarea
                                    ref={textareaRef}
                                    className="tm-textarea tm-fill-textarea"
                                    rows={6}
                                    placeholder="Écrivez le paragraphe ici avec les mots clés entre crochets..."
                                    value={fillText}
                                    onChange={(e) => setFillText(e.target.value)}
                                />

                                {/* Aperçu visuel en direct */}
                                {fillText && (
                                    <div className="tm-fill-live-preview">
                                        <div className="tm-preview-label">Aperçu en direct pour l'élève :</div>
                                        <div className="tm-preview-box">
                                            {renderBlanksPreview(fillText, detectedBlanks)}
                                        </div>
                                    </div>
                                )}

                                {/* Gestion de la banque de mots */}
                                <div className="tm-wordbank-manager">
                                    <div className="tm-wordbank-header">
                                        <strong>Banque de mots proposée aux élèves :</strong>
                                        <span className="tm-wordbank-sub">Générée automatiquement à partir de vos trous</span>
                                    </div>

                                    <div className="tm-wordbank-chips">
                                        {consolidatedWordBank.map((word, idx) => {
                                            const isDistractor = !detectedBlanks.includes(word);
                                            return (
                                                <span key={idx} className={`tm-word-chip ${isDistractor ? 'distractor' : ''}`}>
                                                    <span>{word}</span>
                                                    {isDistractor && (
                                                        <button
                                                            type="button"
                                                            className="tm-remove-word-btn"
                                                            onClick={() => handleRemoveDistractor(word)}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    <div className="tm-add-distractor-row">
                                        <input
                                            type="text"
                                            className="tm-distractor-input"
                                            placeholder="Ajouter un mot piège / perturbateur…"
                                            value={distractorInput}
                                            onChange={(e) => setDistractorInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddDistractor(); } }}
                                        />
                                        <button
                                            type="button"
                                            className="tm-add-distractor-btn"
                                            onClick={handleAddDistractor}
                                            disabled={!distractorInput.trim()}
                                        >
                                            + Ajouter mot piège
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODE 2 : QUESTION CIBLÉE */}
                        {questionType === 'targeted' && (
                            <div className="tm-mode-targeted-container">
                                <div className="tm-form-field">
                                    <label className="tm-label">Énoncé de la question ciblée *</label>
                                    <textarea
                                        className="tm-textarea"
                                        rows={4}
                                        placeholder="Ex: À l'aide du document 1, expliquez comment la Première Guerre mondiale a bouleversé la vie des civils à l'arrière."
                                        value={targetedPrompt}
                                        onChange={(e) => setTargetedPrompt(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="tm-form-field">
                                    <label className="tm-label">💡 Éléments de réponse attendus (Modèle)</label>
                                    <textarea
                                        className="tm-textarea"
                                        rows={4}
                                        placeholder="Ex: Mentionner les réquisitions, la propagande, les bombardements et le rôle des munitionnettes..."
                                        value={sampleAnswer}
                                        onChange={(e) => setSampleAnswer(e.target.value)}
                                    />
                                </div>

                                <div className="tm-form-field">
                                    <label className="tm-label">📋 Consignes et critères d'évaluation pour l'élève</label>
                                    <input
                                        type="text"
                                        className="tm-input"
                                        placeholder="Ex: Rédigez une réponse ordonnée d'au moins 5 lignes avec deux arguments historiques."
                                        value={guidelines}
                                        onChange={(e) => setGuidelines(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* MODE 3 : QCM */}
                        {questionType === 'qcm' && (
                            <div className="tm-mode-qcm-container">
                                <div className="tm-form-field">
                                    <label className="tm-label">Question du QCM *</label>
                                    <textarea
                                        className="tm-textarea"
                                        rows={3}
                                        placeholder="Ex: Quelle est la capitale politique de l'Empire byzantin jusqu'en 1453 ?"
                                        value={qcmPrompt}
                                        onChange={(e) => setQcmPrompt(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="tm-qcm-editor-choices">
                                    <label className="tm-label">4 Propositions de réponse (sélectionnez le bouton radio de la bonne réponse) *</label>
                                    {qcmChoices.map((choice, idx) => {
                                        const isChecked = qcmCorrectIndex === idx;
                                        const letter = String.fromCharCode(65 + idx);
                                        return (
                                            <div key={idx} className={`tm-qcm-choice-row ${isChecked ? 'is-correct' : ''}`}>
                                                <label className="tm-qcm-radio-label">
                                                    <input
                                                        type="radio"
                                                        name="qcm-correct-choice"
                                                        className="tm-qcm-radio"
                                                        checked={isChecked}
                                                        onChange={() => setQcmCorrectIndex(idx)}
                                                    />
                                                    <span className="tm-qcm-letter-tag">{letter}</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="tm-input flex-1"
                                                    placeholder={`Proposition ${letter}`}
                                                    value={choice}
                                                    onChange={(e) => {
                                                        const updated = [...qcmChoices];
                                                        updated[idx] = e.target.value;
                                                        setQcmChoices(updated);
                                                    }}
                                                    required
                                                />
                                                {isChecked && (
                                                    <span className="tm-qcm-correct-indicator">✓ Bonne réponse</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="tm-form-field">
                                    <label className="tm-label">💡 Explication pédagogique (affichée après validation)</label>
                                    <textarea
                                        className="tm-textarea"
                                        rows={2}
                                        placeholder="Ex: Constantinople a été fondée par l'empereur Constantin en 330..."
                                        value={qcmExplanation}
                                        onChange={(e) => setQcmExplanation(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Formulaire */}
                    <div className="tm-editor-footer">
                        <button type="button" className="tm-modal-cancel-btn" onClick={onClose} disabled={saving}>
                            Annuler
                        </button>
                        <button type="submit" className="tm-editor-submit-btn" disabled={saving}>
                            {saving ? (
                                <><span className="tm-btn-spinner" /> Enregistrement…</>
                            ) : (
                                <>💾 {isEditing ? 'Mettre à jour l\'entraînement' : 'Créer l\'entraînement'}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── HELPER RENDU DES TROUS EN APERÇU ─────────────────────────────────────────
function renderBlanksPreview(text = '', blanks = []) {
    if (!text) return null;
    // Remplacer les [mot] ou "mot" par des jetons visuels
    const regex = /(\[[^\]]+\]|["“«][^"”»]+["”»])/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        const rawContent = match[1].replace(/^\[|\]$|^["“«]|["”»]$/g, '').trim();
        parts.push(
            <span key={match.index} className="tm-hole-slot">
                <span className="tm-hole-blank">______</span>
                <span className="tm-hole-hint">({rawContent})</span>
            </span>
        );
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}

function getSectionSubject(section) {
    const key = String(section || '').toUpperCase();
    if (key.includes('HIST')) return 'histoire';
    if (key.includes('GEO')) return 'geo';
    if (key.includes('EMC')) return 'emc';
    return 'general';
}
