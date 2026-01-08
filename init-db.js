const mongoose = require('mongoose');
require('dotenv').config();

const PlayerSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  classroom: String,
  email: String,
  validatedQuestions: [String],
  validatedLevels: { type: [mongoose.Schema.Types.Mixed], default: [] },
  spellingMistakes: { type: Array, default: [] },
  created_at: { type: Date, default: Date.now },
});

const Player = mongoose.model('Player', PlayerSchema, 'players');

const players = [
    // === 1D BFI (SÉCURISÉ) ===
    { firstName: 'Amaia Carolina', lastName: 'Arguello Zambrano', classroom: '1D', email: 'arguello.amaia@condamine.edu.ec' },
    { firstName: 'Ezequiel', lastName: 'Benitez Valarezo', classroom: '1D', email: 'benitez.ezequiel@condamine.edu.ec' },
    { firstName: 'Emilia Anahi', lastName: 'Conrado Guerrón', classroom: '1D', email: 'conrado.emilia@condamine.edu.ec' },
    { firstName: 'Isabel Cristina', lastName: 'Dávila Pérez', classroom: '1D', email: 'davila.isabel@condamine.edu.ec' },
    { firstName: 'Anna Victoria', lastName: 'Fernández Enríquez', classroom: '1D', email: 'fernandez.anna@condamine.edu.ec' },
    { firstName: 'Doménica Elizabeth', lastName: 'Gallardo Gallardo', classroom: '1D', email: 'gallardo.domenica@condamine.edu.ec' },
    { firstName: 'Adrián Felipe', lastName: 'Guzmán Espinosa', classroom: '1D', email: 'guzman.adrian@condamine.edu.ec' },
    { firstName: 'Marcela Ranné', lastName: 'Herrera Sempértegui', classroom: '1D', email: 'herrera.marcela@condamine.edu.ec' },
    { firstName: 'Batia Tatiana', lastName: 'Jácome Pástor', classroom: '1D', email: 'jacome.batia@condamine.edu.ec' },
    { firstName: 'Fabien', lastName: 'Lhomme Santiago', classroom: '1D', email: 'lhomme.santiago@condamine.edu.ec' },
    { firstName: 'Juan Xavier', lastName: 'Molina Alcivar', classroom: '1D', email: 'molina.juan@condamine.edu.ec' },
    { firstName: 'Franca', lastName: 'Navarro Gallegos', classroom: '1D', email: 'navarro.franca@condamine.edu.ec' },
    { firstName: 'Eduardo', lastName: 'Ojeda Rivera', classroom: '1D', email: 'ojeda.eduardo@condamine.edu.ec' },
    { firstName: 'Isabella Romina', lastName: 'Quelal Espinosa', classroom: '1D', email: 'quelal.isabella@condamine.edu.ec' },
    { firstName: 'Xander', lastName: 'Vancraeynest Martinez', classroom: '1D', email: 'vancraeynest.xander@condamine.edu.ec' },
    { firstName: 'Francisca Leonor', lastName: 'Yánez Tinoco', classroom: '1D', email: 'yanez.francisca@condamine.edu.ec' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '1D' },
    // Garder Gael et tests
    { firstName: 'Gael', lastName: 'Barbier Durango', classroom: '6D' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '6D' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '2A' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '5B' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '5C' }
];

async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ BDD Connectée.');
    // On met à jour ou on insère (évite les doublons)
    for (const p of players) {
        await Player.findOneAndUpdate(
            { firstName: p.firstName, lastName: p.lastName, classroom: p.classroom },
            p,
            { upsert: true }
        );
    }
    console.log('✅ Liste des élèves synchronisée (1D BFI incluse).');
  } catch (err) { console.error(err); } 
  finally { mongoose.disconnect(); }
}
initializeDatabase();