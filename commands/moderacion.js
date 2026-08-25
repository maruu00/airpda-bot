/**
 * MODERACIÓN — Ban, kick, warn, mute, unmute, clear, slowmode, lock
 * Slash: /ban /kick /warn /mute /unmute /warns /clear /slowmode /lock /unlock /timeout
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const E = require('../utils/embeds');
const config = require('../config');
const Warn = require('../database/models/Warn');
const GuildConfig = require('../database/models/GuildConfig');

async function logMod(guild, gc, embed) {
  if (!gc?.canales?.modLogs) return;
  const ch = guild.channels.cache.get(gc.canales.modLogs);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

const data = [
  // /ban
  new SlashCommandBuilder().setName('ban').setDescription('Banear a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a banear').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón del ban').setRequired(false).setMaxLength(500))
    .addIntegerOption(o => o.setName('dias').setDescription('Días de mensajes a borrar (0-7)').setRequired(false).setMinValue(0).setMaxValue(7)),

  // /kick
  new SlashCommandBuilder().setName('kick').setDescription('Expulsar a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(false).setMaxLength(500)),

  // /warn
  new SlashCommandBuilder().setName('warn').setDescription('Advertir a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a advertir').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('Razón de la advertencia').setRequired(true).setMaxLength(500)),

  // /warns — ver warns de un usuario
  new SlashCommandBuilder().setName('warns').setDescription('Ver advertencias de un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)),

  // /clearwarns
  new SlashCommandBuilder().setName('clearwarns').setDescription('Eliminar advertencias de un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true)),

  // /quitar-warn — quitar un warn específico (1 de 3)
  new SlashCommandBuilder().setName('quitar-warn').setDescription('Quitar una advertencia específica de un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addIntegerOption(o => o.setName('indice').setDescription('Número del warn a quitar (1 = más antiguo)').setRequired(true).setMinValue(1)),

  // /mute
  new SlashCommandBuilder().setName('mute').setDescription('Silenciar a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a silenciar').setRequired(true))
    .addStringOption(o => o.setName('duracion').setDescription('Duración (ej: 10m, 1h, 1d)').setRequired(false))
    .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(false).setMaxLength(500)),

  // /unmute
  new SlashCommandBuilder().setName('unmute').setDescription('Dessilenciar a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a dessilenciar').setRequired(true)),

  // /clear
  new SlashCommandBuilder().setName('clear').setDescription('Borrar mensajes del canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('cantidad').setDescription('Número de mensajes (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('usuario').setDescription('Solo borrar mensajes de este usuario').setRequired(false)),

  // /slowmode
  new SlashCommandBuilder().setName('slowmode').setDescription('Establecer modo lento en el canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('segundos').setDescription('Segundos de cooldown (0 = desactivar)').setRequired(true).setMinValue(0).setMaxValue(21600)),

  // /lock
  new SlashCommandBuilder().setName('lock').setDescription('Bloquear el canal para usuarios normales')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('razon').setDescription('Razón del bloqueo').setRequired(false)),

  // /unlock
  new SlashCommandBuilder().setName('unlock').setDescription('Desbloquear el canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // /timeout — tiempo de espera nativo de Discord
  new SlashCommandBuilder().setName('timeout').setDescription('Poner en timeout a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addIntegerOption(o => o.setName('minutos').setDescription('Duración en minutos (1-40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('razon').setDescription('Razón').setRequired(false).setMaxLength(500)),

  // /unban
  new SlashCommandBuilder().setName('unban').setDescription('Desbanear a un usuario por ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('id').setDescription('ID del usuario a desbanear').setRequired(true)),

  // /userinfo
  new SlashCommandBuilder().setName('userinfo').setDescription('Ver información de un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(false)),

  // /serverinfo
  new SlashCommandBuilder().setName('serverinfo').setDescription('Ver información del servidor'),

  // /roleinfo
  new SlashCommandBuilder().setName('roleinfo').setDescription('Ver información de un rol')
    .addRoleOption(o => o.setName('rol').setDescription('Rol').setRequired(true)),
];

// Parsear duración como "10m", "1h", "2d" → ms
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * (multipliers[unit] || 60000);
}

async function execute(interaction, client) {
  const cmd = interaction.commandName;
  const gc = await GuildConfig.findOne({ guildId: interaction.guildId });

  // ── BAN ─────────────────────────────────────────────────────────────────────
  if (cmd === 'ban') {
    const target = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razón especificada';
    const dias = interaction.options.getInteger('dias') || 0;

    try {
      const member = interaction.guild.members.cache.get(target.id);
      if (member && !member.bannable) return interaction.reply({ embeds: [E.err('Sin permisos', 'No puedo banear a ese usuario.')], ephemeral: true });

      await interaction.guild.bans.create(target.id, { reason: `${interaction.user.tag}: ${razon}`, deleteMessageSeconds: dias * 86400 });

      await interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('🔨 Usuario baneado')
        .addFields(
          { name: 'Usuario', value: `${target.tag} (${target.id})`, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Razón', value: razon, inline: false },
        )
        .setTimestamp()] });

      await logMod(interaction.guild, gc, new EmbedBuilder().setColor(config.colors.danger).setTitle('🔨 Ban').addFields(
        { name: 'Usuario', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Moderador', value: interaction.user.tag, inline: true },
        { name: 'Razón', value: razon }
      ).setTimestamp());

      try { await target.send(`🔨 Has sido **baneado** de **${interaction.guild.name}**.\nRazón: ${razon}`); } catch {}
    } catch (e) {
      return interaction.reply({ embeds: [E.err('Error', e.message)], ephemeral: true });
    }
  }

  // ── KICK ────────────────────────────────────────────────────────────────────
  if (cmd === 'kick') {
    const target = interaction.options.getMember('usuario');
    const razon = interaction.options.getString('razon') || 'Sin razón';

    if (!target) return interaction.reply({ embeds: [E.err('No encontrado', 'Usuario no está en el servidor.')], ephemeral: true });
    if (!target.kickable) return interaction.reply({ embeds: [E.err('Sin permisos', 'No puedo expulsar a ese usuario.')], ephemeral: true });

    try {
      await target.kick(`${interaction.user.tag}: ${razon}`);
      await interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('👢 Usuario expulsado')
        .addFields(
          { name: 'Usuario', value: `${target.user.tag}`, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Razón', value: razon },
        )
        .setTimestamp()] });

      await logMod(interaction.guild, gc, new EmbedBuilder().setColor(config.colors.warning).setTitle('👢 Kick')
        .addFields({ name: 'Usuario', value: target.user.tag, inline: true }, { name: 'Razón', value: razon }).setTimestamp());
    } catch (e) {
      return interaction.reply({ embeds: [E.err('Error', e.message)], ephemeral: true });
    }
  }

  // ── WARN ────────────────────────────────────────────────────────────────────
  if (cmd === 'warn') {
    const target = interaction.options.getUser('usuario');
    const razon = interaction.options.getString('razon');

    let warnDoc = await Warn.findOne({ guildId: interaction.guildId, userId: target.id });
    if (!warnDoc) warnDoc = new Warn({ guildId: interaction.guildId, userId: target.id, warns: [] });

    const warnId = `W${Date.now().toString(36).toUpperCase()}`;
    warnDoc.warns.push({ id: warnId, razon, moderador: interaction.user.tag, fecha: new Date() });
    await warnDoc.save();

    const total = warnDoc.warns.length;

    await interaction.reply({ embeds: [new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle('⚠️ Advertencia emitida')
      .addFields(
        { name: 'Usuario', value: `${target.tag}`, inline: true },
        { name: 'Total warns', value: `${total}`, inline: true },
        { name: 'Razón', value: razon },
      )
      .setTimestamp()] });

    await logMod(interaction.guild, gc, new EmbedBuilder().setColor(config.colors.warning).setTitle('⚠️ Warn')
      .addFields({ name: 'Usuario', value: target.tag, inline: true }, { name: 'Razón', value: razon }, { name: 'Total', value: `${total}`, inline: true }).setTimestamp());

    try {
      await target.send({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('📢 Has sido sancionado — American Island RP')
          .setDescription(
            `Tras una evaluación, se ha decretado que has sido **sancionado**.\n\n` +
            `**Motivo:** ${razon}\n` +
            `**Staff a cargo:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n` +
            `**Fecha:** ${new Date().toLocaleString('es-ES')}\n` +
            `**Advertencias activas:** ${total}\n\n` +
            `Para cualquier duda, **abre un ticket** en el servidor.\n` +
            `Para saber más sobre las normativas del servidor, visita: https://www.airpda.xyz/normativa`
          )
          .setFooter({ text: 'American Island RP — Sistema de Sanciones' })
          .setTimestamp()
        ]
      });
    } catch {}

    // Auto-acciones por número de warns
    const member = interaction.guild.members.cache.get(target.id);
    if (total >= 5 && member) {
      await member.ban({ reason: 'Auto-ban: 5 advertencias' }).catch(() => {});
      await interaction.followUp({ embeds: [E.warn('Auto-ban', `${target.tag} fue baneado automáticamente por acumular 5 advertencias.`)] });
    } else if (total >= 3 && member) {
      // Timeout 1h
      await member.timeout(3600000, 'Auto-timeout: 3 advertencias').catch(() => {});
      await interaction.followUp({ embeds: [E.warn('Auto-timeout', `${target.tag} recibió un timeout de 1 hora por 3 advertencias.`)] });
    }
  }

  // ── WARNS ───────────────────────────────────────────────────────────────────
  if (cmd === 'warns') {
    const target = interaction.options.getUser('usuario');
    const warnDoc = await Warn.findOne({ guildId: interaction.guildId, userId: target.id });

    if (!warnDoc?.warns?.length) return interaction.reply({ embeds: [E.ok('Sin warns', `${target.tag} no tiene advertencias.`)] });

    const lista = warnDoc.warns.map((w, i) => `**${i + 1}.** ${w.razon} — *${w.moderador}* (${new Date(w.fecha).toLocaleDateString('es-ES')})`).join('\n');

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle(`⚠️ Warns de ${target.tag}`)
        .setDescription(lista)
        .setFooter({ text: `Total: ${warnDoc.warns.length} advertencias` })
        .setTimestamp()],
    });
  }

  // ── CLEARWARNS ──────────────────────────────────────────────────────────────
  if (cmd === 'clearwarns') {
    const target = interaction.options.getUser('usuario');
    await Warn.deleteOne({ guildId: interaction.guildId, userId: target.id });
    return interaction.reply({ embeds: [E.ok('Warns eliminados', `Todas las advertencias de ${target.tag} han sido eliminadas.`)] });
  }

  // ── QUITAR-WARN (quitar 1 de N) ───────────────────────────────────────────
  if (cmd === 'quitar-warn') {
    const target = interaction.options.getUser('usuario');
    const indice = interaction.options.getInteger('indice');
    const warnDoc = await Warn.findOne({ guildId: interaction.guildId, userId: target.id });
    if (!warnDoc?.warns?.length) return interaction.reply({ embeds: [E.err('Sin warns', `${target.tag} no tiene advertencias.`)] });
    if (indice < 1 || indice > warnDoc.warns.length) return interaction.reply({ embeds: [E.err('Índice inválido', `Ese usuario tiene ${warnDoc.warns.length} warns. Usa un número entre 1 y ${warnDoc.warns.length}.`)] });
    const quitado = warnDoc.warns.splice(indice - 1, 1)[0];
    await warnDoc.save();
    const restantes = warnDoc.warns.length;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('✅ Warn quitado').setDescription(`Se quitó el warn **#${indice}** de ${target.tag}.\n**Razón quitada:** ${quitado.razon}\n**Restantes:** ${restantes}`).setTimestamp()] });
    await logMod(interaction.guild, gc, new EmbedBuilder().setColor(config.colors.success).setTitle('✅ Warn quitado').addFields({ name: 'Usuario', value: target.tag, inline: true }, { name: 'Quitado por', value: interaction.user.tag, inline: true }, { name: 'Razón quitada', value: quitado.razon }).setTimestamp());
    return;
  }

  // ── MUTE ────────────────────────────────────────────────────────────────────
  if (cmd === 'mute') {
    const target = interaction.options.getMember('usuario');
    const duracion = parseDuration(interaction.options.getString('duracion') || '30m');
    const razon = interaction.options.getString('razon') || 'Sin razón';

    if (!target) return interaction.reply({ embeds: [E.err('No encontrado', 'Usuario no está en el servidor.')], ephemeral: true });

    // Discord timeout (nativo)
    await target.timeout(duracion, razon).catch(() => {});

    // Rol muted (legacy)
    const muteRole = gc?.roles?.muted;
    if (muteRole) await target.roles.add(muteRole).catch(() => {});

    await interaction.reply({ embeds: [E.ok('Silenciado', `🔇 ${target.user.tag} silenciado por ${interaction.options.getString('duracion') || '30m'}. Razón: ${razon}`)] });
    await logMod(interaction.guild, gc, new EmbedBuilder().setColor(config.colors.warning).setTitle('🔇 Mute')
      .addFields({ name: 'Usuario', value: target.user.tag, inline: true }, { name: 'Razón', value: razon }).setTimestamp());
  }

  // ── UNMUTE ──────────────────────────────────────────────────────────────────
  if (cmd === 'unmute') {
    const target = interaction.options.getMember('usuario');
    if (!target) return interaction.reply({ embeds: [E.err('No encontrado', 'Usuario no encontrado.')], ephemeral: true });

    await target.timeout(null).catch(() => {});
    const muteRole = gc?.roles?.muted;
    if (muteRole) await target.roles.remove(muteRole).catch(() => {});

    return interaction.reply({ embeds: [E.ok('Dessilenciado', `🔊 ${target.user.tag} ya puede hablar de nuevo.`)] });
  }

  // ── CLEAR ───────────────────────────────────────────────────────────────────
  if (cmd === 'clear') {
    const cantidad = interaction.options.getInteger('cantidad');
    const targetUser = interaction.options.getUser('usuario');

    let mensajes = await interaction.channel.messages.fetch({ limit: 100 });
    if (targetUser) mensajes = mensajes.filter(m => m.author.id === targetUser.id);
    mensajes = [...mensajes.values()].slice(0, cantidad);

    const deleted = await interaction.channel.bulkDelete(mensajes, true).catch(() => null);
    const n = deleted?.size || 0;

    await interaction.reply({ embeds: [E.ok('Mensajes eliminados', `🗑️ Se eliminaron **${n}** mensajes.`)], ephemeral: true });
  }

  // ── SLOWMODE ─────────────────────────────────────────────────────────────────
  if (cmd === 'slowmode') {
    const seg = interaction.options.getInteger('segundos');
    await interaction.channel.setRateLimitPerUser(seg);
    return interaction.reply({
      embeds: [seg === 0 ? E.ok('Modo lento desactivado', 'El canal vuelve a la velocidad normal.') : E.ok('Modo lento activado', `⏱️ Modo lento: **${seg} segundos** entre mensajes.`)],
    });
  }

  // ── LOCK / UNLOCK ────────────────────────────────────────────────────────────
  if (cmd === 'lock') {
    const razon = interaction.options.getString('razon') || 'Canal bloqueado por el staff';
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.danger).setDescription(`🔒 **Canal bloqueado.** ${razon}`).setTimestamp()] });
  }

  if (cmd === 'unlock') {
    await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setDescription('🔓 **Canal desbloqueado.**').setTimestamp()] });
  }

  // ── TIMEOUT ─────────────────────────────────────────────────────────────────
  if (cmd === 'timeout') {
    const target = interaction.options.getMember('usuario');
    const minutos = interaction.options.getInteger('minutos');
    const razon = interaction.options.getString('razon') || 'Sin razón';

    if (!target) return interaction.reply({ embeds: [E.err('No encontrado', 'Usuario no está en el servidor.')], ephemeral: true });
    await target.timeout(minutos * 60000, razon);

    return interaction.reply({ embeds: [E.ok('Timeout aplicado', `⏰ ${target.user.tag} está en timeout por **${minutos} minutos**. Razón: ${razon}`)] });
  }

  // ── UNBAN ───────────────────────────────────────────────────────────────────
  if (cmd === 'unban') {
    const id = interaction.options.getString('id');
    await interaction.guild.bans.remove(id).catch(() => null);
    return interaction.reply({ embeds: [E.ok('Desbaneado', `Usuario con ID ${id} fue desbaneado.`)] });
  }

  // ── USERINFO ─────────────────────────────────────────────────────────────────
  if (cmd === 'userinfo') {
    const target = interaction.options.getMember('usuario') || interaction.member;
    const user = target.user;
    const warnDoc = await Warn.findOne({ guildId: interaction.guildId, userId: user.id });

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🪪 ID', value: user.id, inline: true },
        { name: '📅 Cuenta creada', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '📥 Se unió', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '⚠️ Warns', value: `${warnDoc?.warns?.length || 0}`, inline: true },
        { name: '🎭 Roles', value: target.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).slice(0, 10).join(' ') || '*Sin roles*', inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── SERVERINFO ───────────────────────────────────────────────────────────────
  if (cmd === 'serverinfo') {
    const g = interaction.guild;
    await g.fetch();
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`🏠 ${g.name}`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        { name: '🪪 ID', value: g.id, inline: true },
        { name: '👑 Dueño', value: `<@${g.ownerId}>`, inline: true },
        { name: '👥 Miembros', value: `${g.memberCount}`, inline: true },
        { name: '📅 Creado', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Canales', value: `${g.channels.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${g.roles.cache.size}`, inline: true },
        { name: '🔒 Verificación', value: g.verificationLevel.toString(), inline: true },
        { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount || 0}`, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── ROLEINFO ─────────────────────────────────────────────────────────────────
  if (cmd === 'roleinfo') {
    const rol = interaction.options.getRole('rol');
    const members = interaction.guild.members.cache.filter(m => m.roles.cache.has(rol.id));
    const embed = new EmbedBuilder()
      .setColor(rol.color || config.colors.primary)
      .setTitle(`🎭 Rol: ${rol.name}`)
      .addFields(
        { name: '🪪 ID', value: rol.id, inline: true },
        { name: '👥 Miembros', value: `${members.size}`, inline: true },
        { name: '🎨 Color', value: rol.hexColor, inline: true },
        { name: '📌 Mencionable', value: rol.mentionable ? '✅' : '❌', inline: true },
        { name: '📌 Hoisted', value: rol.hoist ? '✅' : '❌', inline: true },
        { name: '📅 Creado', value: `<t:${Math.floor(rol.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = { data, execute };
