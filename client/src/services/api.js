export const api = {
    get: (url) => fetch(`/api${url}`).then(r => r.json()),
    post: (url, data) => fetch(`/api${url}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json())
};