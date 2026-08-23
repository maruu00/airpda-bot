'use strict';

const { PermissionFlagsBits, EmbedBuilder, ApplicationIntegrationType } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const { captureEvidence } = require('../../utils/evidenceCapture');
const { checkBlacklist } = require('../../utils/blacklist');

const EXTERNAL_APP_WHITELIST = [];

const SECURITY_BUILD = 'security-v3-2026-07-16'; // <-- busca esta línea en tus logs al arrancar
console.log(`[Security] Módulo cargado: ${SECURITY_BUILD}`);

const CFG = {
  SPAM_MSG_LIMIT:    8,          // mensajes...
  SPAM_INTERVAL_MS:  10000,      // ...en esta ventana (10s) para contar como spam
  RAID_JOIN_LIMIT:          10,
  RAID_JOIN_LIMIT_SUSPICIOUS: 5,
  RAID_JOIN_WINDOW:        10000,
  NEW_ACCOUNT_RATIO_TRIGGER: 0.6,
  TIMEOUT_SPAM:      5 * 60_000,
  TIMEOUT_LINK:      5 * 60_000,
  TIMEOUT_MENTION:   5 * 60_000,
  BAD_WORDS: ['pornografi', 'pornograph', 'onlyfans', 'hijo de puta', 'hijoputa', 'subnormal', 'mongolo', 'retrasado'],
  LOG_CHANNEL_ID: '1528125569643057244',
};

// key -> { count: number, firstTs: number }
const spamTracker = new Map();
const raidJoinMap = new Map();
const imageTracker = new Map();

function isStaff(member, config) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  const wlRoles = config?.security?.whitelistRoles ?? [];
  return wlRoles.some(id => member.roles.cache.has(id));
}

async function secLog(guild, embed, evidenceFile = null) {
  try {
    const config = await GuildConfig.findOne({ guildId: guild.id }).lean();
    const sec = config?.security || {};
    const chId = sec.logChannelId || CFG.LOG_CHANNEL_ID;
    if (!chId) return;
    const ch = await guild.channels.fetch(chId).catch(() => null);
    if (!ch) return;
    const files = evidenceFile ? [evidenceFile] : [];
    const embeds = [embed];
    if (evidenceFile) {
      embeds.push(new EmbedBuilder().setColor(0xef4444).setTitle('📸 Evidencia').setImage('attachment://evidencia.png').setFooter({ text: 'Generado automáticamente' }));
    }
    await ch.send({ embeds, files }).catch(err => console.error('[Security] Error enviando log:', err.message));
  } catch (err) {
    console.error('[Security] Error en secLog:', err.message);
  }
}

function makeEmbed(title, desc, color = 0xef4444) {
  return new EmbedBuilder().setColor(color).setTitle(`🛡️ ${title}`).setDescription(desc).setTimestamp();
}

async function deleteUserMessages(channel, userId) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const toDelete = messages.filter(m => m.author.id === userId && (Date.now() - m.createdTimestamp) < 1209600000);
    if (toDelete.size > 1) {
      await channel.bulkDelete(toDelete, true).catch(() => toDelete.forEach(m => m.delete().catch(() => {})));
    } else if (toDelete.size === 1) {
      await toDelete.first().delete().catch(() => {});
    }
  } catch {}
}

/**
 * Intenta silenciar a un miembro. Devuelve { ok, reason } — nunca miente.
 */
async function muteUser(member, durationMs, reason) {
  if (!member) return { ok: false, reason: 'Miembro no encontrado (¿salió del servidor?)' };
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return { ok: false, reason: 'Es administrador, exento de sanciones automáticas.' };
  }
  if (!member.moderatable) {
    return { ok: false, reason: 'El bot no puede moderar a este usuario (rol del bot igual o por debajo del suyo, o le falta el permiso "Moderar miembros"). Sube el rol del bot por encima del rol de este usuario.' };
  }
  try {
    await member.timeout(durationMs, reason);
    return { ok: true, reason: null };
  } catch (err) {
    console.error('[Security] Fallo al aplicar timeout:', err.message);
    return { ok: false, reason: `Error de Discord: ${err.message}` };
  }
}

