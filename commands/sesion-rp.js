/**
 * SESIÓN RP — Gestión de sesiones, votaciones y estado admin
 * Slash: /abrir-sesion /cerrar-sesion /abrir-votacion /admin-on /admin-off /anuncio /aviso /warn /ban
 * Prefix: !abrir-sesion !cerrar-sesion !abrir-votacion !admin-on !admin-off !anuncio !aviso !warn !ban
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { getPlayer, isMod, isAdmin } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');
const Warn = require('../database/models/Warn');

const data = [
  new SlashCommandBuilder()
    .setName('abrir-sesion')
    .setDescription('[STAFF] Abrir sesión de roleplay oficial')
    .addStringOption(o => o.setName('descripcion').setDescription('Descripción de la sesión').setRequired(false).setMaxLength(500))
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de sesión').setRequired(false)
      .addChoices(
        { name: '🎭 Roleplay general', value: 'rp_general' },
        { name: '👮 Sesión policial (PD)', value: 'policial' },
        { name: '🔥 Sesión LSFD', value: 'lsfd' },
        { name: '⚔️ Evento especial', value: 'evento' },
        { name: '🕵️ Sesión encubierta', value: 'encubierta' },
      )),

  new SlashCommandBuilder()
    .setName('cerrar-sesion')
    .setDescription('[STAFF] Cerrar sesión de roleplay activa')
    .addStringOption(o => o.setName('motivo').setDescription('Motivo del cierre').setRequired(false)),

  new SlashCommandBuilder()
    .setName('abrir-votacion')
    .setDescription('[STAFF] Abrir una votación en el servidor')
    .addStringOption(o => o.setName('pregunta').setDescription('Pregunta de la votación').setRequired(true).setMaxLength(300))
    .addStringOption(o => o.setName('opcion1').setDescription('Opción 1').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('opcion2').setDescription('Opción 2').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('opcion3').setDescription('Opción 3 (opcional)').setRequired(false).setMaxLength(100))
    .addStringOption(o => o.setName('opcion4').setDescription('Opción 4 (opcional)').setRequired(false).setMaxLength(100))
    .addIntegerOption(o => o.setName('duracion').setDescription('Duración en minutos').setRequired(false).setMinValue(1).setMaxValue(10080)),

  new SlashCommandBuilder()
    .setName('admin-on')
    .setDescription('[STAFF] Ponerse como administrador IC (in-character)')
    .addStringOption(o => o.setName('motivo').setDescription('Motivo / descripción').setRequired(false)),

  new SlashCommandBuilder()
    .setName('admin-off')
    .setDescription('[STAFF] Quitarse el modo administrador IC'),

  new SlashCommandBuilder()
    .setName('anuncio')
    .setDescription('[STAFF] Hacer un anuncio oficial del servidor (texto, no embed)')
    .addStringOption(o => o.setName('mensaje').setDescription('Contenido del anuncio').setRequired(true).setMaxLength(2000))
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de anuncio').setRequired(false)
      .addChoices(
        { name: '📢 General', value: 'general' },
        { name: '🚨 Urgente', value: 'urgente' },
        { name: '📅 Evento', value: 'evento' },
        { name: '🔧 Mantenimiento', value: 'mantenimiento' },
      )),

  new SlashCommandBuilder()
    .setName('aviso')
    .setDescription('[STAFF] Enviar un aviso a un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón del aviso').setRequired(true).setMaxLength(500)),

];

async function execute(interaction, client) {
  const cmd = interaction.commandName;
  const gc  = await GuildConfig.findOne({ guildId: interaction.guildId });
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || isMod(interaction.member, gc) || isAdmin(interaction.member);

  // ── ABRIR SESIÓN ────────────────────────────────────────────────────────────
  if (cmd === 'abrir-sesion') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede abrir sesiones.')], ephemeral: true });

    const desc = interaction.options.getString('descripcion') || 'Sesión de roleplay oficial.';
    const tipo = interaction.options.getString('tipo') || 'rp_general';

    const tiposInfo = {
      rp_general: { emoji: '🎭', nombre: 'Roleplay General', color: 0x22c55e },
      policial:   { emoji: '👮', nombre: 'Sesión Policial', color: 0x003f7f },
      lsfd:       { emoji: '🔥', nombre: 'Sesión LSFD', color: 0xcc0000 },
      evento:     { emoji: '⚔️', nombre: 'Evento Especial', color: 0x8b5cf6 },
      encubierta: { emoji: '🕵️', nombre: 'Sesión Encubierta', color: 0x1a1a2e },
    };

    const info  = tiposInfo[tipo] || tiposInfo.rp_general;
    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.emoji} SESIÓN ABIERTA — ${info.nombre}`)
      .setDescription(desc)
      .addFields(
        { name: '📅 Inicio', value: new Date().toLocaleString('es-ES'), inline: true },
        { name: '👤 Abierto por', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: 'AmericanRP — Sesión activa' })
      .setTimestamp();

    // Enviar en canal de anuncios si existe
    let targetChannel = interaction.channel;
    if (gc?.canales?.anuncios) {
      const anCh = await interaction.guild.channels.fetch(gc.canales.anuncios).catch(() => null);
      if (anCh) targetChannel = anCh;
    }

    await targetChannel.send({ content: '@everyone', embeds: [embed] });
    return interaction.reply({ embeds: [E.ok('Sesión abierta', 'Se ha abierto la sesión de RP correctamente.')], ephemeral: true });
  }

  // ── CERRAR SESIÓN ───────────────────────────────────────────────────────────
  if (cmd === 'cerrar-sesion') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede cerrar sesiones.')], ephemeral: true });

    const motivo = interaction.options.getString('motivo') || 'La sesión ha finalizado.';
    const embed  = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🔴 SESIÓN CERRADA')
      .setDescription(motivo)
      .addFields(
        { name: '📅 Fin', value: new Date().toLocaleString('es-ES'), inline: true },
        { name: '👤 Cerrado por', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: 'AmericanRP — Sesión finalizada' })
      .setTimestamp();

    let targetChannel = interaction.channel;
    if (gc?.canales?.anuncios) {
      const anCh = await interaction.guild.channels.fetch(gc.canales.anuncios).catch(() => null);
      if (anCh) targetChannel = anCh;
    }

    await targetChannel.send({ embeds: [embed] });
    return interaction.reply({ embeds: [E.ok('Sesión cerrada', 'Sesión de RP finalizada.')], ephemeral: true });
  }

  // ── ABRIR VOTACIÓN ──────────────────────────────────────────────────────────
  if (cmd === 'abrir-votacion') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede crear votaciones.')], ephemeral: true });

    const pregunta = interaction.options.getString('pregunta');
    const ops      = [
      interaction.options.getString('opcion1'),
      interaction.options.getString('opcion2'),
      interaction.options.getString('opcion3'),
      interaction.options.getString('opcion4'),
    ].filter(Boolean);
    const duracion = interaction.options.getInteger('duracion') || 60;

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const embed  = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('🗳️ VOTACIÓN OFICIAL')
      .setDescription(`**${pregunta}**\n\n${ops.map((o, i) => `${emojis[i]} ${o}`).join('\n')}`)
      .addFields(
        { name: '⏳ Duración', value: `${duracion} minuto(s)`, inline: true },
        { name: '📅 Abierta por', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: 'Haz clic en tu opción para votar' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      ops.map((o, i) =>
        new ButtonBuilder()
          .setCustomId(`vote_${i}`)
          .setLabel(`${emojis[i]} ${o.substring(0, 20)}`)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const votos = new Map(); // userId -> opcionIndex
    const conteo = new Array(ops.length).fill(0);

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: duracion * 60 * 1000,
      filter: i => i.customId.startsWith('vote_'),
    });

    collector.on('collect', async i => {
      const idx = parseInt(i.customId.replace('vote_', ''));
      if (votos.has(i.user.id)) {
        const prev = votos.get(i.user.id);
        conteo[prev]--;
      }
      votos.set(i.user.id, idx);
      conteo[idx]++;
      await i.reply({ content: `✅ Has votado por **${ops[idx]}**`, ephemeral: true });

      // Actualizar embed con resultados parciales
      const resEmbed = EmbedBuilder.from(embed).setFields(
        { name: '📊 Resultados parciales', value: ops.map((o, j) => `${emojis[j]} ${o}: **${conteo[j]} voto(s)**`).join('\n'), inline: false },
        { name: '⏳ Duración', value: `${duracion} minuto(s)`, inline: true },
        { name: '🗳️ Total votos', value: `${votos.size}`, inline: true },
      );
      await msg.edit({ embeds: [resEmbed] }).catch(() => {});
    });

    collector.on('end', async () => {
      const ganador = ops[conteo.indexOf(Math.max(...conteo))];
      const finalEmbed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('🏁 VOTACIÓN FINALIZADA')
        .setDescription(`**${pregunta}**\n\n🏆 **Ganador: ${ganador}**`)
        .addFields({ name: '📊 Resultados finales', value: ops.map((o, i) => `${emojis[i]} ${o}: **${conteo[i]} voto(s)**`).join('\n') })
        .setTimestamp();
      await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
    });

    return;
  }

  // ── ADMIN ON ────────────────────────────────────────────────────────────────
  if (cmd === 'admin-on') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede usar el modo admin IC.')], ephemeral: true });

    const motivo = interaction.options.getString('motivo') || 'Gestión administrativa';
    const player = await getPlayer(interaction.user.id, interaction.user.username);

    player.cooldowns = player.cooldowns || new Map();
    player.cooldowns.set('admin_on', 'true');
    await player.save();

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🛡️ MODO ADMINISTRADOR — ACTIVADO')
      .setDescription(`**${player.getFullName() || interaction.user.username}** está en modo administrador IC.`)
      .addFields({ name: '📋 Motivo', value: motivo })
      .setFooter({ text: 'AmericanRP · Admin IC' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── ADMIN OFF ───────────────────────────────────────────────────────────────
  if (cmd === 'admin-off') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede usar este comando.')], ephemeral: true });

    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (player.cooldowns) {
      player.cooldowns.delete('admin_on');
      await player.save();
    }

    return interaction.reply({ embeds: [E.ok('Modo admin desactivado', `**${player.getFullName()}** ha salido del modo admin IC.`)] });
  }

  // ── ANUNCIO ────────────────────────────────────────────────────────────────
  if (cmd === 'anuncio') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede hacer anuncios.')], ephemeral: true });

    const mensaje = interaction.options.getString('mensaje');
    const tipo    = interaction.options.getString('tipo') || 'general';

    const tipoPrefix = {
      general:       '📢 **ANUNCIO OFICIAL**',
      urgente:       '🚨 **⚠️ ANUNCIO URGENTE ⚠️**',
      evento:        '📅 **PRÓXIMO EVENTO**',
      mantenimiento: '🔧 **MANTENIMIENTO**',
    };

    // FORMATO TEXTO (no embed, según requerimiento)
    const textoFinal = `${tipoPrefix[tipo] || '📢 **ANUNCIO**'}\n\n${mensaje}\n\n— _<@${interaction.user.id}>_`;

    let targetChannel = interaction.channel;
    if (gc?.canales?.anuncios) {
      const anCh = await interaction.guild.channels.fetch(gc.canales.anuncios).catch(() => null);
      if (anCh) targetChannel = anCh;
    }

    if (tipo === 'urgente') {
      await targetChannel.send({ content: `@everyone\n\n${textoFinal}` });
    } else {
      await targetChannel.send({ content: textoFinal });
    }

    return interaction.reply({ content: '✅ Anuncio publicado.', ephemeral: true });
  }

  // ── AVISO ──────────────────────────────────────────────────────────────────
  if (cmd === 'aviso') {
    if (!isStaff) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el staff puede enviar avisos.')], ephemeral: true });

    const target = interaction.options.getUser('usuario');
    const razon  = interaction.options.getString('razon');

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('⚠️ AVISO OFICIAL')
      .setDescription(`Has recibido un aviso de la administración.`)
      .addFields(
        { name: '📋 Razón', value: razon },
        { name: '👤 Staff', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📅 Fecha', value: new Date().toLocaleString('es-ES'), inline: true },
      )
      .setFooter({ text: 'AmericanRP · Aviso oficial' })
      .setTimestamp();

    try { await target.send({ embeds: [embed] }); } catch {}
    await interaction.reply({ embeds: [E.ok('Aviso enviado', `Aviso enviado a <@${target.id}>.`)], ephemeral: true });
    return;
  }

  // ── WARN ───────────────────────────────────────────────────────────────────
  if (cmd === 'warn') {
    const target = interaction.options.getUser('usuario');
    const razon  = interaction.options.getString('razon');

    if (!isMod(interaction.member, gc) && !isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Necesitas permisos de moderación.')], ephemeral: true });
    }

    const warnDoc = await Warn.findOneAndUpdate(
      { guildId: interaction.guildId, userId: target.id },
      { $push: { warns: { razon, moderador: interaction.user.tag, moderadorId: interaction.user.id, activo: true } } },
      { upsert: true, new: true },
    );
    const totalWarns = warnDoc.warns.filter(w => w.activo).length;

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('⚠️ ADVERTENCIA')
      .addFields(
        { name: '👤 Usuario', value: `<@${target.id}>`, inline: true },
        { name: '👮 Moderador', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📋 Razón', value: razon },
        { name: '🔢 Total warns', value: `${totalWarns}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    try { await target.send({ embeds: [embed] }); } catch {}

    // Auto-action on multiple warns
    if (totalWarns >= 3) {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member && gc?.roles?.muted) {
        await member.roles.add(gc.roles.muted).catch(() => {});
        await interaction.followUp({ content: `⚠️ ${totalWarns} warns acumulados — Se ha silenciado automáticamente a <@${target.id}>.` });
      }
    }

    return;
  }

  // ── BAN ────────────────────────────────────────────────────────────────────
  if (cmd === 'ban') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Necesitas permisos de banear.')], ephemeral: true });
    }

    const target = interaction.options.getUser('usuario');
    const razon  = interaction.options.getString('razon');
    const dias   = interaction.options.getInteger('dias') ?? 0;

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ embeds: [E.err('No encontrado', 'Usuario no está en el servidor.')], ephemeral: true });

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'No puedes banear a un administrador.')], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🔨 BAN APLICADO')
      .addFields(
        { name: '👤 Usuario', value: `<@${target.id}> (${target.tag})`, inline: true },
        { name: '👮 Moderador', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📋 Razón', value: razon },
      )
      .setTimestamp();

    try { await target.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🔨 Has sido baneado').setDescription(`**Razón:** ${razon}\n**Servidor:** ${interaction.guild.name}`).setTimestamp()] }); } catch {}
    await member.ban({ reason: razon, deleteMessageSeconds: dias * 86400 });
    return interaction.reply({ embeds: [embed] });
  }
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  { name: 'abrir-sesion', aliases: ['sesion', 'open-sesion'], description: '!abrir-sesion [descripcion]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    const desc = args.join(' ') || 'Sesión de RP oficial.';
    await message.channel.send({ content: '@everyone', embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('🎭 SESIÓN ABIERTA').setDescription(desc).setTimestamp()] });
  }},
  { name: 'cerrar-sesion', aliases: ['close-sesion'], description: '!cerrar-sesion [motivo]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🔴 SESIÓN CERRADA').setDescription(args.join(' ') || 'La sesión ha finalizado.').setTimestamp()] });
  }},
  { name: 'anuncio', description: '!anuncio [mensaje] — Anuncio en texto plano', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    const msg = args.join(' ');
    if (!msg) return message.reply('❌ Escribe el mensaje del anuncio.');
    await message.delete().catch(() => {});
    await message.channel.send(`📢 **ANUNCIO OFICIAL**\n\n${msg}\n\n— _${message.author.toString()}_`);
  }},
  { name: 'aviso', description: '!aviso @usuario [razon]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    const target = message.mentions.users.first();
    const razon  = args.slice(1).join(' ') || 'Sin razón especificada';
    if (!target) return message.reply('Menciona un usuario.');
    try { await target.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('⚠️ AVISO').setDescription(`**Razón:** ${razon}`).setTimestamp()] }); } catch {}
    await message.reply(`✅ Aviso enviado a ${target.tag}.`);
  }},
  { name: 'warn', aliases: ['w'], description: '!warn / !w @usuario [razon]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('Sin permisos.');
    const target = message.mentions.users.first();
    const razon  = args.slice(1).join(' ') || 'Sin razón';
    if (!target) return message.reply('Menciona un usuario.');
    const warnDoc2 = await Warn.findOneAndUpdate(
      { guildId: message.guild.id, userId: target.id },
      { $push: { warns: { razon, moderador: message.author.tag, moderadorId: message.author.id, activo: true } } },
      { upsert: true, new: true },
    );
    const total = warnDoc2.warns.filter(w => w.activo).length;
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('⚠️ WARN').setDescription(`<@${target.id}> advertido.\n**Razón:** ${razon}\n**Total warns:** ${total}`).setTimestamp()] });
    try {
      await target.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('📢 Has sido sancionado — American Island RP').setDescription(
        `Tras una evaluación, se ha decretado que has sido **sancionado**.\n\n` +
        `**Motivo:** ${razon}\n` +
        `**Staff a cargo:** ${message.author.tag} (\`${message.author.id}\`)\n` +
        `**Fecha:** ${new Date().toLocaleString('es-ES')}\n` +
        `**Advertencias activas:** ${total}\n\n` +
        `Para cualquier duda, **abre un ticket** en el servidor.\n` +
        `Para saber más sobre las normativas del servidor, visita: https://www.airpda.xyz/normativa`
      ).setFooter({ text: 'American Island RP — Sistema de Sanciones' }).setTimestamp()] });
    } catch {}
  }},
  { name: 'ban', description: '!ban @usuario [razon]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('Sin permisos.');
    const target = message.mentions.users.first();
    const razon  = args.slice(1).join(' ') || 'Sin razón';
    if (!target) return message.reply('Menciona un usuario.');
    await message.guild.members.ban(target, { reason: razon }).catch(e => message.reply(`Error: ${e.message}`));
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🔨 BANEADO').setDescription(`<@${target.id}> ha sido baneado.\n**Razón:** ${razon}`).setTimestamp()] });
  }},
  { name: 'admin-on', description: '!admin-on [motivo]', async run(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🛡️ ADMIN IC — ACTIVADO').setDescription(`${message.author.toString()} está en modo admin IC.\n${args.join(' ') || ''}`).setTimestamp()] });
  }},
  { name: 'admin-off', description: '!admin-off', async run(message) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('Sin permisos.');
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🛡️ ADMIN IC — DESACTIVADO').setDescription(`${message.author.toString()} ha salido del modo admin IC.`).setTimestamp()] });
  }},
];

module.exports = { data, execute, prefixCommands };
