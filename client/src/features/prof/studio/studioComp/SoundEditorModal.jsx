// @signatures: SoundEditorModal, drawWaveform, playSound
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';
import './SoundEditorModal.css';

export default function SoundEditorModal({ soundUrl, soundName, onSave, onClose, resolveUrl }) {
    const [buffer, setBuffer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [name, setName] = useState(soundName || "Son");
    const [trimStart, setTrimStart] = useState(0); 
    const [trimEnd, setTrimEnd] = useState(1);     
    const [history, setHistory] = useState([]);    
    const [isProcessing, setIsProcessing] = useState(true);
    
    const [debugInfo, setDebugInfo] = useState("Initialisation...");

    const canvasRef = useRef(null);
    const sourceRef = useRef(null);
    const audioCtxRef = useRef(null);

    // 1. CHARGEMENT
    useEffect(() => {
        async function load() {
            if (!soundUrl) {
                setDebugInfo("Erreur: URL manquante");
                setIsProcessing(false);
                return;
            }
            
            const fullUrl = resolveUrl(soundUrl);
            setDebugInfo(`Chargement de: ${fullUrl.slice(-20)}...`);

            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            const result = await SoundExpert.decodeAudio(fullUrl, audioCtxRef.current);
            
            if (result) {
                setBuffer(result);
                setHistory([result]);
                setDebugInfo(`AUDIO OK: ${result.duration.toFixed(2)}s`);
            } else {
                setDebugInfo("ÉCHEC: Buffer vide ou format invalide.");
            }
            setIsProcessing(false);
        }
        load();
        return () => { if(sourceRef.current) sourceRef.current.stop(); };
    }, [soundUrl]);

    // 2. OBSERVATEUR DE TAILLE (FIX VAGUE INVISIBLE)
    useEffect(() => {
        if (!canvasRef.current || !buffer) return;

        // On redessine dès que la taille change (ex: fin d'animation d'ouverture)
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(drawWaveform);
        });
        
        resizeObserver.observe(canvasRef.current);
        
        // Premier dessin forcé
        drawWaveform();

        return () => resizeObserver.disconnect();
    }, [buffer, trimStart, trimEnd]);

    const drawWaveform = () => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer) return;

        // 1. Récupérer la taille réelle du conteneur
        // On remonte au parent si le canvas est écrasé à 0
        const parent = canvas.parentElement;
        const width = parent.clientWidth || 600;
        const height = parent.clientHeight || 200;

        if (width === 0 || height === 0) return;

        // 2. Adapter la résolution (High DPI)
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        // Pour le CSS (taille affichée)
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // 3. DESSIN
        ctx.fillStyle = '#fdf4ff'; 
        ctx.fillRect(0, 0, width, height);

        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#7e22ce'; // Violet foncé (haute visibilité)
        ctx.beginPath();
        
        let hasSignal = false;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const idx = (i * step) + j;
                if (idx < data.length) {
                    const datum = data[idx];
                    if (datum !== 0) hasSignal = true;
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }
            const y = (1 + min) * amp;
            const h = Math.max(1, (max - min) * amp);
            ctx.fillRect(i, y, 1, h);
        }

        // --- INFO DEBUG SUR L'ÉCRAN ---
        if (!hasSignal) setDebugInfo("⚠️ SILENCE DÉTECTÉ (Amplitude 0)");
        else setDebugInfo(`🎨 DESSINÉ: ${width}x${height}px`);

        // Trim Zones
        const x1 = trimStart * width;
        const x2 = trimEnd * width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(0, 0, x1, height);
        ctx.fillRect(x2, 0, width - x2, height);
        
        // Trim Lines
        ctx.fillStyle = '#ef4444'; // Rouge pour bien voir les barres
        ctx.fillRect(x1, 0, 2, height);
        ctx.fillRect(x2 - 2, 0, 2, height);
    };

    const playSound = async () => {
        if (isPlaying) {
            if (sourceRef.current) sourceRef.current.stop();
            setIsPlaying(false);
            return;
        }
        if (!buffer || !audioCtxRef.current) return;

        if (audioCtxRef.current.state === 'suspended') {
            await audioCtxRef.current.resume();
        }
        
        const source = audioCtxRef.current.createBufferSource();
        const startSec = trimStart * buffer.duration;
        const duration = (trimEnd - trimStart) * buffer.duration;

        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        source.start(0, startSec, duration);
        sourceRef.current = source;
        setIsPlaying(true);
        source.onended = () => setIsPlaying(false);
    };

    const applyEffect = (effectName) => {
        if (!buffer) return;
        setIsProcessing(true);
        setTimeout(() => {
            let newBuff = buffer;
            if (SoundExpert[effectName.toLowerCase()] || effectName === 'TRIM' || effectName === 'FASTER' || effectName === 'SLOWER' || effectName === 'LOUDER' || effectName === 'SOFTER') {
                 if (effectName === 'TRIM') newBuff = SoundExpert.trim(buffer, trimStart, trimEnd);
                 else if (effectName === 'FASTER') newBuff = SoundExpert.changeSpeed(buffer, 1.25);
                 else if (effectName === 'SLOWER') newBuff = SoundExpert.changeSpeed(buffer, 0.8);
                 else if (effectName === 'LOUDER') newBuff = SoundExpert.applyGain(buffer, 1.25);
                 else if (effectName === 'SOFTER') newBuff = SoundExpert.applyGain(buffer, 0.75);
                 else if (effectName === 'REVERSE') newBuff = SoundExpert.reverse(buffer);
                 else if (effectName === 'ROBOT') newBuff = SoundExpert.robotize(buffer);
                 
                 setHistory(prev => [...prev.slice(-10), newBuff]);
                 setBuffer(newBuff);
                 if (effectName === 'TRIM') { setTrimStart(0); setTrimEnd(1); }
            }
            setIsProcessing(false);
        }, 50);
    };

    const handleSaveInternal = () => {
        if (!buffer) return;
        setIsProcessing(true);
        const wavBlob = SoundExpert.bufferToWav(buffer);
        if (!wavBlob) {
            alert("Erreur export WAV");
            setIsProcessing(false);
            return;
        }

        const fd = new FormData();
        const finalName = name.endsWith('.wav') ? name : `${name}.wav`;
        fd.append('file', wavBlob, finalName);
        fetch('/api/studio/upload-asset', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => { if (data.url) onSave(data.url, finalName); onClose(); })
            .finally(() => setIsProcessing(false));
    };

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        if (Math.abs(x - trimStart) < Math.abs(x - trimEnd)) setTrimStart(Math.max(0, Math.min(x, trimEnd - 0.05)));
        else setTrimEnd(Math.min(1, Math.max(x, trimStart + 0.05)));
    };

    const handleUndo = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            setHistory(newHistory);
            setBuffer(newHistory[newHistory.length - 1]);
            setTrimStart(0);
            setTrimEnd(1);
        }
    };

    return (
        <div className="se-modal-overlay">
            <div className="se-window animate-in zoom-in">
                {isProcessing && (
                    <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center flex-col">
                        <div className="text-4xl animate-spin">⚙️</div>
                        <span className="font-black text-purple-600 mt-2 uppercase">Traitement...</span>
                    </div>
                )}
                
                <div className="se-header">
                    <input className="se-title-input" value={name} onChange={e => setName(e.target.value)} />
                    <div className="se-header-actions">
                        <button className="se-btn-main btn-undo" onClick={handleUndo} disabled={history.length <= 1}>↩ Undo</button>
                        <button className="se-btn-main btn-save" onClick={handleSaveInternal}>💾 Sauver</button>
                        <button className="se-btn-main btn-close" onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className="se-wave-area relative">
                    <canvas ref={canvasRef} className="se-canvas" onMouseDown={handleMouseDown} />
                    
                    <div className="absolute top-2 left-2 bg-slate-900/80 text-white p-2 rounded text-[10px] font-mono pointer-events-none z-50">
                        <strong>DIAGNOSTIC:</strong><br/>
                        {debugInfo}
                    </div>

                    <div className="se-trim-handle handle-left" style={{ left: `calc(${trimStart * 100}% - 20px)` }}>▎</div>
                    <div className="se-trim-handle handle-right" style={{ left: `${trimEnd * 100}%` }}>▎</div>
                </div>

                <div className="se-toolbar">
                    <button className={`se-play-big ${isPlaying ? 'playing' : ''}`} onClick={playSound}>{isPlaying ? '⏹' : '▶'}</button>
                    <div className="w-px h-10 bg-slate-200 mx-2"></div>
                    {(trimStart > 0 || trimEnd < 1) && (
                        <button className="se-tool-btn" onClick={() => applyEffect('TRIM')}><div className="se-tool-icon text-red-500 border-red-200">✂️</div><span className="se-tool-label text-red-500">Couper</span></button>
                    )}
                    <button className="se-tool-btn" onClick={() => applyEffect('FASTER')}><div className="se-tool-icon">🐇</div><span className="se-tool-label">Vite</span></button>
                    <button className="se-tool-btn" onClick={() => applyEffect('SLOWER')}><div className="se-tool-icon">🐢</div><span className="se-tool-label">Lent</span></button>
                    <button className="se-tool-btn" onClick={() => applyEffect('LOUDER')}><div className="se-tool-icon">🔊</div><span className="se-tool-label">Fort</span></button>
                    <button className="se-tool-btn" onClick={() => applyEffect('SOFTER')}><div className="se-tool-icon">🔉</div><span className="se-tool-label">Doux</span></button>
                    <button className="se-tool-btn" onClick={() => applyEffect('REVERSE')}><div className="se-tool-icon">↩️</div><span className="se-tool-label">Envers</span></button>
                    <button className="se-tool-btn" onClick={() => applyEffect('ROBOT')}><div className="se-tool-icon">🤖</div><span className="se-tool-label">Robot</span></button>
                </div>
            </div>
        </div>
    );
}
