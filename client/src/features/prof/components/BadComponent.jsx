// @signatures: BadComponent
import React from 'react';
import './Introuvable.css'; // <--- LE PIÈGE EST ICI (Ce fichier n'existe pas)

export default function BadComponent() {
    return (
        <div className="bad-component">
            <h1>Ceci est un test de sécurité</h1>
            <p>Si tu vois ce fichier dans ton projet, c'est que la sécurité a échoué.</p>
        </div>
    );
}
