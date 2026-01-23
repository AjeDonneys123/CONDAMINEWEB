import React from 'react';
import './BehaviorTimer.css';

export default function BehaviorTimer({ studentData }) {
    if (!studentData || !studentData.behaviorRecords) return null;

    // Récupération des données du prof (ou prend le dernier record actif)
    // Ici on suppose que le système gère un tableau, on prend celui qui a de l'activité
    const activeRecord = studentData.behaviorRecords.length > 0 
        ? studentData.behaviorRecords[studentData.behaviorRecords.length - 1] 
        : { crosses: 0, bonuses: 0, weeksToRedemption: 3 };

    // --- LOGIQUE CROIX ---
    const crosses = activeRecord.crosses || 0;
    const weeksLeft = activeRecord.weeksToRedemption || 3;
    const redemptionPct = (weeksLeft / 3) * 100;

    // --- LOGIQUE BONUS ---
    const totalBonuses = activeRecord.bonuses || 0;
    const currentCycleBonuses = totalBonuses % 4; // Combien de bonus dans le cycle actuel (0, 1, 2, 3)
    const bonusesNeeded = 4 - currentCycleBonuses;
    const totalAPlus = Math.floor(totalBonuses / 4); // Nombre de cycles A+ complétés
    const bonusPct = (currentCycleBonuses / 4) * 100;

    return (
        <div className="behavior-timer-wrapper">
            
            {/* 1. ZONE SANCTIONS (ROUGE) */}
            <div className="bt-section sanctions">
                <div className="bt-header-row">
                    <span className="bt-title red">
                        <span>⚠️</span> SANCTIONS EN COURS
                    </span>
                    <span className="text-[10px] font-black text-red-400">{crosses}/3 AVANT PUNITION</span>
                </div>

                {/* LIGNE DES CROIX VISUELLES */}
                <div className="bt-icons-container">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`bt-icon-slot ${i < crosses ? 'filled-cross' : ''}`}>
                            {i < crosses ? '❌' : ''}
                        </div>
                    ))}
                </div>

                {/* BARRE DE RACHAT (Si croix existantes) */}
                {crosses > 0 && (
                    <div className="bt-bar-container animate-in fade-in">
                        <div className="bt-label-mini">
                            <span>Temps avant annulation d'une croix</span>
                            <span>{weeksLeft} sem.</span>
                        </div>
                        <div className="bt-progress-track">
                            <div className="bt-progress-fill red" style={{ width: `${redemptionPct}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* 2. ZONE BONUS (VERT/OR) */}
            <div className="bt-section bonus">
                <div className="bt-header-row">
                    <span className="bt-title green">
                        <span>🏆</span> MÉRITES & EFFORTS
                    </span>
                    {totalAPlus > 0 && (
                        <div className="bt-aplus-badge">
                            {totalAPlus} x A+ OBTENUS 🌟
                        </div>
                    )}
                </div>

                {/* LIGNE DES BONUS VISUELS */}
                <div className="bt-icons-container">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className={`bt-icon-slot ${i < currentCycleBonuses ? 'filled-star' : ''}`}>
                            {i < currentCycleBonuses ? '⭐' : ''}
                        </div>
                    ))}
                </div>

                {/* BARRE VERS LE A+ */}
                <div className="bt-bar-container">
                    <div className="bt-label-mini">
                        <span style={{color: '#d97706'}}>Progression vers le prochain A+</span>
                        <span style={{color: '#d97706'}}>{bonusesNeeded} bonus restants</span>
                    </div>
                    <div className="bt-progress-track">
                        <div className="bt-progress-fill gold" style={{ width: `${bonusPct}%` }}></div>
                    </div>
                </div>
            </div>

        </div>
    );
}