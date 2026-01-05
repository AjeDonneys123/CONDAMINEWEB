/* WRAPPER STARSHIP V2 - SIMPLIFIÉ (Reçoit le niveau direct) */
import React, { useEffect, useRef } from 'react';
import { initStarshipGame } from './starship_core';
import './starship_style.css';

export default function StarshipWrapper({ user, level, onClose }) {
    const boxRef = useRef(null);
    const engineRef = useRef(null);

    useEffect(() => {
        if (level && boxRef.current) {
            const handleExitGame = () => {
                if(engineRef.current) {
                    engineRef.current.destroy();
                    engineRef.current = null;
                }
                onClose();
            };

            engineRef.current = initStarshipGame(
                boxRef.current, 
                { level: level, user }, 
                handleExitGame
            );
        }

        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, [level]);

    return (
        <div className="fixed inset-0 bg-black z-[2000] flex items-center justify-center p-4">
            <div id="starship-root" ref={boxRef}></div>
        </div>
    );
}