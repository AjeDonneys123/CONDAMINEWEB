// @signatures: GameEngine, handleStartGame, logSonde
import React, { useState, useRef, useEffect } from 'react';
import SoundExpert from './SoundExpert';

/**
 * 🔊 MOTEUR "OPÉRATION SON" (V730)
 * Zéro blocage. Affichage immédiat. Focus unique sur l'audio.
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

    // CHARGEMENT FLASH DES SONS
    useEffect(() => {
        logSonde("🛠️ Warmup Audio...");
        if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        const scene = project.scenes?.[activeSceneIdx];
        const sndUrls = [...new Set((scene?.globalSounds || []).flatMap(gs => (gs.sounds || []).map(s => s.url)))];

        sndUrls.forEach(url => {
            logSonde(`📡 Téléchargement: ${url.split('/').pop()}`);
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

    const handleStartGame = async () => {
        if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
        
        try {
            const ctx = canvasRef.current.getContext('2d');
            // CODE INJECTÉ MINIMALISTE
            const Factory = new Function('params', `
                const { audioBuffers, audioCtx, logSonde, project, sceneIdx } = params;
                return class {
                    start() {
                        logSonde("🎬 Script démarré");
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
                            } else { logSonde("🚫 Buffer vide", "error"); }
                        } else { logSonde("❓ Pas de son DÉPART", "error"); }
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
            setEngineStarted(true);
        } catch(e) { logSonde("💥 Crash: " + e.message, "error"); }
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-900 flex flex-col items-center justify-center">
            {/* SONDE VISUELLE GÉANTE */}
            <div className="absolute top-0 left-0 right-0 p-8 flex flex-col gap-2 pointer-events-none">
                {debugLogs.map(log => (
                    <div key={log.id} className={`p-4 rounded-xl font-black text-lg shadow-2xl ${log.type === 'error' ? 'bg-red-600 text-white' : log.type === 'success' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black'}`}>
                        {log.text}
                    </div>
                ))}
            </div>

            {!engineStarted ? (
                <button onClick={handleStartGame} className="px-20 py-10 bg-white text-indigo-600 rounded-full font-black text-6xl shadow-2xl border-8 border-indigo-500 hover:scale-110 transition-transform">
                    🔊 TESTER SON
                </button>
            ) : (
                <div className="text-center">
                    <h2 className="text-white text-4xl font-black mb-8 animate-pulse">SON EN COURS...</h2>
                    <canvas ref={canvasRef} width={400} height={200} className="bg-black border-4 border-white rounded-2xl" />
                    <button onClick={handleStartGame} className="mt-8 px-10 py-4 bg-indigo-500 text-white font-black rounded-xl">REJOUER SON</button>
                </div>
            )}

            <button onClick={onStop} className="absolute bottom-10 bg-red-600 text-white px-10 py-5 rounded-full font-black text-2xl">QUITTER</button>
        </div>
    );
}
