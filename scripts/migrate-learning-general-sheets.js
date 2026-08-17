require('dotenv').config();
const mongoose = require('mongoose');
const { LearningModule } = require('../server/prof/models/prof.models');
const { restoreGeneralSheet } = require('../server/prof/learning/general-sheet.persistence');

const apply = process.argv.includes('--apply');

async function main() {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI manquant dans .env');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    const modules = await LearningModule.find({}).lean();
    const changes = modules
        .map((module) => ({ module, restored: restoreGeneralSheet(module.steps, module.title) }))
        .filter(({ restored }) => restored.changed);
    const created = changes.filter(({ restored }) => restored.created).length;
    console.log(`[fiche-generale] ${modules.length} apprentissage(s) analysé(s), ${changes.length} à mettre à jour, ${created} fiche(s) à recréer.`);

    if (!apply || changes.length === 0) {
        console.log(apply ? '[fiche-generale] Aucune modification nécessaire.' : '[fiche-generale] Audit uniquement. Relancer avec --apply pour écrire en BDD.');
        return;
    }

    const backupCollectionName = `learningmodules_general_sheet_backup_${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
    const backupCollection = mongoose.connection.db.collection(backupCollectionName);
    await backupCollection.insertMany(changes.map(({ module }) => ({ ...module, backedUpAt: new Date() })), { ordered: false });
    await LearningModule.bulkWrite(changes.map(({ module, restored }) => ({
        updateOne: {
            filter: { _id: module._id },
            update: { $set: { steps: restored.steps } }
        }
    })), { ordered: false });
    console.log(`[fiche-generale] Migration terminée. Sauvegarde BDD : ${backupCollectionName}`);
}

main()
    .catch((error) => {
        console.error('[fiche-generale] Échec :', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