function isChannelExento(message, sec) {
  const exentos = sec?.canalesExentos ?? [];
  return exentos.includes(message.channel.id);
}

/** Envía el embed de sanción, avisando claramente si el mute falló de verdad */
async function announceSanction(message, title, muteResult, extraDesc = '') {
  let desc;
  if (muteResult.ok) {
    desc = `<@${message.author.id}> silenciado. ${extraDesc}`;
  } else {
    desc = `⚠️ <@${message.author.id}> **debería** haber sido silenciado pero falló: ${muteResult.reason}\n${extraDesc}`;
  }
  const embed = makeEmbed(title, desc, muteResult.ok ? 0xef4444 : 0xf59e0b);
  await message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
  return embed;
}

// ─── Anti-External Apps (User-Install Raid) ──────────────────────────────
async function handleExternalAppRaid(message, sec) {
  if (sec.antiExternalApps === false) return false;
  const meta = message.interactionMetadata ?? message.interaction ?? null;
  if (!meta) return false;
  const appId = message.applicationId;
  if (appId && EXTERNAL_APP_WHITELIST.includes(appId)) return false;
  const owners = meta.authorizingIntegrationOwners;
  const isGuildInstalled = owners && (
    owners.has?.(ApplicationIntegrationType.GuildInstall) ||
    owners[ApplicationIntegrationType.GuildInstall] !== undefined
  );
  if (isGuildInstalled) return false;
  const invoker = meta.user ?? null;
  if (!invoker) return false;
  const evidence = await captureEvidence(message, 'Uso de app externa no autorizada (raid)').catch(() => null);
  await message.delete().catch(() => {});
  await deleteUserMessages(message.channel, message.author.id).catch(() => {});
  const action = sec.externalAppAction ?? 'ban';
  let actionResult = { ok: false, reason: 'Sin acción configurada' };
  try {
    if (action === 'ban') {
      await message.guild.members.ban(invoker.id, { reason: `Anti-raid: uso de app externa (${appId ?? 'desconocida'})`, deleteMessageSeconds: 3600 });
      actionResult = { ok: true, reason: null };
    } else if (action === 'kick') {
      const member = await message.guild.members.fetch(invoker.id).catch(() => null);
      if (member) { await member.kick('Anti-raid: uso de app externa'); actionResult = { ok: true, reason: null }; }
      else actionResult = { ok: false, reason: 'Miembro no encontrado' };
    } else if (action === 'timeout') {
      const member = await message.guild.members.fetch(invoker.id).catch(() => null);
      if (member) { await member.timeout(60 * 60_000, 'Anti-raid: uso de app externa'); actionResult = { ok: true, reason: null }; }
      else actionResult = { ok: false, reason: 'Miembro no encontrado' };
    }
  } catch (err) {
    actionResult = { ok: false, reason: err.message };
  }
  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle('🚨 App externa de raid detectada y bloqueada')
    .setDescription(
      `**Usuario:** <@${invoker.id}> (\`${invoker.id}\`)\n` +
      `**App usada:** \`${appId ?? 'desconocida'}\`\n` +
      `**Acción:** ${actionResult.ok ? `✅ ${action.toUpperCase()} aplicado` : `⚠️ Falló (${actionResult.reason})`}\n` +
      `Mensaje eliminado. Revisa \`Server Settings → Roles → Apps Permissions → Use External Apps\` si esto se repite.`
    )
    .setTimestamp();
  await secLog(message.guild, embed, evidence);
  return true;
}

// ─── Anti-Spam (contador simple, sin arrays raros) ────────────────────────
async function handleAntiSpam(message, sec) {
  if (sec.antiSpam === false) return false;
  const key = `${message.author.id}_${message.guild.id}`;
  const now = Date.now();
  const tracked = spamTracker.get(key);

  let entry;
  if (!tracked || (now - tracked.firstTs) > CFG.SPAM_INTERVAL_MS) {
    // Nueva ventana
    entry = { count: 1, firstTs: now };
  } else {
    entry = { count: tracked.count + 1, firstTs: tracked.firstTs };
  }
  spamTracker.set(key, entry);

  if (entry.count < CFG.SPAM_MSG_LIMIT) return false;

  spamTracker.delete(key);
  const evidence = await captureEvidence(message, 'Spam masivo').catch(() => null);
  await deleteUserMessages(message.channel, message.author.id);
  const muteResult = await muteUser(message.member, CFG.TIMEOUT_SPAM, 'Anti-Spam');
  const embed = await announceSanction(message, 'Spam detectado', muteResult, `(${entry.count} mensajes en ${(CFG.SPAM_INTERVAL_MS/1000)}s)`);
  await secLog(message.guild, embed, evidence);
  return true;
}

