const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const ServerStatus = require('../database/models/ServerStatus');

const STATUS_CHANNEL_ID = process.env.STATUS_CHANNEL_ID;
const STATUS_LOG_CHANNEL_ID = '1480878156213780591';
const STATUS_IMG_URL = 'https://www.airpda.xyz';
const TICKET_CHANNEL_MENTION = '<#1441818964505399307>';
const MAX_JUGADORES = 30;

const STAFF_IDS = ['1441818963133731016'];

function buildStatusEmbed(status, psnId = null) {
  const state = status.isOnline ? 'ONLINE' : 'OFFLINE';
  const emoji = status.isOnline ? '🟢' : '🔴';
  const color = status.isOnline ? config.colors.success : config.colors.danger;
  const psn = psnId || status.psnId || '---';

  const desc = [
    `**Server Status**`,
    `${emoji} **${state}**`,
    ``,
    `🌴 **ID PSN:**`,
    `\`${psn}\``,
    ``,
    `👥 **Jugadores**`,
    `\`${status.jugadores}/${status.maxJugadores || MAX_JUGADORES}\``,
    ``,
    `🚔 **LSPD:** \`${status.lspd}\``,
    `⭐ **LSCSD:** \`${status.lscsd}\``,
    `🔥 **LSCFD:** \`${status.lscfd}\``,
    `🧰 **Mecánicos:** \`${status.mecanicos}\``,
    `🛠️ **Staff IC:** \`${status.staffIc}\``,
  ];

  if (status.historial && status.historial.length > 0) {
    const last = status.historial[status.historial.length - 1];
    const fecha = last.fecha ? new Date(last.fecha).toLocaleString('es-ES') : '---';
    desc.push('');
    desc.push('📊 **HISTORIAL DE SESIONES**');
    desc.push(`📅 \`${fecha}\``);
    desc.push(`\`${last.jugadores || 0} jug · 🚔${last.lspd || 0} · ⭐${last.lscsd || 0} · 🔥${last.lscfd || 0} · 🧰${last.mecanicos || 0} · 🛠️${last.staffIc || 0}\``);
  }

  desc.push('');
  desc.push('📌 **¿NECESITAS AYUDA?**');
  desc.push(`📧 Soporte: ${TICKET_CHANNEL_MENTION}`);
  desc.push('');
  desc.push(status.isOnline ? '🚀 **¡ENTRA Y DISFRUTA AHORA!**' : '🔴 **SERVER CERRADO — Vuelve pronto.**');

  return new EmbedBuilder()
    .setColor(color)
    .setDescription(desc.join('\n'))
    .setImage(STATUS_IMG_URL + '/' + (status.isOnline ? 'status-on.png' : 'status-off.png'))
    .setFooter({ text: `AmericanRP • ${new Date().toLocaleString('es-ES')}` })
    .setTimestamp();
}

function buildPsnEmbed(status, psnId = null) {
  const psn = psnId || status.psnId || '---';
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setDescription(`# 🌴 **ID PSN:** ${psn}`)
    .setFooter({ text: 'AmericanRP · Roleplay' })
    .setTimestamp();
}

function buildActionButtons(status) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sv_mas:miembros').setLabel('+ Miembros').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('sv_menos:miembros').setLabel('- Miembros').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('sv_mas:lspd').setLabel('🚔 + LSPD').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sv_menos:lspd').setLabel('🚔 - LSPD').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sv_mas:lscsd').setLabel('⭐ + LSCSD').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sv_menos:lscsd').setLabel('⭐ - LSCSD').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sv_mas:lscfd').setLabel('🔥 + LSCFD').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sv_menos:lscfd').setLabel('🔥 - LSCFD').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sv_mas:mecanicos').setLabel('🧰 + Mecánicos').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sv_menos:mecanicos').setLabel('🧰 - Mecánicos').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sv_mas:staffic').setLabel('🛠️ + Staff IC').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sv_menos:staffic').setLabel('🛠️ - Staff IC').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sv_pico').setLabel('📊 Pico').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sv_cerrar').setLabel(status.isOnline ? '🔴 Cerrar Server' : '🟢 Abrir Server').setStyle(status.isOnline ? ButtonStyle.Danger : ButtonStyle.Success),
  );
  return [row1, row2, row3];
}

async function getOrCreateStatus() {
  let status = await ServerStatus.findOne({ key: 'current' });
  if (!status) {
    status = await ServerStatus.create({ key: 'current', maxJugadores: MAX_JUGADORES });
  }
  return status;
}

// Resolver el ID PSN: prioridad al guardado en ServerStatus (bot o web)
// y fallback al PSN del staff que abrió el server (User.psnId, editado desde la web)
async function getPsnId(status) {
  if (status.psnId) return status.psnId;
  try {
    const { User } = require('../database/models/PdaModels');
    if (status.iniciadorId) {
      const u = await User.findOne({ discordId: status.iniciadorId }).lean();
      if (u?.psnId) {
        status.psnId = u.psnId;
        await status.save().catch(() => {});
        return u.psnId;
      }
    }
  } catch {}
  return null;
}

