export async function initDashboardModule(container) {
    console.log("📂 Injection Dashboard V22 (Finder + Bouton Bleu)");

    container.innerHTML = `
        <div class="card">
            <h3>Gestion des Élèves</h3>
            
            <div class="prof-controls" style="display:flex; gap:15px; margin-bottom:20px; background:#f0f7ff; padding:20px; border-radius:12px; border:1px solid #2563eb; align-items: flex-end;">
                
                <div style="flex:1;">
                    <label style="font-size:0.8em; font-weight:bold; color:#2563eb; display:block; margin-bottom:5px;">CLASSE :</label>
                    <select id="dash-class-filter" style="height:45px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                        <option value="all">Toutes</option>
                        <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        <option value="2A">2de A</option><option value="2CD">2de CD</option>
                    </select>
                </div>
                
                <div style="flex:2;">
                    <label style="font-size:0.8em; font-weight:bold; color:#2563eb; display:block; margin-bottom:5px;">FINDER (RECHERCHE NOM) :</label>
                    <input id="dash-search" placeholder="Taper le nom d'un élève..." style="height:45px; border-radius:8px; border:1px solid #cbd5e1; width:100%; padding:10px;">
                </div>

                <div style="flex:1;">
                    <button id="btn-tester-classe" style="width:100%; height:45px; background:#3b82f6; color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer;">
                        🎮 Tester la classe
                    </button>
                </div>
            </div>

            <table class="prof-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                        <th style="padding:12px; text-align:left;">Élève</th>
                        <th style="padding:12px; text-align:left;">Classe</th>
                        <th style="padding:12px; text-align:center;">Action</th>
                    </tr>
                </thead>
                <tbody id="dash-players-body">
                    <tr><td colspan="3" style="text-align:center; padding:20px;">Chargement...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    const body = document.getElementById("dash-players-body");
    const searchInput = document.getElementById("dash-search");
    const classFilter = document.getElementById("dash-class-filter");
    const btnTest = document.getElementById("btn-tester-classe");

    // Bouton Bleu
    btnTest.onclick = async () => {
        const cls = classFilter.value;
        if(cls === "all") return alert("Sélectionne une classe d'abord.");
        const res = await window.api.post('/api/register', { firstName: "Eleve", lastName: "Test", classroom: cls });
        if(res.ok) { 
            localStorage.setItem("player", JSON.stringify(res)); 
            window.location.reload(); 
        }
    };

    // Finder
    const render = async () => {
        const players = await window.api.fetchPlayers();
        const searchVal = (searchInput.value || "").toLowerCase();
        const classVal = classFilter.value;

        const filtered = players.filter(p => {
            const fullName = (p.firstName + " " + p.lastName).toLowerCase();
            return fullName.includes(searchVal) && (classVal === "all" || p.classroom === classVal);
        });

        body.innerHTML = filtered.map(p => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px;"><b>${p.firstName} ${p.lastName}</b></td>
                <td style="padding:12px;">${p.classroom}</td>
                <td style="text-align:center;">
                    <button onclick="window.resetPlayerInDB('${p._id}')" style="padding:5px 10px; background:#fee2e2; color:red; border-radius:5px;">Reset</button>
                </td>
            </tr>
        `).join('');
    };

    window.resetPlayerInDB = async (id) => {
        if(!confirm("Effacer progression ?")) return;
        const res = await window.api.post('/api/reset-player', { playerId: id });
        if(res.ok) render();
    };

    searchInput.oninput = render;
    classFilter.onchange = render;
    render();
}