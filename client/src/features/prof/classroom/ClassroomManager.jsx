import React, { useState, useEffect, useRef } from 'react';
import './ClassroomManager.css';

export default function ClassroomManager({ globalClassId, user }) {
    const [students, setStudents] = useState([]);
    const [gridSize, setGridSize] = useState({ cols: 6, rows: 5 });
    const [separators, setSeparators] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [iaLoading, setIaLoading] = useState(false);
    
    // UI STATES
    const [viewMode, setViewMode] = useState('PLAN');
    const [searchTerm, setSearchTerm] = useState("");
    
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [currentNote, setCurrentNote] = useState("");
    const [swapSource, setSwapSource] = useState(null);
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
    
    // --- GESTION DES ACTIONS ---
    const addBehavior = async (sid, type, extra = null) => { 
        if (!myId) return alert("Erreur: ID Professeur introuvable.");

        // Optimistic UI Update
        setStudents(prev => prev.map(s => {
            if (s._id !== sid) return s;
            const newS = { ...s, behaviorRecords: [...(s.behaviorRecords || [])] };
            let rIdx = newS.behaviorRecords.findIndex(r => r.teacherId === myId);
            if(rIdx === -1) { newS.behaviorRecords.push({ teacherId: myId, crosses: 0, bonuses: 0, weeksToRedemption: 3 }); rIdx = newS.behaviorRecords.length - 1; }
            
            const r = { ...newS.behaviorRecords[rIdx] };
            if (type === 'CROSS') r.crosses++;
            if (type === 'BONUS') r.bonuses++;
            if (type === 'REMOVE_CROSS') r.crosses = Math.max(0, r.crosses - 1);
            if (type === 'REMOVE_BONUS') r.bonuses = Math.max(0, r.bonuses - 1);
            
            // Mise à jour visuelle immédiate pour la punition supprimée
            if (type === 'REMOVE_PUNISHMENT') {
                newS.punishmentStatus = 'NONE';
            }

            newS.behaviorRecords[rIdx] = r;
            return newS;
        }));

        try {
            const res = await fetch('/api/classroom/behavior', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ studentId: sid, type, teacherId: myId, extraData: extra }) 
            });

            if (res.ok) {
                await loadData();
                if (['SAVE_NOTE', 'REMOVE_PUNISHMENT'].includes(type)) setSelectedStudent(null);
            }
        } catch(e) { console.error("Erreur API", e); loadData(); }
    };

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
                    <div key={`${x}-${y}`} className={`grid-cell-wrapper ${isOver ? 'drag-over' : ''} ${hasSep ? 'has-separator' : ''}`} style={{ gridColumn: x + 1, gridRow: y + 1 }} onDragOver={(e) => handleDragOver(e, x, y)} onDrop={(e) => handleDrop(e, x, y)} onClick={() => !student && swapSource && moveStudentTo(swapSource._id, x, y) && setSwapSource(null)}>
                        {student ? (
                            <div className={`student-card-drag ${draggingId === student._id ? 'dragging' : ''} ${getMyStats(student).crosses >= 3 ? 'punished' : ''}`} draggable="true" onDragStart={(e) => handleDragStart(e, student._id)} onClick={(e) => { e.stopPropagation(); handleOpenStudent(student); }}>
                                {getMyStats(student).crosses > 0 && <div className="sc-badge">⏳ {getMyStats(student).weeksToRedemption}</div>}
                                {student.myNote && <div className="sc-note-badge">N</div>}
                                {student.punishmentStatus && student.punishmentStatus !== 'NONE' && (<div className={`sc-punishment-badge ${student.punishmentStatus === 'LATE' ? 'late' : 'pending'}`}>P</div>)}
                                <div className="sc-indicators">{(student.indicators || []).map((ind, i) => (<div key={i} className={`indicator-dot indicator-${ind.type}-${ind.status}`} title={`${ind.type} : ${ind.status}`}></div>))}</div>
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

    const renderList = () => {
        const filtered = students.filter(s => (s.firstName + ' ' + s.lastName).toLowerCase().includes(searchTerm.toLowerCase())).sort((a,b) => a.lastName.localeCompare(b.lastName));
        return (
            <div className="list-container custom-scrollbar">
                <input className="list-finder" placeholder="🔎 Chercher un élève..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {filtered.map(s => {
                    const stats = getMyStats(s);
                    return (
                        <div key={s._id} className="student-list-row">
                            <div className="list-info" onClick={() => handleOpenStudent(s)}><span className="list-name">{s.lastName} {s.firstName}</span><span className="list-stats">❌ {stats.crosses} | ⭐ {stats.bonuses} {s.punishmentStatus !== 'NONE' ? '| ⚠️ PUNI' : ''}</span></div>
                            <div className="list-actions"><button className="btn-list-action btn-x" onClick={() => addBehavior(s._id, 'CROSS')}>❌</button><button className="btn-list-action btn-v" onClick={() => addBehavior(s._id, 'BONUS')}>⭐</button><button className="btn-list-action btn-c" onClick={() => handleOpenStudent(s)}>📝</button></div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="classroom-wrapper" style={{ '--grid-cols': gridSize.cols }}>
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleFileSelect} />
            {iaLoading && <div className="ia-loader"><div className="spinner-ia"></div><span>IA ACTIVE...</span></div>}
            
            <div className="cm-header">
                <h2 className="cm-title md:block hidden">{viewMode === 'PLAN' ? 'MODE PLAN' : 'MODE LISTE'}</h2>
                <div className="view-switcher">
                    <button className={`view-btn ${viewMode === 'PLAN' ? 'active' : ''}`} onClick={() => setViewMode('PLAN')}>📍 PLAN</button>
                    <button className={`view-btn ${viewMode === 'LIST' ? 'active' : ''}`} onClick={() => setViewMode('LIST')}>📋 LISTE</button>
                </div>
            </div>
            
            {viewMode === 'PLAN' ? (
                <>
                    <div className="cm-toolbar hidden md:flex">
                        <button className="cm-btn purple" onClick={() => fileInputRef.current.click()}>🔮 IMPORT IA</button>
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        <span className="text-[10px] font-bold text-slate-400">COLS:</span><button className="cm-btn slate" onClick={() => changeGrid(-1, 0)}>-</button><span className="font-bold">{gridSize.cols}</span><button className="cm-btn slate" onClick={() => changeGrid(1, 0)}>+</button>
                        <span className="text-[10px] font-bold text-slate-400 ml-2">ROWS:</span><button className="cm-btn slate" onClick={() => changeGrid(0, -1)}>-</button><span className="font-bold">{gridSize.rows}</span><button className="cm-btn slate" onClick={() => changeGrid(0, 1)}>+</button>
                    </div>
                    
                    <div className="grid-container custom-scrollbar">
                        <div className="grid-header-row" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))` }}>{renderHeaders()}</div>
                        <div className="interactive-grid" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))`, gridTemplateRows: `repeat(${gridSize.rows}, var(--cell-size, 100px))` }}>{renderGrid()}</div>
                    </div>
                </>
            ) : renderList()}
            
            <div className={`action-drawer ${selectedStudent ? 'open' : ''}`}>
                {selectedStudent && (
                    <>
                        <div className="drawer-header"><span className="drawer-name">{selectedStudent.firstName} {selectedStudent.lastName}</span><button className="drawer-close" onClick={() => setSelectedStudent(null)}>✕</button></div>
                        <div className="drawer-grid-complex">
                            <button className="act-btn btn-cross" onClick={() => addBehavior(selectedStudent._id, 'CROSS')}>❌ AJOUTER CROIX</button>
                            <button className="act-btn btn-bonus" onClick={() => addBehavior(selectedStudent._id, 'BONUS')}>⭐ AJOUTER BONUS</button>
                            <button className="act-btn btn-rem-cross" onClick={() => addBehavior(selectedStudent._id, 'REMOVE_CROSS')}>RETIRER CROIX</button>
                            <button className="act-btn btn-rem-bonus" onClick={() => addBehavior(selectedStudent._id, 'REMOVE_BONUS')}>RETIRER BONUS</button>
                            <button className="act-btn btn-note" onClick={() => setShowNoteInput(!showNoteInput)}>📝 NOTES PERSONNELLES {showNoteInput ? '▲' : '▼'}</button>
                            
                            {/* BOUTON REMPLACÉ : SUPPRIMER PUNITION */}
                            <button className="act-btn btn-cancel-punish" onClick={() => addBehavior(selectedStudent._id, 'REMOVE_PUNISHMENT')}>
                                ⚖️ LEVER PUNITION
                            </button>
                        </div>
                        {showNoteInput && (
                            <div className="note-area-wrapper">
                                <textarea className="note-textarea" value={currentNote} onChange={e => setCurrentNote(e.target.value)} placeholder="Note invisible pour l'élève..." />
                                <button className="btn-save-note" onClick={() => addBehavior(selectedStudent._id, 'SAVE_NOTE', currentNote)}>ENREGISTRER LA NOTE</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}