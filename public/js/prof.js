// ==================================================
export function initProfDashboard() {
    console.log("🎓 Prof Dashboard Init (V4 - Menu Déroulant & Liste Visuelle)");
    const dashboard = document.getElementById("profDashboard");
    if(dashboard) dashboard.style.display = "block";
    
    // --- UI DASHBOARD ---
    const tabsHtml = `
      <div class="tabs-container">
          <button id="tabStudents" class="tab-btn active">👥 Élèves</button>
          <button id="tabHomeworks" class="tab-btn">📚 Devoirs</button>
          <button id="tabGames" class="tab-btn">🎮 Créateur de Jeux</button>
          <button id="viewBugsBtn" class="tab-btn" style="color:#7c3aed; margin-left:auto;">🐛 Bugs</button>
      </div>
      
      <!-- CONTENU ELEVES -->
      <div id="contentStudents" class="tab-content active">
        <div style="margin-bottom: 15px;"><select id="classFilter" style="width:100%; padding:8px;"><option value="all">Toutes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2de A</option><option value="2CD">2de CD</option></select></div>
        <button id="testClassBtn" style="width:100%; padding:12px; background:#3b82f6; color:white; border:none; border-radius:8px; margin-bottom:15px; font-weight:bold;">🎮 Tester classe</button>
        <input id="studentSearch" placeholder="Rechercher..." style="width:100%; padding:10px; margin-bottom:15px;">
        <table id="playersTable" style="width:100%; border-collapse:collapse;"><thead style="background:#f8fafc;"><tr><th style="padding:10px;">Prénom</th><th style="padding:10px;">Classe</th><th style="padding:10px;">Progression</th><th style="padding:10px;">Actions</th></tr></thead><tbody id="playersBody"></tbody></table>
      </div>

      <!-- CONTENU DEVOIRS -->
      <div id="contentHomeworks" class="tab-content" style="display:none;">
          <button id="addHomeworkBtn" class="action-btn" style="margin-bottom:15px;">➕ Nouveau Devoir</button>
          <table style="width:100%; text-align:left;"><tbody id="profHomeworksBody"></tbody></table>
      </div>

      <!-- CONTENU JEUX (CREATEUR) -->
      <div id="contentGames" class="tab-content" style="display:none;">
          <div style="display:flex; gap:20px;">
              <!-- COLONNE GAUCHE : LISTE DES NIVEAUX -->
              <div style="flex:1; border-right:1px solid #eee; padding-right:15px;">
                  <h3>📂 Mes Niveaux</h3>
                  <select id="gameClassFilter" style="width:100%; padding:8px; margin-bottom:10px; border-radius:6px; border:1px solid #ccc;">
                      <option value="all">Toutes les classes</option>
                      <option value="6D">6eD</option><option value="5B">5eB</option>
                      <option value="5C">5eC</option><option value="2A">2de A</option>
                  </select>
                  <div id="levelsList" style="max-height:500px; overflow-y:auto;">Chargement...</div>
                  <button id="btnNewLevel" style="width:100%; margin-top:10px; padding:10px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer;">+ Nouveau Niveau</button>
              </div>
              
              <!-- COLONNE DROITE : EDITEUR -->
              <div style="flex:2; background:#f8fafc; padding:20px; border-radius:12px; border:1px solid #e2e8f0;">
                  <h3 id="editorTitle">Créer / Éditer un niveau</h3>
                  
                  <!-- SELECTION DU JEU (IMPORTANT : IDs FIXES) -->
                  <label style="font-weight:bold; font-size:0.9em;">Jeu & Chapitre :</label>
                  <select id="lvlChapter" style="width:100%; padding:10px; margin-bottom:15px; border-radius:6px; border:1px solid #2563eb; background:#eff6ff;">
                      <option value="ch1-zombie">🧟 Chap 1 : Zombie (Quiz)</option>
                      <option value="ch2-starship">🚀 Chap 2 : Starship (Quiz)</option>
                      <option value="ch3-jumper">🏃 Chap 3 : Jumper (Quiz)</option>
                      <option value="ch4-redaction">📝 Chap 4 : Rédaction (Texte)</option>
                  </select>

                  <div style="display:flex; gap:10px; margin-bottom:15px;">
                      <div style="flex:2;">
                          <input id="lvlTitle" placeholder="Titre (ex: Le Présent)" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc;">
                      </div>
                      <div style="flex:1;">
                          <select id="lvlClass" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc;">
                              <option value="6e">6e</option><option value="5e">5e</option><option value="2de">2de</option>
                          </select>
                      </div>
                  </div>
                  
                  <textarea id="lvlLesson" placeholder="Contenu de la leçon (optionnel)..." style="width:100%; height:60px; padding:8px; margin-bottom:15px; border:1px solid #ccc; border-radius:6px;"></textarea>

                  <!-- LISTE DES QUESTIONS ACTUELLES (VISUEL) -->
                  <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:15px;">
                      <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Questions dans ce niveau :</h4>
                      <div id="visualQuestionsList" style="max-height:200px; overflow-y:auto; font-size:0.9em; color:#475569;">
                          Aucune question pour l'instant.
                      </div>
                  </div>

                  <!-- BOUTONS D'AJOUT -->
                  <div style="display:flex; gap:10px; margin-bottom:10px;">
                      <button id="modeManualBtn" style="flex:1; padding:8px; background:#2563eb; color:white; border:none; cursor:pointer; border-radius:6px;">✍️ Ajouter Manuellement</button>
                      <button id="modeAutoBtn" style="flex:1; padding:8px; background:white; border:1px solid #ccc; cursor:pointer; border-radius:6px;">🤖 Générer avec l'IA</button>
                  </div>

                  <!-- ZONE MANUELLE -->
                  <div id="manualZone" style="background:#f0fdf4; padding:15px; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:15px;">
                      <input id="mQ" placeholder="La question ?" style="width:100%; padding:8px; margin-bottom:5px;">
                      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin-bottom:5px;">
                        <input id="mO0" placeholder="Réponse A"> <input id="mO1" placeholder="Réponse B">
                        <input id="mO2" placeholder="Réponse C"> <input id="mO3" placeholder="Réponse D">
                      </div>
                      <div style="display:flex; gap:10px; align-items:center;">
                          <select id="mGood" style="padding:8px;"><option value="0">Bonne réponse : A</option><option value="1">Bonne réponse : B</option><option value="2">Bonne réponse : C</option><option value="3">Bonne réponse : D</option></select>
                          <button id="btnAddManualQ" style="background:#16a34a; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">OK</button>
                      </div>
                  </div>
                  
                  <!-- ZONE IA -->
                  <div id="aiZone" style="display:none; background:#e0f2fe; padding:15px; border-radius:8px; border:1px solid #bae6fd; margin-bottom:15px;">
                      <p style="margin:0 0 10px 0;">Envoyez un cours PDF ou tapez un sujet :</p>
                      <input type="file" id="aiDocFile" style="margin-bottom:10px;">
                      <input id="aiTopic" placeholder="Sujet (ex: Les verbes du 2e groupe)" style="width:100%; padding:8px; margin-bottom:10px;">
                      <button id="btnLaunchAI" style="background:#7c3aed; color:white; border:none; padding:8px 15px; cursor:pointer; border-radius:4px;">Générer 5 questions</button>
                      <div id="aiStatus" style="margin-top:5px; font-weight:bold;"></div>
                  </div>

                  <!-- INPUT JSON CACHÉ (MAIS UTILE POUR LE CODE) -->
                  <textarea id="lvlQuestions" style="display:none;">[]</textarea>
                  
                  <div style="display:flex; gap:10px;">
                      <button id="btnSaveLevel" style="flex:2; padding:15px; background:#1e293b; color:white; border:none; font-weight:bold; cursor:pointer; font-size:1.1em; border-radius:8px;">💾 ENREGISTRER</button>
                      <button id="btnCancelEdit" style="flex:1; padding:15px; background:#ef4444; color:white; border:none; cursor:pointer; border-radius:8px; display:none;">Annuler</button>
                  </div>
              </div>
          </div>
      </div>
    `;

    dashboard.innerHTML = tabsHtml; 
    
    // --- NAVIGATION ONGLETS ---
    const switchTab = (id) => {
        ['contentStudents','contentHomeworks','contentGames'].forEach(c => document.getElementById(c).style.display = 'none');
        ['tabStudents','tabHomeworks','tabGames'].forEach(t => document.getElementById(t).classList.remove('active'));
        document.getElementById(id).style.display = 'block';
        document.getElementById(id.replace('content','tab')).classList.add('active');
    };
    document.getElementById("tabStudents").onclick = () => switchTab('contentStudents');
    document.getElementById("tabHomeworks").onclick = () => { switchTab('contentHomeworks'); loadProfHomeworks(); };
    document.getElementById("tabGames").onclick = () => { switchTab('contentGames'); loadGameLevels(); };

    // --- INIT ---
    fetchAndRenderPlayers();
    document.getElementById("addHomeworkBtn").onclick = () => { window.state.tempHwLevels = [{instruction:"", aiPrompt:"", attachmentUrls:[], questionImage:null}]; window.state.editingHomeworkId=null; document.getElementById("createHomeworkModal").style.display="flex"; renderCreateHomeworkForm(); };
    document.getElementById("classFilter").onchange = applyFiltersAndRender;
    document.getElementById("studentSearch").oninput = applyFiltersAndRender;
    setupBugListeners();
    setupTestClassListener();

    // --- LOGIQUE JEUX ---
    document.getElementById("btnNewLevel").onclick = resetGameEditor;
    document.getElementById("btnCancelEdit").onclick = resetGameEditor;
    
    document.getElementById("modeManualBtn").onclick = () => {
        document.getElementById("manualZone").style.display = "block";
        document.getElementById("aiZone").style.display = "none";
    };
    document.getElementById("modeAutoBtn").onclick = () => {
        document.getElementById("manualZone").style.display = "none";
        document.getElementById("aiZone").style.display = "block";
    };
    
    // 1. AJOUT MANUEL
    document.getElementById("btnAddManualQ").onclick = () => {
        const q = document.getElementById("mQ").value;
        const opts = [
            document.getElementById("mO0").value, document.getElementById("mO1").value,
            document.getElementById("mO2").value, document.getElementById("mO3").value
        ].filter(o => o.trim() !== "");
        const good = parseInt(document.getElementById("mGood").value);

        if(!q || opts.length < 2) return alert("Il faut une question et au moins 2 réponses.");

        addQuestionToMemory({ q: q, options: opts, a: good });
        
        // Reset champs
        document.getElementById("mQ").value = "";
        document.getElementById("mO0").value = ""; document.getElementById("mO1").value = "";
        document.getElementById("mO2").value = ""; document.getElementById("mO3").value = "";
    };

    // 2. IA
    document.getElementById("btnLaunchAI").onclick = generateQuestionsAI;
    document.getElementById("btnSaveLevel").onclick = saveLevel;
    document.getElementById("gameClassFilter").onchange = loadGameLevels;
    
    // Variable globale pour savoir si on édite ou on crée
    window.state.currentLevelId = null;
}

