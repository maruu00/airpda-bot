const { parse, extractEntities } = require('./parser');
const { exec } = require('./executor');

async function processNaturalOrder(text, context) {
  const parsed = parse(text);
  const entities = extractEntities(text, context.mentions);
  if (!parsed.intent) {
    return { ok:false, msg: `❓ No entendí. Prueba: \`!bot ayuda\` — Ej: \`!bot rellena comida\`, \`!bot dame rol @Rol\`, \`!bot silencia a @Usuario 10m\``, parsed, entities };
  }
  const result = await exec(parsed.intent, entities, { ...context, text, parsed });
  return { ok: true, msg: result, parsed, entities, intent: parsed.intent };
}

module.exports = { processNaturalOrder, parse, extractEntities };
