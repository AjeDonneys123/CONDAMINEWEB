const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');

const config = {
    apiKey: 'a'.repeat(32),
    ollamaBaseUrl: 'http://ollama.test',
    defaultModel: 'llama3.1:8b',
    requestTimeoutMs: 1000,
    maxConcurrent: 1,
    maxQueue: 2
};

const start = async (fetchImpl) => {
    const server = createApp(config, { fetch: fetchImpl }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    return { server, url: `http://127.0.0.1:${port}` };
};

test('health indique que Ollama est disponible', async (t) => {
    const instance = await start(async () => ({ ok: true }));
    t.after(() => instance.server.close());
    const response = await fetch(`${instance.url}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ollama, 'ready');
});

test('chat exige la cle API', async (t) => {
    const instance = await start(async () => { throw new Error('ne doit pas etre appele'); });
    t.after(() => instance.server.close());
    const response = await fetch(`${instance.url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Bonjour' }] })
    });
    assert.equal(response.status, 401);
});

test('chat transmet la requete a Ollama', async (t) => {
    let forwarded;
    const instance = await start(async (_url, options) => {
        forwarded = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({ model: 'llama3.1:8b', message: { role: 'assistant', content: 'Salut' }, done: true })
        };
    });
    t.after(() => instance.server.close());
    const response = await fetch(`${instance.url}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Bonjour' }] })
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message.content, 'Salut');
    assert.equal(forwarded.stream, false);
    assert.equal(forwarded.keep_alive, '30m');
    assert.equal(forwarded.options.num_predict, 220);
});

test('chat diffuse progressivement la reponse Ollama', async (t) => {
    let forwarded;
    const instance = await start(async (_url, options) => {
        forwarded = JSON.parse(options.body);
        return {
            ok: true,
            body: (async function* stream() {
                yield Buffer.from('{"message":{"content":"Bon"},"done":false}\n');
                yield Buffer.from('{"message":{"content":"jour"},"done":true}\n');
            })()
        };
    });
    t.after(() => instance.server.close());
    const response = await fetch(`${instance.url}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Bonjour' }] })
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Bon.*jour/s);
    assert.equal(forwarded.stream, true);
    assert.equal(forwarded.keep_alive, '30m');
    assert.equal(forwarded.options.num_predict, 220);
});
