// --- VERSION AVANCÉE (DRAG & DROP) + ARCHITECTURE GLOBALE ---

export function initProfDashboard() {
    console.log("🎓 Prof Dashboard Init");
    const dashboard = document.getElementById("profDashboard");
    if(dashboard) dashboard.style.display = "block";
    
    fetchAndRenderPlayers();

    document.getElementById("tabStudents").onclick = () => { 
        document.getElementById("contentStudents").style.display="block"; 
        document.getElementById("contentHomeworks").style.display="none"; 
        document.getElementById("tabStudents").classList.add("active");
        document.getElementById("tabHomeworks").classList.remove("active");
    };
    document.getElementById("tabHomeworks").onclick = () => { 
        document.getElementById("contentStudents").style.display="none"; 
        document.getElementById("contentHomeworks").style.display="block"; 
        document.getElementById("tabHomeworks").classList.add("active");
        document.getElementById("tabStudents").classList.remove("active");
        loadProfHomeworks(); 
    };

    document.getElementById("addHomeworkBtn").onclick = () => {
        window.state.tempHwLevels = [{ instruction: "", aiPrompt: "", attachmentUrls: [], questionImage: null }]; 
        window.state.editingHomeworkId = null; 
        document.getElementById("createHomeworkModal").style.display = "flex";
        renderCreateHomeworkForm();
    };

    document.getElementById("classFilter").onchange = applyFiltersAndRender;
    document.getElementById("studentSearch").oninput = applyFiltersAndRender;

    setupBugListeners();
    setupTestClassListener();
}

// --- GESTION DES COPIES (L'OEIL) ---
window.viewSubmissions = async function(hwId, hwClass) {
    const players = window.state.allPlayersData.filter(p => p.classroom === hwClass || hwClass === "Toutes");
    const submissions = await window.api.get(`/api/submissions/${hwId}`) || [];

    const modal = document.createElement('div');
    modal.className = "modal-overlay";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-content" style="width:90%; max-width:800px; max-height:85vh; overflow-y:auto;">
            <h3>Suivi des copies : ${hwClass}</h3>
            <table style="width:100%; border-collapse:collapse; margin-top:15px;">
                <thead style="background:#f1f5f9;">
                    <tr>
                        <th style="padding:10px; text-align:left;">Élève</th>
                        <th style="padding:10px;">Statut</th>
                        <th style="padding:10px;">Note</th>
                        <th style="padding:10px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map(p => {
                        const sub = submissions.find(s => s.playerId && s.playerId._id === p._id);
                        return `
                            <tr>
                                <td style="padding:10px; border-bottom:1px solid #eee;">${p.firstName} ${p.lastName}</td>
                                <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">
                                    ${sub ? '✅ Rendu' : '<span style="color:#94a3b8;">⏳ Non rendu</span>'}
                                </td>
                                <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">
                                    ${sub ? (sub.levelsResults[0]?.grade || 'A valider') : '-'}
                                </td>
                                <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">
                                    ${sub ? `<button onclick="window.openStudentCopy('${sub._id}')" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Voir la copie</button>` : '-'}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px; text-align:right;">
                <button onclick="this.closest('.modal-overlay').remove()" style="padding:10px 20px; cursor:pointer;">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.openStudentCopy = async function(subId) {
    const sub = await window.api.get(`/api/submission-detail/${subId}`);
    if(!sub) return alert("Erreur chargement copie");

    const modal = document.createElement('div');
    modal.className = "modal-overlay";
    modal.style.zIndex = "2100";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-content" style="width:95%; max-width:1000px; max-height:90vh; overflow-y:auto; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Correction : ${sub.playerId.firstName} ${sub.playerId.lastName}</h3>
                <span style="background:#e0f2fe; color:#0369a1; padding:5px 12px; border-radius:20px; font-weight:bold;">${sub.homeworkId.title}</span>
            </div>
            <hr>
            <div id="copy-container">
                ${sub.levelsResults.map((result, i) => `
                    <div class="lvl-result-box" style="margin-bottom:30px; padding:20px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                        <h4 style="margin-top:0; color:#2563eb; border-bottom:2px solid #2563eb; display:inline-block;">Question ${result.levelIndex + 1}</h4>
                        <div style="display:flex; gap:25px; margin-top:15px;">
                            <div style="flex:1;">
                                <strong>Réponse de l'élève :</strong>
                                <div style="background:white; padding:15px; border-radius:8px; border:1px solid #cbd5e1; margin-top:10px; min-height:100px; white-space: pre-wrap;">${result.userText || '<i style="color:gray;">Aucun texte saisi</i>'}</div>
                                ${result.userImageUrl ? `
                                    <div style="margin-top:15px;">
                                        <strong>Photo jointe :</strong><br>
                                        <img src="${result.userImageUrl}" style="max-width:100%; border:2px solid #ccc; border-radius:8px; margin-top:5px; cursor:zoom-in;" onclick="window.open(this.src)">
                                    </div>` : ''}
                            </div>
                            <div style="flex:1; background:#fff; padding:15px; border-radius:8px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);">
                                <strong>Correction du Professeur :</strong>
                                <textarea class="teacher-fb" style="width:100%; height:150px; margin:10px 0; padding:10px; border-radius:6px; border:1px solid #2563eb; font-family:inherit;">${result.teacherFeedback || result.aiFeedback}</textarea>
                                <strong>Note / Appréciation :</strong>
                                <input class="teacher-grade" value="${result.grade}" style="width:100%; padding:10px; border:1px solid #2563eb; border-radius:6px; font-weight:bold; color:#16a34a;">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="text-align:right; position:sticky; bottom:-20px; background:white; padding:20px; border-top:1px solid #eee; margin:0 -20px -20px -20px;">
                <button id="btnSaveCorrection" style="background:#16a34a; color:white; border:none; padding:12px 30px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em;">💾 Enregistrer</button>
                <button onclick="this.closest('.modal-overlay').remove()" style="padding:12px 20px; margin-left:15px; cursor:pointer; background:none; border:1px solid #ccc; border-radius:8px;">Annuler</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("#btnSaveCorrection").onclick = async () => {
        const results = sub.levelsResults.map((r, i) => ({
            ...r,
            teacherFeedback: modal.querySelectorAll(".teacher-fb")[i].value,
            grade: modal.querySelectorAll(".teacher-grade")[i].value
        }));
        const saveRes = await window.api.post('/api/update-correction', { subId, levelsResults: results });
        if (saveRes.ok) { alert("✅ Copie mise à jour !"); modal.remove(); }
    };
};

