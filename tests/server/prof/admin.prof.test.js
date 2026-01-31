import { describe, it, expect, vi } from 'vitest';

describe('Silo Prof: Logique Admin', () => {
    it('doit charger le routeur admin sans erreur', () => {
        const router = require('../../../server/prof/admin/admin.prof.js');
        expect(router).toBeDefined();
        expect(typeof router).toBe('function'); // C'est un middleware Express
    });
});
