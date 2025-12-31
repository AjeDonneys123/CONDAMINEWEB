export async function initDashboardModule(container) {
    console.log("📂 Injection du Finder et du bouton bleu de test...");

    container.innerHTML = `
        <div class="card">
            <h3>Gestion des Élèves</h3>
            
            <div class="prof-controls" style="display:flex; gap:15px; margin-bottom:20px; background:#f0f7ff; padding:20px; border-radius:12px; border:1px solid #2563eb; align-items: flex-end;">
                
                <div style="flex:1;">
                    <label style="font-size:0.8em; font-weight:bold; color:#2563eb; display:block; margin-bottom:5px;">1. FILTRER PAR CLASSE</label>
                    <select id="dash-class-filter" style="margin-bottom:0; padding:10px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                        <option value="all">Toutes les classes</option>
                        <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
                        <option value="2A">2de A</option><option value="2CD">2de CD</option>
                    </select>
                </div>
                
                <div style="flex:2;">
                    <label style="font-size:0.8em; font-weight:bold; color:#2563eb; display:block; margin-bottom:5px;">2. FINDER (RECHERCHE NOM)</label>
                    <input id="dash-search" placeholder="Taper le nom d'un élève..." style="margin-bottom:0; padding:10px; border-radius:8px; border:1px solid #cbd5e1; width:100%;">
                </div>

                <div style="flex:1;">
                    <button id="btn-tester-classe" style="width:100%; height:45px; background:#3b82f6; color:white; border-radius:8px; font-weight:bold; border:none; cursor:pointer;">
                        🎮 Tester la classe
                    </button>
                </div>
            </div>

            <table class="prof-table">
                <thead>
                    <tr><th>Élève</th><th>Classe</th><th style="text-align:center;">Action</th></tr>
                </thead>
                <tbody id="dash-players-body">
                    <tr><td colspan="3" style="text-align:center;">Chargement...</td></tr>
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
        const searchVal = searchInput.value.toLowerCase();
        const classVal = classFilter.value;

        const filtered = players.filter(p => {
            const fullName = (p.firstName + " " + p.lastName).toLowerCase();
            return fullName.includes(searchVal) && (classVal === "all" || p.classroom === classVal);
        });

        body.innerHTML = filtered.map(p => `
            <tr>
                <td><b>${p.firstName} ${p.lastName}</b></td>
                <td>${p.classroom}</td>
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