async function notifyPsnChange(client, channelId, newPsn, oldPsn) {
  try {
    const channel = await client.channels.fetch(channelId);
    const sent = await channel.send({
      content: `@everyone 🎮 **Nueva ID de PSN:** \`${newPsn}\``,
    });
    setTimeout(() => {
      sent.delete().catch(() => {});
    }, 5000);
  } catch (e) {
    console.error('[Status] Error al notificar cambio de PSN:', e.message);
  }
}

async function updateStatusEmbed(status, client) {
  if (!status.channelId || !status.messageId) return;
  try {
    const psn = await getPsnId(status);
    const normalized = psn || '';
    const prevPublished = status.psnPublicado || '';
    const channel = await client.channels.fetch(status.channelId);
    const msg = await channel.messages.fetch(status.messageId);
    const embeds = [buildStatusEmbed(status, psn)];
    if (status.isOnline) embeds.push(buildPsnEmbed(status, psn));
    await msg.edit({ embeds });
    if (normalized && prevPublished !== '' && normalized !== prevPublished) {
      notifyPsnChange(client, status.channelId, normalized, prevPublished);
    }
    if (prevPublished !== normalized) {
      status.psnPublicado = normalized || null;
      await status.save().catch(() => {});
    }
  } catch (e) {
    console.error('[Status] Error al editar embed:', e.message);
  }
}

// ── Sync desde web ────────────────────────────────────────────────────────────
// La web y el bot comparten MongoDB. Este poller refresca el embed en Discord
// automáticamente cuando la web cambia el estado, jugadores o el ID PSN.
let statusLastSnapshot = null;

function statusSnapshot(status, psn) {
  return [status.isOnline, psn || '', status.jugadores || 0, status.maxJugadores || MAX_JUGADORES,
    status.lspd || 0, status.lscsd || 0, status.lscfd || 0, status.mecanicos || 0, status.staffIc || 0].join('|');
}

function startStatusSync(client, intervalMs = 15000) {
  statusLastSnapshot = null;
  setInterval(async () => {
    try {
      const status = await getOrCreateStatus();
      if (!status.channelId || !status.messageId) return;
      const psn = await getPsnId(status);
      const snap = statusSnapshot(status, psn);
      if (snap === statusLastSnapshot) return;
      statusLastSnapshot = snap;
      await updateStatusEmbed(status, client);
    } catch (e) {
      console.error('[Status Sync]', e.message);
    }
  }, intervalMs);
}

async function sendLogToChannel(client, log) {
  try {
    const channel = await client.channels.fetch(STATUS_LOG_CHANNEL_ID);
    const hora = log.fecha ? new Date(log.fecha).toLocaleString('es-ES') : '---';
    const campo = { jugadores: '👥 Jugadores', lspd: '🚔 LSPD', lscsd: '⭐ LSCSD', lscfd: '🔥 LSCFD', mecanicos: '🧰 Mecánicos', staffIc: '🛠️ Staff IC', isOnline: '🔌 Estado' }[log.field] || log.field;
    const accion = log.field === 'isOnline'
      ? (log.newValue === 1 ? '🟢 Server abierto' : '🔴 Server cerrado')
      : `${campo}: \`${log.oldValue}\` → \`${log.newValue}\``;
    await channel.send({ content: `📋 **${hora}** — ${accion} — *${log.changedBy || '??'}*${log.origen === 'web' ? ' 🌐' : ''}` });
  } catch (e) {
    console.error('[Status] Error al enviar log:', e.message);
  }
}

let statusLock = Promise.resolve();

