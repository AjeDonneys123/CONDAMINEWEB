import React, { useEffect, useRef } from 'react';
import { initStarshipGame } from './starship_core';
import './starship_style.css';

export default function StarshipWrapper({ user, level, onClose }) {
    const boxRef = useRef(null);
    const engineRef = useRef(null);

    useEffect(() => {
        if (level && boxRef.current) {
            // Lancement du moteur avec nettoyage
            const engine = initStarshipGame(boxRef.current, { level, user }, onClose);
            engineRef.current = engine;
        }
        
        return () => {
            if (engineRef.current) engineRef.current.destroy();
        };
    }, [level]);

    return (
        // CONTENEUR PLEIN ÉCRAN FORCÉ (z-index max, fond noir)
        // C'est ce style qui manquait et qui causait l'écran gris/vide
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col w-full h-full">
            <div id="starship-root" ref={boxRef} className="w-full h-full relative overflow-hidden"></div>
        </div>
    );
}