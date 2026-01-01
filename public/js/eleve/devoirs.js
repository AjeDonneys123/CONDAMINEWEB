export async function initDevoirsModule(container) {
    console.log("%c📚 LISEUSE DEVOIRS V25 - CLEAN UI & PAN FIX", "color: white; background: #2563eb; padding: 5px;");

    container.innerHTML = `
        <div class="hw-layout">
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Tes Devoirs Maison</h3>
                <div id="hw-items-container">Chargement...</div>
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
                </div>

                <!-- BAS (25%) -->
                <div class="interaction-zone">
                    <div class="question-part">
                        <div id="hw-q-small-title" style="font-size:0.7em; color:var(--primary); font-weight:900; margin-bottom:2px;">QUESTION 1</div>
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
                        <button id="hw-btn-submit" class="action-btn">Envoyer mon travail 🤖</button>
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
        qSmallTitle: document.getElementById("hw-q-small-title"),
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
        ui.listTarget.innerHTML = hws.length ? "" : "<p style='text-align:center; padding:40px;'>Aucun devoir. 🌴</p>";
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
        
        // Nettoyage UI Question
        if (firstLvl.instruction && firstLvl.instruction.trim() !== "") {
            ui.qText.innerHTML = firstLvl.instruction.replace(/\n/g, '<br>');
            ui.qText.style.display = "block";
            ui.qSmallTitle.style.display = "block";
        } else {
            ui.qText.style.display = "none";
            ui.qSmallTitle.style.display = "none";
        }
        
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
            const ratioW = (ui.viewer.offsetWidth * 0.95) / ui.img.naturalWidth;
            const ratioH = (ui.viewer.offsetHeight * 0.95) / ui.img.naturalHeight;
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

    // --- BUTTON EVENTS ---
    document.getElementById("btn-prev-doc").onclick = (e) => { e.stopPropagation(); if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = (e) => { e.stopPropagation(); if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = (e) => { e.stopPropagation(); view.scale += 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-out").onclick = (e) => { e.stopPropagation(); view.scale -= 0.2; updateTransform('doc'); };
    document.getElementById("btn-zoom-in-q").onclick = (e) => { e.stopPropagation(); viewQ.scale += 0.2; updateTransform('q'); };
    document.getElementById("btn-zoom-out-q").onclick = (e) => { e.stopPropagation(); viewQ.scale -= 0.2; updateTransform('q'); };
    document.getElementById("btn-close-hw").onclick = () => { ui.workView.style.display = "none"; ui.listView.style.display = "block"; };

    // --- MOTEUR PAN (CORRIGÉ POUR ÉVITER LES CONFLITS) ---
    const setupPan = (container, type) => {
        let isDown = false, startX, startY;

        container.addEventListener('mousedown', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            isDown = true; 
            container.style.cursor = "grabbing";
            const v = (type === 'doc') ? view : viewQ;
            startX = e.clientX - v.x; 
            startY = e.clientY - v.y;
        });

        // Utilisation de l'event global sur window pour un drag fluide
        window.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            const v = (type === 'doc') ? view : viewQ;
            v.x = e.clientX - startX; 
            v.y = e.clientY - startY;
            updateTransform(type);
        });

        window.addEventListener('mouseup', () => {
            isDown = false; 
            container.style.cursor = "grab";
        });
    };

    setupPan(ui.viewer, 'doc');
    setupPan(ui.qImgZone, 'q');

    loadList();
}