// PLUS D'IMPORTS

export class StarshipGame {
    constructor(container, controller) {
        this.c = container;
        this.ctrl = controller;
        this.qEl = container.querySelector("#question");
        this.ship = container.querySelector("#ship");
    }

    loadQuestion(q) {
        this.currentQ = q;
        if(this.qEl) this.qEl.textContent = q.q;
        
        let optsContainer = this.c.querySelector(".starship-options");
        if(!optsContainer) {
            optsContainer = document.createElement("div");
            optsContainer.className = "starship-options";
            optsContainer.style.cssText = "position:absolute; bottom:10px; width:100%; display:flex; justify-content:center; gap:10px;";
            this.c.querySelector("#starship-game-area").appendChild(optsContainer);
        }
        
        optsContainer.innerHTML = "";
        if(q.options) {
            q.options.forEach((opt, idx) => {
                const btn = document.createElement("button");
                btn.textContent = opt;
                btn.style.cssText = "padding:10px; background:rgba(0,0,0,0.8); color:white; border:1px solid #00ff00; border-radius:5px; cursor:pointer;";
                btn.onclick = () => this.check(idx);
                optsContainer.appendChild(btn);
            });
        } else {
            optsContainer.innerHTML = `<input id="star-input" style="padding:5px;"><button id="star-btn" style="padding:5px;">Tirer</button>`;
            this.c.querySelector("#star-btn").onclick = () => this.checkText();
        }
    }

    check(idx) {
        const correct = this.currentQ.a;
        let isCorrect = (typeof correct === 'number') ? (idx === correct) : (this.currentQ.options[idx] === correct);
        
        if(isCorrect) {
            if(this.ship) this.ship.style.transform = "translateY(-50px)";
            setTimeout(() => this.ctrl.notifyCorrectAnswer(), 300);
        } else {
            this.ctrl.notifyWrongAnswer();
        }
    }

    async checkText() {
        const val = this.c.querySelector("#star-input").value;
        // CORRECTION : window.api et window.state
        const res = await window.api.verifyWithAI({
            question: this.currentQ.q,
            userAnswer: val,
            expectedAnswer: this.currentQ.a,
            playerId: window.state.currentPlayerId
        });
        if(res.status === "correct") this.ctrl.notifyCorrectAnswer();
        else this.ctrl.notifyWrongAnswer();
    }
}