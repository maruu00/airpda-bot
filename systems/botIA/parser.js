const knowledge = require('./knowledge');
const fs = require('fs');
const path = require('path');

let brain = null;
try {
  brain = JSON.parse(fs.readFileSync(path.join(__dirname, 'brain.json'), 'utf8'));
} catch { brain = null; }

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s@<>#&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreIntent(text, intent) {
  const norm = normalize(text);
  const words = norm.split(' ');
  let score = 0;
  for (const kw of intent.keywords) {
    const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if (kw.includes('.*')) {
      const re = new RegExp(kw.replace(/\.\*/g, '.*'), 'i');
      if (re.test(norm)) score += 3;
    } else {
      if (norm.includes(kwNorm)) score += 2;
      if (words.includes(kwNorm)) score += 1;
      // coincidencia parcial
      for (const w of words) {
        if (w.length > 3 && kwNorm.includes(w) || w.includes(kwNorm)) score += 0.5;
      }
    }
  }
  return score;
}

function parse(text) {
  const norm = normalize(text);
  // Prioridades especiales — cura a todo el mundo debe ir primero
  if (/cura.*tod|san.*tod|revive.*tod|curar.*tod/.test(norm)) {
    const i = knowledge.find(k=>k.id==='curar_todos'); if(i) return { intent: 'curar_todos', confidence: 0.98, intentObj: i, bestScore: 10 };
  }
  if (/desilencia|desmutea|unmute|quita.*silencio/.test(norm)) {
    const i = knowledge.find(k=>k.id==='desilenciar'); return { intent: 'desilenciar', confidence: 0.95, intentObj: i, bestScore: 10 };
  }
  if (/quitar.*rol|remueve.*rol/.test(norm)) {
    const i = knowledge.find(k=>k.id==='quitar_rol'); return { intent: 'quitar_rol', confidence: 0.9, intentObj: i, bestScore: 8 };
  }
  if (/rellena.*comida|comida.*todos|hambre.*todos/.test(norm)) {
    const i = knowledge.find(k=>k.id==='rellenar_comida_todos'); return { intent: 'rellenar_comida_todos', confidence: 0.95, intentObj: i, bestScore: 9 };
  }

  let best = null;
  let bestScore = 0;
  let secondScore = 0;
  for (const intent of knowledge) {
    if (intent.id === 'generic') continue;
    const s = scoreIntent(text, intent);
    if (s > bestScore) { secondScore = bestScore; bestScore = s; best = intent; }
    else if (s > secondScore) secondScore = s;
  }
  if (!best || bestScore < 2) {
    // Fallback: intentar match por nombre de comando directo
    const maybeCmd = norm.split(' ').find(w => knowledge.some(k=>k.id.replace(/_/g,' ').includes(w)));
    if (maybeCmd) {
      const fallback = knowledge.find(k=>k.id.includes(maybeCmd.replace(/\s/g,'_')));
      if (fallback) return { intent: fallback.id, confidence: 0.4, intentObj: fallback, bestScore: 2 };
    }
    return { intent: null, confidence: 0, bestScore };
  }
  const confidence = Math.min(bestScore / 6, 1);
  // Si los dos mejores están muy cerca, baja confianza
  const finalConf = (bestScore - secondScore < 1) ? confidence * 0.7 : confidence;
  return { intent: best.id, confidence: finalConf, intentObj: best, bestScore };
}

function extractEntities(text, mentions) {
  const entities = {};
  const userIds = [...text.matchAll(/<@!?(\d+)>/g)].map(m=>m[1]);
  if (userIds.length) entities.userIds = userIds;
  else if (mentions?.users?.size) {
    // mentions es Collection de discord.js
    try { entities.userIds = [...mentions.users.keys ? mentions.users.keys() : []]; } catch { }
    if (!entities.userIds?.length && mentions.users.first) {
      const u = mentions.users.first(); if (u) entities.userIds=[u.id];
    }
  }
  const roleIds = [...text.matchAll(/<@&(\d+)>/g)].map(m=>m[1]);
  if (roleIds.length) entities.roleIds = roleIds;
  else if (mentions?.roles?.size) {
    try { entities.roleIds = [...mentions.roles.keys()]; } catch {}
    if (!entities.roleIds?.length && mentions.roles.first) {
      const r = mentions.roles.first(); if (r) entities.roleIds=[r.id];
    }
  }
  const nums = [...text.matchAll(/(\d+[.,]?\d*)/g)].map(m=> parseInt(m[1].replace(/[.,]/g,''),10)).filter(n=>!isNaN(n) && n>0 && n<100000000);
  if (nums.length) entities.cantidades = nums;
  const dur = text.match(/(\d+\s*(s|seg|min|m|h|hora|d|dia)s?)/i);
  if (dur) entities.duration = dur[0].replace(/\s+/g,'');
  entities.raw = text;
  return entities;
}

module.exports = { parse, extractEntities, normalize };