async function handleStatusCore(interaction, client) {
  const [action, target] = interaction.customId.split(':');
  if (action !== 'sv_mas' && action !== 'sv_menos' && action !== 'sv_cerrar' && action !== 'sv_pico') return;

  const member = interaction.member;
  const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(STAFF_IDS[0]);
  if (!isStaff) {
    try { return await interaction.reply({ content: '❌ No tienes permisos para usar estos controles.', flags: 64 }); } catch { return; }
  }

  // Deferir inmediatamente para evitar Unknown interaction (3s)
  try { await interaction.deferReply({ flags: 64 }); } catch {}

  statusLock = statusLock.then(async () => {
    let status = await getOrCreateStatus();
    if (!status.isOnline && action !== 'sv_cerrar') {
      try { return await interaction.editReply({ content: '❌ El servidor está cerrado. Usa "Abrir Server" para activarlo.' }); } catch { return; }
    }

    const field = target === 'miembros' ? 'jugadores'
      : target === 'staffic' ? 'staffIc'
      : target;

    const oldValue = status[field] || 0;

    if (action === 'sv_mas' && target !== 'cerrar') {
      if (field === 'jugadores') {
        status.jugadores = Math.min((status.jugadores || 0) + 1, status.maxJugadores || MAX_JUGADORES);
        if (status.jugadores > (status.picoMaximo || 0)) {
          status.picoMaximo = status.jugadores;
          status.picoFecha = new Date();
        }
      } else {
        status[field] = Math.min((status[field] || 0) + 1, 99);
      }
    } else if (action === 'sv_menos' && target !== 'cerrar') {
      status[field] = Math.max((status[field] || 0) - 1, 0);
    }

    if (status[field] !== oldValue) {
      status.logs.push({
        field: field === 'jugadores' ? 'jugadores' : field,
        oldValue,
        newValue: status[field],
        changedBy: interaction.user.username,
        origen: 'discord',
      });
      if (status.logs.length > 100) status.logs = status.logs.slice(-100);
    }

    status.markModified('jugadores');
    status.markModified('lspd');
    status.markModified('lscsd');
    status.markModified('lscfd');
    status.markModified('mecanicos');
    status.markModified('staffIc');
    status.markModified('logs');
    await status.save();
    await updateStatusEmbed(status, client);
    if (status.logs.length > 0) sendLogToChannel(client, status.logs[status.logs.length - 1]);
    try { await interaction.editReply({ content: `✅ **${target.toUpperCase()}** actualizado: \`${status[field]}\`` }); } catch {}
  });
  return statusLock;
}

async function handleCerrar(interaction, client) {
  try { await interaction.deferReply({ flags: 64 }); } catch {}
  const member = interaction.member;
  const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(STAFF_IDS[0]);
  if (!isStaff) { try { return await interaction.editReply({ content: '❌ Sin permisos.' }); } catch { return; } }

  let status = await getOrCreateStatus();
  status.isOnline = !status.isOnline;
  status.logs.push({
    field: 'isOnline',
    oldValue: status.isOnline ? 0 : 1,
    newValue: status.isOnline ? 1 : 0,
    changedBy: interaction.user.username,
    origen: 'discord',
  });
  if (!status.isOnline) {
    status.historial.push({
      fecha: new Date(),
      jugadores: status.jugadores,
      lspd: status.lspd, lscsd: status.lscsd, lscfd: status.lscfd,
      mecanicos: status.mecanicos, staffIc: status.staffIc,
    });
    status.jugadores = 0;
    status.lspd = 0; status.lscsd = 0; status.lscfd = 0;
    status.mecanicos = 0; status.staffIc = 0;
    status.cerradoEn = new Date();
  } else {
    status.abiertoEn = new Date();
  }
  if (status.logs.length > 100) status.logs = status.logs.slice(-100);
  status.markModified('logs');
  await status.save();
  await updateStatusEmbed(status, client);
  sendLogToChannel(client, status.logs[status.logs.length - 1]);
  try { await interaction.editReply({ content: `✅ Server ${status.isOnline ? 'abierto' : 'cerrado'}` }); } catch {}
}

