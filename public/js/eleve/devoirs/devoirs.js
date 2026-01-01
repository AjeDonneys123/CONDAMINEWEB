export async function initDevoirsModule(container) {
    console.log("%c📚 MODULE DEVOIRS V22 - RÉPARATION VISUELLE", "color: white; background: #2563eb; padding: 5px; font-weight: bold;");

    container.innerHTML = `
        <div class="hw-layout">
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Mes Travaux à rendre</h3>
                <div id="hw-items-container">Chargement...</div>
            </div>

            <div id="hw-work-view" class="hw-work-view" style="display:none;">
                <div id="doc-viewer" class="doc-viewer-container">
                    <div id="pan-zoom-content" style="top: 50%; left: 50%;">
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

                <div class="interaction-zone">
                    <div class="question-part">
                        <b style="color:var(--primary); font-size:0.8em; display:block; margin-bottom:5px;">CONSIGNE :</b>
                        <div id="hw-question-text" style="font-weight:bold; line-height:1.4; color:var(--text-main);"></div>
                    </div>
                    <div class="answer-part">
                        <textarea id="hw-answer-input" placeholder="Écris ta réponse ici..."></textarea>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                             <label style="cursor:pointer; color:var(--primary); font-size:0.9rem; font-weight:bold;">
                                📎 Joindre une photo
                                <input type="file" id="hw-file-input" style="display:none;">
                             </label>
                             <button id="hw-btn-submit" class="action-btn" style="width:auto; padding:10px 30px;">Envoyer mon travail 🤖</button>
                        </div>
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
        input: document.getElementById("hw-answer-input"),
        btnSubmit: document.getElementById("hw-btn-submit")
    };

    let currentHw = null;
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };

    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        ui.listTarget.innerHTML = "";
        if(!hws || hws.length === 0) {
            ui.listTarget.innerHTML = "<p style='text-align:center; padding:40px; color:#94a3b8;'>Aucun devoir. 🌴</p>";
            return;
        }
        hws.forEach(hw => {
            const d = document.createElement("div");
            d.className = "card";
            d.style.cssText = "display:flex; justify-content:space-between; align-items:center; cursor:pointer; border:1px solid #eee; margin-bottom:10px; padding:15px;";
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
        ui.qText.innerHTML = firstLvl.instruction.replace(/\n/g, '<br>');
        docs = firstLvl.attachmentUrls || [];
        docIdx = 0;
        renderDoc();
    };

    function renderDoc() {
        if (docs.length === 0) return;
        ui.img.style.display = "block";
        ui.img.onload = () => {
            const container = document.getElementById("doc-viewer");
            const ratioW = (container.offsetWidth * 0.9) / ui.img.naturalWidth;
            const ratioH = (container.offsetHeight * 0.9) / ui.img.naturalHeight;
            view = { x: 0, y: 0, scale: Math.min(ratioW, ratioH) };
            updateTransform();
        };
        ui.img.src = docs[docIdx];
        document.getElementById("hw-page-counter").innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform() {
        const content = document.getElementById("pan-zoom-content");
        if(content) content.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }

    // --- EVENTS ---
    document.getElementById("btn-prev-doc").onclick = () => { if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = () => { if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = () => { view.scale += 0.2; updateTransform(); };
    document.getElementById("btn-zoom-out").onclick = () => { view.scale -= 0.2; updateTransform(); };
    document.getElementById("btn-close-hw").onclick = () => { ui.workView.style.display = "none"; ui.listView.style.display = "block"; };

    // Pan (Drag)
    let isDown = false, startX, startY;
    const vCont = document.getElementById("doc-viewer");
    vCont.onmousedown = (e) => {
        if(e.target.tagName === 'BUTTON') return;
        isDown = true; vCont.style.cursor = "grabbing";
        startX = e.clientX - view.x; startY = e.clientY - view.y;
    };
    window.onmousemove = (e) => {
        if(!isDown) return;
        view.x = e.clientX - startX; view.y = e.clientY - startY;
        updateTransform();
    };
    window.onmouseup = () => { isDown = false; vCont.style.cursor = "grab"; };

    loadList();
}