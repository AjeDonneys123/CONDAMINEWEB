import { initDevoirsModule } from './devoirs.js';
import { initJeuxModule } from './jeux.js';

export async function initEleveDashboard(container) {
    console.log("%c🧒 ESPACE ÉLÈVE V22 - CHARGÉ", "color: white; background: #16a34a; padding: 10px; font-weight: bold;");

    // 1. Rétablir le bouton orange "🎓 Prof" pour l'élève de test
    const user = window.state.user;
    if(user && user.firstName === "Eleve" && user.lastName === "Test") {
        const btnProf = document.getElementById("backToProfBtn");
        if(btnProf) {
            btnProf.style.display = "block";
            btnProf.onclick = () => { 
                localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" })); 
                window.location.reload(); 
            };
        }
    }

    // 2. Initialisation du carnet de fautes
    const btnMistakes = document.getElementById("myMistakesBtn");
    if(btnMistakes) {
        btnMistakes.style.display = "block";
        btnMistakes.onclick = openMistakesModal;
    }

    // 3. FIX FERMETURE : On attache l'événement de fermeture une seule fois ici
    const closeBtn = document.getElementById("closeMistakesBtn");
    if(closeBtn) {
        closeBtn.onclick = () => {
            console.log("🔒 Fermeture du carnet de fautes");
            document.getElementById("mistakesModal").style.display = "none";
        };
    }

    // 4. Rendu de la coque de navigation (Onglets)
    container.innerHTML = `
        <div class="student-shell">
            <div class="tabs-container">
                <button id="tab-devoirs" class="tab-btn active">📚 Mes Devoirs</button>
                <button id="tab-jeux" class="tab-btn">🎮 Mini-Jeux</button>
            </div>
            
            <div id="eleve-content-area" style="min-height: 400px;">
                <!-- Les sous-modules injectent ici -->
            </div>
        </div>
    `;

    const tabDevoirs = document.getElementById("tab-devoirs");
    const tabJeux = document.getElementById("tab-jeux");
    const contentArea = document.getElementById("eleve-content-area");

    const switchTab = (name) => {
        tabDevoirs.classList.toggle('active', name === 'devoirs');
        tabJeux.classList.toggle('active', name === 'jeux');
        contentArea.innerHTML = `<div style="padding:40px; text-align:center; color:#94a3b8;">Chargement...</div>`;

        if (name === 'devoirs') {
            initDevoirsModule(contentArea);
        } else {
            initJeuxModule(contentArea);
        }
    };

    tabDevoirs.onclick = () => switchTab('devoirs');
    tabJeux.onclick = () => switchTab('jeux');

    // Démarrage par défaut sur Devoirs
    switchTab('devoirs');
}

async function openMistakesModal() {
    const list = document.getElementById("mistakesList");
    const modal = document.getElementById("mistakesModal");
    modal.style.display = "flex";
    list.innerHTML = "<p style='text-align:center; padding:20px;'>Chargement de ton carnet...</p>";

    try {
        const res = await window.api.get(`/api/player-data/${window.state.currentPlayerId}`);
        if(res && res.spellingMistakes) {
            const mistakes = res.spellingMistakes;
            if(mistakes.length === 0) {
                list.innerHTML = "<p style='text-align:center; padding:40px;'>Aucune faute enregistrée ! 🎉</p>";
            } else {
                list.innerHTML = `
                    <table class="correction-table">
                        <thead>
                            <tr><th>Mot erroné</th><th>Correction</th><th>Explication</th><th></th></tr>
                        </thead>
                        <tbody>
                            ${mistakes.reverse().map((m, i) => `
                                <tr>
                                    <td><span class="wrong-word">${m.wrong}</span></td>
                                    <td><span class="right-word">${m.correct}</span></td>
                                    <td><small>${m.reason || "Usage"}</small></td>
                                    <td style="text-align:right;">
                                        <button onclick="deleteMistakeLocally(${mistakes.length - 1 - i})" 
                                                style="background:#fee2e2; color:red; border-radius:50%; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #f87171; cursor:pointer;">✕</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
            }
        }
    } catch(e) { 
        console.error("Erreur chargement fautes:", e);
        list.innerHTML = "<p style='text-align:center; color:red; padding:20px;'>Erreur lors du chargement des données.</p>"; 
    }
}

// Fonction globale pour supprimer une faute (appelée par le onclick dans le HTML injecté)
window.deleteMistakeLocally = async (idx) => {
    const res = await window.api.post('/api/delete-mistake', { playerId: window.state.currentPlayerId, mistakeIndex: idx });
    if(res.ok) openMistakesModal();
};