async function handlePico(interaction) {
  try { await interaction.deferReply({ flags: 64 }); } catch {}
  const status = await getOrCreateStatus();
  try {
    return await interaction.editReply({
      content: `📊 **Pico máximo:** ${status.picoMaximo || 0} jugadores${status.picoFecha ? ` (${status.picoFecha.toLocaleDateString('es-ES')})` : ''}`,
    });
  } catch {
    try { return await interaction.reply({ content: `📊 **Pico máximo:** ${status.picoMaximo || 0} jugadores`, flags: 64 }); } catch { return; }
  }
}

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName('status-on')
      .setDescription('Activar / actualizar estado del servidor')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption(o => o.setName('canal').setDescription('Canal donde publicar el embed (opcional, default: STATUS_CHANNEL_ID)').setRequired(false))
      .addIntegerOption(o => o.setName('jugadores').setDescription('Jugadores actuales').setRequired(false))
      .addIntegerOption(o => o.setName('lspd').setDescription('Policías LSPD').setRequired(false))
      .addIntegerOption(o => o.setName('lscsd').setDescription('Sheriffs LSCSD').setRequired(false))
      .addIntegerOption(o => o.setName('lscfd').setDescription('Bomberos LSCFD').setRequired(false))
      .addIntegerOption(o => o.setName('mecanicos').setDescription('Mecánicos').setRequired(false))
      .addIntegerOption(o => o.setName('staffic').setDescription('Staff IC').setRequired(false))
      .addStringOption(o => o.setName('psnid').setDescription('ID de PSN del staff').setRequired(false).setMaxLength(30)),
    new SlashCommandBuilder()
      .setName('status-off')
      .setDescription('Cerrar estado del servidor (todo a 0)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName('status-panel')
      .setDescription('Abrir panel de control del status (solo staff)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  ],

  async execute(interaction, client) {
    const member = interaction.member;
    const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(STAFF_IDS[0]);
    if (!isStaff) {
      return interaction.reply({ content: '❌ No tienes permisos.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    if (interaction.commandName === 'status-off') {
      let status = await getOrCreateStatus();
      status.isOnline = false;
      status.logs.push({ field: 'isOnline', oldValue: 1, newValue: 0, changedBy: interaction.user.username, origen: 'discord' });
      status.historial.push({
        fecha: new Date(),
        jugadores: status.jugadores,
        lspd: status.lspd, lscsd: status.lscsd, lscfd: status.lscfd,
        mecanicos: status.mecanicos, staffIc: status.staffIc,
      });
      status.jugadores = 0;
      status.lspd = 0; status.lscsd = 0; status.lscfd = 0;
      status.mecanicos = 0; status.staffIc = 0;
      status.cerradoEn = new Date();
      if (status.logs.length > 100) status.logs = status.logs.slice(-100);
      status.markModified('logs');
      await status.save();
      await updateStatusEmbed(status, client);
      sendLogToChannel(client, status.logs[status.logs.length - 1]);
      return interaction.editReply({ content: '✅ Server cerrado.' });
    }

    if (interaction.commandName === 'status-on') {
      let status = await getOrCreateStatus();
      status.isOnline = true;
      status.iniciadorId = interaction.user.id;
      status.iniciadorNombre = interaction.user.username;
      status.maxJugadores = MAX_JUGADORES;

      if (!status.abiertoEn) status.abiertoEn = new Date();

      const opts = {
        jugadores: interaction.options.getInteger('jugadores'),
        lspd: interaction.options.getInteger('lspd'),
        lscsd: interaction.options.getInteger('lscsd'),
        lscfd: interaction.options.getInteger('lscfd'),
        mecanicos: interaction.options.getInteger('mecanicos'),
        staffic: interaction.options.getInteger('staffic'),
      };
      const psnOpt = interaction.options.getString('psnid');
      if (psnOpt !== null) status.psnId = psnOpt;
      for (const [k, v] of Object.entries(opts)) {
        if (v !== null) status[k] = Math.max(0, v);
      }

      const channelOpt = interaction.options.getChannel('canal');
      const channelId = channelOpt?.id || STATUS_CHANNEL_ID;
      if (!channelId) {
        return interaction.editReply({ content: '❌ No hay canal configurado. Usa la opción `canal` o añade `STATUS_CHANNEL_ID` en el .env del bot.' });
      }
      let channel;
      try {
        channel = await client.channels.fetch(channelId);
      } catch {
        return interaction.editReply({ content: `❌ Canal <#${channelId}> no encontrado. Verifica que el ID sea correcto y que el bot tenga acceso.` });
      }

      const psn = await getPsnId(status);
      const embeds = [buildStatusEmbed(status, psn), buildPsnEmbed(status, psn)];

      if (status.channelId && status.messageId) {
        try {
          const oldChannel = await client.channels.fetch(status.channelId);
          const oldMsg = await oldChannel.messages.fetch(status.messageId);
          await oldMsg.edit({ embeds });
        } catch {
          const msg = await channel.send({ embeds });
          status.channelId = channel.id;
          status.messageId = msg.id;
        }
      } else {
        const msg = await channel.send({ embeds });
        status.channelId = channel.id;
        status.messageId = msg.id;
      }

      if (status.jugadores > (status.picoMaximo || 0)) {
        status.picoMaximo = status.jugadores;
        status.picoFecha = new Date();
      }

      status.logs.push({ field: 'isOnline', oldValue: 0, newValue: 1, changedBy: interaction.user.username, origen: 'discord' });
      if (status.logs.length > 100) status.logs = status.logs.slice(-100);
      status.markModified('logs');
      await status.save();
      sendLogToChannel(client, status.logs[status.logs.length - 1]);
      return interaction.editReply({ content: `✅ Status online publicado en ${channel}.` });
    }

    if (interaction.commandName === 'status-panel') {
      const status = await getOrCreateStatus();
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('🎮 Panel de Control — Status')
        .setDescription('Usá los botones para ajustar el estado del servidor.')
        .setFooter({ text: `Solo visible para vos` })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed], components: buildActionButtons(status) });
    }
  },

  async handleStatusButton(interaction, client) {
    const [action, target] = interaction.customId.split(':');
    if (target === 'cerrar' || action === 'sv_cerrar') return handleCerrar(interaction, client);
    if (action === 'sv_pico' || target === 'pico') return handlePico(interaction);
    return handleStatusCore(interaction, client);
  },

  startStatusSync,
};