// Gestion de la liste visuelle des questions
function addQuestionToMemory(qObj) {
    let current = [];
    try { current = JSON.parse(document.getElementById("lvlQuestions").value); } catch(e){}
    if(!Array.isArray(current)) current = [];
    
    current.push(qObj);
    document.getElementById("lvlQuestions").value = JSON.stringify(current);
    renderVisualQuestions();
}

function renderVisualQuestions() {
    let current = [];
    try { current = JSON.parse(document.getElementById("lvlQuestions").value); } catch(e){}
    const container = document.getElementById("visualQuestionsList");
    
    if(current.length === 0) {
        container.innerHTML = "Aucune question pour l'instant.";
        return;
    }
    
    container.innerHTML = current.map((q, idx) => `
        <div style="border-bottom:1px solid #eee; padding:5px; display:flex; justify-content:space-between; align-items:center;">
            <span><b>${idx+1}.</b> ${q.q}</span>
            <button onclick="window.removeQuestion(${idx})" style="color:red; border:none; background:none; cursor:pointer;">🗑️</button>
        </div>
    `).join('');
}

window.removeQuestion = (idx) => {
    let current = JSON.parse(document.getElementById("lvlQuestions").value);
    current.splice(idx, 1);
    document.getElementById("lvlQuestions").value = JSON.stringify(current);
    renderVisualQuestions();
};

