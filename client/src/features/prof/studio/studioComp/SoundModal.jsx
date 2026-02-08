// @signatures: SoundModal
import React, { useState, useRef, useEffect } from 'react';
import './SoundModal.css';

export default function SoundModal({ onSave, onClose }) {
    const [tab, setTab] = useState('upload'); // upload, mic, ai
    const [recording, setRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [timer, setTimer] = useState(0);
    const [loading, setLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioRef = useRef(new Audio());

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            clearInterval(timerRef.current);
        };
    }, []);

    // --- MICROPHONE LOGIC ---
    const toggleRecord = async () => {
        if (recording) {
            mediaRecorderRef.current.stop();
            setRecording(false);
            clearInterval(timerRef.current);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorderRef.current = new MediaRecorder(stream);
                const chunks = [];
                
                mediaRecorderRef.current.ondataavailable = e => chunks.push(e.data);
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(chunks, { type: 'audio/mp3' });
                    setAudioBlob(blob);
                    setAudioUrl(URL.createObjectURL(blob));
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current.start();
                setRecording(true);
                setTimer(0);
                timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
            } catch (e) {
                alert("Accès micro refusé ou impossible.");
            }
        }
    };

    // --- UPLOAD LOGIC ---
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAudioBlob(file);
            setAudioUrl(URL.createObjectURL(file));
        }
    };

    // --- AI LOGIC (Simulated for now) ---
    const handleAIGenerate = () => {
        if (!aiPrompt) return;
        setLoading(true);
        // Simulation d'appel API
        setTimeout(() => {
            setLoading(false);
            alert("Génération IA bientôt disponible ! (API Placeholder)");
        }, 1500);
    };

    // --- SAVE LOGIC ---
    const handleConfirm = async () => {
        if (!audioBlob) return;
        setLoading(true);
        
        const fd = new FormData();
        // On donne un nom générique ou celui du fichier
        const filename = audioBlob.name || `sound_rec_${Date.now()}.mp3`;
        fd.append('file', audioBlob, filename);

        try {
            const res = await fetch('/api/studio/upload-asset', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (data.url) {
                onSave(data.url, filename);
                onClose();
            }
        } catch (e) {
            alert("Erreur upload son.");
        }
        setLoading(false);
    };

    const playPreview = () => {
        if (audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.play();
        }
    };

    const formatTime = (s) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className="sound-modal-overlay" onClick={onClose}>
            <div className="sound-window" onClick={e => e.stopPropagation()}>
                <div className="sound-header">
                    <div className="sound-title">🎵 Ajouter un Son</div>
                    <button className="sound-close" onClick={onClose}>✕</button>
                </div>

                <div className="sound-tabs">
                    <button className={`sound-tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>Import</button>
                    <button className={`sound-tab-btn ${tab === 'mic' ? 'active' : ''}`} onClick={() => setTab('mic')}>Micro</button>
                    <button className={`sound-tab-btn ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>IA Générative</button>
                </div>

                <div className="sound-body">
                    {tab === 'upload' && (
                        <>
                            <input type="file" ref={fileInputRef} hidden accept="audio/*" onChange={handleFileSelect} />
                            <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
                                <span style={{fontSize:'2rem'}}>📂</span>
                                <span className="text-xs font-bold uppercase mt-2">Cliquez pour choisir un MP3/WAV</span>
                            </div>
                        </>
                    )}

                    {tab === 'mic' && (
                        <>
                            <div className={`mic-circle ${recording ? 'recording' : ''}`} onClick={toggleRecord}>
                                {recording ? '⏹' : '🎤'}
                            </div>
                            <div className="mic-timer">{formatTime(timer)}</div>
                            <div className="text-xs text-slate-400 font-bold uppercase">{recording ? "Enregistrement..." : "Appuyez pour enregistrer"}</div>
                        </>
                    )}

                    {tab === 'ai' && (
                        <>
                            <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                                <span className="text-2xl">🤖</span>
                                <p className="text-[10px] font-bold text-purple-600 mt-2 uppercase">Décrivez le son (ex: Explosion laser rétro)</p>
                            </div>
                            <div className="ai-input-group">
                                <input className="ai-input" placeholder="Description..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                                <button className="ai-btn" onClick={handleAIGenerate}>GO</button>
                            </div>
                        </>
                    )}

                    {audioUrl && (
                        <div className="sound-preview animate-in fade-in">
                            <button className="preview-play" onClick={playPreview}>▶</button>
                            <div className="flex-1">
                                <div className="text-[10px] font-black text-slate-500 uppercase mb-1">Aperçu</div>
                                <div className="preview-wave">
                                    <div className="preview-wave-fill" style={{animationDuration: '2s'}}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t bg-slate-50">
                    <button className="btn-confirm-sound" onClick={handleConfirm} disabled={!audioBlob || loading}>
                        {loading ? 'SAUVEGARDE...' : 'AJOUTER CE SON'}
                    </button>
                </div>
            </div>
        </div>
    );
}
