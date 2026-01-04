/**
 * 🧠 CERVEAU COMMUN DES JEUX ÉDUCATIFS
 * Gère : Progression, Vies, Niveaux (0-3), Validation
 */

export class GameProgression {
    constructor(questions, maxLives = 4) {
        this.questions = questions; // Données brutes
        this.lives = maxLives;
        
        // Initialisation des états (Niveau 0, Pas fini)
        this.states = questions.map(() => ({ 
            level: 0, 
            done: false 
        }));
    }

    /**
     * Nettoie une chaîne pour comparaison (accents, majuscules)
     */
    normalize(str) {
        if (typeof str !== 'string') return "";
        return str.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");
    }

    /**
     * Trouve la prochaine question à jouer
     * @returns {Object|null} { question, index, level } ou null si fini
     */
    getNextActiveQuestion() {
        const idx = this.states.findIndex(s => !s.done);
        if (idx === -1) return null; // Jeu fini
        return {
            q: this.questions[idx],
            idx: idx,
            level: this.states[idx].level
        };
    }

    /**
     * Traite une réponse (QCM ou Input)
     * @param {number} qIdx - Index de la question
     * @param {any} answer - Index choisi (QCM) ou Texte tapé (Input)
     * @returns {Object} Résultat { success: boolean, oldLevel: number, newLevel: number, isDone: boolean }
     */
    submitAnswer(qIdx, answer) {
        const q = this.questions[qIdx];
        const state = this.states[qIdx];
        const oldLevel = state.level;
        let success = false;

        // Vérification selon le niveau
        if (state.level < 2) {
            // Mode QCM (answer est un index)
            success = (parseInt(answer) === q.a);
        } else {
            // Mode Input (answer est un texte)
            const correctText = q.options[q.a];
            success = (this.normalize(answer) === this.normalize(correctText));
        }

        // Mise à jour de l'état
        if (success) {
            state.level++;
            if (state.level >= 3) state.done = true;
        } else {
            // Pénalité : on redescend
            if (state.level > 0) state.level--;
        }

        return {
            success,
            oldLevel,
            newLevel: state.level,
            isDone: state.done
        };
    }

    /**
     * Punit le joueur (ex: collision)
     * @param {number} qIdx - Index question en cours
     * @returns {Object} { lives: number, isDead: boolean, newLevel: number }
     */
    loseLife(qIdx) {
        this.lives--;
        
        // Pénalité supplémentaire sur la question en cours
        if (this.states[qIdx].level > 0) {
            this.states[qIdx].level--;
        }

        return {
            lives: this.lives,
            isDead: this.lives <= 0,
            newLevel: this.states[qIdx].level
        };
    }

    /**
     * Données pour l'affichage des barres
     */
    getTrackerData() {
        const totalLevels = this.states.length * 3;
        let currentLevels = 0;
        
        const dots = this.states.map(s => {
            currentLevels += Math.min(s.level, 3);
            return {
                level: s.level,
                pct: (s.level / 3) * 100,
                done: s.done
            };
        });

        return {
            dots,
            globalPct: Math.floor((currentLevels / totalLevels) * 100)
        };
    }
    
    getLives() { return this.lives; }
}