function resetGameEditor() {
    window.state.currentLevelId = null;
    document.getElementById("editorTitle").textContent = "Créer un nouveau niveau";
    document.getElementById("lvlTitle").value = "";
    document.getElementById("lvlLesson").value = "";
    document.getElementById("lvlQuestions").value = "[]";
    renderVisualQuestions();
    document.getElementById("btnCancelEdit").style.display = "none";
}

async function loadGameLevels() {
    const cls = document.getElementById("gameClassFilter").value;
    const target = cls === "all" ? "6e" : cls.replace("D","").replace("B","").replace("C",""); 
    const lvls = await window.api.get(`/api/game-levels/${target}`) || [];
    
    document.getElementById("levelsList").innerHTML = lvls.map(l => `
        <div style="background:white; border:1px solid #ddd; padding:10px; margin-bottom:5px; border-left:4px solid #3b82f6; cursor:pointer;" onclick='window.editLevel(${JSON.stringify(l).replace(/'/g, "&#39;")})'>
            <div style="font-weight:bold;">${l.title}</div>
            <div style="font-size:0.8em; color:#666;">${l.chapterId} • ${l.questions.length} Questions</div>
            <button onclick="window.deleteLevel('${l._id}', event)" style="float:right; margin-top:-20px; color:red; border:none; background:none; font-weight:bold;">×</button>
        </div>
    `).join('');
}

