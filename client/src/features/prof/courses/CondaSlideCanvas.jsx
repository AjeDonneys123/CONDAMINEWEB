import React, { useRef, useState, useEffect } from 'react';
import './CondaSlideViewer.css';

const GOOGLE_FONTS = [
    'Roboto', 'Inter', 'Montserrat', 'Playfair Display',
    'Oswald', 'Merriweather', 'Lora', 'Open Sans', 'Lato'
];

export default function CondaSlideCanvas({
    slide,
    isEditMode = false,
    selectedElementId = null,
    onSelectElement,
    onStartDrag,
    onTextChange,
    children
}) {
    const stageRef = useRef(null);
    const [stageWidth, setStageWidth] = useState(960);

    // Measure stage width to scale fonts proportionally
    useEffect(() => {
        if (!stageRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setStageWidth(entry.contentRect.width);
                }
            }
        });
        observer.observe(stageRef.current);
        return () => observer.disconnect();
    }, []);

    // Dynamically inject Google Fonts
    useEffect(() => {
        const id = 'conda-google-fonts-loader';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${GOOGLE_FONTS.map(f => f.replace(/\s+/g, '+')).join('&family=')}:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap`;
            document.head.appendChild(link);
        }
    }, []);

    const elements = Array.isArray(slide?.elements) ? slide.elements : [];
    const backgroundColor = slide?.background?.color || '#ffffff';
    // Reference 16:9 width is 960px. 1pt ~ 1.33px at 960px width
    const fontScale = stageWidth / 720;

    return (
        <div className="conda-slide-stage-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                ref={stageRef}
                className={`conda-slide-stage ${isEditMode ? 'is-edit-mode' : ''}`}
                style={{ backgroundColor }}
                onClick={(e) => {
                    if (isEditMode && e.target === stageRef.current) {
                        onSelectElement?.(null);
                    }
                }}
            >
                {elements.map((el) => {
                    const isSelected = selectedElementId === el.id;
                    const x = Number(el.x || 0);
                    const y = Number(el.y || 0);
                    const width = Number(el.width || 10);
                    const height = Number(el.height || 10);
                    const ptSize = Number(el.style?.fontSize || 18);
                    const fontSizePx = Math.max(9, Math.round(ptSize * fontScale));

                    return (
                        <div
                            key={el.id}
                            id={`conda-el-${el.id}`}
                            className={`conda-slide-element ${isEditMode ? 'is-edit-mode' : ''} ${isSelected ? 'is-selected' : ''}`}
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                                zIndex: el.zIndex || 1
                            }}
                            onMouseDown={(e) => {
                                if (!isEditMode) return;
                                e.stopPropagation();
                                onSelectElement?.(el.id);
                                if (el.type !== 'text' || selectedElementId !== el.id) {
                                    onStartDrag?.(e, el.id, 'move');
                                }
                            }}
                        >
                            {el.type === 'text' && (
                                <div
                                    className="conda-slide-text"
                                    contentEditable={isEditMode}
                                    suppressContentEditableWarning
                                    style={{
                                        fontFamily: el.style?.fontFamily ? `"${el.style.fontFamily}", sans-serif` : 'sans-serif',
                                        fontSize: `${fontSizePx}px`,
                                        color: el.style?.color || '#1e293b',
                                        fontWeight: el.style?.bold ? 800 : 400,
                                        fontStyle: el.style?.italic ? 'italic' : 'normal',
                                        textDecoration: el.style?.underline ? 'underline' : 'none',
                                        textAlign: el.style?.align || 'left',
                                        backgroundColor: el.style?.backgroundColor || 'transparent'
                                    }}
                                    onBlur={(e) => {
                                        if (isEditMode) {
                                            onTextChange?.(el.id, e.currentTarget.innerText);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (isEditMode) {
                                            e.stopPropagation();
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        if (isEditMode) {
                                            e.stopPropagation();
                                            onSelectElement?.(el.id);
                                        }
                                    }}
                                >
                                    {el.content}
                                </div>
                            )}

                            {el.type === 'image' && (
                                <img
                                    className="conda-slide-image"
                                    src={el.src}
                                    alt={el.alt || 'Slide asset'}
                                    draggable={false}
                                    loading="lazy"
                                />
                            )}

                            {el.type === 'video_youtube' && (
                                <div className="conda-slide-video-wrap">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${el.videoId || ''}?rel=0`}
                                        title="YouTube Video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
                                    />
                                </div>
                            )}

                            {el.type === 'video_drive' && (
                                <div className="conda-slide-video-wrap">
                                    <video
                                        src={el.url || `/api/learning/drive-stream/${el.driveFileId}`}
                                        controls={!isEditMode}
                                        style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
                                    />
                                </div>
                            )}

                            {/* Poignées de redimensionnement en mode édition */}
                            {isEditMode && isSelected && (
                                <>
                                    <div className="conda-resize-handle conda-handle-tl" onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'tl'); }} />
                                    <div className="conda-resize-handle conda-handle-t"  onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 't'); }} />
                                    <div className="conda-resize-handle conda-handle-tr" onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'tr'); }} />
                                    <div className="conda-resize-handle conda-handle-r"  onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'r'); }} />
                                    <div className="conda-resize-handle conda-handle-br" onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'br'); }} />
                                    <div className="conda-resize-handle conda-handle-b"  onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'b'); }} />
                                    <div className="conda-resize-handle conda-handle-bl" onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'bl'); }} />
                                    <div className="conda-resize-handle conda-handle-l"  onMouseDown={(e) => { e.stopPropagation(); onStartDrag?.(e, el.id, 'l'); }} />
                                </>
                            )}
                        </div>
                    );
                })}

                {/* Overlays enfants (mascottes, scènes, animations) */}
                {children}
            </div>
        </div>
    );
}
