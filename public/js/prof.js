import { state } from './state.js';
import { uploadFile, saveHomework, getHomeworks, fetchPlayers } from './api.js';

// ==========================================================
// 1. GESTION DES COPIES ÉLÈVES
// ==========================================================

window.viewSubmissions = async function(hwId, hwClass) {
    const players = state.allPlayersData.filter(p => p.classroom === hwClass || hwClass === "Toutes");
    const res = await fetch(`/api/submissions/${hwId}`);
    const submissions = await res.json();

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
                                    ${sub ? `<button onclick="openStudentCopy('${sub._id}')" style="background:#2563eb; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Voir la copie</button>` : '-'}
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
    const res = await fetch(`/api/submission-detail/${subId}`);
    const sub = await res.json();

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
                                <small style="display:block; margin-top:5px; color:#64748b;">L'élève verra ces modifications à sa prochaine connexion.</small>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="text-align:right; position:sticky; bottom:-20px; background:white; padding:20px; border-top:1px solid #eee; margin:0 -20px -20px -20px;">
                <button id="btnSaveCorrection" style="background:#16a34a; color:white; border:none; padding:12px 30px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:1.1em;">💾 Enregistrer la correction</button>
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

        const saveRes = await fetch('/api/update-correction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subId, levelsResults: results })
        });

        if ((await saveRes.json()).ok) {
            alert("✅ La copie a été mise à jour !");
            modal.remove();
        }
    };
};

// ==========================================================
// 2. INITIALISATION DU DASHBOARD
// ==========================================================

export function initProfDashboard() {
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
        state.tempHwLevels = [{ instruction: "", aiPrompt: "", attachmentUrls: [], questionImage: null }]; 
        state.editingHomeworkId = null; 
        document.getElementById("createHomeworkModal").style.display = "flex";
        renderCreateHomeworkForm();
    };

    document.getElementById("classFilter").onchange = applyFiltersAndRender;
    document.getElementById("studentSearch").oninput = applyFiltersAndRender;

    // --- LOGIQUE BOUTON TEST CLASSE (AVEC FIX MONGODB) ---
    const btnTest = document.getElementById("testClassBtn");
    if(btnTest) {
        btnTest.onclick = async () => {
            const currentFilter = document.getElementById("classFilter").value;
            if (currentFilter === "all" || currentFilter === "") {
                alert("⚠️ Veuillez sélectionner une classe précise dans la liste déroulante (ex: 6eD) pour la tester.");
                return;
            }
            if (confirm(`Voulez-vous voir la plateforme comme un élève de ${currentFilter} ?`)) {
                try {
                    const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ firstName: "Eleve", lastName: "Test", classroom: currentFilter })
                    });
                    const data = await res.json();
                    if (data.ok) {
                        localStorage.setItem("player", JSON.stringify(data));
                        window.location.reload(); 
                    } else {
                        alert("Erreur serveur lors de la création du compte test.");
                    }
                } catch(e) { alert("Erreur de connexion."); }
            }
        };
    }
}

// ==========================================================
// 3. LOGIQUE DES DEVOIRS (CRUD)
// ==========================================================

