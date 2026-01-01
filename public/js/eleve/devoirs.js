export async function initDevoirsModule(container) {
    console.log("📚 Lancement de la Liseuse de Devoirs V22");

    container.innerHTML = `
        <div class="hw-layout">
            <!-- VUE 1 : LISTE -->
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Tes Devoirs Maison</h3>
                <div id="hw-items-container">Chargement...</div>
            </div>

            <!-- VUE 2 : TRAVAIL -->
            <div id="hw-work-view" class="hw-work-view" style="display:none;">
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

                <div class="interaction-zone">
                    <div class="question-part">
                        <b style="color:var(--primary); font-size:0.8em; display:block; margin-bottom:5px;">CONSIGNE :</b>
                        <div id="hw-question-text" style="font-weight:bold; line-height:1.4; color:#1e293b;"></div>
                    </div>
                    <div class="answer-part">
                        <textarea id="hw-answer-input" placeholder="Écris ta réponse ici..."></textarea>
                        <button id="hw-btn-submit" class="action-btn">Envoyer à l'IA 🤖</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const listTarget = document.getElementById("hw-items-container");
    const workView = document.getElementById("hw-work-view");
    const listView = document.getElementById("hw-list-view");

    // --- VARIABLES D'ÉTAT LOCALES ---
    let currentHw = null;
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };

    // --- CHARGEMENT ---
    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        listTarget.innerHTML = "";
        if(!hws || hws.length === 0) {
            listTarget.innerHTML = "<p style='text-align:center; padding:40px;'>Aucun devoir disponible. 🌴</p>";
            return;
        }
        hws.forEach(hw => {
            const d = document.createElement("div");
            d.className = "card";
            d.style.cssText = "display:flex; justify-content:space-between; align-items:center; cursor:pointer; border:1px solid #eee; margin-bottom:10px; padding:15px;";
            d.innerHTML = `<div><b>${hw.title}</b><br><small>Publié le ${new Date(hw.date).toLocaleDateString()}</small></div><span style='font-size:1.2rem;'>➔</span>`;
            d.onclick = () => startHw(hw);
            listTarget.appendChild(d);
        });
    };

    const startHw = (hw) => {
        currentHw = hw;
        listView.style.display = "none";
        workView.style.display = "flex";
        
        const firstLvl = hw.levels[0];
        document.getElementById("hw-question-text").innerHTML = firstLvl.instruction.replace(/\n/g, '<br>');
        docs = firstLvl.attachmentUrls || [];
        docIdx = 0;
        renderDoc();
    };

    function renderDoc() {
        if (docs.length === 0) return;
        const img = document.getElementById("current-doc-img");
        const container = document.getElementById("doc-viewer");
        img.style.display = "block";
        img.onload = () => {
            // Fit-to-screen
            const ratioW = (container.offsetWidth * 0.95) / img.naturalWidth;
            const ratioH = (container.offsetHeight * 0.95) / img.naturalHeight;
            view = { x: 0, y: 0, scale: Math.min(ratioW, ratioH) };
            updateTransform();
        };
        img.src = docs[docIdx];
        document.getElementById("hw-page-counter").innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform() {
        const content = document.getElementById("pan-zoom-content");
        content.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }

    // --- ÉVÉNEMENTS ---
    document.getElementById("btn-prev-doc").onclick = () => { if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = () => { if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = () => { view.scale += 0.15; updateTransform(); };
    document.getElementById("btn-zoom-out").onclick = () => { view.scale -= 0.15; updateTransform(); };
    document.getElementById("btn-close-hw").onclick = () => { workView.style.display = "none"; listView.style.display = "block"; };

    // Pan & Drag
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

    // Submit IA
    document.getElementById("hw-btn-submit").onclick = async () => {
        const val = document.getElementById("hw-answer-input").value.trim();
        if(!val) return alert("Écris ta réponse !");
        const btn = document.getElementById("hw-btn-submit");
        btn.disabled = true; btn.innerText = "Analyse IA...";
        
        try {
            const res = await window.api.post('/api/analyze-homework', {
                userText: val,
                homeworkInstruction: currentHw.levels[0].instruction,
                classroom: window.state.user.classroom,
                playerId: window.state.currentPlayerId,
                homeworkId: currentHw._id
            });
            alert("Analyse terminée ! Note indicative : " + res.grade);
            window.location.reload();
        } catch(e) { btn.disabled = false; btn.innerText = "Envoyer à l'IA 🤖"; }
    };

    loadList();
}