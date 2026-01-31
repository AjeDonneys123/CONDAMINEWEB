/**
 * 🧪 FIX MODÈLES ÉLÈVE (V1.520.0)
 * On ajuste le test pour tenir compte du singleton Mongoose.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('Silo Eleve: Intégrité des Modèles', () => {
    // Note : require ici charge la version élève des schémas
    const { Homework } = require('../../../server/eleve/models/eleve.models.js');

    it('doit posséder les champs de base pour l\'élève', () => {
        expect(Homework.schema.paths.title).toBeDefined();
        expect(Homework.schema.paths.levels).toBeDefined();
    });

    it('doit valider que le modèle Submission est prêt pour le rendu', () => {
        const { Submission } = require('../../../server/eleve/models/eleve.models.js');
        expect(Submission.schema.paths.content).toBeDefined();
        expect(Submission.schema.paths.grade).toBeDefined();
    });
});