window.editLevel = (lvl) => {
    window.state.currentLevelId = lvl._id; // On garde l'ID pour savoir qu'on modifie
    document.getElementById("editorTitle").textContent = "Modifier : " + lvl.title;
    document.getElementById("btnCancelEdit").style.display = "inline-block";
    
    document.getElementById("lvlChapter").value = lvl.chapterId;
    document.getElementById("lvlTitle").value = lvl.title;
    document.getElementById("lvlClass").value = lvl.classroom;
    document.getElementById("lvlLesson").value = lvl.lesson || "";
    document.getElementById("lvlQuestions").value = JSON.stringify(lvl.questions);
    
    renderVisualQuestions(); // Affiche les questions pour qu'on les voie !
};

window.deleteLevel = async (id, e) => {
    e.stopPropagation();
    if(confirm("Vraiment supprimer ce niveau ?")) { 
        await fetch(`/api/game-levels/${id}`, {method:'DELETE'}); 
        loadGameLevels(); 
        resetGameEditor();
    }
};

async function generateQuestionsAI() {
    const fileIn = document.getElementById("aiDocFile");
    const topic = document.getElementById("aiTopic").value;
    const status = document.getElementById("aiStatus");
    
    if(!fileIn.files.length && !topic) return alert("Il faut un fichier ou un sujet !");
    
    status.textContent = "⏳ Analyse en cours...";
    status.style.color = "blue";
    
    let docUrl = null;
    if(fileIn.files.length) {
        const up = await window.api.upload(fileIn.files[0]);
        if(up.ok) docUrl = up.imageUrl;
    }
    
    const res = await window.api.post('/api/generate-game-content', {
        docUrl: docUrl,
        topic: topic,
        gameType: "quiz"
    });
    
    if(res && Array.isArray(res)) {
        status.textContent = "✅ Terminé ! 5 questions ajoutées.";
        status.style.color = "green";
        
        // On fusionne avec les questions existantes
        let current = [];
        try { current = JSON.parse(document.getElementById("lvlQuestions").value); } catch(e){}
        const combined = current.concat(res);
        document.getElementById("lvlQuestions").value = JSON.stringify(combined);
        renderVisualQuestions();
    } else {
        status.textContent = "❌ Erreur IA.";
        status.style.color = "red";
    }
}