async function loadProfHomeworks() {
    const tbody = document.getElementById("profHomeworksBody");
    tbody.innerHTML = "<tr><td colspan='5'>Chargement des devoirs...</td></tr>";
    try {
        const list = await getHomeworks();
        state.homeworksList = list;
        tbody.innerHTML = list.map((h, index) => `
            <tr>
                <td style="padding:12px;">${new Date(h.date).toLocaleDateString()}</td>
                <td style="padding:12px; font-weight:bold;">${h.title}</td>
                <td style="padding:12px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 10px; border-radius:12px; font-size:12px;">${h.classroom}</span></td>
                <td style="padding:12px;">${h.levels.length} Q</td>
                <td style="padding:12px;">
                    <button onclick="window.viewSubmissions('${h._id}', '${h.classroom}')" style="background:#2563eb; color:white; border:none; padding:6px 10px; border-radius:4px; margin-right:5px; cursor:pointer;">👁️ Copies</button>
                    <button onclick="window.openEditModalByIndex(${index})" style="background:#f59e0b; color:white; border:none; padding:6px 10px; border-radius:4px; margin-right:5px; cursor:pointer;">Modif</button>
                    <button onclick="deleteHomework('${h._id}')" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </td>
            </tr>`).join('');
    } catch(e) { tbody.innerHTML = "<tr><td colspan='5' style='color:red'>Erreur serveur.</td></tr>"; }
}

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
            <button onclick="document.getElementById('createHomeworkModal').style.display='none'" style="padding:10px 20px; border:none; background:none; cursor:pointer; margin-right:15px;">Annuler</button>
            <button id="btnSaveHw" style="background:#16a34a; color:white; padding:12px 30px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">🚀 Enregistrer le devoir</button>
        </div>
    </div>`;

    renderLevelsInputs();
    modal.querySelector("#btnAddLvl").onclick = () => { state.tempHwLevels.push({instruction:"", aiPrompt:"", attachmentUrls:[], questionImage:null}); renderLevelsInputs(); };
    modal.querySelector("#btnSaveHw").onclick = saveForm;
}

// --- FONCTION CORRIGÉE AVEC UPLOAD DOCUMENTS ---
window.renderLevelsInputs = function() {
    const container = document.getElementById("levelsContainer");
    if(!container) return;
    container.innerHTML = "";
    state.tempHwLevels.forEach((lvl, idx) => {
        const div = document.createElement("div");
        div.style.cssText = "border:1px solid #e2e8f0; padding:15px; margin-top:20px; background:#f8fafc; border-radius:10px; position:relative;";
        div.innerHTML = `
            <button onclick="removeLevel(${idx})" style="position:absolute; top:10px; right:10px; color:red; background:none; border:none; cursor:pointer;">Suppr</button>
            <h4 style="margin-top:0;">Page ${idx+1}</h4>
            
            <div style="margin-bottom:15px;">
                <label>Texte de la Question :</label>
                <textarea id="lvlInst-${idx}" style="width:100%; height:60px; padding:8px; border-radius:6px; border:1px solid #ccc;">${lvl.instruction || ''}</textarea>
            </div>
            
            <div style="margin-bottom:15px;">
                <label>Documents (PDF/Images) :</label>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" onchange="uploadFileToZone(this, ${idx}, 'top')" style="font-size:12px;">
                    <span style="font-size:0.9em; color:#64748b;">
                        ${lvl.attachmentUrls && lvl.attachmentUrls.length > 0 ? `✅ ${lvl.attachmentUrls.length} fichier(s)` : 'Aucun document'}
                    </span>
                </div>
            </div>

            <div>
                <label>Image de Question (Facultatif) :</label>
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" onchange="uploadFileToZone(this, ${idx}, 'bottom')" style="font-size:12px;">
                    ${lvl.questionImage ? `<span style="color:green;">✅ Image OK</span>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
};

async function saveForm() {
    const titleVal = document.getElementById("hwTitle").value;
    const clsVal = document.getElementById("hwClass").value;
    state.tempHwLevels.forEach((lvl, i) => { 
        lvl.instruction = document.getElementById(`lvlInst-${i}`).value; 
    });
    const res = await saveHomework({ id: state.editingHomeworkId, title: titleVal, classroom: clsVal, levels: state.tempHwLevels }, !!state.editingHomeworkId);
    if(res.ok) {
        document.getElementById('createHomeworkModal').style.display='none';
        loadProfHomeworks();
    }
}

window.openEditModalByIndex = function(index) {
    const hw = state.homeworksList[index];
    state.editingHomeworkId = hw._id;
    state.tempHwLevels = JSON.parse(JSON.stringify(hw.levels));
    document.getElementById("createHomeworkModal").style.display = "flex";
    renderCreateHomeworkForm(hw);
};

window.removeLevel = function(idx) { state.tempHwLevels.splice(idx, 1); renderLevelsInputs(); };

window.uploadFileToZone = async function(inputEl, lvlIdx, zoneId) {
    if (!inputEl.files[0]) return;
    const res = await uploadFile(inputEl.files[0]);
    if (res.ok) {
        // zoneId 'top' = Documents | zoneId 'bottom' = Image Question
        if (zoneId === 'top') state.tempHwLevels[lvlIdx].attachmentUrls.push(res.imageUrl);
        else state.tempHwLevels[lvlIdx].questionImage = res.imageUrl;
        renderLevelsInputs();
    }
};

window.deleteHomework = async (id) => { if(confirm("Supprimer ce devoir ?")) { await fetch(`/api/homework/${id}`, { method: 'DELETE' }); loadProfHomeworks(); } };

async function fetchAndRenderPlayers() { 
    state.allPlayersData = await fetchPlayers(); 
    applyFiltersAndRender(); 
}

function applyFiltersAndRender() { 
    const f = document.getElementById("classFilter").value; 
    const s = document.getElementById("studentSearch").value.toLowerCase();
    const l = state.allPlayersData.filter(p => (f==="all"||p.classroom===f) && (p.firstName.toLowerCase().includes(s) || p.lastName.toLowerCase().includes(s)));
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

window.resetPlayer = async (id) => { 
    if(confirm("⚠️ Réinitialiser cet élève ? (Efface ses notes et progrès)")) { 
        await fetch("/api/reset-player", {
            method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({playerId:id})
        }); 
        fetchAndRenderPlayers(); 
    } 
};