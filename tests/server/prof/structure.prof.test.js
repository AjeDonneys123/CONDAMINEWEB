/**
 * 🧪 TESTS US STRUCTURE PROF (V1.540.0)
 * Ajout du test pour le choix Cacher/Supprimer (US#12)
 */
import { describe, it, expect } from 'vitest';

describe('Silo Prof: Logique de suppression intelligente (US#12)', () => {
    
    it('doit permettre de supprimer une section pour TOUTES les classes (permanent: true)', () => {
        const teacher = {
            subjectSections: [
                { name: "MATHS", scope: "GLOBAL", hiddenIn: [] }
            ]
        };

        const deleteSection = (name, isPermanent) => {
            if (isPermanent) {
                teacher.subjectSections = teacher.subjectSections.filter(s => s.name !== name);
            }
        };

        deleteSection("MATHS", true);
        expect(teacher.subjectSections).toHaveLength(0);
    });

    it('doit permettre de cacher une section pour UNE classe spécifique (permanent: false)', () => {
        const teacher = {
            subjectSections: [
                { name: "MATHS", scope: "GLOBAL", hiddenIn: [] }
            ]
        };

        const hideSection = (name, classId) => {
            const section = teacher.subjectSections.find(s => s.name === name);
            if (section) section.hiddenIn.push(classId);
        };

        hideSection("MATHS", "6A");
        expect(teacher.subjectSections[0].hiddenIn).toContain("6A");
        expect(teacher.subjectSections).toHaveLength(1); // La section existe toujours
    });
});