async function saveLevel() {
    try {
        const rawJson = document.getElementById("lvlQuestions").value;
        const questions = JSON.parse(rawJson);
        
        if (!Array.isArray(questions) || questions.length === 0) return alert("Ajoute au moins une question !");

        // Si on a un ID, on supprime l'ancien avant de recréer (ou on fait un update, ici simple delete/create)
        if(window.state.currentLevelId) {
             await fetch(`/api/game-levels/${window.state.currentLevelId}`, {method:'DELETE'});
        }

        const data = {
            chapterId: document.getElementById("lvlChapter").value,
            title: document.getElementById("lvlTitle").value,
            classroom: document.getElementById("lvlClass").value,
            lesson: document.getElementById("lvlLesson").value,
            questions: questions
        };
        await window.api.post('/api/game-levels', data);
        alert("Niveau sauvegardé !");
        resetGameEditor();
        loadGameLevels();
    } catch(e) { alert("Erreur technique lors de la sauvegarde."); console.error(e); }
}

// --- FONCTIONS EXISTANTES (DEVOIRS & COPIES) - NE PAS SUPPRIMER ---
// ... (Assurez-vous que le reste du fichier avec viewSubmissions, openStudentCopy, etc. est bien là)
window.viewSubmissions = async function(hwId, hwClass) {
    const players = window.state.allPlayersData.filter(p => p.classroom === hwClass || hwClass === "Toutes");
    const submissions = await window.api.get(`/api/submissions/${hwId}`) || [];
    const modal = document.createElement('div');
    modal.className = "modal-overlay"; modal.style.display = "flex";
    modal.innerHTML = `<div class="modal-content" style="width:90%; max-width:800px; max-height:85vh; overflow-y:auto;"><h3>Suivi: ${hwClass}</h3><table style="width:100%; border-collapse:collapse; margin-top:15px;"><thead style="background:#f1f5f9;"><tr><th style="padding:10px;">Élève</th><th style="padding:10px;">Statut</th><th style="padding:10px;">Note</th><th style="padding:10px;">Action</th></tr></thead><tbody>${players.map(p => { const sub = submissions.find(s => s.playerId && s.playerId._id === p._id); return `<tr><td style="padding:10px;">${p.firstName} ${p.lastName}</td><td style="padding:10px;">${sub ? '✅ Rendu' : '⏳ Non rendu'}</td><td style="padding:10px;">${sub ? (sub.levelsResults[0]?.grade || 'A valider') : '-'}</td><td style="padding:10px;">${sub ? `<button onclick="window.openStudentCopy('${sub._id}')">Voir</button>` : '-'}</td></tr>`; }).join('')}</tbody></table><div style="margin-top:20px; text-align:right;"><button onclick="this.closest('.modal-overlay').remove()">Fermer</button></div></div>`;
    document.body.appendChild(modal);
};