// ─── Anti-Links ───────────────────────────────────────────────────────────
async function handleAntiLinks(message, sec) {
  if (sec.antiLinks === false) return false;
  const content = message.content || '';
  const urlRegex = /(?:https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)\S+/gi;
  if (!urlRegex.test(content)) return false;
  const wl = [...(sec.linkWhitelist ?? [])];
  const links = content.match(urlRegex) ?? [];
  const hasBlocked = links.some(l => !wl.some(w => l.toLowerCase().includes(w)));
  if (!hasBlocked) return false;
  const evidence = await captureEvidence(message, 'Enlace no permitido').catch(() => null);
  await deleteUserMessages(message.channel, message.author.id);
  const muteResult = await muteUser(message.member, CFG.TIMEOUT_LINK, 'Anti-Links');
  const embed = await announceSanction(message, 'Enlace bloqueado', muteResult);
  await secLog(message.guild, embed, evidence);
  return true;
}

async function handleAntiMentions(message, sec) {
  if (sec.antiMentions === false) return false;
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  if (mentions < 5) return false;
  const evidence = await captureEvidence(message, 'Menciones masivas').catch(() => null);
  await deleteUserMessages(message.channel, message.author.id);
  const muteResult = await muteUser(message.member, CFG.TIMEOUT_MENTION, 'Anti-Menciones');
  const embed = await announceSanction(message, 'Menciones masivas', muteResult, `(${mentions} menciones)`);
  await secLog(message.guild, embed, evidence);
  return true;
}

// ─── Anti-Insultos ─────────────────────────────────────────────────────────
async function announceSanction(message, title, muted, reason) {
  const embed = makeEmbed(title, `<@${message.author.id}> ${reason}${muted ? '' : ' (no se pudo aplicar timeout)'}.`, muted ? 0xef4444 : 0xf59e0b);
  await message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
  return embed;
}

async function handleAntiInsult(message, sec) {
  if (sec.antiInsultos === false) return false;
  console.log(`[Security] handleAntiInsult check: content="${(message.content||'').slice(0,60)}" found=${checkBlacklist(message.content||'').found}`);
  const result = checkBlacklist(message.content || '');
  if (!result.found) return false;
  console.log(`[Security] Blacklist hit: category=${result.category} word=${result.word}`);

  const evidence = await captureEvidence(message, `Lenguaje inapropiado (${result.category})`).catch((e) => { console.error('[Security] captureEvidence error:', e.message); return null; });
  await message.delete().catch(() => {});

  if (result.category === 'slur') {
    const muted = await muteUser(message.member, 30 * 60_000, `Blacklist: slur (${result.category})`);
    const embed = await announceSanction(message, '🚫 Lenguaje discriminatorio', muted, '30 min por lenguaje gravemente ofensivo.');
    await secLog(message.guild, embed, evidence);
  } else if (result.category === 'sexual') {
    const muted = await muteUser(message.member, 60_000, 'Blacklist: contenido +18');
    const embed = await announceSanction(message, '🔞 Contenido +18 bloqueado', muted, '1 min por contenido sexual/inapropiado.');
    await secLog(message.guild, embed, evidence);
  } else {
    const embed = makeEmbed('🤬 Lenguaje inapropiado', `<@${message.author.id}> evita ese lenguaje.`, 0xf59e0b);
    await message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
    await secLog(message.guild, embed, evidence);
  }
  return true;
}

