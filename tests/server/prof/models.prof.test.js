import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('Silo Prof: Intégrité des Modèles', () => {
    const { Chapter, Homework, Teacher, Admin, Student } = require('../../../server/prof/models/prof.models.js');

    it('doit avoir le modèle Chapter avec le champ section par défaut', () => {
        expect(Chapter.schema.paths.section).toBeDefined();
        // Vérifie la valeur par défaut définie dans prof.models.js
        expect(Chapter.schema.paths.section.options.default).toBe("GÉNÉRAL");
    });

    it('doit avoir le modèle Teacher avec le champ subjectSections', () => {
        expect(Teacher.schema.paths.subjectSections).toBeDefined();
    });

    it('doit avoir le modèle Homework avec le ciblage par classe', () => {
        expect(Homework.schema.paths.targetClassrooms).toBeDefined();
    });
});