window.openStudentCopy = async function(subId) {
    const sub = await window.api.get(`/api/submission-detail/${subId}`);
    if(!sub) return alert("Erreur chargement copie");
    const modal = document.createElement('div');
    modal.className = "modal-overlay"; modal.style.zIndex = "2100"; modal.style.display = "flex";
    modal.innerHTML = `<div class="modal-content" style="width:95%; max-width:1000px; max-height:90vh; overflow-y:auto; text-align:left;"><div style="display:flex; justify-content:space-between; align-items:center;"><h3>Correction : ${sub.playerId.firstName} ${sub.playerId.lastName}</h3></div><hr><div id="copy-container">${sub.levelsResults.map((result, i) => `<div class="lvl-result-box" style="margin-bottom:30px; padding:20px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;"><h4 style="margin-top:0; color:#2563eb;">Question ${result.levelIndex + 1}</h4><div style="display:flex; gap:25px; margin-top:15px;"><div style="flex:1;"><strong>Réponse de l'élève :</strong><div style="background:white; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-top:10px;">${result.userText || '<i>Aucun texte</i>'}</div>${result.userImageUrl ? `<img src="${result.userImageUrl}" style="max-width:100%; border:2px solid #ccc; margin-top:5px;" onclick="window.open(this.src)">` : ''}</div><div style="flex:1; background:#fff; padding:15px;"><strong>Correction :</strong><textarea class="teacher-fb" style="width:100%; height:150px;">${result.teacherFeedback || result.aiFeedback}</textarea><strong>Note :</strong><input class="teacher-grade" value="${result.grade}" style="width:100%; padding:10px;"></div></div></div>`).join('')}</div><div style="text-align:right; margin-top:20px;"><button id="btnSaveCorrection" style="background:#16a34a; color:white; padding:12px 30px;">Enregistrer</button><button onclick="this.closest('.modal-overlay').remove()" style="margin-left:15px;">Annuler</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector("#btnSaveCorrection").onclick = async () => { const results = sub.levelsResults.map((r, i) => ({ ...r, teacherFeedback: modal.querySelectorAll(".teacher-fb")[i].value, grade: modal.querySelectorAll(".teacher-grade")[i].value })); const saveRes = await window.api.post('/api/update-correction', { subId, levelsResults: results }); if (saveRes.ok) { alert("✅ Copie mise à jour !"); modal.remove(); } };
};

async function loadProfHomeworks() {
    const tbody = document.getElementById("profHomeworksBody");
    tbody.innerHTML = "<tr><td colspan='5'>Chargement...</td></tr>";
    try { const list = await window.api.getHomeworks(); window.state.homeworksList = list; tbody.innerHTML = list.map((h, index) => `<tr><td style="padding:12px;">${new Date(h.date).toLocaleDateString()}</td><td style="padding:12px; font-weight:bold;">${h.title}</td><td style="padding:12px;">${h.classroom}</td><td style="padding:12px;">${h.levels.length} Q</td><td style="padding:12px;"><button onclick="window.viewSubmissions('${h._id}', '${h.classroom}')">👁️</button> <button onclick="window.openEditModalByIndex(${index})">✏️</button> <button onclick="deleteHomework('${h._id}')">🗑️</button></td></tr>`).join(''); } catch(e) { tbody.innerHTML = "<tr><td colspan='5'>Erreur</td></tr>"; }
}

window.openEditModalByIndex = function(index) { const hw = window.state.homeworksList[index]; window.state.editingHomeworkId = hw._id; window.state.tempHwLevels = JSON.parse(JSON.stringify(hw.levels)); document.getElementById("createHomeworkModal").style.display = "flex"; renderCreateHomeworkForm(hw); };

