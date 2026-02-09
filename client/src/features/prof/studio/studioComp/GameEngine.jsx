// @signatures: GameEngine, handleStartGame, logSonde
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';

/**
 * 🔊 MOTEUR "OPÉRATION SON" (V740)
 * FIX : "Cannot read properties of null (reading 'getContext')"
 * Focus : Déclenchement Audio DÉPART.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    const canvasRef = useRef(null);
    const [engineStarted, setEngineStarted] = useState(false);
    const [debugLogs, setDebugLogs] = useState([]);
    const audioCtxRef = useRef(null);
    const audioBuffersRef = useRef(new Map());

    const logSonde = (msg, type = 'info') => {
        const id = Math.random();
        setDebugLogs(prev => [...prev, { id, text: msg, type }].slice(-10));
    };

    // 1. WARMUP AUDIO (Dès le montage)
    useEffect(() => {
        logSonde("🛠️ Warmup Audio...");
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const scene = project.scenes?.[activeSceneIdx];
        const sndUrls = [...new Set((scene?.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url)))];

        sndUrls.forEach(url => {
            logSonde(`📡 Chargement: ${url.split('/').pop()}`);
            SoundExpert.decodeAudio(resolveUrl(url), audioCtxRef.current).then(buf => {
                if (buf) {
                    audioBuffersRef.current.set(url, buf);
                    logSonde("✅ SON DÉCODÉ !", "success");
                } else {
                    logSonde("❌ ÉCHEC DÉCODAGE", "error");
                }
            });
        });
    }, [project]);

    // 2. INITIALISATION DU SCRIPT (Une fois que le canvas est monté)
    useEffect(() => {
        if (engineStarted && canvasRef.current) {
            try {
                logSonde("🎬 Initialisation Script...");
                const ctx = canvasRef.current.getContext('2d');
                
                const Factory = new Function('params', `
                    const { audioBuffers, audioCtx, logSonde, project, sceneIdx } = params;
                    return class {
                        start() {
                            logSonde("🚀 Script démarré");
                            this.play();
                        }
                        play() {
                            logSonde("🔊 Tentative lecture...");
                            const gs = project.scenes[sceneIdx].globalSounds?.find(s => s.name === "DÉPART");
                            if(gs && gs.sounds[0]) {
                                const buffer = audioBuffers.get(gs.sounds[0].url);
                                if(buffer) {
                                    const src = audioCtx.createBufferSource();
                                    src.buffer = buffer; src.connect(audioCtx.destination); src.start(0);
                                    logSonde("🎵 !!! SON SORTI !!!", "success");
                                } else { logSmeta("🚫 Buffer manquant", "error"); }
                            } else { logSonde("❓ Pas de son dans DÉPART", "error"); }
                        }
                    }
                `);

                const GameClass = Factory({ 
                    audioBuffers: audioBuffersRef.current, 
                    audioCtx: audioCtxRef.current, 
                    logSonde, project, sceneIdx: activeSceneIdx 
                });

                const instance = new GameClass();
                instance.start();
            } catch (e) {
                logSonde("💥 Crash Script: " + e.message, "error");
            }
        }
    }, [engineStarted]);

    const handleStartGame = async () => {
        if (audioCtxRef.current?.state === 'suspended') {
            await audioCtxRef.current.resume();
        }
        setEngineStarted(true);
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center">
            {/* HUD DE DEBUG */}
            <div className="absolute top-0 left-0 right-0 p-8 flex flex-col gap-2 pointer-events-none">
                {debugLogs.map(log => (
                    <div key={log.id} className={`p-4 rounded-xl font-black text-lg shadow-2xl border-l-8 ${log.type === 'error' ? 'bg-red-600 text-white border-red-900' : log.type === 'success' ? 'bg-green-500 text-white border-green-900' : 'bg-yellow-400 text-black border-yellow-600'}`}>
                        {log.text}
                    </div>
                ))}
            </div>

            {!engineStarted ? (
                <button onClick={handleStartGame} className="px-20 py-10 bg-white text-indigo-600 rounded-full font-black text-6xl shadow-2xl border-8 border-indigo-500 hover:scale-110 transition-transform active:scale-95">
                    🔊 DÉMARRER LE TEST
                </button>
            ) : (
                <div className="flex flex-col items-center gap-8">
                    <h2 className="text-white text-4xl font-black animate-pulse">AUDIO ACTIF</h2>
                    <canvas 
                        ref={canvasRef} 
                        width={400} 
                        height={200} 
                        className="bg-black border-4 border-slate-700 rounded-3xl shadow-2xl" 
                    />
                    <button 
                        onClick={() => setEngineStarted(false)} 
                        className="px-8 py-4 bg-slate-800 text-white font-bold rounded-xl border border-slate-600"
                    >
                        🔄 RÉINITIALISER
                    </button>
                </div>
            )}

            <button 
                onClick={onStop} 
                className="absolute bottom-10 bg-red-600 text-white px-10 py-5 rounded-full font-black text-2xl shadow-xl hover:bg-red-700"
            >
                FERMER L'USINE
            </button>
        </div>
    );
}
