window.api = {
    async post(url, data) { 
        try { 
            const r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }); 
            return await r.json(); 
        } catch(e) { console.error("API Post Error:", e); return {ok:false}; } 
    },
    async get(url) { 
        try { 
            const r = await fetch(url); 
            return r.ok ? await r.json() : null; 
        } catch(e) { console.error("API Get Error:", e); return null; } 
    },
    async fetchPlayers() { return await this.get('/api/players') || []; }
};

window.state = {
    user: JSON.parse(localStorage.getItem("player") || "null"),
    getClassKey: (c) => { 
        if(!c) return "6e"; 
        const val = c.toUpperCase(); 
        if (val.includes("6")) return "6e"; 
        if (val.includes("5")) return "5e"; 
        return "2de"; 
    },
    currentPlayerId: null
};

document.addEventListener("DOMContentLoaded", async () => {
    const mainContent = document.getElementById("main-content");
    if (!mainContent) return;

    if (window.state.user) {
        window.state.currentPlayerId = window.state.user.id || window.state.user._id;
        document.getElementById("registerCard").style.display = "none";
        document.getElementById("logoutBtn").style.display = "block";
        const badge = document.getElementById("studentBadge");
        if(badge) { badge.textContent = `${window.state.user.firstName} ${window.state.user.lastName}`; badge.style.display = "block"; }

        const isProf = (window.state.user.firstName.toLowerCase().includes("jean") && window.state.user.lastName.toLowerCase().includes("vuill")) || window.state.user.id === "prof";
        
        if (isProf) {
            const module = await import('./prof/prof.js');
            module.initProfDashboard(mainContent);
        } else {
            const module = await import('./eleve/eleve.js');
            module.initEleveDashboard(mainContent);
        }
    }

    const regForm = document.getElementById("registerForm");
    if(regForm) regForm.onsubmit = async (e) => {
        e.preventDefault();
        const f = document.getElementById("firstName").value.trim();
        const l = document.getElementById("lastName").value.trim();
        const c = document.getElementById("classroom").value;
        if (f.toLowerCase() === "jean" && l.toLowerCase().includes("vuill")) {
            document.getElementById("profPasswordModal").style.display = "block";
            return;
        }
        const res = await window.api.post('/api/register', { firstName: f, lastName: l, classroom: c });
        if(res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); }
    };

    const valProfBtn = document.getElementById("validateProfPasswordBtn");
    if(valProfBtn) valProfBtn.onclick = () => {
        if(document.getElementById("profPassword").value === "Clemenceau1919") {
            localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" }));
            window.location.reload();
        }
    };

    document.getElementById("logoutBtn").onclick = () => { localStorage.removeItem("player"); window.location.reload(); };
});


