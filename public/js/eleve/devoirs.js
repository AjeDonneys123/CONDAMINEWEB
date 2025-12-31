export async function initDevoirsModule(container) {
    console.log("📚 Chargement du module Devoirs...");

    container.innerHTML = `
        <div class="hw-layout">
            <!-- VUE LISTE -->
            <div id="hw-list-view" class="hw-list-view">
                <h3 style="margin-top:0; color:var(--primary);">📚 Mes Devoirs Maison</h3>
                <div id="hw-items-container">Chargement...</div>
            </div>

            <!-- VUE TRAVAIL (LISEUSE) -->
            <div id="hw-work-view" class="hw-work-view" style="display:none;">
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

                <div class="interaction-zone">
                    <div class="question-part">
                        <b style="color:var(--primary); font-size:0.8em;">CONSIGNE :</b>
                        <div id="hw-question-text" style="font-weight:bold; margin-top:5px;"></div>
                    </div>
                    <div class="answer-part">
                        <textarea id="hw-answer-input" placeholder="Écris ta réponse ici..."></textarea>
                        <button id="hw-btn-submit" class="action-btn">Envoyer mon travail 🤖</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const listTarget = document.getElementById("hw-items-container");
    const workView = document.getElementById("hw-work-view");
    const listView = document.getElementById("hw-list-view");

    // NAVIGATION
    const loadList = async () => {
        // window.api.getHomeworks est maintenant défini dans app.js !
        const hws = await window.api.getHomeworks(window.state.user.classroom);
        if(!hws || hws.length === 0) {
            listTarget.innerHTML = "<p style='text-align:center; padding:40px;'>Aucun devoir. 🌴</p>";
            return;
        }
        listTarget.innerHTML = hws.map(hw => `
            <div class="hw-list-item card" onclick='window.launchHw("${hw._id}")' style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <div><b>${hw.title}</b><br><small>Publié le ${new Date(hw.date).toLocaleDateString()}</small></div>
                <span>➔</span>
            </div>
        `).join('');

        // On attache l'ID à une fonction globale temporaire pour le clic
        window.launchHw = (id) => {
            const hw = hws.find(h => h._id === id);
            startHwWorkspace(hw);
        };
    };

    // LOGIQUE DE LA LISEUSE
    let docs = [];
    let docIdx = 0;
    let view = { x: 0, y: 0, scale: 1.0 };

    function startHwWorkspace(hw) {
        listView.style.display = "none";
        workView.style.display = "flex";
        
        const firstLvl = hw.levels[0];
        document.getElementById("hw-question-text").innerHTML = firstLvl.instruction.replace(/\n/g, '<br>');
        docs = firstLvl.attachmentUrls || [];
        docIdx = 0;
        
        renderDoc();

        // Bouton Submit
        document.getElementById("hw-btn-submit").onclick = async () => {
            const val = document.getElementById("hw-answer-input").value.trim();
            if(!val) return alert("Réponse vide !");
            const btn = document.getElementById("hw-btn-submit");
            btn.disabled = true;
            btn.innerText = "Analyse...";
            const res = await window.api.post('/api/analyze-homework', {
                userText: val,
                homeworkInstruction: firstLvl.instruction,
                playerId: window.state.currentPlayerId
            });
            alert("Travail reçu ! Note : " + res.grade);
            window.location.reload();
        };
    }

    function renderDoc() {
        if (docs.length === 0) return;
        const img = document.getElementById("current-doc-img");
        const container = document.getElementById("doc-viewer");
        img.style.display = "block";
        img.onload = () => {
            const ratioW = (container.offsetWidth * 0.9) / img.naturalWidth;
            const ratioH = (container.offsetHeight * 0.9) / img.naturalHeight;
            view = { x: 0, y: 0, scale: Math.min(ratioW, ratioH) };
            updateTransform();
        };
        img.src = docs[docIdx];
        document.getElementById("hw-page-counter").innerText = `${docIdx + 1} / ${docs.length}`;
    }

    function updateTransform() {
        document.getElementById("pan-zoom-content").style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }

    document.getElementById("btn-prev-doc").onclick = () => { if(docIdx > 0) { docIdx--; renderDoc(); } };
    document.getElementById("btn-next-doc").onclick = () => { if(docIdx < docs.length - 1) { docIdx++; renderDoc(); } };
    document.getElementById("btn-zoom-in").onclick = () => { view.scale += 0.2; updateTransform(); };
    document.getElementById("btn-zoom-out").onclick = () => { view.scale -= 0.2; updateTransform(); };
    document.getElementById("btn-close-hw").onclick = () => { workView.style.display = "none"; listView.style.display = "block"; };

    loadList();
}