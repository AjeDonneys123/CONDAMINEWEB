export async function initDevoirsModule(container) {
    console.log("%c📚 MODULE DEVOIRS V37 - RÉPARATION COMPLÈTE", "color: white; background: #16a34a; padding: 5px; font-weight: bold;");

    // 1. STRUCTURE HTML DU MODULE
    container.innerHTML = `
        <div class="hw-layout">
            <!-- VUE 1 : LISTE DES DEVOIRS -->
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Mes Travaux à rendre</h3>
                <div id="hw-items-container">Chargement de la liste...</div>
            </div>

            <!-- VUE 2 : ZONE DE TRAVAIL (LISEUSE + RÉPONSE) -->
            <div id="hw-work-view" class="hw-work-view" style="display:none;">
                
                <!-- HAUT : LA LISEUSE (LIGNE 1 - 75%) -->
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
                    
                    <button id="btn-close-hw" style="position:absolute; top:15px; left:15px; background:var(--danger); color:white; padding:8px 15px; z-index:100; border-radius:8px;">✕ Quitter</button>
                    
                    <div id="hw-q-label-tab" style="position:absolute; bottom:0; left:20px; background:var(--secondary); color:white; padding:4px 15px; border-radius:8px 8px 0 0; font-weight:900; font-size:0.75rem; z-index:15;">QUESTION</div>
                </div>

                <!-- BAS : INTERACTION (LIGNE 2 - 25%) -->
                <div class="interaction-zone">
                    <div class="question-part">
                        <div id="hw-question-text" style="font-weight:bold; font-size:0.9rem; color:#1e293b; max-height:60px; overflow-y:auto; margin-bottom:5px;"></div>
                        
                        <div id="q-image-container">
                            <div id="pan-zoom-question-content"></div>
                            <div class="doc-controls" style="transform: scale(0.65); bottom: 2px; right: 2px;">
                                <button class="zoom-btn" id="btn-zoom-out-q">➖</button>
                                <button class="zoom-btn" id="btn-zoom-in-q">➕</button>
                            </div>
                        </div>
                    </div>
                    <div class="answer-part">
                        <textarea id="hw-answer-input" placeholder="Écris ta réponse ici..."></textarea>
                        <button id="hw-btn-submit" class="action-btn">Envoyer mon travail à l'IA 🤖</button>
                    </div>
                </div>

            </div>

            <!-- OVERLAY DE FEEDBACK IA (FIXED AU CENTRE) -->
            <div id="hw-feedback-overlay">
                <div class="feedback-card">
                    <div class="feedback-header"><h2 style="color:var(--primary); margin:0;">Analyse IA 🧠</h2></div>
                    <div id="hw-ai-grade" style="text-align:center; font-size:3.5rem; font-weight:900; color:var(--success); margin:10px 0;"></div>
                    <div class="feedback-scroll-area" id="hw-ai-content"></div>
                    <div style="display:flex; gap:15px;">
                        <button id="btn-improve-hw" class="action-btn" style="flex:1; background:var(--secondary); height:55px; border-radius:15px;">✍️ Améliorer</button>
                        <button id="btn-save-hw" class="action-btn" style="flex:1; background:var(--success); height:55px; border-radius:15px;">💾 Sauvegarder et Quitter</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- VARIABLES D'ÉTAT ---
    const ui = {
        listTarget: document.getElementById("hw-items-container"),
        workView: document.getElementById("hw-work-view"),
        listView: document.getElementById("hw-list-view"),
        fbOverlay: document.getElementById("hw-feedback-overlay"),
        btnSubmit: document.getElementById("hw-btn-submit"),
        img: document.getElementById("current-doc-img"),
        qText: document.getElementById("hw-question-text"),
        qContainer: document.getElementById("pan-zoom-question-content"),
        viewer: document.getElementById("doc-viewer"),
        qZone: document.getElementById("q-image-container")
    };

    let currentHw = null;
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };
    let viewQ = { x: 0, y: 0, scale: 1.0 };

    // --- LOGIQUE DE CHARGEMENT ---
    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        ui.listTarget.innerHTML = "";
        
        if(!hws || hws.length === 0) {
            ui.listTarget.innerHTML = "<p style='text-align:center; padding:40px; color:#94a3b8;'>Aucun devoir disponible. 🌴</p>";
            return;
        }

        hws.forEach(hw => {
            const d = document.createElement("div");
            d.className = "hw-list-item card";
            d.innerHTML = `<div><b>${hw.title}</b><br><small>Publié le ${new Date(hw.date).toLocaleDateString()}</small></div><span style='font-size:1.5rem;'>➔</span>`;
            d.onclick = () => startHw(hw);
            ui.listTarget.appendChild(d);
        });
    };

    const startHw = (hw) => {
        currentHw = hw;
        ui.listView.style.display = "none";
        ui.workView.style.display = "flex";
        
        const firstLvl = hw.levels[0];
        ui.qText.innerHTML = firstLvl.instruction ? firstLvl.instruction.replace(/\n/g, '<br>') : "";

        // Setup Image Question (Bas Gauche)
        ui.qContainer.innerHTML = "";
        if(firstLvl.questionImage) {
            ui.qZone.style.display = "block";
            const qImg = document.createElement("img");
            qImg.src = firstLvl.questionImage;
            qImg.onload = () => {
                const ratio = ui.qZone.offsetWidth / qImg.naturalWidth;
                viewQ = { x: 0, y: 0, scale: ratio };
                updateTransform('q');
            };
            ui.qContainer.appendChild(qImg);
        } else {
            ui.qZone.style.display = "none";
        }

        docs = firstLvl.attachmentUrls || [];
        docIdx = 0;
        renderDoc();
    };

    function renderDoc() {
        if (!docs.length) return;
        ui.img.style.display = "block";
        ui.img.onload = () => {
            const ratioW = (ui.viewer.offsetWidth * 0.9) / ui.img.naturalWidth;
            const ratioH = (ui.viewer.offsetHeight * 0.9) / ui.img.naturalHeight;
            view = { x: 0, y: 0, scale: Math.min(ratioW, ratioH) };
            updateTransform('doc');
        };
        ui.img.src = docs[docIdx];
        document.getElementById("hw-page-counter").innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform(type) {
        const target = (type === 'doc') ? document.getElementById("pan-zoom-content") : ui.qContainer;
        const v = (type === 'doc') ? view : viewQ;
        if(target) {
            target.style.transform = `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
        }
    }

    // --- MOTEUR PAN (DRAG & SLIDE) DOUBLE ---
    let activeDrag = null; 
    let startX, startY;

    const onMouseDown = (e, type) => {
        if(e.target.tagName === 'BUTTON') return;
        activeDrag = type;
        const v = (type === 'doc') ? view : viewQ;
        startX = e.clientX - v.x;
        startY = e.clientY - v.y;
        (type === 'doc' ? ui.viewer : ui.qZone).style.cursor = "grabbing";
    };

    ui.viewer.addEventListener('mousedown', (e) => onMouseDown(e, 'doc'));
    ui.qZone.addEventListener('mousedown', (e) => onMouseDown(e, 'q'));

    window.addEventListener('mousemove', (e) => {
        if(!activeDrag) return;
        const v = (activeDrag === 'doc') ? view : viewQ;
        v.x = e.clientX - startX;
        v.y = e.clientY - startY;
        updateTransform(activeDrag);
    });

    window.addEventListener('mouseup', () => {
        if(!activeDrag) return;
        (activeDrag === 'doc' ? ui.viewer : ui.qZone).style.cursor = "grab";
        activeDrag = null;
    });

    // --- NAVIGATION ET ZOOM ---
    document.getElementById("btn-prev-doc").onclick = (e) => { e.stopPropagation(); if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = (e) => { e.stopPropagation(); if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = (e) => { e.stopPropagation(); view.scale += 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-out").onclick = (e) => { e.stopPropagation(); view.scale -= 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-in-q").onclick = (e) => { e.stopPropagation(); viewQ.scale += 0.2; updateTransform('q'); };
    document.getElementById("btn-zoom-out-q").onclick = (e) => { e.stopPropagation(); viewQ.scale -= 0.2; updateTransform('q'); };
    document.getElementById("btn-close-hw").onclick = () => { ui.workView.style.display = "none"; ui.listView.style.display = "block"; };

    // --- ENVOI IA ---
    ui.btnSubmit.onclick = async () => {
        const inputArea = document.getElementById("hw-answer-input");
        const val = inputArea.value.trim();
        if(!val) return alert("Réponse vide !");
        
        ui.btnSubmit.disabled = true;
        ui.btnSubmit.innerText = "Analyse IA...";

        try {
            const res = await window.api.post('/api/analyze-homework', {
                userText: val,
                homeworkInstruction: currentHw.levels[0].instruction,
                classroom: window.state.user.classroom,
                playerId: window.state.currentPlayerId,
                homeworkId: currentHw._id
            });

            document.getElementById("hw-ai-grade").innerText = res.grade || "Reçu";
            document.getElementById("hw-ai-content").innerHTML = res.feedback;
            ui.fbOverlay.style.display = "flex";

            document.getElementById("btn-improve-hw").onclick = () => {
                ui.fbOverlay.style.display = "none";
                ui.btnSubmit.disabled = false;
                ui.btnSubmit.innerText = "Envoyer mon travail à l'IA 🤖";
                inputArea.focus();
            };

            document.getElementById("btn-save-hw").onclick = () => {
                window.location.reload();
            };

        } catch(e) {
            console.error(e);
            ui.btnSubmit.disabled = false;
            ui.btnSubmit.innerText = "Envoyer mon travail à l'IA 🤖";
            alert("L'IA n'a pas pu répondre.");
        }
    };

    loadList();
}