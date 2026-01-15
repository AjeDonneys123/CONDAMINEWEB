export class ZombieGame {
    constructor(container, ctrl) { this.c = container; this.ctrl = ctrl; }
    loadQuestion(q) { this.c.querySelector('#z-q').textContent = q.q; }
}