// --- GESTION DEVOIRS (CRUD + MODALE AVANCÉE) ---

async function loadProfHomeworks() {
    const tbody = document.getElementById("profHomeworksBody");
    tbody.innerHTML = "<tr><td colspan='5'>Chargement...</td></tr>";
    try {
        const list = await window.api.getHomeworks();
        window.state.homeworksList = list;
        tbody.innerHTML = list.map((h, index) => `
            <tr>
                <td style="padding:12px;">${new Date(h.date).toLocaleDateString()}</td>
                <td style="padding:12px; font-weight:bold;">${h.title}</td>
                <td style="padding:12px;">${h.classroom}</td>
                <td style="padding:12px;">${h.levels.length} Q</td>
                <td style="padding:12px;">
                    <button onclick="window.viewSubmissions('${h._id}', '${h.classroom}')">👁️</button>
                    <button onclick="window.openEditModalByIndex(${index})">✏️</button>
                    <button onclick="deleteHomework('${h._id}')">🗑️</button>
                </td>
            </tr>`).join('');
    } catch(e) { tbody.innerHTML = "<tr><td colspan='5'>Erreur</td></tr>"; }
}

window.openEditModalByIndex = function(index) {
    const hw = window.state.homeworksList[index];
    window.state.editingHomeworkId = hw._id;
    window.state.tempHwLevels = JSON.parse(JSON.stringify(hw.levels));
    document.getElementById("createHomeworkModal").style.display = "flex";
    renderCreateHomeworkForm(hw);
};

function renderCreateHomeworkForm(hw = null) {
    const title = hw ? hw.title : "";
    const currentClass = hw ? hw.classroom : "Toutes";
    const modal = document.getElementById("createHomeworkModal");
    const opt = (val) => `<option value="${val}" ${currentClass===val?"selected":""}>${val}</option>`;

    modal.innerHTML = `
    <div class="modal-content" style="width:95%; max-width:900px; padding:25px; background:white; border-radius:15px; max-height:90vh; overflow-y:auto;">
        <h3>${hw ? "Modifier" : "Nouveau"} Devoir</h3>
        <div style="margin-bottom:15px;"><label>Titre :</label><input id="hwTitle" value="${title}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;"></div>
        <div style="margin-bottom:15px;"><label>Classe :</label><select id="hwClass" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;">${opt("Toutes")}${opt("6D")}${opt("5B")}${opt("5C")}${opt("2A")}${opt("2CD")}</select></div>
        <div id="levelsContainer"></div>
        <button id="btnAddLvl" style="width:100%; padding:12px; margin-top:10px; background:#f1f5f9; color:#475569; border:1px dashed #cbd5e1; border-radius:8px; cursor:pointer; font-weight:bold;">+ Ajouter une question (Page)</button>
        <div style="margin-top:25px; text-align:right; border-top:1px solid #eee; padding-top:20px;">
            <button onclick="document.getElementById('createHomeworkModal').style.display='none'" style="padding:10px; cursor:pointer;">Annuler</button>
            <button id="btnSaveHw" style="background:#16a34a; color:white; padding:12px 30px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Enregistrer</button>
        </div>
    </div>`;

    renderLevelsInputs();
    modal.querySelector("#btnAddLvl").onclick = () => { window.state.tempHwLevels.push({instruction:"", aiPrompt:"", attachmentUrls:[], questionImage:null}); renderLevelsInputs(); };
    modal.querySelector("#btnSaveHw").onclick = saveForm;
}

