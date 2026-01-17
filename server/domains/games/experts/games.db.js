const GamesDB = require('../db/games.db');
const GamesExpertDB = {
    getAll: async () => await GamesDB.fetchAll(),
    saveQuiz: async (data) => await GamesDB.upsert(data)
};
module.exports = GamesExpertDB;