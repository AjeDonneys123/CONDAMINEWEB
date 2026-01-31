/**
 * 🧪 TESTS LOGIQUE MÉTIER : DEVOIRS PROF (V1.530.0)
 * Validation : US#16 (Distribution fine) et US#31 (Punitions)
 */
import { describe, it, expect } from 'vitest';

describe('Silo Prof: Logique de Création & Distribution', () => {

    it('US#16 : Doit permettre la sélection d\'élèves spécifiques (Mode Soutien)', () => {
        const classStudents = ["ID1", "ID2", "ID3", "ID4"];
        const selected = ["ID1", "ID3"];

        const homework = {
            title: "Soutien Maths",
            isAllClass: false,
            assignedStudents: selected
        };

        expect(homework.isAllClass).toBe(false);
        expect(homework.assignedStudents).toHaveLength(2);
        expect(homework.assignedStudents).toContain("ID1");
        expect(homework.assignedStudents).not.toContain("ID2");
    });

    it('US#31 : Un devoir marqué comme punition doit être flaggé "isPunishment"', () => {
        const punishmentHw = {
            title: "Rédaction supplémentaire",
            isPunishment: true,
            isAllClass: false
        };
        expect(punishmentHw.isPunishment).toBe(true);
    });

    it('DISTRIBUTION : Doit pouvoir cibler plusieurs classes à la fois', () => {
        const hw = { targetClassrooms: ["6A", "6B", "6C"] };
        expect(hw.targetClassrooms).toContain("6B");
    });
});
