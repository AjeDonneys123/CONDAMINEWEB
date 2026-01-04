import React, { useEffect, useRef } from 'react';
import { initZombieGame } from './zombie_core'; // Import du moteur pur
import './zombie_style.css';

export default function ZombieWrapper({ user, onClose }) {
    const boxRef = useRef(null);
    const engineRef = useRef(null);

    useEffect(() => {
        // Au montage, on donne la DIV au moteur
        if (boxRef.current) {
            // On passe l'élément DOM et les callbacks
            engineRef.current = initZombieGame(boxRef.current, { user }, onClose);
        }

        // Au démontage (quand on quitte ou que React reload), on tue le moteur
        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
            }
        };
    }, []);

    // Rendu React minimaliste : Juste une boîte noire
    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
            <div id="zombie-root" ref={boxRef}></div>
        </div>
    );
}