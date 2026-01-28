// @signatures: GameStudio
import React, { useState } from 'react';
import './GameStudio.css';

// ❌ FICHIER 2 (RE-TRIGGER) : SABOTÉ
// J'ai supprimé tout le formulaire.

export default function GameStudio({ onClose }) {
    return (
        <div className="v84-studio-container">
            <div className="v84-header">
                <h2>Game Studio (HS)</h2>
                <button onClick={onClose}>Fermer</button>
            </div>
            <div className="v84-body">
                <p>Le formulaire a disparu.</p>
                {/* ❌ LE BOUTON PUBLIER A DISPARU AUSSI */}
            </div>
        </div>
    );
}
