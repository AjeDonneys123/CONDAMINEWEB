// --- COEUR DE L'APPLICATION (Version Globale) ---

// 1. DÉFINITION DE L'API
const api = {
    async post(url, data) { 
        try { 
            const r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }); 
            return await r.json(); 
        } catch(e) { console.error("API Error:", e); return {ok:false}; } 
    },
    async get(url) { 
        try { 
            const r = await fetch(url); 
            return r.ok ? await r.json() : null; 
        } catch(e) { console.error("API Error:", e); return null; } 
    },
    async upload(file) { 
        try { 
            const fd = new FormData(); fd.append('file', file); 
            const r = await fetch('/api/upload', { method: 'POST', body: fd }); 
            return await r.json(); 
        } catch(e) { console.error("Upload Error:", e); return {ok:false}; } 
    },
    
    // Méthodes métier
    async saveHomework(data, isUpdate) { return await this.post(isUpdate ? `/api/homework/${data.id}` : '/api/homework', data); },
    async getHomeworks(classroom) { return await this.get(classroom ? `/api/homework/${classroom}` : '/api/homework-all') || []; },
    async fetchPlayers() { return await this.get('/api/players') || []; },
    async reportBug(bugData) { return await this.post('/api/report-bug', bugData); },
    async verifyWithAI(payload) { return await this.post('/api/verify-answer-ai', payload); }
};

// 2. DÉFINITION DU STATE
const state = {
    user: JSON.parse(localStorage.getItem("player") || "null"),
    getClassKey: (c) => { 
        if(!c) return "default"; 
        const val = c.toUpperCase(); 
        if (val.includes("6")) return "6e"; 
        if (val.includes("5")) return "5e"; 
        return "2de"; 
    },
    isRKeyDown: false, isTKeyDown: false, isGameActive: false, isGlobalPaused: false, locked: false,
    allQuestionsData: {}, allPlayersData: [], homeworksList: [],
    currentPlayerId: JSON.parse(localStorage.getItem("player"))?._id || null,
    currentPlayerData: JSON.parse(localStorage.getItem("player")) || null,
    levels: [], currentLevel: 0, currentIndex: 0, lives: 4, localScores: [], general: 0,
    currentGameModuleInstance: null, tempHwLevels: [], editingHomeworkId: null
};

// 3. EXPOSITION GLOBALE (LA CLÉ DU SUCCÈS)
window.api = api;
window.state = state;

// On garde les exports pour les jeux (compatibilité)
export { api, state };

// 4. LOGIQUE DE DÉMARRAGE
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 App Started. User:", state.user ? state.user.firstName : "Guest");

    if (state.user) {
        state.currentPlayerId = state.user.id || state.user._id;
        state.currentPlayerData = state.user;

        document.getElementById("registerCard").style.display = "none";
        const badge = document.getElementById("studentBadge");
        if(badge) { badge.textContent = `${state.user.firstName} ${state.user.lastName}`; badge.style.display = "block"; }
        document.getElementById("logoutBtn").style.display = "block";

        const isProf = (state.user.firstName.toLowerCase().includes("jean") && state.user.lastName.toLowerCase().includes("vuill")) || state.user.id === "prof";
        
        // Import dynamique sans dépendance circulaire
        if (isProf) {
            const module = await import('./prof.js');
            module.initProfDashboard();
        } else {
            const module = await import('./eleve.js');
            module.initStudentInterface();
        }
    }

    // Gestion Formulaire Connexion
    const regForm = document.getElementById("registerForm");
    if(regForm) regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = document.getElementById("firstName").value.trim();
        const l = document.getElementById("lastName").value.trim();
        const c = document.getElementById("classroom").value;

        if (f.toLowerCase().includes("jean") && l.toLowerCase().includes("vuill")) { 
            document.getElementById("profPasswordModal").style.display = "block"; 
            return; 
        }

        const res = await api.post('/api/register', { firstName: f, lastName: l, classroom: c });
        if(res.ok) { 
            localStorage.setItem("player", JSON.stringify(res)); 
            window.location.reload(); 
        } else { alert("Élève non trouvé."); }
    });

    // Gestion Mot de passe Prof
    const validateBtn = document.getElementById("validateProfPasswordBtn");
    if(validateBtn) validateBtn.addEventListener("click", () => {
        if(document.getElementById("profPassword").value === "Clemenceau1919") {
            localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" }));
            window.location.reload();
        } else alert("Code incorrect");
    });

    document.getElementById("logoutBtn").onclick = () => { localStorage.removeItem("player"); window.location.reload(); };
});

// Cheat Codes
document.addEventListener("keydown", (e) => { 
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key?.toLowerCase() === "r") state.isRKeyDown = true; 
    if (e.key?.toLowerCase() === "t") state.isTKeyDown = true; 
});
document.addEventListener("keyup", (e) => { 
    if (e.key?.toLowerCase() === "r") state.isRKeyDown = false; 
    if (e.key?.toLowerCase() === "t") state.isTKeyDown = false; 
});