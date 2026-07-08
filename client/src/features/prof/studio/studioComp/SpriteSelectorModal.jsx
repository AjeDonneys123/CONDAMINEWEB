import React, { useEffect, useRef, useState } from 'react';

export default function SpriteSelectorModal({ initialImageUrl = '', resolveUrl, onCancel, onApply }) {
    const canvasRef = useRef(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const [sourceUrl, setSourceUrl] = useState(initialImageUrl || '');
    const [selections, setSelections] = useState([]);
    const [draftSelection, setDraftSelection] = useState(null);
    const [error, setError] = useState('');

    const draw = () => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        selections.forEach((box, index) => {
            ctx.fillStyle = 'rgba(79, 70, 229, 0.14)';
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = Math.max(2, canvas.width / 350);
            ctx.fillRect(box.x, box.y, box.w, box.h);
            ctx.strokeRect(box.x, box.y, box.w, box.h);
            ctx.fillStyle = '#4f46e5';
            ctx.font = `bold ${Math.max(13, canvas.width / 35)}px sans-serif`;
            ctx.fillText(String(index + 1), box.x + 6, box.y + 18);
        });
        if (draftSelection) {
            ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = Math.max(2, canvas.width / 350);
            ctx.setLineDash([10, 7]);
            ctx.fillRect(draftSelection.x, draftSelection.y, draftSelection.w, draftSelection.h);
            ctx.strokeRect(draftSelection.x, draftSelection.y, draftSelection.w, draftSelection.h);
            ctx.setLineDash([]);
        }
    };

    useEffect(draw, [selections, draftSelection]);

    useEffect(() => {
        if (!sourceUrl) return;
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            imageRef.current = image;
            const maxWidth = 900;
            const maxHeight = 520;
            const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
            const canvas = canvasRef.current;
            canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
            setSelections([]);
            setDraftSelection(null);
            setError('');
            requestAnimationFrame(draw);
        };
        image.onerror = () => setError("Impossible de charger cette image.");
        image.src = resolveUrl ? resolveUrl(sourceUrl) : sourceUrl;
    }, [sourceUrl]);

    const pointFromEvent = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
            y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height))
        };
    };

    const handlePointerDown = (event) => {
        if (!imageRef.current) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const point = pointFromEvent(event);
        dragRef.current = point;
        setDraftSelection({ x: point.x, y: point.y, w: 0, h: 0 });
    };

    const handlePointerMove = (event) => {
        if (!dragRef.current) return;
        const start = dragRef.current;
        const end = pointFromEvent(event);
        setDraftSelection({
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y)
        });
    };

    const handlePointerUp = (event) => {
        if (!dragRef.current) return;
        const start = dragRef.current;
        const end = pointFromEvent(event);
        dragRef.current = null;
        setDraftSelection(null);
        const box = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y)
        };
        if (box.w < 8 || box.h < 8) return;
        setSelections((current) => [...current, box]);
    };

    const handlePointerCancel = () => {
        dragRef.current = null;
        setDraftSelection(null);
    };

    const handleFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setSourceUrl(String(reader.result || ''));
        reader.readAsDataURL(file);
    };

    const applySelections = () => {
        const sourceCanvas = canvasRef.current;
        const sourceImage = imageRef.current;
        if (!sourceCanvas || !sourceImage || selections.length === 0) return;
        try {
            const frames = selections.map((box, index) => {
                const scaleX = sourceImage.naturalWidth / sourceCanvas.width;
                const scaleY = sourceImage.naturalHeight / sourceCanvas.height;
                const sourceBox = {
                    x: box.x * scaleX,
                    y: box.y * scaleY,
                    w: box.w * scaleX,
                    h: box.h * scaleY
                };
                const output = document.createElement('canvas');
                output.width = Math.max(1, Math.round(sourceBox.w));
                output.height = Math.max(1, Math.round(sourceBox.h));
                output.getContext('2d').drawImage(
                    sourceImage,
                    sourceBox.x, sourceBox.y, sourceBox.w, sourceBox.h,
                    0, 0, output.width, output.height
                );
                return { url: output.toDataURL('image/png'), name: `sprite-${Date.now()}-${index + 1}.png`, type: 'image' };
            });
            onApply(frames);
        } catch (e) {
            setError("Découpage impossible. Charge l'image depuis ton ordinateur.");
        }
    };

    return (
        <div className="sprite-selector-backdrop" role="dialog" aria-modal="true" aria-label="Sélectionner des sprites">
            <div className="sprite-selector-modal">
                <div className="sprite-selector-head">
                    <div>
                        <strong>SÉLECTIONNER LES SPRITES</strong>
                        <span>Trace un cadre autour de chaque sprite à ajouter.</span>
                    </div>
                    <button type="button" onClick={onCancel}>×</button>
                </div>
                <div className="sprite-selector-tools">
                    <label>
                        📂 CHARGER UNE PLANCHE
                        <input type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
                    </label>
                    <button type="button" onClick={() => setSelections((current) => current.slice(0, -1))} disabled={selections.length === 0}>ANNULER LE DERNIER</button>
                    <button type="button" onClick={() => setSelections([])} disabled={selections.length === 0}>EFFACER LES CADRES</button>
                    <span>{selections.length} sprite{selections.length > 1 ? 's' : ''}</span>
                </div>
                <div className="sprite-selector-workspace">
                    {!sourceUrl && <div className="sprite-selector-empty">Charge une image contenant tes sprites.</div>}
                    <canvas
                        ref={canvasRef}
                        className={sourceUrl ? '' : 'hidden'}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                    />
                </div>
                {error && <div className="sprite-selector-error">{error}</div>}
                <div className="sprite-selector-footer">
                    <button type="button" onClick={onCancel}>FERMER</button>
                    <button type="button" className="primary" onClick={applySelections} disabled={selections.length === 0}>
                        AJOUTER {selections.length || ''} SPRITE{selections.length > 1 ? 'S' : ''} À L’ACTION
                    </button>
                </div>
            </div>
        </div>
    );
}
