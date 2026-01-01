export async function initDevoirsModule(container) {
    console.log("%c📚 LISEUSE DEVOIRS V26 - LOGIQUE IA & UI FIX", "color: white; background: #2563eb; padding: 5px;");

    container.innerHTML = `
        <div class="hw-layout">
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Tes Devoirs Maison</h3>
                <div id="hw-items-container">Chargement de la liste...</div>
            </div>

            <div id="hw-work-view" class="hw-work-view" style="display:none;">
                <!-- HAUT (75%) -->
                <div id="doc-viewer" class="doc-viewer-container">
                    <div id="pan-zoom-content">
                        <img id="current-doc-img" src="" style="display:none;">
                    </div>
                    <div class="page-counter" id="hw-page-counter">1 / 1</div>
                    <button id="btn-prev-doc" class="nav-arrow">❮</button>
                    <button id="btn-next-doc" class="nav-arrow">❯</button>
                    <div class="doc-controls">
                        <button class="zoom-btn" id="btn-zoom-out">➖</button>
                        <button class="zoom-btn" id="btn-zoom-in">➕</button>
                    </div>
                    <button id="btn-close-hw" style="position:absolute; top:15px; left:15px; background:var(--danger); color:white; padding:8px 15px; z-index:100; border-radius:8px;">✕ Quitter</button>
                    
                    <!-- LABEL QUESTION AU DESSUS DE LA LIGNE ORANGE -->
                    <div id="hw-q-label-tab">QUESTION 1</div>
                </div>

                <!-- BAS (25%) -->
                <div class="interaction-zone">
                    <div class="question-part">
                        <div id="hw-question-text" style="font-weight:bold; font-size:0.95rem; color:#1e293b; max-height:100%; overflow-y:auto;"></div>
                        
                        <div id="q-image-container" style="display:none;">
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
        </div>
    `;

    const ui = {
        listTarget: document.getElementById("hw-items-container"),
        workView: document.getElementById("hw-work-view"),
        listView: document.getElementById("hw-list-view"),
        img: document.getElementById("current-doc-img"),
        qText: document.getElementById("hw-question-text"),
        qLabel: document.getElementById("hw-q-label-tab"),
        input: document.getElementById("hw-answer-input"),
        btnSubmit: document.getElementById("hw-btn-submit"),
        qContainer: document.getElementById("pan-zoom-question-content"),
        viewer: document.getElementById("doc-viewer"),
        qImgZone: document.getElementById("q-image-container")
    };

    let currentHw = null;
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };
    let viewQ = { x: 0, y: 0, scale: 1.0 };

    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        ui.listTarget.innerHTML = hws.length ? "" : "<p style='text-align:center; padding:40px;'>Aucun devoir disponible.</p>";
        hws.forEach(hw => {
            const d = document.createElement("div");
            d.className = "hw-list-item card";
            d.innerHTML = `<div><b>${hw.title}</b><br><small>Publié le ${new Date(hw.date).toLocaleDateString()}</small></div><span>➔</span>`;
            d.onclick = () => startHw(hw);
            ui.listTarget.appendChild(d);
        });
    };

    const startHw = (hw) => {
        currentHw = hw;
        ui.listView.style.display = "none";
        ui.workView.style.display = "flex";
        const firstLvl = hw.levels[0];
        
        // Setup Consigne
        ui.qText.innerHTML = firstLvl.instruction ? firstLvl.instruction.replace(/\n/g, '<br>') : "";
        ui.qLabel.innerText = "QUESTION 1";

        // Setup Image Question
        ui.qContainer.innerHTML = "";
        if(firstLvl.questionImage) {
            ui.qImgZone.style.display = "block";
            const qImg = document.createElement("img");
            qImg.src = firstLvl.questionImage;
            qImg.onload = () => {
                const ratio = ui.qImgZone.offsetWidth / qImg.naturalWidth;
                viewQ = { x: 0, y: 0, scale: ratio };
                updateTransform('q');
            };
            ui.qContainer.appendChild(qImg);
        } else {
            ui.qImgZone.style.display = "none";
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
        if(type === 'doc') {
            document.getElementById("pan-zoom-content").style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
        } else {
            ui.qContainer.style.transform = `translate(-50%, -50%) translate(${viewQ.x}px, ${viewQ.y}px) scale(${viewQ.scale})`;
        }
    }

    // --- BUTTONS ---
    document.getElementById("btn-prev-doc").onclick = (e) => { e.stopPropagation(); if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = (e) => { e.stopPropagation(); if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = (e) => { e.stopPropagation(); view.scale += 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-out").onclick = (e) => { e.stopPropagation(); view.scale -= 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-in-q").onclick = (e) => { e.stopPropagation(); viewQ.scale += 0.2; updateTransform('q'); };
    document.getElementById("btn-zoom-out-q").onclick = (e) => { e.stopPropagation(); viewQ.scale -= 0.2; updateTransform('q'); };
    document.getElementById("btn-close-hw").onclick = () => { ui.workView.style.display = "none"; ui.listView.style.display = "block"; };

    // --- MOTEUR PAN (DRAG & SLIDE) ---
    const setupPan = (container, type) => {
        let isDown = false, startX, startY;
        container.addEventListener('mousedown', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            isDown = true; container.style.cursor = "grabbing";
            const v = (type === 'doc') ? view : viewQ;
            startX = e.clientX - v.x; startY = e.clientY - v.y;
        });
        window.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            const v = (type === 'doc') ? view : viewQ;
            v.x = e.clientX - startX; v.y = e.clientY - startY;
            updateTransform(type);
        });
        window.addEventListener('mouseup', () => { isDown = false; container.style.cursor = "grab"; });
    };

    setupPan(ui.viewer, 'doc');
    setupPan(ui.qImgZone, 'q');

    // --- LOGIQUE ENVOYER A L'IA (BOUTON BLEU) ---
    ui.btnSubmit.onclick = async () => {
        const val = ui.input.value.trim();
        if(!val) return alert("Réponse vide !");

        ui.btnSubmit.disabled = true;
        ui.btnSubmit.innerText = "Analyse IA en cours... 🧠";

        try {
            const res = await window.api.post('/api/analyze-homework', {
                userText: val,
                homeworkInstruction: currentHw.levels[0].instruction,
                classroom: window.state.user.classroom,
                playerId: window.state.currentPlayerId,
                homeworkId: currentHw._id
            });

            if (res.feedback) {
                // Affichage du résultat dans une alerte simple pour confirmation
                alert("Correction IA reçue !\n\nNote indicative : " + (res.grade || "Non noté"));
                // On recharge pour voir les fautes dans le carnet
                window.location.reload();
            }
        } catch(e) {
            console.error(e);
            alert("Erreur de connexion avec l'IA.");
            ui.btnSubmit.disabled = false;
            ui.btnSubmit.innerText = "Envoyer mon travail à l'IA 🤖";
        }
    };

    loadList();
}