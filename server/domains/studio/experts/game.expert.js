// @signatures: GameExpert, getTestData
const mongoose = require('mongoose');

/**
 * 🕹️ EXPERT GAME - STUDIO
 * Gère la fourniture des données de test et la validation des scripts de jeu.
 */
const GameExpert = {
    /**
     * Récupère le dernier jeu marqué comme test pour alimenter le simulateur
     */
    getTestData: async () => {
        try {
            const GameLevel = mongoose.model('GameLevel');
            const testGame = await GameLevel.findOne({ isTestGame: true }).sort({ updatedAt: -1 }).lean();
            
            if (testGame) return testGame;

            // Mock de secours si aucun jeu de test n'est défini
            return {
                title: "Quiz de Secours",
                levels: [{
                    name: "Niveau 1",
                    questions: [
                        { q: "Combien font 2 x 3 ?", options: ["4", "5", "6", "8"], a: 2 },
                        { q: "Capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Lille"], a: 1 }
                    ]
                }]
            };
        } catch (e) {
            console.error("❌ [GAME-EXPERT] Error:", e.message);
            return null;
        }
    }
};

module.exports = GameExpert;
