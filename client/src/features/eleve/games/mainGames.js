export class GameProgression {
    constructor(questions, maxLives = 4) {
        this.questions = questions;
        this.lives = maxLives;
        this.states = questions.map(() => ({ level: 0, done: false }));
    }
    normalize(str) { return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); }
    getNextActiveQuestion() {
        const idx = this.states.findIndex(s => !s.done);
        return idx === -1 ? null : { q: this.questions[idx], idx, level: this.states[idx].level };
    }
    submitAnswer(qIdx, answer) {
        const q = this.questions[qIdx];
        const state = this.states[qIdx];
        let success = state.level < 2 ? (parseInt(answer) === q.a) : (this.normalize(answer) === this.normalize(q.options[q.a]));
        if (success) { state.level++; if (state.level >= 3) state.done = true; }
        else if (state.level > 0) state.level--;
        return { success, isDone: state.done };
    }
    loseLife(qIdx) { this.lives--; if (this.states[qIdx].level > 0) this.states[qIdx].level--; return { lives: this.lives, isDead: this.lives <= 0 }; }
    getTrackerData() {
        const current = this.states.reduce((acc, s) => acc + Math.min(s.level, 3), 0);
        return { dots: this.states.map(s => ({ pct: (s.level/3)*100, done: s.done })), globalPct: (current / (this.states.length * 3)) * 100 };
    }
    getLives() { return this.lives; }
}