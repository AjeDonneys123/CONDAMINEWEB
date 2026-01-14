/**
 * 📞 SERVICE API CENTRALISÉ (V2 - ÉTANCHE)
 */

const API_BASE = '/api';

const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur serveur : ${response.status}`);
    }
    return response.json();
};

export const api = {
    async get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        return handleResponse(response);
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    async delete(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE'
        });
        return handleResponse(response);
    },

    // Raccourcis Devoirs
    async getHomeworks(classroom) {
        return this.get(`/homework/by-class/${classroom}`);
    },

    // Raccourcis Jeux
    async getGames() {
        return this.get('/games/all');
    },

    // Raccourcis Joueurs
    async getPlayers() {
        return this.get('/players');
    }
};