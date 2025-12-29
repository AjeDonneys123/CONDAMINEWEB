import { state, api } from '../app.js';

export class RedactionGame {
    constructor(container, controller) {
        this.c = container;
        this.ctrl = controller;
        this.qEl = container.querySelector("#redac-q");
        this.input = container.querySelector("#redac-answer");
        this.btnSubmit = container.querySelector("#redac-submit");
        this.loading = container.querySelector("#redac-loading");
        this.analysis = container.querySelector("#analysis-area");
        this.fbContent = container.querySelector("#text-good");
        this.btnContinue = container.querySelector("#redac-continue");

        if(this.btnSubmit) this.btnSubmit.onclick = () => this.check();
        if(this.btnContinue) this.btnContinue.onclick = () => this.finish(true);
    }

    loadQuestion(q) {
        this.currentQ = q;
        if(this.qEl) this.qEl.innerHTML = `<h3>Rédaction</h3><p>${q.q}</p>`;
        if(this.input) { this.input.value = ""; this.input.disabled = false; }
        if(this.analysis) this.analysis.style.display = "none";
        if(this.loading) this.loading.style.display = "none";
        if(this.btnSubmit) this.btnSubmit.style.display = "inline-block";
    }

    async check() {
        const txt = this.input.value.trim();
        if(txt.length < 5) return alert("Écris une phrase complète !");

        this.input.disabled = true;
        this.btnSubmit.style.display = "none";
        this.loading.innerHTML = "🧠 Analyse de l'IA...";
        this.loading.style.display = "block";

        try {
            // CORRECTION : api.verifyWithAI
            const res = await api.verifyWithAI({
                question: this.currentQ.q,
                userAnswer: txt,
                expectedAnswer: "Réponse libre cohérente",
                playerId: state.currentPlayerId
            });

            this.loading.style.display = "none";
            this.analysis.style.display = "block";
            
            if(res.status === "correct") {
                this.fbContent.innerHTML = `<h4 style="color:green">Excellent !</h4><p>${res.feedback}</p>`;
                this.btnContinue.onclick = () => this.ctrl.notifyCorrectAnswer();
            } else {
                this.fbContent.innerHTML = `<h4 style="color:orange">À améliorer</h4><p>${res.feedback}</p>`;
                this.btnContinue.onclick = () => this.ctrl.notifyWrongAnswer();
            }

        } catch(e) {
            console.error(e);
            this.loading.innerText = "Erreur IA";
            this.btnSubmit.style.display = "inline-block";
        }
    }
}