// ─── Anti-Raid de joins ────────────────────────────────────────────────────
async function checkRaid(member) {
  if (!member || !member.guild) return false;
  const guild = member.guild;
  const config = await GuildConfig.findOne({ guildId: guild.id });
  if (!config) return false;
  const sec = config.security || {};
  if (sec.antiRaid === false) return false;

  if (sec.raidMode) {
    const cooldownMs = (sec.raidCooldownMinutes ?? 15) * 60_000;
    const since = sec.raidModeSince ? sec.raidModeSince.getTime() : 0;
    if (since && (Date.now() - since) > cooldownMs) {
      sec.raidMode = false;
      sec.raidModeSince = null;
      config.security = sec;
      config.markModified('security');
      await config.save();
      const ch = await guild.channels.fetch(sec.logChannelId || CFG.LOG_CHANNEL_ID).catch(() => null);
      if (ch) await ch.send({ embeds: [makeEmbed('✅ Raid mode desactivado', 'El modo raid expiró automáticamente.', 0x22c55e)] }).catch(() => {});
    } else {
      await handleMemberDuringRaid(member, sec);
      return true;
    }
  }

  const key = guild.id;
  const now = Date.now();
  const accountAgeDays = (now - member.user.createdTimestamp) / 86_400_000;
  const joins = (raidJoinMap.get(key) ?? []).filter(j => now - j.ts < CFG.RAID_JOIN_WINDOW);
  joins.push({ ts: now, accountAgeDays });
  raidJoinMap.set(key, joins);

  const newAccountThresholdDays = sec.minAccountAgeDays ?? 3;
  const newAccounts = joins.filter(j => j.accountAgeDays < newAccountThresholdDays).length;
  const newAccountRatio = joins.length ? newAccounts / joins.length : 0;

  const hardTrigger = joins.length >= CFG.RAID_JOIN_LIMIT;
  const suspiciousTrigger = joins.length >= CFG.RAID_JOIN_LIMIT_SUSPICIOUS && newAccountRatio >= CFG.NEW_ACCOUNT_RATIO_TRIGGER;

  if (hardTrigger || suspiciousTrigger) {
    raidJoinMap.delete(key);
    sec.raidMode = true;
    sec.raidModeSince = new Date();
    config.security = sec;
    config.markModified('security');
    await config.save();

    if (sec.verificationLockdown !== false) {
      try { await guild.setVerificationLevel(3, 'Anti-raid: modo raid activado'); } catch (err) { console.error('[Security] No se pudo subir verificationLevel:', err.message); }
    }

    const embed = makeEmbed(
      '🚨 RAID DETECTADO',
      `**${joins.length} uniones** en <10s (${newAccounts} cuentas nuevas, ratio ${(newAccountRatio * 100).toFixed(0)}%).\n` +
      `Servidor en **modo raid** ${sec.raidCooldownMinutes ?? 15} min (se desactiva solo).\n` +
      `Verificación subida temporalmente.`,
      0xef4444
    );
    const ch = await guild.channels.fetch(sec.logChannelId || CFG.LOG_CHANNEL_ID).catch(() => null);
    if (ch) await ch.send({ content: '@here', embeds: [embed] }).catch(() => {});

    await handleMemberDuringRaid(member, sec);
    return true;
  }

  return false;
}

async function handleMemberDuringRaid(member, sec) {
  const action = sec.autoActionNewAccounts ?? 'none';
  if (action === 'none') return;
  const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
  const minAge = sec.minAccountAgeDays ?? 3;
  if (ageDays >= minAge) return;
  try {
    if (action === 'kick') await member.kick('Anti-raid: cuenta nueva durante raid activo');
    else if (action === 'timeout') await member.timeout(60 * 60_000, 'Anti-raid: cuenta nueva durante raid activo');
  } catch (err) {
    console.error('[Security] Error en handleMemberDuringRaid:', err.message);
  }
}

