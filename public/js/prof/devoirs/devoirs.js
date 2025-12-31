export async function initDevoirsModule(container) {
    console.log("📂 Sous-module DEVOIRS PROF chargé");

    container.innerHTML = `
        <div class="card">
            <h3>Suivi des Devoirs Maison</h3>
            <button class="action-btn" style="background:var(--success); margin-bottom:20px; width:auto;">➕ Nouveau Devoir</button>
            <div id="prof-hw-list">Chargement...</div>
        </div>
    `;

    const listCont = document.getElementById("prof-hw-list");

    const loadHw = async () => {
        const hws = await window.api.getHomeworks(); // Récupère tout
        if(!hws.length) { listCont.innerHTML = "Aucun devoir créé."; return; }

        listCont.innerHTML = hws.map(h => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; border:1px solid #eee; margin-bottom:10px; padding:15px;">
                <span><b>${h.title}</b> <small>(${h.classroom})</small></span>
                <button style="color:var(--primary); background:none; border:1px solid var(--primary); padding:5px 10px;">👁️ Voir Copies</button>
            </div>
        `).join('');
    };

    loadHw();
}