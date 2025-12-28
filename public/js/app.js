export const api = {
    async post(url, data) { try { const r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }); return await r.json(); } catch(e) { return {ok:false}; } },
    async get(url) { try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch(e) { return null; } },
    async upload(file) { try { const fd = new FormData(); fd.append('file', file); const r = await fetch('/api/upload', { method: 'POST', body: fd }); return await r.json(); } catch(e) { return {ok:false}; } }
};
export const state = {
    user: JSON.parse(localStorage.getItem("player") || "null"),
    getClassKey: (c) => { 
        if(!c) return "default"; 
        const val = c.toUpperCase(); 
        if (val.includes("6")) return "6e"; 
        if (val.includes("5")) return "5e"; 
        return "2de"; 
    },
    isRKeyDown: false, isTKeyDown: false, questionsData: null
};
import { initProfDashboard } from './prof.js';
import { initStudentInterface } from './eleve.js';
document.addEventListener("DOMContentLoaded", () => {
    if (state.user) {
        const regCard = document.getElementById("registerCard");
        const badge = document.getElementById("studentBadge");
        const logout = document.getElementById("logoutBtn");
        if(regCard) regCard.style.display = "none";
        if(badge) {
            badge.textContent = `${state.user.firstName} ${state.user.lastName}`;
            badge.style.display = "block";
        }
        if(logout) logout.style.display = "block";
        const isProf = (state.user.firstName.toLowerCase().includes("jean") && state.user.lastName.toLowerCase().includes("vuill")) || state.user.id === "prof";
        if (isProf) initProfDashboard(); else initStudentInterface();
    }
    const regForm = document.getElementById("registerForm");
    if(regForm) regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = document.getElementById("firstName").value.trim();
        const l = document.getElementById("lastName").value.trim();
        const c = document.getElementById("classroom").value;
        if (f.toLowerCase().includes("jean") && l.toLowerCase().includes("vuill")) { 
            const modal = document.getElementById("profPasswordModal");
            if(modal) modal.style.display = "block"; 
            return; 
        }
        const res = await api.post('/api/register', { firstName: f, lastName: l, classroom: c });
        if(res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); } else alert("Élève non trouvé.");
    });
    const validateBtn = document.getElementById("validateProfPasswordBtn");
    if(validateBtn) validateBtn.addEventListener("click", () => {
        const pass = document.getElementById("profPassword");
        if(pass && pass.value === "Clemenceau1919") {
            localStorage.setItem("player", JSON.stringify({ id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" }));
            window.location.reload();
        } else alert("Code incorrect");
    });
    const logoutBtn = document.getElementById("logoutBtn");
    if(logoutBtn) logoutBtn.onclick = () => { localStorage.removeItem("player"); window.location.reload(); };
});
document.addEventListener("keydown", (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.key?.toLowerCase() === "r") state.isRKeyDown = true; if (e.key?.toLowerCase() === "t") state.isTKeyDown = true; });
document.addEventListener("keyup", (e) => { if (e.key?.toLowerCase() === "r") state.isRKeyDown = false; if (e.key?.toLowerCase() === "t") state.isTKeyDown = false; });