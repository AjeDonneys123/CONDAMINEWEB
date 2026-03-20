// @signatures: DashboardFolder, getSubjectClass, s
import React from 'react';
import './DashboardFolder.css';

/**
 * 🌊 DASHBOARD STREAM (Ex-Folder)
 * Affiche une liste plate chronologique avec badge matière.
 */
export default function DashboardFolder({ items, type, onSelect, onDelete }) {
  
  // 1. TRI CHRONOLOGIQUE (Le plus récent en haut)
  // On utilise createdAt ou date s'il existe, sinon on garde l'ordre par défaut
  const sortedItems = [...items].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0);
      const dateB = new Date(b.createdAt || b.date || 0);
      return dateB - dateA; // Descendant
  });

  // 2. HELPER COULEURS
  const getSubjectClass = (subject) => {
      const s = (subject || "").toUpperCase();
      if (s.includes('MATH')) return 'sub-maths';
      if (s.includes('FRAN')) return 'sub-fr';
      if (s.includes('HIST') || s.includes('GEO') || s.includes('EMC')) return 'sub-hist';
      if (s.includes('ANGL') || s.includes('ESP') || s.includes('ALL') || s.includes('LANG')) return 'sub-lang';
      if (s.includes('SCI') || s.includes('SVT') || s.includes('PHY') || s.includes('TECH')) return 'sub-sci';
      if (s.includes('ART') || s.includes('MUSI')) return 'sub-art';
      return 'sub-gen';
  };

  // 3. RENDU VIDE
  if (sortedItems.length === 0) {
      const emptyTypeLabel = type === 'homework'
          ? 'devoir'
          : (type === 'learning' ? 'module apprentissage' : (type === 'expose' ? 'exposé' : (type === 'lecture' ? 'lecture' : (type === 'fiche' ? 'fiche' : 'jeu'))));
      const emptyIcon = type === 'homework' ? '📚' : (type === 'learning' ? '🧠' : (type === 'expose' ? '🗣️' : (type === 'lecture' ? '📖' : (type === 'fiche' ? '🗂️' : '🎮'))));
      return (
          <div className="empty-stream">
              <span className="empty-icon">{emptyIcon}</span>
              <span className="empty-text">Aucun {emptyTypeLabel} pour le moment.</span>
          </div>
      );
  }

  // 4. RENDU LISTE
  return (
    <div className="stream-container animate-in">
      {sortedItems.map(item => {
          const subjectName = item.subject || "GÉNÉRAL";
          const isDone = item.status === 'done';
          
          return (
            <div key={item._id} onClick={() => onSelect(item)} className="stream-card group">
                {/* LIGNE 1 : MATIÈRE + FLAG PUNITION */}
                <div className="card-header">
                    <div className="card-header-left">
                        <span className={`subject-badge ${getSubjectClass(subjectName)}`}>
                            {subjectName}
                        </span>
                        {item.isPunishment && <span className="punishment-flag">⚠️ PUNITION</span>}
                        {item.teacherValidated === true && <span className="validation-flag">✅ DEVOIR VALIDÉ</span>}
                    </div>
                    {typeof onDelete === 'function' && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item);
                            }}
                            className="delete-item-btn"
                            aria-label={`Supprimer ${item.title || 'cet élément'}`}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* LIGNE 2 : TITRE */}
                <div className="card-title">
                    {item.title}
                </div>

                {/* LIGNE 3 : STATUT */}
                <div className="card-footer">
                    {isDone ? (
                        <div className="status-badge status-done">
                            <span>✅</span> <span>{item.teacherValidated === true ? 'VALIDÉ' : 'FAIT'}</span>
                        </div>
                    ) : (
                        <div className="status-badge status-todo">
                            <span>⭕</span> <span>À FAIRE</span>
                        </div>
                    )}
                    
                    <div className="card-arrow">➔</div>
                </div>
            </div>
          );
      })}
    </div>
  );
}
