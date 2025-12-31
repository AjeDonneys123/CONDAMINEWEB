export async function initProfDashboard() {
    console.log("🎓 Dashboard Enseignant - Version Intégrale");
    const dashboard = document.getElementById("profDashboard");
    if(dashboard) dashboard.style.display = "block";
    
    // On réinitialise l'interface
    renderEditorBase();
    setupListeners();
    loadGameLevels();
    fetchAndRenderPlayers();
}

function renderEditorBase() {
    const dashboard = document.getElementById("profDashboard");
    dashboard.innerHTML = `
        <div class="tabs-container" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:2px solid #eee; padding-bottom:10px;">
            <button id="tabStudents" class="action-btn" style="background:#64748b;">👥 Élèves</button>
            <button id="tabHomeworks" class="action-btn" style="background:#64748b;">📚 Devoirs</button>
            <button id="tabGames" class="action-btn">🎮 Créateur de Jeux</button>
        </div>

        <div id="contentStudents" class="tab-content" style="display:none;">
            <div style="margin-bottom: 15px;">
                <select id="classFilter" style="width:100%; padding:8px;">
                    <option value="all">Toutes les classes</option>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                    <option value="2A">2de A</option><option value="2CD">2de CD</option>
                </select>
            </div>
            <table id="playersTable" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding:10px; text-align:left;">Prénom</th>
                        <th style="padding:10px; text-align:left;">Classe</th>
                        <th style="padding:10px; text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody id="playersBody"></tbody>
            </table>
        </div>

        <div id="contentHomeworks" class="tab-content" style="display:none;">
            <button id="addHomeworkBtn" class="action-btn" style="margin-bottom:15px; background:var(--success);">➕ Nouveau Devoir</button>
            <div id="homeworksListContainer">Chargement des devoirs...</div>
        </div>

        <div id="contentGames" class="tab-content">
            <div id="editorZone" style="display:flex; gap:20px;">
                <div style="flex:1; border-right:1px solid #eee; padding-right:15px;">
                    <h3>📂 Mes Niveaux (BDD)</h3>
                    <div id="levelsList" style="max-height:600px; overflow-y:auto;">Chargement...</div>
                </div>

                <div style="flex:2; background:#fff; padding:20px; border-radius:12px;">
                    <h3 id="lvlEditorTitle">Éditeur de Niveau</h3>
                    
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input id="lvlTitle" placeholder="Titre (ex: Le Présent)" style="flex:2; padding:10px; border-radius:8px; border:1px solid #ccc;">
                        <select id="lvlClass" style="flex:1; padding:10px; border-radius:8px;">
                            <option value="6e">6e</option><option value="5e">5e</option><option value="2de">2de</option>
                        </select>
                    </div>

                    <select id="lvlChapter" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;">
                        <option value="ch1-zombie">🧟 Zombie (Quiz)</option>
                        <option value="ch2-starship">🚀 Starship (Quiz)</option>
                        <option value="ch3-jumper">🏃 Jumper (Quiz)</option>
                        <option value="ch4-redaction">📝 Rédaction</option>
                    </select>
                    
                    <textarea id="lvlLesson" placeholder="Contenu de la leçon (optionnel)..." style="width:100%; height:60px; padding:10px; margin-bottom:15px; border-radius:8px; border:1px solid #ccc;"></textarea>

                    <h4 style="margin-bottom:10px;">Questions dans ce niveau :</h4>
                    <div id="visualQuestionsList" class="visual-questions-container">
                        Aucune question pour l'instant.
                    </div>

                    <div id="manualInputZone" style="background:#f0f7ff; padding:15px; border-radius:12px; border:1px solid #cbd5e1; margin-top:20px;">
                        <label><b>Nouvelle Question :</b></label>
                        <input id="mQ" placeholder="Tape l'énoncé de la question..." style="width:100%; padding:10px; margin:5px 0 15px 0; border-radius:8px; border:1px solid #ccc;">
                        
                        <label><b>Options (Clique sur la lettre pour définir la réponse correcte) :</b></label>
                        <div id="optionsPreviewContainer" style="margin-top:10px;">
                            ${['A','B','C','D'].map((letter, i) => `
                                <div class="manual-opt-row ${i === 0 ? 'selected' : ''}" data-index="${i}" onclick="window.selectGoodAnswer(${i})">
                                    <span class="manual-opt-label">${letter}:</span>
                                    <input class="manual-opt-input" id="mO${i}" placeholder="Réponse ${letter}...">
                                </div>
                            `).join('')}
                        </div>
                        <button id="btnAddQ" style="width:100%; background:var(--success); color:white; padding:12px; margin-top:10px; border-radius:8px;">➕ Ajouter la question</button>
                    </div>

                    <div style="margin-top:20px; display:flex; gap:10px;">
                        <button id="btnSaveLvl" style="flex:2; background:var(--primary); color:white; padding:15px; font-size:1.1em; border-radius:8px;">💾 ENREGISTRER LE NIVEAU COMPLET</button>
                        <button id="btnResetEditor" style="flex:1; background:var(--danger); color:white; border-radius:8px;">Vider l'éditeur</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentQuestions = [];
let selectedGoodIndex = 0;

window.selectGoodAnswer = (idx) => {
    selectedGoodIndex = idx;
    document.querySelectorAll('.manual-opt-row').forEach((row, i) => {
        if(i === idx) row.classList.add('selected');
        else row.classList.remove('selected');
    });
};

function setupListeners() {
    const tabStudents = document.getElementById("tabStudents");
    const tabHomeworks = document.getElementById("tabHomeworks");
    const tabGames = document.getElementById("tabGames");

    const showTab = (tabId) => {
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        if(tabId === 'students') document.getElementById('contentStudents').style.display = 'block';
        if(tabId === 'homeworks') document.getElementById('contentHomeworks').style.display = 'block';
        if(tabId === 'games') document.getElementById('contentGames').style.display = 'block';
    };

    tabStudents.onclick = () => showTab('students');
    tabHomeworks.onclick = () => { showTab('homeworks'); loadHomeworksList(); };
    tabGames.onclick = () => showTab('games');

    document.getElementById("btnAddQ").onclick = () => {
        const q = document.getElementById("mQ").value.trim();
        const opts = [
            document.getElementById("mO0").value.trim(),
            document.getElementById("mO1").value.trim(),
            document.getElementById("mO2").value.trim(),
            document.getElementById("mO3").value.trim()
        ].filter(o => o !== "");

        if(!q || opts.length < 2) return alert("Il faut une question et au moins 2 réponses.");
        if(selectedGoodIndex >= opts.length) return alert("La réponse correcte sélectionnée (A, B, C ou D) doit correspondre à une case remplie !");

        currentQuestions.push({ q, options: opts, a: selectedGoodIndex });
        renderVisualQuestions();
        
        // Reset inputs
        document.getElementById("mQ").value = "";
        ['mO0','mO1','mO2','mO3'].forEach(id => document.getElementById(id).value = "");
    };

    document.getElementById("btnSaveLvl").onclick = async () => {
        const title = document.getElementById("lvlTitle").value.trim();
        if(!title || currentQuestions.length === 0) return alert("Titre et questions requis !");
        
        const data = {
            title,
            chapterId: document.getElementById("lvlChapter").value,
            classroom: document.getElementById("lvlClass").value,
            lesson: document.getElementById("lvlLesson").value,
            questions: currentQuestions
        };

        const res = await window.api.post('/api/game-levels', data);
        if(res.ok) { 
            alert("Niveau sauvegardé avec succès en BDD !"); 
            currentQuestions = []; 
            document.getElementById("lvlTitle").value = "";
            document.getElementById("lvlLesson").value = "";
            renderVisualQuestions(); 
            loadGameLevels(); 
        }
    };

    document.getElementById("btnResetEditor").onclick = () => {
        if(confirm("Voulez-vous vraiment vider l'éditeur ?")) {
            currentQuestions = [];
            renderVisualQuestions();
        }
    };

    const classFilter = document.getElementById("classFilter");
    if(classFilter) classFilter.onchange = fetchAndRenderPlayers;
}

function renderVisualQuestions() {
    const cont = document.getElementById("visualQuestionsList");
    if(currentQuestions.length === 0) { 
        cont.innerHTML = "<p style='color:#94a3b8; font-style:italic;'>Aucune question pour l'instant.</p>"; 
        return; 
    }
    
    cont.innerHTML = currentQuestions.map((q, idx) => `
        <div class="visual-q-item" style="border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 10px; background: white;">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <b style="color:var(--primary);">Question ${idx+1}: ${q.q}</b>
                <button onclick="window.removeQuestionFromCurrent(${idx})" style="color:var(--danger); background:none; font-size:1.2rem;">🗑️</button>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:10px;">
                ${q.options.map((opt, i) => `
                    <div style="padding:6px 10px; border-radius:5px; border: 1px solid ${i === q.a ? 'var(--success)' : '#eee'}; background: ${i === q.a ? '#f0fdf4' : '#fcfcfc'}; color: ${i === q.a ? 'var(--success)' : '#475569'}; font-size: 0.9em;">
                        <b style="margin-right:5px;">${String.fromCharCode(65 + i)}:</b> ${opt} 
                        ${i === q.a ? '✓' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

window.removeQuestionFromCurrent = (idx) => {
    currentQuestions.splice(idx, 1);
    renderVisualQuestions();
};

async function loadGameLevels() {
    const list = document.getElementById("levelsList");
    const lvls = await window.api.get(`/api/game-levels/Toutes`) || [];
    if(lvls.length === 0) {
        list.innerHTML = "<p>Aucun niveau créé.</p>";
        return;
    }
    list.innerHTML = lvls.map(l => `
        <div class="level-db-card" style="padding:10px; border:1px solid #ddd; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <b style="font-size:0.95em;">${l.title}</b><br>
                <small style="color:#64748b;">${l.chapterId} • ${l.classroom} • ${l.questions.length} Q</small>
            </div>
            <button onclick="window.deleteLvlFromDB('${l._id}')" style="background:none; color:var(--danger); font-size:1.1rem;">🗑️</button>
        </div>
    `).join('');
}

window.deleteLvlFromDB = async (id) => {
    if(confirm("Supprimer définitivement ce niveau de la base de données ?")) {
        await fetch(`/api/game-levels/${id}`, { method: 'DELETE' });
        loadGameLevels();
    }
};

async function fetchAndRenderPlayers() {
    const filter = document.getElementById("classFilter").value;
    const players = await window.api.fetchPlayers();
    const body = document.getElementById("playersBody");
    const filtered = players.filter(p => filter === "all" || p.classroom === filter);
    
    body.innerHTML = filtered.map(p => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:10px;">${p.firstName} ${p.lastName}</td>
            <td style="padding:10px;">${p.classroom}</td>
            <td style="padding:10px; text-align:center;">
                <button onclick="alert('Fonctionnalité de suivi en cours')" style="background:#e2e8f0; color:#475569; padding:5px 10px; border-radius:4px;">Suivi</button>
            </td>
        </tr>
    `).join('');
}

async function loadHomeworksList() {
    const container = document.getElementById("homeworksListContainer");
    const hws = await window.api.getHomeworks();
    if(hws.length === 0) {
        container.innerHTML = "<p>Aucun devoir créé.</p>";
        return;
    }
    container.innerHTML = hws.map(h => `
        <div style="padding:10px; border:1px solid #ddd; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between;">
            <span><b>${h.title}</b> (${h.classroom})</span>
            <button onclick="alert('Edition bientôt disponible')" style="color:var(--primary); background:none;">✏️</button>
        </div>
    `).join('');
}