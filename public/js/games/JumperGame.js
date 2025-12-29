// PLUS D'IMPORTS

export class JumperGame {
    constructor(container, controller) {
        this.c = container;
        this.ctrl = controller;
        this.qEl = container.querySelector("#q-text");
        this.grid = container.querySelector("#options-grid");
    }

    loadQuestion(q) {
        this.currentQ = q;
        if(this.qEl) this.qEl.textContent = q.q;
        
        if(this.grid) {
            this.grid.innerHTML = "";
            if(q.options) {
                q.options.forEach((opt, idx) => {
                    const btn = document.createElement("button");
                    btn.className = "option-btn";
                    btn.textContent = opt;
                    btn.onclick = () => this.check(idx);
                    this.grid.appendChild(btn);
                });
            } else {
                this.grid.innerHTML = "<p>QCM requis.</p>";
            }
        }
    }

    check(idx) {
        const correct = this.currentQ.a; 
        let isCorrect = (typeof correct === 'number') ? (idx === correct) : (this.currentQ.options[idx] === correct);
        if(isCorrect) this.ctrl.notifyCorrectAnswer();
        else this.ctrl.notifyWrongAnswer();
    }
}