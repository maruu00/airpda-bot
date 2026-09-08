/**
 * Trainer — entrena la IA propia localmente
 * Construye índice, calcula pesos y guarda en brain.json
 * Gratis, sin API, se ejecuta al iniciar o con !bot entrenar
 */
const fs = require('fs');
const path = require('path');
const knowledge = require('./knowledge');

function train() {
  const start = Date.now();
  // Construir índice invertido: keyword -> intents
  const index = {};
  let totalKeywords = 0;
  for (const intent of knowledge) {
    for (const kw of intent.keywords) {
      const norm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (!index[norm]) index[norm] = [];
      index[norm].push(intent.id);
      totalKeywords++;
    }
  }
  const stats = {
    intents: knowledge.length,
    keywords: totalKeywords,
    indexed: Object.keys(index).length,
    trainedAt: new Date().toISOString(),
    version: '2.0-infinita',
  };
  const brain = { index, stats, knowledge: knowledge.map(k=>({id:k.id, ejemplo:k.ejemplo})) };
  const outPath = path.join(__dirname, 'brain.json');
  fs.writeFileSync(outPath, JSON.stringify(brain, null, 2), 'utf8');
  console.log(`[IA Trainer] Entrenada: ${stats.intents} intents, ${stats.keywords} keywords, ${stats.indexed} únicos en ${Date.now()-start}ms`);
  console.log(`[IA Trainer] Guardado en ${outPath}`);
  return brain;
}

if (require.main === module) train();

module.exports = { train };
