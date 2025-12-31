import { initDevoirsModule } from './devoirs/devoirs.js';
import { initJeuxModule } from './jeux/jeux.js';

export async function initEleveDashboard(container) {
    console.log("🎓 Dashboard Élève V14 - Actif");

    // Bouton orange Prof pour élève test
    if(window.state.currentPlayerData.firstName === "Eleve" && window.state.currentPlayerData.lastName === "Test") {
        const btnProf = document.getElementById("backToProfBtn");
        if(btnProf) {
            btnProf.style.display = "block";
            btnProf.onclick = () => { 
                localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" })); 
                window.location.reload(); 
            };
        }
    }

    container.innerHTML = `
        <div class="tabs-container">
            <button id="tab-devoirs" class="tab-btn active">📚 Mes Devoirs</button>
            <button id="tab-jeux" class="tab-btn">🎮 Mini-Jeux</button>
        </div>
        <div id="eleve-content-area"></div>
    `;

    const area = document.getElementById("eleve-content-area");
    const tDev = document.getElementById("tab-devoirs");
    const tJeu = document.getElementById("tab-jeux");

    const switchTab = (name) => {
        tDev.classList.toggle('active', name === 'devoirs');
        tJeu.classList.toggle('active', name === 'jeux');
        if(name === 'devoirs') initDevoirsModule(area);
        else initJeuxModule(area);
    };

    tDev.onclick = () => switchTab('devoirs');
    tJeu.onclick = () => switchTab('jeux');

    switchTab('devoirs');
}


