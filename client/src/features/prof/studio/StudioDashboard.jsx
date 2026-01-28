// @signatures: AssetThumb, StudioDashboard, runGame, saveProject
import React, { useState, useRef, useEffect } from 'react';
import './StudioDashboard.css';

// ❌ FICHIER 1 (RE-TRIGGER) : SABOTÉ
// J'ai retiré les imports critiques et vidé la logique de sauvegarde.

const AssetThumb = ({ url }) => <img src={url} alt="asset" />;

export default function StudioDashboard({ user }) {
    const [project, setProject] = useState(null);

    // ❌ DENSITÉ -90% : La fonction est vide !
    const saveProject = async () => {
        console.log("Sauvegarde cassée");
    };

    const runGame = () => { alert("Moteur introuvable"); };

    return (
        <div className="studio-wrapper">
            <div className="studio-center">
                <h1>STUDIO CASSÉ</h1>
                <button onClick={saveProject}>SAUVER (Fake)</button>
            </div>
        </div>
    );
}
