export async function initJeuxModule(container) {
    console.log("📂 SOUS-MODULE JEUX : Lancement");

    container.innerHTML = `
        <div class="card">
            <h3 style="margin-top:0; color:var(--success);">🎮 Mes Mini-Jeux</h3>
            <div class="chapter-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                
                <div class="chapter-box card" id="btn-launch-zombie" style="cursor:pointer; border-left:5px solid var(--primary);">
                    <h3 style="color:var(--primary);">🧟 Chapitre 1</h3>
                    <p><b>L'Attaque des Zombies</b></p>
                    <p style="font-size:0.9em; color:var(--text-light);">Survis à l'invasion en révisant ta grammaire.</p>
                    <button class="action-btn" style="margin-top:10px;">JOUER</button>
                </div>

                <div class="chapter-box card" style="opacity:0.5; border-left:5px solid #cbd5e1;">
                    <h3>🚀 Chapitre 2</h3>
                    <p>Starship Grammar (Bientôt)</p>
                    <button class="action-btn" disabled style="background:#ccc;">VERROUILLÉ</button>
                </div>

            </div>
        </div>
    `;

    document.getElementById("btn-launch-zombie").onclick = () => {
        alert("Lancement du Zombie (Module en attente de reconnexion)");
    };
}