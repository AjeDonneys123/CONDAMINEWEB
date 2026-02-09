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
            setDebugInfo(`Chargement...`);

            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }

            const result = await SoundExpert.decodeAudio(fullUrl, audioCtxRef.current);
            
            if (result) {
                setBuffer(result);
                setHistory([result]);
                setDebugInfo(`AUDIO OK: ${result.duration.toFixed(2)}s`);
            } else {
                setDebugInfo("ÉCHEC: Fichier invalide.");
            }
            setIsProcessing(false);
        }
        load();
        return () => { if(sourceRef.current) try{sourceRef.current.stop()}catch(e){} };
    }, [soundUrl]);

    // 2. DESSIN OPTIMISÉ (TURBO WAVE)
    useEffect(() => {
        if (!canvasRef.current || !buffer) return;
        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(drawWaveform));
        resizeObserver.observe(canvasRef.current);
        drawWaveform();
        return () => resizeObserver.disconnect();
    }, [buffer, trimStart, trimEnd]);

    const drawWaveform = () => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0) return;

        // Configuration
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const width = rect.width;
        const height = rect.height;
        
        // Fond
        ctx.fillStyle = '#fdf4ff'; 
        ctx.fillRect(0, 0, width, height);

        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#a855f7'; // Violet
        
        // 🚀 OPTIMISATION MAJEURE : SKIP STEP
        // Au lieu de lire tous les points, on saute des échantillons pour aller plus vite.
        // Plus le fichier est long, plus on saute.
        const skip = Math.max(1, Math.floor(step / 10)); 

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            // Boucle interne optimisée
            for (let j = 0; j < step; j += skip) {
                const idx = (i * step) + j;
                if (idx < data.length) {
                    const datum = data[idx];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
            }
            
            // Dessin
            const y = (1 + min) * amp;
            const h = Math.max(1, (max - min) * amp);
            ctx.fillRect(i, y, 1, h);
        }

        // Zones Trim
        const x1 = trimStart * width;
        const x2 = trimEnd * width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(0, 0, x1, height);
        ctx.fillRect(x2, 0, width - x2, height);
        
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x1, 0, 2, height);
        ctx.fillRect(x2 - 2, 0, 2, height);
    };

    const playSound = () => {
        // STOP
        if (isPlaying) {
            if (sourceRef.current) try { sourceRef.current.stop(); } catch(e){}
            setIsPlaying(false);
            return;
        }

        // PLAY
        if (!buffer || !audioCtxRef.current) return;

        // 🚀 NON-BLOQUANT : On demande le resume mais on n'attend pas (Fire & Forget)
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        
        const source = audioCtxRef.current.createBufferSource();
        const startSec = trimStart * buffer.duration;
        const duration = (trimEnd - trimStart) * buffer.duration;

        source.buffer = buffer;
        source.connect(audioCtxRef.current.destination);
        
        // Démarrage immédiat
        source.start(0, startSec, duration);
        
        sourceRef.current = source;
        setIsPlaying(true);
        source.onended = () => setIsPlaying(false);
    };

    const applyEffect = (effectName) => {
        if (!buffer) return;
        setIsProcessing(true);
        // Timeout pour laisser l'UI afficher le loader avant de geler le thread
        setTimeout(() => {
            let newBuff = buffer;
            if (SoundExpert[effectName.toLowerCase()] || effectName === 'TRIM' || ['FASTER','SLOWER','LOUDER','SOFTER','REVERSE','ROBOT'].includes(effectName)) {
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
        const fd = new FormData();
        const finalName = name.endsWith('.wav') ? name : `${name}.wav`;
        fd.append('file', wavBlob, finalName);

        fetch('/api/studio/upload-asset', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => { if (data.url) onSave(data.url, finalName); onClose(); })
            .catch(() => alert("Erreur sauvegarde"))
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
