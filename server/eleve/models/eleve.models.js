// @signatures: EleveModels, SingletonBridge
const ProfModels = require('../../prof/models/prof.models');
/**
 * 🎒 PONT DE SÉCURITÉ
 * Redirige vers le Singleton Prof pour éviter les collisions Mongoose.
 */
module.exports = ProfModels;
