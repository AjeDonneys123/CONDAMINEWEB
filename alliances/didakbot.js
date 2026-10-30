const ENDPOINT = 'https://novapeda.eu/didakbot3.php';
const fs = require('fs');
const path = require('path');

function configurations() {
  try {
    const localFile = path.join(__dirname, 'didakbot-sessions.json');
    const source = process.env.ALLIANCES_DIDAKBOT_BOTS || (fs.existsSync(localFile) ? fs.readFileSync(localFile, 'utf8') : '[]');
    const value = JSON.parse(source);
    return Array.isArray(value) ? value : Array.isArray(value?.sessions) ? value.sessions : [];
  } catch (_) { return []; }
}

function extractJson(text) {
  const raw = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch (_) { return null; }
}

async function post(bot, fields) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('session', bot.sessionCode);
  url.searchParams.set('pseudo', bot.pseudo);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams(Object.entries(fields).map(([key, value]) => [key, String(value ?? '')])),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) throw new Error(String(data?.error || `Didakbot HTTP ${response.status}`));
    return data;
  } finally { clearTimeout(timeout); }
}

async function ensureSession(bot) {
  if (bot.sessionId && bot.participantId) return;
  const joined = await post(bot, { action: 'join_session', session_code: bot.sessionCode, pseudo: bot.pseudo });
  bot.sessionId = String(joined?.session?.session_id || joined?.session?.id || '');
  bot.participantId = String(joined?.participant_id || joined?.participant?.id || '');
  bot.chatbotId = String(bot.chatbotId || joined?.session?.chatbot_id || '');
  if (!bot.sessionId || !bot.participantId || !bot.chatbotId) throw new Error('Session Didakbot incomplète.');
}

async function decide(bot, context) {
  if (!bot?.sessionCode) return null;
  await ensureSession(bot);
  const prompt = `Tu incarnes ${bot.pseudo}, joueur autonome du jeu ALLIANCES. Décide uniquement avec les données ci-dessous. Tu ne connais aucune donnée privée adverse.\n
Réponds avec un unique objet JSON sans commentaire :
{"ally":"nom ou null","like":"nom ou null","statement":"180 caractères max","action":"attack|transfer|pass","target":"nom ou null","target2":null,"amount":nombre}
À chaque tour, choisis ton allié secret, un like éventuel, un communiqué public et une seule action : attaquer, transférer des soldats, ou ne rien faire. Le nombre amount ne peut jamais dépasser totalSoldiers. Tous les soldats non utilisés se cumulent automatiquement en défense générale. Respecte les ressources disponibles et ta personnalité. Une petite attaque peut être un signal diplomatique.\n
CONTEXTE AUTORISÉ : ${JSON.stringify(context)}`;
  const sent = await post(bot, {
    action: 'send_message', session_id: bot.sessionId, participant_id: bot.participantId,
    chatbot_id: bot.chatbotId, content: prompt, pseudo: bot.pseudo, is_mention: 'true'
  });
  return extractJson(sent?.bot_response);
}

async function observe(bot, update) {
  if (!bot?.sessionCode) return;
  await ensureSession(bot);
  await post(bot, {
    action: 'send_message', session_id: bot.sessionId, participant_id: bot.participantId,
    chatbot_id: bot.chatbotId,
    content: `MISE À JOUR DU JEU. Mémorise-la sans prendre de décision maintenant. Réponds seulement MÉMORISÉ.\n${JSON.stringify(update)}`,
    pseudo: bot.pseudo, is_mention: 'true'
  });
}

function attach(persona, index) {
  const config = configurations()[index];
  if (!config?.sessionCode) return null;
  return { sessionCode:String(config.sessionCode), chatbotId:String(config.chatbotId || ''), pseudo:persona.name, sessionId:'', participantId:'' };
}

module.exports = { attach, decide, observe };
