import React, { useEffect, useRef, useState } from 'react';
import { initZombieGame } from './zombie_core';
import './zombie_style.css';
import { api } from '../../../../services/api';

function normalizeClass(c) {
    if(!c) return "";
    return c.toString().toLowerCase().replace(/e/g, '').replace(/eme/g, '').trim();
}

export default function ZombieWrapper({ user, onClose }) {
    const boxRef = useRef(null);
    const engineRef = useRef(null);
    const [availableLevels, setAvailableLevels] = useState([]);
    const [selectedLevel, setSelectedLevel] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/game-levels/all').then(data => {
            if(data && data.length > 0) {
                const userClass = normalizeClass(user.classroom);
                const myLevels = data.filter(l => {
                    const levelClass = normalizeClass(l.classroom || 'Toutes');
                    return l.chapterId === 'ch1-zombie' && (levelClass === 'toutes' || levelClass === userClass);
                });
                setAvailableLevels(myLevels);
            }
            setLoading(false);
        });
    }, []);

    // Gestion du lancement et de la fermeture propre
    useEffect(() => {
        if (selectedLevel && boxRef.current) {
            // Callback sécurisée
            const handleExitGame = () => {
                if(engineRef.current) {
                    engineRef.current.destroy();
                    engineRef.current = null;
                }
                // Force le retour au dashboard
                setSelectedLevel(null);
            };

            engineRef.current = initZombieGame(
                boxRef.current, 
                { level: selectedLevel, user }, 
                handleExitGame
            );
        }

        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
                engineRef.current = null;
            }
        };
    }, [selectedLevel]);

    if (loading) return <div className="fixed inset-0 bg-slate-900 flex items-center justify-center text-white font-bold">Chargement...</div>;

    // --- DASHBOARD ---
    if (!selectedLevel) {
        return (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur z-50 flex items-center justify-center p-4">
                <div className="z-dashboard-container animate-in zoom-in">
                    <div className="z-dash-header">
                        <h1 className="z-dash-title">ZOMBIE GRAMMAR</h1>
                        <p className="z-dash-subtitle">Choisis ta mission, {user.firstName}</p>
                    </div>

                    {availableLevels.length > 0 ? (
                        <div className="z-levels-grid custom-scrollbar">
                            {availableLevels.map(lvl => (
                                <div key={lvl._id} className="z-level-card" onClick={() => setSelectedLevel(lvl)}>
                                    <span className="z-card-icon">🧟</span>
                                    <div className="z-card-title">{lvl.title}</div>
                                    <div className="z-card-info">{lvl.questions.length} Questions</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-500">Aucune mission pour {user.classroom}.</div>
                    )}

                    <button onClick={onClose} className="z-btn-back">RETOUR QG</button>
                </div>
            </div>
        );
    }

    // --- JEU ---
    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
            <div id="zombie-root" ref={boxRef}></div>
        </div>
    );
}