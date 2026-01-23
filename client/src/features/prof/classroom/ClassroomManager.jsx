import React, { useState, useEffect, useRef } from 'react';
import './ClassroomManager.css';

/**
 * 🎓 GESTION DE CLASSE V10 - NOUVELLE INTERFACE ACTIONS
 * - Réorganisation du tiroir d'attribution (2 colonnes).
 * - Suppression sous l'ajout.
 * - Support du mode déplacement manuel.
 */
export default function ClassroomManager({ globalClassId, user }) {
    const [students, setStudents] = useState([]);
    const [gridSize, setGridSize] = useState({ cols: 6, rows: 5 });
    const [separators, setSeparators] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [iaLoading, setIaLoading] = useState(false);
    
    // UI Drawer States
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [currentNote, setCurrentNote] = useState("");
    const [swapSource, setSwapSource] = useState(null);

    // Drag States
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);

    const fileInputRef = useRef(null);
    
    const myId = user ? (user._id || user.id) : null;

    const loadData = async () => {
        if (!globalClassId) return;
        try {
            const resClass = await fetch(`/api/classroom/${globalClassId}`);
            if (resClass.ok) {
                const clsInfo = await resClass.json();
                if (clsInfo.layout && clsInfo.layout.separators) setSeparators(clsInfo.layout.separators);
            }
            const queryParams = myId ? `?teacherId=${myId}` : '';
            const res = await fetch(`/api/classroom/plan/${globalClassId}${queryParams}`);
            
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    let maxCol = 5; let maxRow = 4;
                    data.forEach(s => {
                        if (s.seatX >= maxCol) maxCol = s.seatX + 1;
                        if (s.seatY >= maxRow) maxRow = s.seatY + 1;
                    });
                    setGridSize(prev => ({ cols: Math.max(prev.cols, maxCol), rows: Math.max(prev.rows, maxRow) }));
                    setStudents(data);
                } else { setStudents([]); }
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClassId, myId]);

    const toggleSeparator = async (colIndex) => { let newSeps = [...separators]; if (newSeps.includes(colIndex)) newSeps = newSeps.filter(s => s !== colIndex); else newSeps.push(colIndex); setSeparators(newSeps); try { await fetch('/api/classroom/layout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ classId: globalClassId, separators: newSeps }) }); } catch(e){} };
    const changeGrid = (dC, dR) => { setGridSize(p => ({ cols: Math.max(2, p.cols + dC), rows: Math.max(2, p.rows + dR) })); };
    const handleDragStart = (e, sId) => { setDraggingId(sId); e.dataTransfer.setData("text/plain", sId); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e, x, y) => { e.preventDefault(); setDragOverCell(`${x}-${y}`); };
    const handleDrop = async (e, x, y) => { e.preventDefault(); setDragOverCell(null); const sId = draggingId; if (!sId) return; const targetStudent = students.find(s => s.seatX === x && s.seatY === y); const movedStudent = students.find(s => s._id === sId); if (targetStudent && targetStudent._id !== sId) { const oldX = movedStudent.seatX; const oldY = movedStudent.seatY; setStudents(prev => prev.map(s => { if (s._id === sId) return { ...s, seatX: x, seatY: y }; if (s._id === targetStudent._id) return { ...s, seatX: oldX, seatY: oldY }; return s; })); } else { setStudents(prev => prev.map(s => s._id === sId ? { ...s, seatX: x, seatY: y } : s)); } try { await fetch('/api/classroom/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ studentId: sId, x, y }) }); } catch(err) { loadData(); } setDraggingId(null); };
    const handleFileSelect = async (e) => { const file = e.target.files[0]; if (!file) return; if(!confirm(`📸 Analyser ${file.name} ?`)) return; setIaLoading(true); const formData = new FormData(); formData.append('file', file); formData.append('classId', globalClassId); try { await fetch('/api/classroom/import-plan', { method: 'POST', body: formData }); await loadData(); } catch(e) { alert("Erreur IA"); } setIaLoading(false); e.target.value = null; };
    const getMyStats = (stu) => { if (!stu.behaviorRecords) return { crosses: 0, bonuses: 0, weeksToRedemption: 3 }; return stu.behaviorRecords.find(r => r.teacherId === myId) || { crosses: 0, bonuses: 0, weeksToRedemption: 3 }; };
    const handleOpenStudent = (stu) => { if (swapSource) { moveStudentTo(swapSource._id, stu.seatX, stu.seatY); setSwapSource(null); return; } setSelectedStudent(stu); setCurrentNote(stu.myNote || ""); setShowNoteInput(false); };
    const addBehavior = async (type, extraData = null) => { if (!selectedStudent || !myId) return; await fetch('/api/classroom/behavior', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ studentId: selectedStudent._id, type, teacherId: myId, extraData }) }); if (type === 'SAVE_NOTE') { setStudents(prev => prev.map(s => s._id === selectedStudent._id ? { ...s, myNote: extraData } : s)); setShowNoteInput(false); } else { loadData(); if (['SAVE_NOTE', 'REMOVE_CROSS', 'REMOVE_BONUS'].includes(type)) setSelectedStudent(null); } };
    const moveStudentTo = async (sid, x, y) => { try { await fetch('/api/classroom/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ studentId: sid, x, y }) }); await loadData(); } catch(e){} };

    if (!globalClassId) return <div className="p-10 text-center text-slate-400 font-black">SÉLECTIONNEZ UNE CLASSE</div>;

    const renderGrid = () => {
        const cells = [];
        for (let y = 0; y < gridSize.rows; y++) {
            for (let x = 0; x < gridSize.cols; x++) {
                const student = students.find(s => s.seatX === x && s.seatY === y);
                const isOver = dragOverCell === `${x}-${y}`;
                const hasSep = separators.includes(x);
                cells.push(
                    <div key={`${x}-${y}`} className={`grid-cell-wrapper ${isOver ? 'drag-over' : ''} ${hasSep ? 'has-separator' : ''}`} style={{ gridColumn: x + 1, gridRow: y + 1, width: '100px', height: '100px' }} onDragOver={(e) => handleDragOver(e, x, y)} onDrop={(e) => handleDrop(e, x, y)} onClick={() => !student && swapSource && moveStudentTo(swapSource._id, x, y) && setSwapSource(null)}>
                        {student ? (
                            <div className={`student-card-drag ${draggingId === student._id ? 'dragging' : ''} ${getMyStats(student).crosses >= 3 ? 'punished' : ''}`} draggable="true" onDragStart={(e) => handleDragStart(e, student._id)} onClick={(e) => { e.stopPropagation(); handleOpenStudent(student); }}>
                                {getMyStats(student).crosses > 0 && <div className="sc-badge">⏳ {getMyStats(student).weeksToRedemption}</div>}
                                {student.myNote && <div className="sc-note-badge">N</div>}
                                <div className="sc-indicators">
                                    {(student.indicators || []).map((ind, i) => (
                                        <div key={i} className={`indicator-dot indicator-${ind.type}-${ind.status}`} title={`${ind.type} : ${ind.status}`}></div>
                                    ))}
                                </div>
                                <div className="sc-avatar">{student.gender === 'F' ? '👧' : '👦'}</div>
                                <div className="sc-name">{student.firstName}<br/>{student.lastName.slice(0,1)}.</div>
                                <div className="sc-counters"><span style={{color:'#ef4444'}}>❌{getMyStats(student).crosses}</span><span style={{color:'#10b981'}}>⭐{getMyStats(student).bonuses}</span></div>
                            </div>
                        ) : ( <div className={`grid-cell-empty ${isOver ? 'drag-over' : ''}`}>+</div> )}
                    </div>
                );
            }
        }
        return cells;
    };

    const renderHeaders = () => {
        const headers = [];
        for (let x = 0; x < gridSize.cols; x++) {
            headers.push(
                <div key={x} className="col-header-cell">COL {x+1}
                    {x < gridSize.cols - 1 && (<div className="separator-trigger" onDoubleClick={() => toggleSeparator(x)}><div className="separator-line-hint"></div></div>)}
                </div>
            );
        }
        return headers;
    };

    return (
        <div className="classroom-wrapper">
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleFileSelect} />
            {iaLoading && <div className="ia-loader"><div className="spinner-ia"></div><span>IA ACTIVE...</span></div>}
            <div className="cm-header">
                <span className="cm-title">PLAN DE CLASSE {swapSource && <span className="text-orange-500 text-sm ml-4 animate-pulse">| DÉPLACEMENT DE {swapSource.firstName}...</span>}</span>
                <div className="cm-toolbar">
                    <button className="cm-btn purple" onClick={() => fileInputRef.current.click()}>🔮 IMPORT IA</button>
                    <div className="w-px h-6 bg-slate-200 mx-2"></div>
                    <span className="text-[10px] font-bold text-slate-400">COLS:</span><button className="cm-btn slate" onClick={() => changeGrid(-1, 0)}>-</button><span className="font-bold">{gridSize.cols}</span><button className="cm-btn slate" onClick={() => changeGrid(1, 0)}>+</button>
                    <span className="text-[10px] font-bold text-slate-400 ml-2">ROWS:</span><button className="cm-btn slate" onClick={() => changeGrid(0, -1)}>-</button><span className="font-bold">{gridSize.rows}</span><button className="cm-btn slate" onClick={() => changeGrid(0, 1)}>+</button>
                </div>
            </div>
            <div className="grid-container custom-scrollbar">
                <div className="grid-header-row" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, 100px)` }}>{renderHeaders()}</div>
                <div className="interactive-grid" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, 100px)`, gridTemplateRows: `repeat(${gridSize.rows}, 100px)` }}>{renderGrid()}</div>
            </div>
            <div className={`action-drawer ${selectedStudent ? 'open' : ''}`}>
                {selectedStudent && (
                    <>
                        <div className="drawer-header"><span className="drawer-name">{selectedStudent.firstName} {selectedStudent.lastName}</span><button className="drawer-close" onClick={() => setSelectedStudent(null)}>✕</button></div>
                        <div className="drawer-grid-complex">
                            {/* COLONNE 1 : CROIX */}
                            <button className="act-btn btn-cross" onClick={() => addBehavior('CROSS')}>❌ AJOUTER CROIX</button>
                            {/* COLONNE 2 : BONUS */}
                            <button className="act-btn btn-bonus" onClick={() => addBehavior('BONUS')}>⭐ AJOUTER BONUS</button>
                            
                            {/* LIGNE 2 COL 1 : REMOVE CROIX */}
                            <button className="act-btn btn-rem-cross" onClick={() => addBehavior('REMOVE_CROSS')}>RETIRER CROIX</button>
                            {/* LIGNE 2 COL 2 : REMOVE BONUS */}
                            <button className="act-btn btn-rem-bonus" onClick={() => addBehavior('REMOVE_BONUS')}>RETIRER BONUS</button>
                            
                            {/* LIGNE 3 : NOTES (Full Width) */}
                            <button className="act-btn btn-note" onClick={() => setShowNoteInput(!showNoteInput)}>📝 NOTES PERSONNELLES {showNoteInput ? '▲' : '▼'}</button>
                            
                            {/* LIGNE 4 : DÉPLACER (Full Width) */}
                            <button className="act-btn btn-move-full" onClick={() => { setSwapSource(selectedStudent); setSelectedStudent(null); }}>🔄 DÉMARRER DÉPLACEMENT</button>
                        </div>
                        {showNoteInput && (
                            <div className="note-area-wrapper">
                                <textarea className="note-textarea" value={currentNote} onChange={e => setCurrentNote(e.target.value)} placeholder="Note invisible pour l'élève..." />
                                <button className="btn-save-note" onClick={() => addBehavior('SAVE_NOTE', currentNote)}>ENREGISTRER LA NOTE</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}