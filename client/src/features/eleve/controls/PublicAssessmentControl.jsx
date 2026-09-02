import React, { useEffect, useState } from 'react';
import './PublicAssessmentControl.css';

export default function PublicAssessmentControl({ controlId, currentUser = null }) {
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Identite eleve
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');

  // Reponses eleve: { [itemId]: { value: string, values: string[] } }
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Resultat de correction
  const [submissionResult, setSubmissionResult] = useState(null);

  // Contestations en cours: { [key]: { message: string, sending: boolean, done: boolean } }
  // key: `${itemId}` ou `${itemId}_${blankIndex}`
  const [activeContestKey, setActiveContestKey] = useState('');
  const [contestMessage, setContestMessage] = useState('');
  const [contestedMap, setContestedMap] = useState({});

  useEffect(() => {
    if (!controlId) {
      setError('Aucun identifiant de contrôle spécifié.');
      setLoading(false);
      return;
    }
    const loadControl = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/eleve/controls/${encodeURIComponent(controlId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Contrôle introuvable ou indisponible.');
        setControl(data);

        // Pre-initialiser les reponses
        const initial = {};
        (data.items || []).forEach((item) => {
          if (item.type === 'fill') {
            const blankCount = (String(item.prompt || '').match(/__________/g) || []).length || (item.expectedAnswers?.length || 1);
            initial[item.id] = { values: Array(blankCount).fill('') };
          } else {
            initial[item.id] = { value: '' };
          }
        });
        setAnswers(initial);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement du contrôle.');
      } finally {
        setLoading(false);
      }
    };
    loadControl();
  }, [controlId]);

  const handleUpdateChoice = (itemId, choiceIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], value: choiceIndex }
    }));
  };

  const handleUpdateText = (itemId, text) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], value: text }
    }));
  };

  const handleUpdateBlank = (itemId, blankIndex, text) => {
    setAnswers((prev) => {
      const currentValues = [...(prev[itemId]?.values || [])];
      currentValues[blankIndex] = text;
      return {
        ...prev,
        [itemId]: { ...prev[itemId], values: currentValues }
      };
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setSubmissionError('Veuillez renseigner votre prénom et votre nom en haut de la page.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmissionError('');
    setSubmitting(true);

    try {
      const payloadAnswers = (control.items || []).map((item) => {
        const answer = answers[item.id] || {};
        if (item.type === 'fill') {
          return { itemId: item.id, values: answer.values || [] };
        }
        return { itemId: item.id, value: answer.value ?? '' };
      });

      const res = await fetch(`/api/eleve/controls/${encodeURIComponent(controlId)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          studentId: currentUser?._id || '',
          answers: payloadAnswers
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lors de la validation du contrôle.');

      setSubmissionResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setSubmissionError(err.message || 'Impossible de soumettre le contrôle.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendContest = async (itemId, blankIndex = null) => {
    const key = Number.isInteger(blankIndex) ? `${itemId}_${blankIndex}` : `${itemId}`;
    const message = contestMessage.trim() || 'Contestation de la réponse saisie';
    setContestedMap((prev) => ({ ...prev, [key]: { status: 'sending', message } }));

    try {
      const res = await fetch(`/api/eleve/controls/${encodeURIComponent(controlId)}/contest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionResult?.id || '',
          studentName: `${firstName.trim()} ${lastName.trim()}`,
          itemId,
          ...(Number.isInteger(blankIndex) ? { blankIndex } : {}),
          message
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lors de l’envoi de la contestation.');

      setContestedMap((prev) => ({ ...prev, [key]: { status: 'pending', message } }));
      setActiveContestKey('');
      setContestMessage('');
    } catch (err) {
      alert(err.message || 'Échec de la contestation.');
      setContestedMap((prev) => ({ ...prev, [key]: null }));
    }
  };

  if (loading) {
    return (
      <div className="public-control-shell">
        <div className="public-control-container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <h2 style={{ fontWeight: 900 }}>Chargement du contrôle...</h2>
        </div>
      </div>
    );
  }

  if (error || !control) {
    return (
      <div className="public-control-shell">
        <div className="public-control-container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontWeight: 900, color: '#dc2626' }}>{error || 'Contrôle introuvable'}</h2>
          <p style={{ color: '#64748b', marginTop: 8 }}>Vérifie le lien ou le QR code fourni par ton professeur.</p>
        </div>
      </div>
    );
  }

  const items = control.items || [];
  const totalPoints = items.reduce((sum, it) => sum + (Number(it.points) || 1), 0);

  // ==================== RENDU : PHASE DE CORRECTION ====================
  if (submissionResult) {
    const corrections = submissionResult.corrections || [];
    return (
      <div className="public-control-shell">
        <div className="public-control-container">
          <div className="public-control-score-card">
            <div className="public-control-score-title">Résultat du contrôle</div>
            <div className="public-control-score-number">
              {submissionResult.score} / {submissionResult.total}
            </div>
            <div className="public-control-score-notice">
              ✓ Devoir validé et transmis à ton professeur pour {submissionResult.studentName || `${firstName} ${lastName}`}.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Correction détaillée
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
              Si une réponse ou un mot saisi a été compté faux alors qu'il est correct, utilise le bouton <strong>Contester</strong> pour le signaler au professeur.
            </p>
          </div>

          {items.map((item, itemIdx) => {
            const corr = corrections.find((c) => String(c.itemId) === String(item.id)) || {};
            const isItemCorrect = corr.correct === true;
            const wholeContestKey = String(item.id);
            const wholeContested = contestedMap[wholeContestKey] || (corr.contestStatus === 'pending' ? { status: 'pending', message: corr.contestMessage } : null);

            return (
              <div
                key={item.id}
                className={`public-control-correction-card ${
                  isItemCorrect ? 'correct' : (wholeContested ? 'contested' : 'incorrect')
                }`}
              >
                <div className="public-control-item-head">
                  <span className="public-control-item-number">
                    Question {itemIdx + 1} · {item.lessonTitle || 'Général'}
                  </span>
                  <span className="public-control-item-points">
                    {corr.awardedPoints ?? (isItemCorrect ? item.points : 0)} / {item.points || 1} pt(s)
                  </span>
                </div>

                {/* QCM */}
                {item.type === 'qcm' && (
                  <div>
                    <div className="public-control-prompt">{item.prompt}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {(item.choices || []).map((choice, cIdx) => {
                        const isStudentChoice = Number(corr.value) === cIdx;
                        return (
                          <div
                            key={choice}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 10,
                              fontWeight: 700,
                              fontSize: 14,
                              border: isStudentChoice ? (isItemCorrect ? '2px solid #22c55e' : '2px solid #ef4444') : '1px solid #e2e8f0',
                              background: isStudentChoice ? (isItemCorrect ? '#dcfce7' : '#fee2e2') : '#f8fafc',
                              color: '#1e293b'
                            }}
                          >
                            <span style={{ fontWeight: 900, marginRight: 8 }}>{String.fromCharCode(65 + cIdx)}.</span>
                            {choice}
                            {isStudentChoice && (
                              <span style={{ marginLeft: 10, fontWeight: 900, color: isItemCorrect ? '#15803d' : '#b91c1c' }}>
                                {isItemCorrect ? '✓ Ta réponse (Correct)' : '✗ Ta réponse'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TARGET / QUESTION OUVERTE */}
                {item.type === 'target' && (
                  <div>
                    <div className="public-control-prompt">{item.prompt}</div>
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'white', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 800 }}>Ta réponse :</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isItemCorrect ? '#166534' : '#991b1b', marginTop: 4 }}>
                        {corr.value || <em style={{ color: '#94a3b8' }}>Aucune réponse saisie</em>}
                      </div>

                      {!isItemCorrect && (corr.expectedAnswers?.length > 0 || corr.expectedKeywords?.length > 0) && (
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e2e8f0', fontSize: 13 }}>
                          <span style={{ fontWeight: 800, color: '#475569' }}>Attendu : </span>
                          <span style={{ color: '#0f172a', fontWeight: 700 }}>
                            {(corr.expectedAnswers || []).join(' OU ') || (corr.expectedKeywords || []).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bouton de contestation pour target */}
                    {!isItemCorrect && (
                      <div style={{ marginTop: 10 }}>
                        {wholeContested ? (
                          <span className="public-control-contest-badge">
                            ⚠️ Contestation envoyée {wholeContested.message ? `(« ${wholeContested.message} »)` : ''}
                          </span>
                        ) : activeContestKey === wholeContestKey ? (
                          <div className="public-control-contest-box">
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                              Pourquoi ta réponse devrait-elle être acceptée ?
                            </div>
                            <input
                              type="text"
                              placeholder="Ex: Synonyme exact, orthographe proche..."
                              value={contestMessage}
                              onChange={(e) => setContestMessage(e.target.value)}
                            />
                            <div className="public-control-contest-box-actions">
                              <button
                                type="button"
                                className="public-control-contest-cancel"
                                onClick={() => setActiveContestKey('')}
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                className="public-control-contest-send"
                                onClick={() => handleSendContest(item.id)}
                              >
                                Envoyer au professeur
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="public-control-contest-btn"
                            onClick={() => {
                              setActiveContestKey(wholeContestKey);
                              setContestMessage('');
                            }}
                          >
                            ⚠️ Contester cette réponse
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* FILL / TEXTE A TROUS */}
                {item.type === 'fill' && (
                  <div>
                    <div style={{ fontSize: 15, lineHeight: 2.2, color: '#1e293b' }}>
                      {(() => {
                        const segments = String(item.prompt || '').split('__________');
                        const blankResults = corr.blankResults || [];
                        return segments.map((seg, sIdx) => {
                          const hasBlank = sIdx < segments.length - 1;
                          const blankInfo = blankResults[sIdx] || {};
                          const blankKey = `${item.id}_${sIdx}`;
                          const isBlankCorrect = blankInfo.correct === true;
                          const blankContested = contestedMap[blankKey] || (blankInfo.contestStatus === 'pending' ? { status: 'pending', message: blankInfo.contestMessage } : null);

                          return (
                            <React.Fragment key={sIdx}>
                              <span>{seg}</span>
                              {hasBlank && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', margin: '0 4px', verticalAlign: 'middle' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 8px',
                                      borderRadius: 8,
                                      fontSize: 13,
                                      fontWeight: 800,
                                      border: isBlankCorrect ? '1.5px solid #22c55e' : (blankContested ? '1.5px solid #f59e0b' : '1.5px solid #ef4444'),
                                      background: isBlankCorrect ? '#dcfce7' : (blankContested ? '#fef3c7' : '#fee2e2'),
                                      color: isBlankCorrect ? '#15803d' : (blankContested ? '#b45309' : '#991b1b')
                                    }}
                                  >
                                    {isBlankCorrect ? (
                                      `✓ ${blankInfo.value || '...'}`
                                    ) : (
                                      <>
                                        <span>✗ {blankInfo.value || '(vide)'}</span>
                                        {blankInfo.expected && (
                                          <span style={{ fontSize: 11, color: '#475569', fontWeight: 900 }}>
                                            [attendu: {blankInfo.expected}]
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </span>

                                  {/* Bouton contestation par trou */}
                                  {!isBlankCorrect && (
                                    <>
                                      {blankContested ? (
                                        <span className="public-control-contest-badge" title={blankContested.message}>
                                          ⚠️ Contesté
                                        </span>
                                      ) : activeContestKey === blankKey ? null : (
                                        <button
                                          type="button"
                                          className="public-control-contest-btn"
                                          title="Contester ce trou"
                                          onClick={() => {
                                            setActiveContestKey(blankKey);
                                            setContestMessage('');
                                          }}
                                        >
                                          ⚠️ Contester
                                        </button>
                                      )}
                                    </>
                                  )}
                                </span>
                              )}
                            </React.Fragment>
                          );
                        });
                      })()}
                    </div>

                    {/* Zone de saisie contestation pour un trou ouvert */}
                    {activeContestKey.startsWith(`${item.id}_`) && (
                      <div className="public-control-contest-box">
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                          Contestation pour le trou n°{Number(activeContestKey.split('_')[1]) + 1} :
                        </div>
                        <input
                          type="text"
                          placeholder="Pourquoi ce mot devrait-il être accepté ?"
                          value={contestMessage}
                          onChange={(e) => setContestMessage(e.target.value)}
                        />
                        <div className="public-control-contest-box-actions">
                          <button
                            type="button"
                            className="public-control-contest-cancel"
                            onClick={() => setActiveContestKey('')}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            className="public-control-contest-send"
                            onClick={() => handleSendContest(item.id, Number(activeContestKey.split('_')[1]))}
                          >
                            Envoyer la contestation
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== RENDU : PHASE DE SAISIE DU DEVOIR ====================
  return (
    <div className="public-control-shell">
      <div className="public-control-container">
        {/* En-tete du controle */}
        <div className="public-control-header-card">
          <span className="public-control-badge">Contrôle en direct</span>
          <h1 className="public-control-title">{control.title}</h1>
          <p className="public-control-subtitle">
            {control.subject || 'Général'} · {items.length} question(s) · Barème : {totalPoints} point(s)
          </p>
        </div>

        {/* Identification : Prenom et Nom en haut */}
        <div className="public-control-identity-card">
          <div className="public-control-identity-title">
            <span>👤 Ton identité</span>
          </div>
          <div className="public-control-identity-row">
            <div className="public-control-input-group">
              <label htmlFor="student-firstname">Prénom *</label>
              <input
                id="student-firstname"
                type="text"
                placeholder="Ex. Jean"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="public-control-input-group">
              <label htmlFor="student-lastname">Nom *</label>
              <input
                id="student-lastname"
                type="text"
                placeholder="Ex. Dupont"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
        </div>

        {/* Liste des questions */}
        <form onSubmit={handleSubmit}>
          {items.map((item, itemIdx) => {
            const currentAnswer = answers[item.id] || {};
            return (
              <div key={item.id} className="public-control-item-card">
                <div className="public-control-item-head">
                  <span className="public-control-item-number">
                    {itemIdx + 1} · {item.lessonTitle || 'Question'}
                  </span>
                  <span className="public-control-item-points">
                    {item.points || 1} pt{Number(item.points) > 1 ? 's' : ''}
                  </span>
                </div>

                {/* QCM */}
                {item.type === 'qcm' && (
                  <div>
                    <div className="public-control-prompt">{item.prompt}</div>
                    <div className="public-control-qcm-options">
                      {(item.choices || []).map((choice, cIdx) => {
                        const isSelected = currentAnswer.value === cIdx;
                        return (
                          <button
                            type="button"
                            key={choice}
                            className={`public-control-qcm-button ${isSelected ? 'active' : ''}`}
                            onClick={() => handleUpdateChoice(item.id, cIdx)}
                          >
                            <span className="public-control-choice-letter">
                              {String.fromCharCode(65 + cIdx)}
                            </span>
                            <span>{choice}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* QUESTIONS CIBLEES / OUVERTES */}
                {item.type === 'target' && (
                  <div>
                    <div className="public-control-prompt">{item.prompt}</div>
                    <input
                      type="text"
                      className="public-control-text-input"
                      placeholder="Tape ta réponse ici..."
                      value={currentAnswer.value || ''}
                      onChange={(e) => handleUpdateText(item.id, e.target.value)}
                    />
                  </div>
                )}

                {/* TEXTE A TROUS */}
                {item.type === 'fill' && (
                  <div className="public-control-fill-content">
                    {(() => {
                      const segments = String(item.prompt || '').split('__________');
                      const values = currentAnswer.values || [];
                      return segments.map((seg, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <span>{seg}</span>
                          {sIdx < segments.length - 1 && (
                            <input
                              type="text"
                              className="public-control-blank-input"
                              placeholder={`Trou ${sIdx + 1}...`}
                              value={values[sIdx] || ''}
                              onChange={(e) => handleUpdateBlank(item.id, sIdx, e.target.value)}
                            />
                          )}
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                )}
              </div>
            );
          })}

          {submissionError && (
            <div className="public-control-error-banner">
              ⚠️ {submissionError}
            </div>
          )}

          <div className="public-control-submit-bar">
            <button
              type="submit"
              className="public-control-submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Validation en cours...' : 'VALIDER ET CORRIGER'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
