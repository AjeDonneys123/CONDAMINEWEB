// @signatures: ManualEraser, saveState, undo, startDrawing, stopDrawing, erase, handleSave
import React, { useState, useRef, useEffect } from 'react';
import './ManualEraser.css';

/**
 * 🧹 COMPOSANT GOMME MANUELLE (V460 - CTRL+Z READY)
 * RÔLE : Nettoyage précis avec historique de retour arrière.
 */
export default function ManualEraser({ imageUrl, initialSize, onSave, onCancel, resolveUrl }) {
    const canvasRef = useRef(null);
    const [size, setSize] = useState(initialSize || 10);
    const [isDrawing, setIsDrawing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // --- GESTION DE L'HISTORIQUE (UNDO) ---
    const [history, setHistory] = useState([]);

    // Initialisation du canvas et premier snapshot
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            // On capture l'état initial
            saveState();
        };
        img.src = resolveUrl(imageUrl);
    }, [imageUrl]);

    // Écouteur pour le CTRL+Z
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history]); // On ré-écoute quand l'historique change

    const saveState = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // On stocke l'image brute du canvas (ImageData est trop lourd pour le state, on utilise DataURL ou ImageBitmap)
        // Ici on utilise getImageData pour la fidélité, mais on limite l'historique
        const ctx = canvas.getContext('2d');
        const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev.slice(-20), snapshot]); // Garde les 20 derniers coups
    };

    const undo = () => {
        if (history.length <= 1) return; // Rien à annuler (ou état initial)
        
        const newHistory = [...history];
        newHistory.pop(); // On enlève l'état actuel
        const previousState = newHistory[newHistory.length - 1];
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(previousState, 0, 0);
        
        setHistory(newHistory);
    };

    const startDrawing = (e) => { 
        setIsDrawing(true); 
        erase(e); 
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            saveState(); // On enregistre après chaque trait
        }
    };

    const erase = (e) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    };

    const handleInternalSave = () => {
        setLoading(true);
        canvasRef.current.toBlob(async (blob) => {
            const fd = new FormData();
            fd.append('file', blob, "manual-eraser-edit.png");
            try {
                const res = await fetch('/api/studio/save-edition', { method: 'POST', body: fd }).then(r => r.json());
                onSave(res.url);
            } catch (e) { alert("Erreur sauvegarde."); }
            setLoading(false);
        }, 'image/png');
    };

    return (
        <div className="eraser-modal-overlay" onMouseUp={stopDrawing}>
            <div className="eraser-window animate-in zoom-in" onClick={e => e.stopPropagation()}>
                <div className="eraser-header">
                    <div className="flex flex-col">
                        <h2 className="text-white font-black text-2xl uppercase tracking-tighter">Atelier de Précision</h2>
                        <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">Utilisez CTRL+Z pour annuler</span>
                    </div>
                    <div className="eraser-actions">
                        <button onClick={onCancel} className="btn-eraser-cancel">QUITTER</button>
                        <button onClick={handleInternalSave} disabled={loading} className="btn-eraser-save">
                            {loading ? "TRAITEMENT..." : "APPLIQUER ✨"}
                        </button>
                    </div>
                </div>

                <div className="eraser-canvas-container" onMouseDown={startDrawing} onMouseMove={erase}>
                    <canvas ref={canvasRef} />
                </div>

                <div className="eraser-footer">
                    <div className="flex gap-4">
                        <div className="eraser-size-widget">
                            <span className="text-[10px] font-black text-slate-500 uppercase mr-4">Gomme</span>
                            <button onClick={() => setSize(Math.max(1, size - 2))} className="btn-eraser-size">-</button>
                            <div className="eraser-size-display">{size}</div>
                            <button onClick={() => setSize(Math.min(100, size + 2))} className="btn-eraser-size">+</button>
                        </div>
                        
                        {/* BOUTON UNDO VISUEL */}
                        <button 
                            onClick={undo} 
                            disabled={history.length <= 1}
                            className={`px-6 rounded-2xl font-black text-xs transition-all ${history.length <= 1 ? 'bg-slate-800 text-slate-600 opacity-50' : 'bg-indigo-600 text-white shadow-lg hover:scale-105'}`}
                        >
                            ↩️ ANNULER (CTRL+Z)
                        </button>
                    </div>
                    
                    <p className="text-slate-500 text-sm font-bold italic hidden md:block">
                        L'historique garde vos 20 derniers mouvements.
                    </p>
                </div>
            </div>
        </div>
    );
}