function renderCreateHomeworkForm(hw = null) {
    const title = hw ? hw.title : ""; const currentClass = hw ? hw.classroom : "Toutes"; const modal = document.getElementById("createHomeworkModal"); const opt = (val) => `<option value="${val}" ${currentClass===val?"selected":""}>${val}</option>`;
    modal.innerHTML = `<div class="modal-content" style="width:95%; max-width:900px; padding:25px; background:white; border-radius:15px; max-height:90vh; overflow-y:auto;"><h3>${hw ? "Modifier" : "Nouveau"} Devoir</h3><div style="margin-bottom:15px;"><label>Titre :</label><input id="hwTitle" value="${title}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;"></div><div style="margin-bottom:15px;"><label>Classe :</label><select id="hwClass" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">${opt("Toutes")}${opt("6D")}${opt("5B")}${opt("5C")}${opt("2A")}${opt("2CD")}</select></div><div id="levelsContainer"></div><button id="btnAddLvl" style="width:100%; padding:12px; margin-top:10px; background:#f1f5f9; color:#475569; border:1px dashed #cbd5e1; border-radius:8px;">+ Ajouter une question (Page)</button><div style="margin-top:25px; text-align:right;"><button onclick="document.getElementById('createHomeworkModal').style.display='none'">Annuler</button> <button id="btnSaveHw" style="background:#16a34a; color:white; padding:12px 30px;">Enregistrer</button></div></div>`;
    renderLevelsInputs(); modal.querySelector("#btnAddLvl").onclick = () => { window.state.tempHwLevels.push({instruction:"", aiPrompt:"", attachmentUrls:[], questionImage:null}); renderLevelsInputs(); }; modal.querySelector("#btnSaveHw").onclick = saveForm;
}

window.renderLevelsInputs = function() {
    const container = document.getElementById("levelsContainer"); if(!container) return; container.innerHTML = "";
    window.state.tempHwLevels.forEach((lvl, idx) => {
        const div = document.createElement("div"); div.style.cssText = "border:1px solid #e2e8f0; padding:20px; margin-top:20px; background:#f8fafc; border-radius:12px; position:relative;";
        let docsHtml = lvl.attachmentUrls && lvl.attachmentUrls.length > 0 ? `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:10px; margin-top:10px;">${lvl.attachmentUrls.map((url, docIdx) => `<div class="doc-item" draggable="true" ondragstart="dragStart(event, ${idx}, ${docIdx})" ondragover="allowDrop(event)" ondrop="dropDoc(event, ${idx}, ${docIdx})" style="position:relative; border:1px solid #ccc; border-radius:8px; padding:5px; background:white;">${url.toLowerCase().endsWith('.pdf') ? '📄 PDF' : `<img src="${url}" style="width:100%; height:80px; object-fit:cover;">`}<button onclick="removeDoc(${idx}, ${docIdx})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%;">X</button></div>`).join('')}</div>` : `<div style="padding:20px; color:#94a3b8; text-align:center; border:2px dashed #cbd5e1;">Aucun document.</div>`;
        div.innerHTML = `<button onclick="removeLevel(${idx})" style="position:absolute; top:10px; right:10px; color:red;">Supprimer Page</button><h4 style="margin-top:0;">Page ${idx+1}</h4><div style="margin-bottom:20px;"><label>📂 Documents :</label><div style="background:white; padding:15px; border-radius:8px;">${docsHtml}<div style="margin-top:10px;"><input type="file" id="fileInput-${idx}" multiple onchange="uploadFileToZone(this, ${idx}, 'docs')" style="display:none;"><button onclick="document.getElementById('fileInput-${idx}').click()">+ Ajouter un document</button></div></div></div><hr><div style="margin-bottom:15px;"><label>❓ Question :</label><textarea id="lvlInst-${idx}" style="width:100%; height:60px;">${lvl.instruction || ''}</textarea><div><label>Image Question :</label><input type="file" onchange="uploadFileToZone(this, ${idx}, 'questionImg')"> ${lvl.questionImage ? '✅ Image OK' : ''}</div></div>`;
        container.appendChild(div);
    });
};

