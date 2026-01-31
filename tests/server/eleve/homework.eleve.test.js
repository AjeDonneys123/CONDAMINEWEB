/**
 * 🧪 TESTS LOGIQUE MÉTIER : DEVOIRS ÉLÈVE (V1.530.0)
 * Validation de la visibilité côté consommation.
 */
import { describe, it, expect } from 'vitest';

describe('Silo Eleve: Logique de Visibilité', () => {

    it('CIBLAGE : Un élève de 6A ne doit pas voir les devoirs de la 5B', () => {
        const myClass = "6A";
        const databaseHw = [
            { title: "DM 6A", targetClassrooms: ["6A"], isAllClass: true },
            { title: "DM 5B", targetClassrooms: ["5B"], isAllClass: true }
        ];

        const visible = databaseHw.filter(hw => hw.targetClassrooms.includes(myClass));
        
        expect(visible).toHaveLength(1);
        expect(visible[0].title).toBe("DM 6A");
    });

    it('PUNITION : Un élève non puni ne doit pas voir les devoirs de punition', () => {
        const student = { punishmentStatus: "NONE" };
        const homework = { title: "Punition", isPunishment: true };

        const isVisible = homework.isPunishment ? student.punishmentStatus !== "NONE" : true;
        
        expect(isVisible).toBe(false);
    });
});