// --- LE RETOUR DU DRAG & DROP ET DE LA ZONE BLANCHE ---
window.renderLevelsInputs = function() {
    const container = document.getElementById("levelsContainer");
    if(!container) return;
    container.innerHTML = "";
    
    window.state.tempHwLevels.forEach((lvl, idx) => {
        const div = document.createElement("div");
        div.style.cssText = "border:1px solid #e2e8f0; padding:20px; margin-top:20px; background:#f8fafc; border-radius:12px; position:relative; box-shadow:0 2px 5px rgba(0,0,0,0.05);";
        
        // Zone Documents
        let docsHtml = "";
        if (lvl.attachmentUrls && lvl.attachmentUrls.length > 0) {
            docsHtml = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:10px; margin-top:10px;">`;
            lvl.attachmentUrls.forEach((url, docIdx) => {
                const isPdf = url.toLowerCase().endsWith('.pdf');
                const thumbnail = isPdf 
                    ? `<div style="width:100%; height:80px; background:#e2e8f0; display:flex; align-items:center; justify-content:center; border-radius:8px; color:#475569; font-weight:bold;">PDF</div>`
                    : `<img src="${url}" style="width:100%; height:80px; object-fit:cover; border-radius:8px; pointer-events:none;">`;
                
                docsHtml += `
                    <div class="doc-item"
                         draggable="true" 
                         ondragstart="dragStart(event, ${idx}, ${docIdx})" 
                         ondragover="allowDrop(event)" 
                         ondrop="dropDoc(event, ${idx}, ${docIdx})"
                         style="position:relative; border:1px solid #ccc; border-radius:8px; padding:5px; background:white; cursor:grab;">
                        ${thumbnail}
                        <button onclick="removeDoc(${idx}, ${docIdx})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10;">X</button>
                    </div>`;
            });
            docsHtml += `</div>`;
        } else {
            docsHtml = `<div style="padding:20px; color:#94a3b8; text-align:center; border:2px dashed #cbd5e1; border-radius:8px; margin-top:10px;">Aucun document. Ajoutez-en ci-dessous.</div>`;
        }

        div.innerHTML = `
            <button onclick="removeLevel(${idx})" style="position:absolute; top:10px; right:10px; color:#ef4444; background:white; border:1px solid #ef4444; border-radius:4px; padding:2px 8px; cursor:pointer; font-weight:bold;">Supprimer Page</button>
            <h4 style="margin-top:0; color:#2563eb;">Page ${idx+1}</h4>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; color:#334155;">📂 Documents de Cours (PDF / Images) :</label>
                <div style="background:white; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:5px;">
                    ${docsHtml}
                    <div style="margin-top:10px;">
                        <input type="file" id="fileInput-${idx}" multiple onchange="uploadFileToZone(this, ${idx}, 'docs')" style="display:none;">
                        <button onclick="document.getElementById('fileInput-${idx}').click()" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:6px 12px; border-radius:6px; cursor:pointer;">+ Ajouter un document</button>
                    </div>
                </div>
            </div>

            <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;">

            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; color:#334155;">❓ La Question (Énoncé) :</label>
                <div style="background:white; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-top:5px;">
                    <div style="margin-bottom:10px;">
                        <label style="font-size:0.9em;">Texte de la question :</label>
                        <textarea id="lvlInst-${idx}" style="width:100%; height:60px; padding:8px; border-radius:6px; border:1px solid #ccc; margin-top:5px;">${lvl.instruction || ''}</textarea>
                    </div>
                    <div>
                        <label style="font-size:0.9em;">OU Image de la question (Facultatif) :</label>
                        <div style="display:flex; gap:10px; align-items:center; margin-top:5px;">
                            <input type="file" onchange="uploadFileToZone(this, ${idx}, 'questionImg')" style="font-size:12px;">
                            ${lvl.questionImage ? `<a href="${lvl.questionImage}" target="_blank" style="color:green; font-weight:bold;">✅ Voir l'image</a>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
};

// Fonctions Drag & Drop attachées à window
window.dragStart = function(ev, lvlIdx, docIdx) {
    ev.dataTransfer.effectAllowed = "move";
    ev.dataTransfer.setData("text/plain", docIdx); 
    ev.target.style.opacity = '0.4';
};
window.allowDrop = function(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; };
window.dropDoc = function(ev, lvlIdx, targetDocIdx) {
    ev.preventDefault();
    const fromDocIdx = parseInt(ev.dataTransfer.getData("text/plain"));
    const attachments = window.state.tempHwLevels[lvlIdx].attachmentUrls;
    const movedItem = attachments.splice(fromDocIdx, 1)[0];
    attachments.splice(targetDocIdx, 0, movedItem);
    renderLevelsInputs();
};

window.uploadFileToZone = async function(input, idx, type) {
    if(!input.files.length) return;
    // Feedback visuel
    const btn = input.nextElementSibling;
    if(btn) btn.textContent = "⏳ Envoi...";

    for (const file of input.files) {
        const res = await window.api.upload(file);
        if(res.ok) {
            if(type==='docs') {
               if(!window.state.tempHwLevels[idx].attachmentUrls) window.state.tempHwLevels[idx].attachmentUrls = [];
               window.state.tempHwLevels[idx].attachmentUrls.push(res.imageUrl);
            } else {
               window.state.tempHwLevels[idx].questionImage = res.imageUrl;
            }
        }
    }
    renderLevelsInputs();
};

async function saveForm() {
    const title = document.getElementById("hwTitle").value;
    const cls = document.getElementById("hwClass").value;
    window.state.tempHwLevels.forEach((lvl, i) => { lvl.instruction = document.getElementById(`lvlInst-${i}`).value; });
    const res = await window.api.saveHomework({ id: window.state.editingHomeworkId, title: title, classroom: cls, levels: window.state.tempHwLevels }, !!window.state.editingHomeworkId);
    if(res.ok) { document.getElementById('createHomeworkModal').style.display='none'; loadProfHomeworks(); }
}

window.removeLevel = function(idx) { window.state.tempHwLevels.splice(idx, 1); renderLevelsInputs(); };
window.removeDoc = function(lIdx, dIdx) { window.state.tempHwLevels[lIdx].attachmentUrls.splice(dIdx, 1); renderLevelsInputs(); };
window.deleteHomework = async (id) => { if(confirm("Supprimer ?")) { await fetch(`/api/homework/${id}`, { method: 'DELETE' }); loadProfHomeworks(); } };

async function fetchAndRenderPlayers() { 
    window.state.allPlayersData = await window.api.fetchPlayers(); 
    applyFiltersAndRender(); 
}

function applyFiltersAndRender() { 
    const f = document.getElementById("classFilter").value; 
    const s = document.getElementById("studentSearch").value.toLowerCase();
    const l = window.state.allPlayersData.filter(p => (f==="all"||p.classroom===f) && (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s)));
    document.getElementById("playersBody").innerHTML = l.map(p => `
        <tr>
            <td style="padding:10px;">${p.firstName} ${p.lastName}</td>
            <td style="padding:10px;">${p.classroom}</td>
            <td style="padding:10px; color:#64748b;">-</td>
            <td style="padding:10px;">
                <button onclick="resetPlayer('${p._id}')" style="background:none; border:none; color:#ef4444; cursor:pointer;">Réinitialiser</button>
            </td>
        </tr>`).join(''); 
}

function setupBugListeners() {
    const btn = document.getElementById("viewBugsBtn");
    if(btn) btn.onclick = async () => {
        const bugs = await window.api.get('/api/bugs') || [];
        const list = document.getElementById("bugsBody");
        list.innerHTML = bugs.length ? bugs.map(b => `<div><b>${b.reporterName}</b>: ${b.description} <button onclick="deleteBug('${b._id}')">🗑️</button></div>`).join('') : "Rien.";
        document.getElementById("profBugListModal").style.display = "flex";
    };
    document.getElementById("closeBugListBtn").onclick = () => document.getElementById("profBugListModal").style.display = "none";
}

window.deleteBug = async (id) => { await fetch(`/api/bugs/${id}`, {method:'DELETE'}); document.getElementById("viewBugsBtn").click(); };

function setupTestClassListener() {
    const btn = document.getElementById("testClassBtn");
    if(btn) btn.onclick = async () => {
        const cls = document.getElementById("classFilter").value;
        if(cls==="all" || !cls) return alert("Choisis une classe");
        const res = await window.api.post('/api/register', { firstName: "Eleve", lastName: "Test", classroom: cls });
        if(res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); }
    };
}