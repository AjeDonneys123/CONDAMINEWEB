/**
 * 📞 SERVICE API CENTRALISÉ
 * Gère la communication robuste avec le serveur.
 * Évite les erreurs de parsing JSON sur les 404.
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
    // Méthodes génériques
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

    // Raccourcis spécifiques
    async getHomeworks(classroom) {
        return this.get(`/homework/by-class/${classroom}`);
    },

    async getPlayers() {
        return this.get('/players');
    }
};