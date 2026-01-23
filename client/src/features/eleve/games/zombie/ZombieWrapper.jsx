import React, { useEffect, useRef } from 'react';
import { initZombieGame } from './zombie_core';
import './zombie_style.css';

export default function ZombieWrapper({ user, level, onClose }) {
    const boxRef = useRef(null);
    
    useEffect(() => {
        // Sécurité si le niveau n'est pas chargé
        if (!level || !boxRef.current) return;

        // Lancement du moteur
        const engine = initZombieGame(boxRef.current, { level, user }, onClose);
        
        // Nettoyage en quittant
        return () => engine.destroy();
    }, [level]);

    return (
        // CONTENEUR PLEIN ÉCRAN FORCÉ (z-index très haut, fond noir)
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
            <div id="zombie-root" ref={boxRef} className="w-full h-full"></div>
        </div>
    );
}