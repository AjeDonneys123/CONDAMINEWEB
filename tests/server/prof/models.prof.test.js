import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('Silo Prof: Intégrité des Modèles', () => {
    const { Chapter, Homework, Teacher, Admin, Student, GptInboxMessage } = require('../../../server/prof/models/prof.models.js');

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

    it('stocke durablement une correction GPT unifiée et ses pages', () => {
        ['sujet', 'devoirComplet', 'openaiFileIdRefs', 'images', 'evaluationType', 'note', 'forme', 'introduction', 'arguments', 'exemples', 'developpement', 'conclusion', 'expression', 'message', 'conseils']
            .forEach((field) => expect(GptInboxMessage.schema.paths[field]).toBeDefined());
        expect(GptInboxMessage.schema.paths.note.options.min).toBe(0);
        expect(GptInboxMessage.schema.paths.note.options.max).toBe(20);
        expect(GptInboxMessage.schema.paths.developpement.options.max).toBe(10);
        expect(GptInboxMessage.schema.paths.expression.options.max).toBe(3);
    });
});
