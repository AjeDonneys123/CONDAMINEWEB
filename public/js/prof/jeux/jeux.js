export async function initJeuxModule(container) {
    console.log("📂 Sous-module CRÉATEUR JEUX chargé");

    container.innerHTML = `
        <div id="game-editor-layout" style="display:flex; gap:20px;">
            <div class="editor-sidebar" style="flex:1;">
                <h3>📂 Niveaux en BDD</h3>
                <div id="db-levels-list"></div>
            </div>
            
            <div class="editor-main" style="flex:2;">
                <div class="card">
                    <h3>🛠️ Éditeur de Niveau</h3>
                    <input id="lvl-title" placeholder="Titre (ex: Les adjectifs)">
                    <select id="lvl-chapter">
                        <option value="ch1-zombie">🧟 Zombie (Quiz)</option>
                        <option value="ch2-starship">🚀 Starship</option>
                    </select>
                    
                    <label><b>Aperçu des questions :</b></label>
                    <div id="editor-visual-list" class="visual-list" style="margin-bottom:15px;"></div>

                    <div class="manual-input-box">
                        <input id="mQ" placeholder="Énoncé de la question...">
                        <div class="abcd-grid">
                            ${['A','B','C','D'].map((l, i) => `
                                <div class="opt-row ${i === 0 ? 'selected' : ''}" id="row-${i}" onclick="window.setGood(${i})">
                                    <span class="opt-letter">${l}</span>
                                    <input id="mO${i}" placeholder="Réponse ${l}..." class="opt-field">
                                </div>
                            `).join('')}
                        </div>
                        <button id="btn-add-q" class="action-btn" style="background:var(--success); margin-top:10px;">➕ Ajouter</button>
                    </div>

                    <button id="btn-save-level" class="action-btn" style="margin-top:20px; font-size:1.1rem;">💾 ENREGISTRER LE NIVEAU</button>
                </div>
            </div>
        </div>
    `;

    let questions = [];
    let correctIdx = 0;

    window.setGood = (idx) => {
        correctIdx = idx;
        document.querySelectorAll('.opt-row').forEach((r, i) => r.classList.toggle('selected', i === idx));
    };

    const visualList = document.getElementById("editor-visual-list");

    const refreshVisual = () => {
        if(!questions.length) { visualList.innerHTML = "<i>Aucune question.</i>"; return; }
        visualList.innerHTML = questions.map((q, i) => `
            <div class="visual-q">
                <b>${i+1}. ${q.q}</b><br>
                <small>${q.options.join(' | ')} (Correct: ${['A','B','C','D'][q.a]})</small>
            </div>
        `).join('');
    };

    document.getElementById("btn-add-q").onclick = () => {
        const q = document.getElementById("mQ").value.trim();
        const opts = [0,1,2,3].map(i => document.getElementById(`mO${i}`).value.trim()).filter(v => v !== "");
        if(!q || opts.length < 2) return alert("Données manquantes.");
        questions.push({ q, options: opts, a: correctIdx });
        refreshVisual();
        document.getElementById("mQ").value = "";
        [0,1,2,3].forEach(i => document.getElementById(`mO${i}`).value = "");
    };

    document.getElementById("btn-save-level").onclick = async () => {
        const title = document.getElementById("lvl-title").value.trim();
        if(!title || !questions.length) return alert("Titre ou questions manquant.");
        const res = await window.api.post('/api/game-levels', {
            title, chapterId: document.getElementById("lvl-chapter").value,
            questions, classroom: "Toutes"
        });
        if(res.ok) { alert("Sauvegardé !"); questions = []; refreshVisual(); loadDBLevels(); }
    };

    const loadDBLevels = async () => {
        const lvls = await window.api.get('/api/game-levels/Toutes');
        const cont = document.getElementById("db-levels-list");
        cont.innerHTML = lvls.map(l => `
            <div class="lvl-item">
                <span><b>${l.title}</b></span>
                <button onclick="window.delLvl('${l._id}')" style="color:red; background:none;">🗑️</button>
            </div>
        `).join('');
    };

    window.delLvl = async (id) => {
        if(confirm("Supprimer ?")) { await fetch(`/api/game-levels/${id}`, {method:'DELETE'}); loadDBLevels(); }
    };

    refreshVisual();
    loadDBLevels();
}