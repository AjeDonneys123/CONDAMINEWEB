export async function initDevoirsModule(container) {
    console.log("%c📚 MODULE DEVOIRS V38 - FIX INTEGRAL", "color: white; background: #16a34a; padding: 5px; font-weight: bold;");

    container.innerHTML = `
        <div class="hw-layout">
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Tes Devoirs Maison</h3>
                <div id="hw-items-container">Chargement de la liste...</div>
            </div>

            <div id="hw-work-view" class="hw-work-view" style="display:none;">
                <div id="doc-viewer" class="doc-viewer-container">
                    <div id="pan-zoom-content">
                        <img id="current-doc-img" src="" style="display:none;">
                    </div>
                    <div class="page-counter" id="hw-page-counter">1 / 1</div>
                    <button id="btn-prev-doc" class="nav-arrow" style="left:10px;">❮</button>
                    <button id="btn-next-doc" class="nav-arrow" style="right:10px;">❯</button>
                    <div class="doc-controls">
                        <button class="zoom-btn" id="btn-zoom-out">➖</button>
                        <button class="zoom-btn" id="btn-zoom-in">➕</button>
                    </div>
                    <button id="btn-close-hw" style="position:absolute; top:15px; left:15px; background:var(--danger); color:white; padding:8px 15px; z-index:100; border-radius:8px; cursor:pointer;">✕ Quitter</button>
                    <div id="hw-q-label-tab" style="position:absolute; bottom:0; left:20px; background:var(--secondary); color:white; padding:4px 15px; border-radius:8px 8px 0 0; font-weight:900; font-size:0.75rem; z-index:15;">QUESTION</div>
                </div>

                <div class="interaction-zone" style="flex: 2.5; display: flex; background: white; min-height: 160px;">
                    <div class="question-part" style="flex: 1; padding: 10px 15px; border-right: 2px solid var(--border); background: #f8fafc; overflow: auto;">
                        <div id="hw-question-text" style="font-weight:bold; font-size:0.9rem; color:#1e293b;"></div>
                        <div id="q-image-container" style="display:none; position:relative; overflow:hidden; background:#0f172a; border-radius:8px; border:1px solid #ccc; height:150px; margin-top:5px; cursor:grab;">
                            <div id="pan-zoom-question-content" style="position:absolute; top:50%; left:50%; transform-origin:center center; display:flex; justify-content:center; align-items:center;"></div>
                            <div class="doc-controls" style="transform: scale(0.65); bottom: 2px; right: 2px;">
                                <button class="zoom-btn" id="btn-zoom-out-q">➖</button>
                                <button class="zoom-btn" id="btn-zoom-in-q">➕</button>
                            </div>
                        </div>
                    </div>
                    <div class="answer-part" style="flex: 1.2; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                        <textarea id="hw-answer-input" placeholder="Écris ta réponse ici..."></textarea>
                        <button id="hw-btn-submit" class="action-btn">Envoyer mon travail à l'IA 🤖</button>
                    </div>
                </div>
            </div>
            
            <div id="hw-feedback-overlay" style="display:none; position:fixed; inset:0; background:rgba(15, 23, 42, 0.85); backdrop-filter:blur(8px); z-index:9999; align-items:center; justify-content:center; padding:20px;">
                <div class="feedback-card" style="background:white; width:100%; max-width:800px; max-height:90vh; border-radius:24px; padding:30px; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.5);">
                    <h2 style="color:var(--primary); text-align:center; margin:0;">Analyse de ton travail 🧠</h2>
                    <div id="hw-ai-grade" style="text-align:center; font-size:3.5rem; font-weight:900; color:var(--success); margin:15px 0;"></div>
                    <div class="feedback-scroll-area" id="hw-ai-content" style="flex:1; overflow-y:auto; margin:15px 0; padding:15px; background:#f8fafc; border-radius:12px; border:1px solid #edf2f7; line-height:1.6;"></div>
                    <div style="display:flex; gap:15px;">
                        <button id="btn-improve-hw" class="action-btn" style="flex:1; background:var(--secondary); height:55px; border-radius:15px;">✍️ Améliorer</button>
                        <button id="btn-save-hw" class="action-btn" style="flex:1; background:var(--success); height:55px; border-radius:15px;">💾 Sauvegarder et Quitter</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const ui = {
        listTarget: document.getElementById("hw-items-container"),
        workView: document.getElementById("hw-work-view"),
        listView: document.getElementById("hw-list-view"),
        fbOverlay: document.getElementById("hw-feedback-overlay"),
        btnSubmit: document.getElementById("hw-btn-submit"),
        img: document.getElementById("current-doc-img"),
        qContainer: document.getElementById("pan-zoom-question-content"),
        viewer: document.getElementById("doc-viewer"),
        qZone: document.getElementById("q-image-container")
    };

    let currentHw = null, docs = [], docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 }, viewQ = { x: 0, y: 0, scale: 1.0 };

    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        ui.listTarget.innerHTML = hws.length ? "" : "<p style='text-align:center; padding:40px;'>Aucun devoir disponible.</p>";
        hws.forEach(hw => {
            const d = document.createElement("div"); d.className = "hw-list-item card";
            d.innerHTML = `<div><b>${hw.title}</b><br><small>Publié le ${new Date(hw.date).toLocaleDateString()}</small></div><span>➔</span>`;
            d.onclick = () => { 
                currentHw = hw; ui.listView.style.display = "none"; ui.workView.style.display = "flex"; 
                docs = hw.levels[0].attachmentUrls || []; docIdx = 0; 
                document.getElementById("hw-question-text").innerHTML = hw.levels[0].instruction ? hw.levels[0].instruction.replace(/\n/g, '<br>') : "";
                ui.qContainer.innerHTML = "";
                if(hw.levels[0].questionImage) {
                    ui.qZone.style.display = "block";
                    const qImg = document.createElement("img"); qImg.src = hw.levels[0].questionImage;
                    qImg.onload = () => {
                        const ratio = Math.min(ui.qZone.offsetWidth * 0.9 / qImg.naturalWidth, ui.qZone.offsetHeight * 0.9 / qImg.naturalHeight);
                        viewQ = { x: 0, y: 0, scale: ratio }; updateTransform('q');
                    };
                    ui.qContainer.appendChild(qImg);
                } else ui.qZone.style.display = "none";
                renderDoc();
            };
            ui.listTarget.appendChild(d);
        });
    };

    function renderDoc() {
        ui.img.style.display = "block"; ui.img.src = docs[docIdx];
        ui.img.onload = () => {
            const ratio = Math.min(ui.viewer.offsetWidth * 0.9 / ui.img.naturalWidth, ui.viewer.offsetHeight * 0.9 / ui.img.naturalHeight);
            view = { x: 0, y: 0, scale: ratio }; updateTransform('doc');
        };
        document.getElementById("hw-page-counter").innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform(type) {
        const target = type === 'doc' ? document.getElementById("pan-zoom-content") : ui.qContainer;
        const v = type === 'doc' ? view : viewQ;
        if(target) target.style.transform = `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
    }

    // --- MOTEUR PAN (DRAG) ---
    let activeDrag = null, startX, startY;
    const onMouseDown = (e, type) => { if(e.target.tagName === 'BUTTON') return; activeDrag = type; const v = (type === 'doc') ? view : viewQ; startX = e.clientX - v.x; startY = e.clientY - v.y; };
    ui.viewer.onmousedown = (e) => onMouseDown(e, 'doc');
    ui.qZone.onmousedown = (e) => onMouseDown(e, 'q');
    window.addEventListener('mousemove', (e) => { if(!activeDrag) return; const v = (activeDrag === 'doc') ? view : viewQ; v.x = e.clientX - startX; v.y = e.clientY - startY; updateTransform(activeDrag); });
    window.addEventListener('mouseup', () => { activeDrag = null; });

    // --- BUTTONS ---
    document.getElementById("btn-prev-doc").onclick = () => { if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = () => { if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = () => { view.scale += 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-out").onclick = () => { view.scale -= 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-in-q").onclick = () => { viewQ.scale += 0.2; updateTransform('q'); };
    document.getElementById("btn-zoom-out-q").onclick = () => { viewQ.scale -= 0.2; updateTransform('q'); };
    document.getElementById("btn-close-hw").onclick = () => { ui.workView.style.display = "none"; ui.listView.style.display = "block"; };

    // --- SUBMIT ---
    ui.btnSubmit.onclick = async () => {
        const val = document.getElementById("hw-answer-input").value.trim();
        if(!val) return alert("Réponse vide !");
        ui.btnSubmit.disabled = true; ui.btnSubmit.innerText = "Analyse IA...";
        try {
            const res = await window.api.post('/api/analyze-homework', { userText: val, homeworkInstruction: currentHw.levels[0].instruction, classroom: window.state.user.classroom, playerId: window.state.currentPlayerId, homeworkId: currentHw._id });
            document.getElementById("hw-ai-grade").innerText = res.grade || "Reçu";
            document.getElementById("hw-ai-content").innerHTML = res.feedback;
            ui.fbOverlay.style.display = "flex";
            document.getElementById("btn-improve-hw").onclick = () => { ui.fbOverlay.style.display = "none"; ui.btnSubmit.disabled = false; ui.btnSubmit.innerText = "Envoyer mon travail à l'IA 🤖"; };
            document.getElementById("btn-save-hw").onclick = () => window.location.reload();
        } catch(e) { ui.btnSubmit.disabled = false; alert("Erreur IA"); }
    };

    loadList();
}