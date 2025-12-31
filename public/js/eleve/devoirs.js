export async function initDevoirsModule(container) {
    console.log("%c📚 LISEUSE DEVOIRS V22 - ACTIVÉE", "color: white; background: #2563eb; padding: 5px;");

    // 1. Rendu de la structure (Vue Liste par défaut)
    container.innerHTML = `
        <div class="hw-layout">
            <!-- VUE 1 : LISTE DES DEVOIRS -->
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Mes Travaux à rendre</h3>
                <div id="hw-items-container">Chargement...</div>
            </div>

            <!-- VUE 2 : ZONE DE TRAVAIL (LISEUSE + QUESTION) -->
            <div id="hw-work-view" class="hw-work-view" style="display:none;">
                
                <!-- HAUT : LA LISEUSE (70% de la hauteur) -->
                <div id="doc-viewer" class="doc-viewer-container">
                    <div id="pan-zoom-content">
                        <img id="current-doc-img" src="" style="display:none;">
                    </div>
                    
                    <div class="page-counter" id="hw-page-counter">1 / 1</div>
                    
                    <button id="btn-prev-doc" class="nav-arrow" style="left:15px;">❮</button>
                    <button id="btn-next-doc" class="nav-arrow" style="right:15px;">❯</button>
                    
                    <div class="doc-controls">
                        <button class="zoom-btn" id="btn-zoom-out">➖</button>
                        <button class="zoom-btn" id="btn-zoom-in">➕</button>
                    </div>
                    
                    <button id="btn-close-hw" style="position:absolute; top:15px; left:15px; background:var(--danger); color:white; padding:8px 15px; z-index:100;">✕ Quitter</button>
                </div>

                <!-- BAS : INTERACTION (30% de la hauteur) -->
                <div class="interaction-zone">
                    <div class="question-part">
                        <b style="color:var(--primary); font-size:0.8em; display:block; margin-bottom:5px;">CONSIGNE :</b>
                        <div id="hw-question-text" style="font-weight:bold; line-height:1.4;"></div>
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

    // --- LOGIQUE DE NAVIGATION ---
    const loadList = async () => {
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        if(!hws || hws.length === 0) {
            listTarget.innerHTML = "<p style='text-align:center; padding:40px; color:#94a3b8;'>Aucun devoir. C'est les vacances ! 🌴</p>";
            return;
        }

        listTarget.innerHTML = hws.map(hw => `
            <div class="hw-list-item card" onclick="window.launchHwWorkspace(${JSON.stringify(hw).replace(/"/g, '&quot;')})">
                <div>
                    <b>${hw.title}</b><br>
                    <small>Publié le ${new Date(hw.date).toLocaleDateString()}</small>
                </div>
                <div style="background:var(--primary); color:white; width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center;">➔</div>
            </div>
        `).join('');
    };

    // --- LOGIQUE DE LA LISEUSE (PAN & ZOOM) ---
    let currentHw = null;
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };

    window.launchHwWorkspace = (hw) => {
        console.log("📖 Ouverture du devoir :", hw.title);
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
        const counter = document.getElementById("hw-page-counter");
        const container = document.getElementById("doc-viewer");

        img.style.display = "block";
        img.onload = () => {
            // Fit-to-screen automatique
            const ratioW = (container.offsetWidth * 0.9) / img.naturalWidth;
            const ratioH = (container.offsetHeight * 0.9) / img.naturalHeight;
            view.scale = Math.min(ratioW, ratioH);
            view.x = 0; view.y = 0;
            updateTransform();
        };
        img.src = docs[docIdx];
        counter.innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform() {
        const content = document.getElementById("pan-zoom-content");
        content.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }

    // --- ÉVÉNEMENTS LISEUSE ---
    document.getElementById("btn-prev-doc").onclick = () => { if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = () => { if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = () => { view.scale += 0.2; updateTransform(); };
    document.getElementById("btn-zoom-out").onclick = () => { view.scale -= 0.2; updateTransform(); };
    document.getElementById("btn-close-hw").onclick = () => { workView.style.display = "none"; listView.style.display = "block"; };

    // Drag & Pan
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

    // --- ENVOI IA ---
    document.getElementById("hw-btn-submit").onclick = async () => {
        const input = document.getElementById("hw-answer-input");
        const val = input.value.trim();
        if(!val) return alert("Ta réponse est vide !");

        const btn = document.getElementById("hw-btn-submit");
        btn.disabled = true;
        btn.innerText = "Analyse IA en cours... 🧠";

        try {
            const res = await window.api.post('/api/analyze-homework', {
                userText: val,
                homeworkInstruction: currentHw.levels[0].instruction,
                classroom: window.state.user.classroom,
                playerId: window.state.currentPlayerId,
                homeworkId: currentHw._id
            });

            // Affichage du feedback dans une alerte simple ou modale
            alert("Travail analysé ! Note indicative : " + res.grade);
            window.location.reload();
        } catch(e) { 
            alert("Erreur lors de l'analyse."); 
            btn.disabled = false; btn.innerText = "Envoyer à l'IA 🤖";
        }
    };

    loadList();
}