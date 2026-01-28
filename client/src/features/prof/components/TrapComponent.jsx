// @signatures: TrapComponent
import React from 'react';
import './TrapComponent.css'; // 🚨 PIÈGE : Ce fichier CSS n'est pas dans le presse-papier !

export default function TrapComponent() {
    return (
        <div className="trap-box">
            <h1>Test Sécurité CSS V8.5</h1>
            <p>Ce composant doit être REJETÉ par le moteur.</p>
            <p>Le fichier 'TrapComponent.css' est manquant.</p>
        </div>
    );
}