// ─── Anti-Imagen Spam ────────────────────────────────────────────────────
async function handleAntiImageSpam(message, sec) {
  if (sec.antiSpam === false) return false;
  console.log(`[Security] handleAntiImageSpam: atts=${message.attachments?.size || 0} embeds=${message.embeds?.length || 0} contentLen=${(message.content||'').length}`);
  if (!message.attachments.size && !message.embeds.some(e => e.image || e.thumbnail)) return false;

  const userId = message.author.id;
  const today = new Date().toDateString();
  let entry = imageTracker.get(userId) || { date: today, count: 0 };
  if (entry.date !== today) entry = { date: today, count: 0 };

  const totalImages = message.attachments.size + message.embeds.filter(e => e.image || e.thumbnail).length;
  if (totalImages < 2) {
    imageTracker.set(userId, entry);
    return false;
  }

  entry.count += 1;
  imageTracker.set(userId, entry);

  if (entry.count === 1) {
    const ev = await captureEvidence(message, 'Múltiples imágenes (1er aviso)').catch(() => null);
    await deleteUserMessages(message.channel, userId);
    const warnEmbed = makeEmbed('📸 Imágenes múltiples', `<@${userId}> no envíes **más de 1 imagen** seguida. Próxima vez serás silenciado 5 min.`, 0xf59e0b);
    await message.channel.send({ embeds: [warnEmbed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    await secLog(message.guild, warnEmbed, ev);
    return true;
  }

  imageTracker.delete(userId);
  const evidence = await captureEvidence(message, 'Múltiples imágenes (2º aviso)').catch(() => null);
  await deleteUserMessages(message.channel, userId);
  const muteResult = await muteUser(message.member, 5 * 60_000, 'Anti-Imagen: múltiples imágenes (2º aviso)');
  const embed = await announceSanction(message, '🔇 Silenciado por imágenes', muteResult);
  await secLog(message.guild, embed, evidence);
  return true;
}

// ─── Anti-Repetición / Flood ───────────────────────────────────────────────
async function handleAntiRepeat(message, sec) {
  if (sec.antiSpam === false) return false;
  const content = message.content || '';
  if (content.length < 50) return false;

  const everyoneCount = (content.match(/@everyone|@here/gi) || []).length;
  if (everyoneCount >= 5) {
    const ev = await captureEvidence(message, '@everyone repetido').catch(() => null);
    await deleteUserMessages(message.channel, message.author.id);
    const muteResult = await muteUser(message.member, 60 * 60_000, 'Anti-@everyone: spam de menciones');
    const embed = await announceSanction(message, '🔇 @everyone masivo', muteResult, `(${everyoneCount}x)`);
    await secLog(message.guild, embed, ev);
    return true;
  }

  const letters = content.replace(/[\s\n\r]/g, '');
  if (letters.length < 100) return false; // antes 30, subido para evitar falsos positivos con mensajes cortos
  const uniqueChars = new Set(letters).size;
  const ratio = uniqueChars / letters.length;

  if (ratio < 0.05) {
    const ev = await captureEvidence(message, 'Flood de caracteres').catch(() => null);
    await deleteUserMessages(message.channel, message.author.id);
    const muteResult = await muteUser(message.member, CFG.TIMEOUT_SPAM, 'Anti-Flood: caracteres repetidos');
    const embed = await announceSanction(message, '🚫 Flood detectado', muteResult, `(${letters.length} chars, ${uniqueChars} únicos)`);
    await secLog(message.guild, embed, ev);
    return true;
  }
  return false;
}

// ─── Entrada principal ────────────────────────────────────────────────────
async function handleSecurity(message) {
  if (!message.guild) return;

  const config = await GuildConfig.findOne({ guildId: message.guild.id }).lean();
  if (!config) return;
  const sec = config.security || {};
  if (sec.activo === false) return;

  // La comprobación de app externa debe correr aunque author.bot sea true
  if (await handleExternalAppRaid(message, sec)) return;

  if (message.author.bot) return;
  if (isStaff(message.member, config)) return;
  if (isChannelExento(message, sec)) return;

  if (await handleAntiInsult(message, sec)) return;
  if (await handleAntiRepeat(message, sec)) return;
  if (await handleAntiLinks(message, sec)) return;
  if (await handleAntiMentions(message, sec)) return;
  if (await handleAntiImageSpam(message, sec)) return;
  if (await handleAntiSpam(message, sec)) return;
}

module.exports = { handleSecurity, checkRaid, isStaff };