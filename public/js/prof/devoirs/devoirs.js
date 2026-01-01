import { state } from '../../state.js';
import { uploadFile, saveHomework, getHomeworks } from '../../api.js';

let homeworksList = [];

export async function initDevoirsModule(container) {
    console.log("📂 Module DEVOIRS PROF - Version Restaurée (Ligne 1 / Ligne 2)");

    container.innerHTML = `
        <div class="card">
            <button id="addHomeworkBtn" class="action-btn" style="background:var(--success); margin-bottom:20px; font-size:1.1rem;">➕ Nouveau Devoir</button>
            <table class="prof-table">
                <thead>
                    <tr><th>Date</th><th>Titre</th><th>Classe</th><th>Questions</th><th style="text-align:center;">Action</th></tr>
                </thead>
                <tbody id="profHomeworksBody">
                    <tr><td colspan="5" style="text-align:center; padding:20px;">Chargement...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    document.getElementById("addHomeworkBtn").onclick = () => {
        state.tempHwLevels = [{ instruction: "", aiPrompt: "", attachmentUrls: [], questionImage: null }];
        state.editingHomeworkId = null;
        renderCreateHomeworkForm();
    };

    refreshHomeworksList();
}

async function refreshHomeworksList() {
    const tbody = document.getElementById("profHomeworksBody");
    try {
        homeworksList = await getHomeworks();
        if (!homeworksList || homeworksList.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>Aucun devoir créé.</td></tr>";
            return;
        }

        tbody.innerHTML = homeworksList.map((h, index) => `
            <tr>
                <td>${new Date(h.date).toLocaleDateString()}</td>
                <td><b>${h.title}</b></td>
                <td><span style="background:#e0f2fe; padding:2px 8px; border-radius:10px; font-size:0.8em;">${h.classroom}</span></td>
                <td>${h.levels.length}</td>
                <td style="text-align:center;">
                    <button onclick="window.openEditHw(${index})" style="background:none; border:none; font-size:1.4rem; cursor:pointer;">🖋️</button>
                    <button onclick="window.deleteHwModule('${h._id}')" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:red; margin-left:10px;">🗑️</button>
                </td>
            </tr>`).join('');
    } catch(e) { tbody.innerHTML = "<tr><td colspan='5' style='color:red'>Erreur de chargement.</td></tr>"; }
}

function renderCreateHomeworkForm(hw = null) {
    const modal = document.getElementById("createHomeworkModal");
    modal.style.display = "flex";

    const title = hw ? hw.title : "";
    const currentClass = hw ? hw.classroom : "Toutes";
    const opt = (val) => `<option value="${val}" ${currentClass === val ? "selected" : ""}>${val}</option>`;

    modal.innerHTML = `
    <div class="modal-content" style="width:95%; max-width:950px; padding:25px; background:white; border-radius:15px; max-height:90vh; overflow-y:auto;">
        <h2 style="text-align:center; margin-top:0;">${hw ? "Modifier" : "Nouveau"} Devoir</h2>
        
        <div style="margin-bottom:15px;"><label><b>Titre :</b></label><input id="hwTitle" value="${title}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px;"></div>
        <div style="margin-bottom:20px;"><label><b>Classe :</b></label><select id="hwClass" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px;">${opt("Toutes")}${opt("6D")}${opt("5B")}${opt("5C")}${opt("2A")}${opt("2CD")}</select></div>
        
        <div id="levelsContainer"></div>
        <button id="btnAddLvl" style="width:100%; padding:12px; margin-top:10px; background:#f1f5f9; color:#2563eb; border:1px dashed #2563eb; border-radius:8px; font-weight:bold;">+ Ajouter Question (Page)</button>
        
        <div style="margin-top:25px; text-align:right; border-top:1px solid #eee; padding-top:20px;">
            <button onclick="document.getElementById('createHomeworkModal').style.display='none'" style="background:#64748b; color:white; padding:10px 25px; margin-right:10px; border-radius:8px;">Annuler</button>
            <button id="btnSaveHw" style="background:var(--success); color:white; padding:10px 40px; font-size:1.1rem; border-radius:8px;">Enregistrer</button>
        </div>
    </div>`;

    renderLevelsInputs();

    document.getElementById("btnAddLvl").onclick = () => {
        state.tempHwLevels.push({ instruction: "", aiPrompt: "", attachmentUrls: [], questionImage: null });
        renderLevelsInputs();
    };

    document.getElementById("btnSaveHw").onclick = saveFormAction;
}

window.renderLevelsInputs = function() {
    const container = document.getElementById("levelsContainer");
    if (!container) return;
    container.innerHTML = "";

    state.tempHwLevels.forEach((lvl, idx) => {
        const div = document.createElement("div");
        div.className = "card";
        div.style.cssText = "border:2px solid #cbd5e1; padding:20px; margin-top:20px; background:#f8fafc; position:relative; border-radius:12px;";

        div.innerHTML = `
            <button onclick="window.removeLevelHw(${idx})" style="position:absolute; top:10px; right:10px; background:#fee2e2; color:red; border:1px solid red; padding:5px 10px; border-radius:8px;">Suppr</button>
            <h4 style="margin-top:0; color:var(--text-main);">Question ${idx + 1}</h4>
            
            <!-- LIGNE 1 : DOCUMENTS -->
            <div style="margin-bottom:25px;">
                <p style="color:#2563eb; font-weight:bold; text-align:center; font-size:0.9em; margin-bottom:10px;">LIGNE 1 : Documents (Haut) - Glissez pour trier</p>
                <div id="top-zone-${idx}" class="visual-list" 
                     style="min-height:90px; border:2px dashed #cbd5e1; background:white; display:flex; flex-wrap:wrap; gap:10px; padding:15px; border-radius:8px;"
                     ondrop="window.hwDrop(event, ${idx})" ondragover="window.allowDrop(event)">
                    
                    ${lvl.attachmentUrls.length === 0 ? '<span style="color:#94a3b8; width:100%; text-align:center;">Aucun document ajouté</span>' : ''}
                    ${lvl.attachmentUrls.map((u, uIdx) => `
                        <div draggable="true" ondragstart="window.hwDrag(event, ${idx}, ${uIdx})"
                             style="position:relative; width:75px; height:75px; border:1px solid #ddd; background:#eee; border-radius:5px; overflow:hidden; cursor:grab;">
                             ${u.toLowerCase().endsWith('.pdf') ? '<div style="font-size:2rem; text-align:center; padding-top:10px;">📄</div>' : `<img src="${u}" style="width:100%; height:100%; object-fit:cover;">`}
                             <button onclick="window.hwRemoveDoc(${idx}, ${uIdx})" style="position:absolute; top:2px; right:2px; background:red; color:white; border-radius:50%; width:20px; height:20px; font-size:10px; border:none; cursor:pointer;">✕</button>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <label class="action-btn" style="width:auto; background:#3b82f6; font-size:0.85em; padding:8px 15px; margin:0;">
                        📁 Ajouter Fichiers
                        <input type="file" multiple onchange="window.hwUpload(this, ${idx}, 'top')" style="display:none;">
                    </label>
                    <input id="url-top-${idx}" placeholder="Ou coller URL" style="margin:0; flex:1; padding:8px; border:1px solid #ccc; border-radius:5px;">
                    <button onclick="window.hwAddUrl(${idx})" style="background:#eee; padding:0 15px; border:1px solid #ccc; border-radius:5px;">OK</button>
                </div>
            </div>

            <hr style="border:none; border-top:1px dashed #cbd5e1; margin:25px 0;">

            <!-- LIGNE 2 : QUESTION -->
            <div>
                <p style="color:#2563eb; font-weight:bold; text-align:center; font-size:0.9em; margin-bottom:15px;">LIGNE 2 : Question (Bas)</p>
                <div style="display:flex; gap:20px; align-items:flex-start;">
                    <div style="flex:1; text-align:center; background:white; border:1px solid #eee; border-radius:10px; padding:15px;">
                        <div style="height:120px; display:flex; align-items:center; justify-content:center; background:#f8fafc; border:1px solid #eee; overflow:hidden; margin-bottom:10px; border-radius:5px;">
                            ${lvl.questionImage ? `<img src="${lvl.questionImage}" style="max-height:100%;">` : '<span style="color:#94a3b8; font-size:0.8em;">Aucune image</span>'}
                        </div>
                        <label style="color:#2563eb; cursor:pointer; text-decoration:underline; font-size:0.85em; font-weight:bold;">
                            ${lvl.questionImage ? 'Changer image' : 'Ajouter image question'}
                            <input type="file" onchange="window.hwUpload(this, ${idx}, 'bottom')" style="display:none;">
                        </label>
                    </div>
                    <div style="flex:2.5;">
                        <label style="font-size:0.85em; font-weight:bold;">Texte de la Question :</label>
                        <textarea id="hw-inst-${idx}" oninput="window.hwSyncData(${idx})" style="height:60px; width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; margin-bottom:15px;">${lvl.instruction}</textarea>
                        <label style="font-size:0.85em; font-weight:bold;">Consigne Secrète pour l'IA :</label>
                        <textarea id="hw-ai-${idx}" oninput="window.hwSyncData(${idx})" style="height:60px; width:100%; padding:8px; border:1px solid #ccc; border-radius:5px; background:#f0f7ff;">${lvl.aiPrompt}</textarea>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
};

// --- WINDOW HELPERS ---

window.openEditHw = (idx) => {
    const hw = homeworksList[idx];
    state.editingHomeworkId = hw._id;
    state.tempHwLevels = JSON.parse(JSON.stringify(hw.levels));
    renderCreateHomeworkForm(hw);
};

window.hwSyncData = (idx) => {
    state.tempHwLevels[idx].instruction = document.getElementById(`hw-inst-${idx}`).value;
    state.tempHwLevels[idx].aiPrompt = document.getElementById(`hw-ai-${idx}`).value;
};

window.hwUpload = async (input, idx, zone) => {
    for (let file of input.files) {
        const res = await uploadFile(file);
        if (res.ok) {
            if (zone === 'top') state.tempHwLevels[idx].attachmentUrls.push(res.imageUrl);
            else state.tempHwLevels[idx].questionImage = res.imageUrl;
        }
    }
    renderLevelsInputs();
};

window.hwAddUrl = (idx) => {
    const val = document.getElementById(`url-top-${idx}`).value.trim();
    if(val) { state.tempHwLevels[idx].attachmentUrls.push(val); renderLevelsInputs(); }
};

window.hwRemoveDoc = (pIdx, dIdx) => {
    state.tempHwLevels[pIdx].attachmentUrls.splice(dIdx, 1);
    renderLevelsInputs();
};

window.removeLevelHw = (idx) => {
    if(confirm("Supprimer cette page ?")) { state.tempHwLevels.splice(idx, 1); renderLevelsInputs(); }
};

window.allowDrop = (e) => e.preventDefault();
window.hwDrag = (e, pIdx, dIdx) => { e.dataTransfer.setData("text", JSON.stringify({ pIdx, dIdx })); };
window.hwDrop = (e, pIdx) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("text"));
    if (data.pIdx !== pIdx) return;
    const list = state.tempHwLevels[pIdx].attachmentUrls;
    const item = list.splice(data.dIdx, 1)[0];
    list.push(item);
    renderLevelsInputs();
};

async function saveFormAction() {
    const title = document.getElementById("hwTitle").value.trim();
    const cls = document.getElementById("hwClass").value;
    if(!title) return alert("Le titre est requis.");
    const data = { id: state.editingHomeworkId, title, classroom: cls, levels: state.tempHwLevels };
    const res = await saveHomework(data, !!state.editingHomeworkId);
    if(res.ok) { document.getElementById("createHomeworkModal").style.display = "none"; refreshHomeworksList(); }
}

window.deleteHwModule = async (id) => {
    if(confirm("Supprimer ce devoir ?")) { await fetch(`/api/homework/${id}`, { method: 'DELETE' }); refreshHomeworksList(); }
};