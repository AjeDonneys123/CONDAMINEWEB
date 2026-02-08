// @signatures: SoundEditorModal, drawWaveform, handleTrim, applyEffect, playSound
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import './SoundEditorModal.css';

export default function SoundEditorModal({ soundUrl, soundName, onSave, onClose, resolveUrl }) {
    const [buffer, setBuffer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [name, setName] = useState(soundName || "Son");
    const [trimStart, setTrimStart] = useState(0); // 0.0 à 1.0
    const [trimEnd, setTrimEnd] = useState(1);     // 0.0 à 1.0
    const [history, setHistory] = useState([]);    // Pour Undo
    const [isProcessing, setIsProcessing] = useState(false);

    const canvasRef = useRef(null);
    const sourceRef = useRef(null);
    const audioCtxRef = useRef(null);

    // Initialisation
    useEffect(() => {
        async function load() {
            if (!soundUrl) return;
            const fullUrl = resolveUrl(soundUrl);
            const decoded = await SoundExpert.decodeAudio(fullUrl);
            setBuffer(decoded);
            setHistory([decoded]); // État initial
        }
        load();
        
        return () => stopSound();
    }, [soundUrl]);

    // Dessin de la Waveform
    useEffect(() => {
        if (!buffer || !canvasRef.current) return;
        drawWaveform();
    }, [buffer, trimStart, trimEnd]);

    const drawWaveform = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        
        ctx.fillStyle = '#fdf4ff'; // Fond rose pale
        ctx.fillRect(0, 0, width, height);

        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#a855f7'; // Onde violette
        ctx.beginPath();
        
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Zone de sélection (Trim)
        const x1 = trimStart * width;
        const x2 = trimEnd * width;
        
        // Zone grisée hors sélection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(0, 0, x1, height);
        ctx.fillRect(x2, 0, width - x2, height);

        // Lignes de coupe
        ctx.fillStyle = '#7e22ce';
        ctx.fillRect(x1, 0, 2, height);
        ctx.fillRect(x2 - 2, 0, 2, height);
    };

    const stopSound = () => {
        if (sourceRef.current) {
            sourceRef.current.stop();
            sourceRef.current = null;
        }
        setIsPlaying(false);
    };

    const playSound = () => {
        if (isPlaying) {
            stopSound();
            return;
        }
        if (!buffer) return;

        // Création du contexte si besoin
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const source = audioCtxRef.current.createBufferSource();
        // On joue la version "Trimée" (virtuellement)
        // Calcul du start/end en secondes
        const startSec = trimStart * buffer.duration;
        const endSec = trimEnd * buffer.duration;
        const duration = endSec - startSec;

        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        
        // play(when, offset, duration)
        source.start(0, startSec, duration);
        sourceRef.current = source;
        setIsPlaying(true);

        source.onended = () => setIsPlaying(false);
    };

    const pushToHistory = (newBuffer) => {
        setHistory(prev => [...prev.slice(-10), newBuffer]); // Max 10 undos
        setBuffer(newBuffer);
        // Reset Trim après un effet car la longueur peut changer
        setTrimStart(0);
        setTrimEnd(1);
    };

    const handleUndo = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop(); // Retire l'actuel
            setHistory(newHistory);
            setBuffer(newHistory[newHistory.length - 1]);
        }
    };

    // --- APPLICATION DES EFFETS ---
    const applyEffect = (effectName) => {
        if (!buffer) return;
        setIsProcessing(true);
        setTimeout(() => { // Timeout pour laisser l'UI afficher le loader si besoin
            let newBuff = buffer;
            
            switch (effectName) {
                case 'TRIM':
                    newBuff = SoundExpert.trim(buffer, trimStart, trimEnd);
                    break;
                case 'FASTER':
                    newBuff = SoundExpert.changeSpeed(buffer, 1.5);
                    break;
                case 'SLOWER':
                    newBuff = SoundExpert.changeSpeed(buffer, 0.75);
                    break;
                case 'LOUDER':
                    newBuff = SoundExpert.applyGain(buffer, 1.5);
                    break;
                case 'SOFTER':
                    newBuff = SoundExpert.applyGain(buffer, 0.5);
                    break;
                case 'REVERSE':
                    newBuff = SoundExpert.reverse(buffer);
                    break;
                case 'ROBOT':
                    newBuff = SoundExpert.robotize(buffer);
                    break;
                case 'FADEIN':
                    newBuff = SoundExpert.fade(buffer, 'in');
                    break;
                case 'FADEOUT':
                    newBuff = SoundExpert.fade(buffer, 'out');
                    break;
            }
            pushToHistory(newBuff);
            setIsProcessing(false);
        }, 10);
    };

    const handleSaveInternal = () => {
        if (!buffer) return;
        setIsProcessing(true);
        
        // 1. Conversion Buffer -> WAV Blob
        const wavBlob = SoundExpert.bufferToWav(buffer);
        
        // 2. Upload via l'API existante
        const fd = new FormData();
        // Ajouter .wav si le nom n'en a pas
        const finalName = name.endsWith('.wav') || name.endsWith('.mp3') ? name : `${name}.wav`;
        fd.append('file', wavBlob, finalName);

        // On utilise l'API upload-asset générique
        fetch('/api/studio/upload-asset', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                onSave(data.url, finalName); // Callback vers le parent
                onClose();
            })
            .catch(() => alert("Erreur sauvegarde"))
            .finally(() => setIsProcessing(false));
    };

    // Gestion Drag sur Canvas pour Trim
    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        // Si on clique plus près du début, on bouge le début, sinon la fin
        if (Math.abs(x - trimStart) < Math.abs(x - trimEnd)) {
            setTrimStart(Math.max(0, Math.min(x, trimEnd - 0.05)));
        } else {
            setTrimEnd(Math.min(1, Math.max(x, trimStart + 0.05)));
        }
    };

    return (
        <div className="se-modal-overlay">
            <div className="se-window animate-in zoom-in">
                {isProcessing && <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center font-black text-purple-600">TRAITEMENT...</div>}
                
                <div className="se-header">
                    <input className="se-title-input" value={name} onChange={e => setName(e.target.value)} />
                    <div className="se-header-actions">
                        <button className="se-btn-main btn-undo" onClick={handleUndo} disabled={history.length <= 1}>↩ Undo</button>
                        <button className="se-btn-main btn-save" onClick={handleSaveInternal}>💾 Sauver</button>
                        <button className="se-btn-main btn-close" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="se-wave-area">
                    <canvas ref={canvasRef} className="se-canvas" onMouseDown={handleMouseDown} />
                    
                    {/* Poignées visuelles (pour l'affichage seulement, la logique est dans le clic) */}
                    <div className="se-trim-handle handle-left" style={{ left: `calc(${trimStart * 100}% - 20px)` }}>▎</div>
                    <div className="se-trim-handle handle-right" style={{ left: `${trimEnd * 100}%` }}>▎</div>
                </div>

                <div className="se-toolbar">
                    <button className={`se-play-big ${isPlaying ? 'playing' : ''}`} onClick={playSound}>
                        {isPlaying ? '⏹' : '▶'}
                    </button>

                    <div className="w-px h-10 bg-slate-200 mx-2"></div>

                    {/* Si sélection active, afficher le bouton COUPER */}
                    {(trimStart > 0 || trimEnd < 1) && (
                        <button className="se-tool-btn" onClick={() => applyEffect('TRIM')}>
                            <div className="se-tool-icon text-red-500 border-red-200">✂️</div>
                            <span className="se-tool-label text-red-500">Couper</span>
                        </button>
                    )}

                    <button className="se-tool-btn" onClick={() => applyEffect('FASTER')}>
                        <div className="se-tool-icon">🐇</div>
                        <span className="se-tool-label">Vite</span>
                    </button>
                    <button className="se-tool-btn" onClick={() => applyEffect('SLOWER')}>
                        <div className="se-tool-icon">🐢</div>
                        <span className="se-tool-label">Lent</span>
                    </button>
                    <button className="se-tool-btn" onClick={() => applyEffect('LOUDER')}>
                        <div className="se-tool-icon">🔊</div>
                        <span className="se-tool-label">Fort</span>
                    </button>
                    <button className="se-tool-btn" onClick={() => applyEffect('SOFTER')}>
                        <div className="se-tool-icon">🔉</div>
                        <span className="se-tool-label">Doux</span>
                    </button>
                    <button className="se-tool-btn" onClick={() => applyEffect('REVERSE')}>
                        <div className="se-tool-icon">↩️</div>
                        <span className="se-tool-label">Envers</span>
                    </button>
                    <button className="se-tool-btn" onClick={() => applyEffect('ROBOT')}>
                        <div className="se-tool-icon">🤖</div>
                        <span className="se-tool-label">Robot</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
