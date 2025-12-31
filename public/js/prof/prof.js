import { initDashboardModule } from './dashboard.js';

export async function initProfDashboard(container) {
    console.log("🎓 Chef d'orchestre PROF V22 chargé");

    container.innerHTML = `
        <div class="prof-shell">
            <div class="tabs-container" style="display:flex; gap:10px; margin-bottom:25px; border-bottom:2px solid #eee; padding-bottom:10px;">
                <button id="tab-dash" class="tab-btn active">👥 Élèves & Finder</button>
                <button id="tab-hw" class="tab-btn">📚 Devoirs</button>
                <button id="tab-game" class="tab-btn">🎮 Créateur de Jeux</button>
            </div>
            
            <div id="prof-content-area" style="min-height: 400px;">
                <!-- Injection ici -->
            </div>
        </div>
    `;

    const area = document.getElementById("prof-content-area");
    const tDash = document.getElementById("tab-dash");
    const tHw = document.getElementById("tab-hw");
    const tGame = document.getElementById("tab-game");

    const switchTab = (name) => {
        [tDash, tHw, tGame].forEach(b => b.classList.remove('active'));
        area.innerHTML = "<div style='padding:40px; text-align:center;'>Chargement...</div>";

        if (name === 'dash') {
            tDash.classList.add('active');
            initDashboardModule(area);
        } else {
            document.getElementById(name === 'hw' ? 'tab-hw' : 'tab-game').classList.add('active');
            area.innerHTML = "<div class='card'><h3>Bientôt disponible</h3></div>";
        }
    };

    tDash.onclick = () => switchTab('dash');
    tHw.onclick = () => switchTab('hw');
    tGame.onclick = () => switchTab('game');

    // Lancement par défaut
    initDashboardModule(area);
}