window.dragStart = function(ev, lvlIdx, docIdx) { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", docIdx); ev.target.style.opacity = '0.4'; };
window.allowDrop = function(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; };
window.dropDoc = function(ev, lvlIdx, targetDocIdx) { ev.preventDefault(); const fromDocIdx = parseInt(ev.dataTransfer.getData("text/plain")); const attachments = window.state.tempHwLevels[lvlIdx].attachmentUrls; const movedItem = attachments.splice(fromDocIdx, 1)[0]; attachments.splice(targetDocIdx, 0, movedItem); renderLevelsInputs(); };
window.uploadFileToZone = async function(input, idx, type) { if(!input.files.length) return; for (const file of input.files) { const res = await window.api.upload(file); if(res.ok) { if(type==='docs') { if(!window.state.tempHwLevels[idx].attachmentUrls) window.state.tempHwLevels[idx].attachmentUrls = []; window.state.tempHwLevels[idx].attachmentUrls.push(res.imageUrl); } else { window.state.tempHwLevels[idx].questionImage = res.imageUrl; } } } renderLevelsInputs(); };
async function saveForm() { const title = document.getElementById("hwTitle").value; const cls = document.getElementById("hwClass").value; window.state.tempHwLevels.forEach((lvl, i) => { lvl.instruction = document.getElementById(`lvlInst-${i}`).value; }); const res = await window.api.saveHomework({ id: window.state.editingHomeworkId, title: title, classroom: cls, levels: window.state.tempHwLevels }, !!window.state.editingHomeworkId); if(res.ok) { document.getElementById('createHomeworkModal').style.display='none'; loadProfHomeworks(); } }
window.removeLevel = function(idx) { window.state.tempHwLevels.splice(idx, 1); renderLevelsInputs(); };
window.removeDoc = function(lIdx, dIdx) { window.state.tempHwLevels[lIdx].attachmentUrls.splice(dIdx, 1); renderLevelsInputs(); };
window.deleteHomework = async (id) => { if(confirm("Supprimer ?")) { await fetch(`/api/homework/${id}`, { method: 'DELETE' }); loadProfHomeworks(); } };
async function fetchAndRenderPlayers() { window.state.allPlayersData = await window.api.fetchPlayers(); applyFiltersAndRender(); }
function applyFiltersAndRender() { const f = document.getElementById("classFilter").value; const s = document.getElementById("studentSearch").value.toLowerCase(); const l = window.state.allPlayersData.filter(p => (f==="all"||p.classroom===f) && (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s))); document.getElementById("playersBody").innerHTML = l.map(p => `<tr><td style="padding:10px;">${p.firstName} ${p.lastName}</td><td style="padding:10px;">${p.classroom}</td><td style="padding:10px;">-</td><td style="padding:10px;"><button onclick="resetPlayer('${p._id}')" style="color:red;">Réinitialiser</button></td></tr>`).join(''); }
function setupBugListeners() { const btn = document.getElementById("viewBugsBtn"); if(btn) btn.onclick = async () => { const bugs = await window.api.get('/api/bugs') || []; const list = document.getElementById("bugsBody"); list.innerHTML = bugs.length ? bugs.map(b => `<div><b>${b.reporterName}</b>: ${b.description} <button onclick="deleteBug('${b._id}')">🗑️</button></div>`).join('') : "Rien."; document.getElementById("profBugListModal").style.display = "flex"; }; document.getElementById("closeBugListBtn").onclick = () => document.getElementById("profBugListModal").style.display = "none"; }
window.deleteBug = async (id) => { await fetch(`/api/bugs/${id}`, {method:'DELETE'}); document.getElementById("viewBugsBtn").click(); };
function setupTestClassListener() { const btn = document.getElementById("testClassBtn"); if(btn) btn.onclick = async () => { const cls = document.getElementById("classFilter").value; if(cls==="all" || !cls) return alert("Choisis une classe"); const res = await window.api.post('/api/register', { firstName: "Eleve", lastName: "Test", classroom: cls }); if(res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); } }; }