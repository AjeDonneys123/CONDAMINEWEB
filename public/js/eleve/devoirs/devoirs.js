export async function initDevoirsModule(container) {
    container.innerHTML = `
        <div class="card">
            <h3>📚 Mes Devoirs Maison</h3>
            <div id="devoirs-list">Chargement des devoirs...</div>
        </div>
    `;

    const classroom = window.state.user.classroom;
    const homeworks = await window.api.getHomeworks(classroom);
    const listCont = document.getElementById("devoirs-list");

    if (!homeworks || homeworks.length === 0) {
        listCont.innerHTML = "<p>Aucun devoir pour le moment. 🌴</p>";
        return;
    }

    listCont.innerHTML = homeworks.map(hw => `
        <div class="card" style="margin-bottom:10px; padding:15px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <span><b>${hw.title}</b></span>
            <button class="action-btn" style="width:auto; padding:5px 15px;">Ouvrir</button>
        </div>
    `).join('');
}


