/**
 * ADMIN — Comandos de administración del servidor y del bot
 * Slash: /admin setup | /admin dar | /admin quitar | /admin config | /admin reset | /admin stats | /admin mantenimiento
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getPlayer, getInventory, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');

const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Comandos de administración (solo admins)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(s => s.setName('setup').setDescription('Configuración automática del servidor'))
  .addSubcommand(s => s.setName('dar').setDescription('Dar dinero o items a un jugador')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(o => o.setName('tipo').setDescription('Qué dar').setRequired(true)
      .addChoices(
        { name: 'Cash', value: 'cash' },
        { name: 'Banco', value: 'banco' },
        { name: 'Dinero sucio', value: 'sucio' },
        { name: 'XP', value: 'xp' },
        { name: 'Item', value: 'item' },
      ))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('item').setDescription('Nombre del item (solo tipo item)').setRequired(false)))
  .addSubcommand(s => s.setName('quitar').setDescription('Quitar dinero a un jugador')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(o => o.setName('tipo').setDescription('Qué quitar').setRequired(true)
      .addChoices(
        { name: 'Cash', value: 'cash' },
        { name: 'Banco', value: 'banco' },
        { name: 'Dinero sucio', value: 'sucio' },
      ))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName('config').setDescription('Configurar el bot para este servidor')
    .addStringOption(o => o.setName('clave').setDescription('Configuración a cambiar').setRequired(true)
      .addChoices(
        { name: 'Prefijo', value: 'prefix' },
        { name: 'Canal logs', value: 'canal_logs' },
        { name: 'Canal modLogs', value: 'canal_modlogs' },
        { name: 'Canal RP', value: 'canal_rp' },
        { name: 'Canal economía', value: 'canal_economia' },
        { name: 'Canal bienvenida', value: 'canal_bienvenida' },
        { name: 'Rol muted', value: 'rol_muted' },
        { name: 'Rol admin', value: 'rol_admin' },
        { name: 'Rol moderador', value: 'rol_moderador' },
        { name: 'AutoMod ON/OFF', value: 'automod_toggle' },
        { name: 'Bienvenida ON/OFF', value: 'bienvenida_toggle' },
        { name: 'AntiSpam ON/OFF', value: 'antispam_toggle' },
      ))
    .addStringOption(o => o.setName('valor').setDescription('Valor (ID de canal/rol, o true/false para toggles)').setRequired(true)))
  .addSubcommand(s => s.setName('reset').setDescription('⚠️ Resetear jugador')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a resetear').setRequired(true))
    .addStringOption(o => o.setName('tipo').setDescription('Qué resetear').setRequired(true)
      .addChoices(
        { name: 'Personaje completo', value: 'personaje' },
        { name: 'Solo dinero', value: 'dinero' },
        { name: 'Solo inventario', value: 'inventario' },
        { name: 'Cooldowns', value: 'cooldowns' },
        { name: 'Estado (muerto/hospital)', value: 'estado' },
      )))
  .addSubcommand(s => s.setName('stats').setDescription('Estadísticas del servidor'))
  .addSubcommand(s => s.setName('buscado').setDescription('Marcar a un jugador como buscado')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador').setRequired(true))
    .addBooleanOption(o => o.setName('estado').setDescription('¿Buscado?').setRequired(true)))
  .addSubcommand(s => s.setName('arrestar').setDescription('Arrestar a un jugador (encarcelar)')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador').setRequired(true))
    .addIntegerOption(o => o.setName('tiempo').setDescription('Tiempo en minutos').setRequired(true).setMinValue(1).setMaxValue(1440)))
  .addSubcommand(s => s.setName('antiraid').setDescription('Activar/desactivar sistema anti-raid')
    .addStringOption(o => o.setName('estado').setDescription('on/off').setRequired(true)
      .addChoices({ name: '🟢 Activar', value: 'on' }, { name: '🔴 Desactivar', value: 'off' })));

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();

  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo los administradores pueden usar estos comandos.')], flags: 64 });
  }

  const gc = await GuildConfig.findOne({ guildId: interaction.guildId }) || await GuildConfig.create({ guildId: interaction.guildId });

  // ── SETUP ───────────────────────────────────────────────────────────────────
  if (sub === 'setup') {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('⚙️ Setup — AmericanRP Bot')
      .setDescription('🔍 Buscando canales y roles existentes...')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Buscar canal por palabras clave en el nombre (insensible a mayúsculas/emojis)
    function findChannel(keywords, type = ChannelType.GuildText) {
      const kws = Array.isArray(keywords) ? keywords : [keywords];
      return interaction.guild.channels.cache.find(c =>
        c.type === type &&
        kws.some(kw => c.name.toLowerCase().includes(kw.toLowerCase())),
      ) || null;
    }

    // Buscar rol por palabras clave
    function findRole(keywords) {
      const kws = Array.isArray(keywords) ? keywords : [keywords];
      return interaction.guild.roles.cache.find(r =>
        kws.some(kw => r.name.toLowerCase().includes(kw.toLowerCase())),
      ) || null;
    }

    const encontrados = [];
    const noEncontrados = [];

    // ── CANALES ────────────────────────────────────────────────────────────
    const busquedaCanales = [
      { clave: 'bienvenida',   keywords: ['bienvenida', 'welcome'],                     label: '👋 Bienvenida' },
      { clave: 'anuncios',     keywords: ['anuncio', 'anuncios', 'announcement'],        label: '📢 Anuncios' },
      { clave: 'rp',           keywords: ['roleplay', 'rol', 'rp', 'juego'],            label: '🎭 Roleplay' },
      { clave: 'economia',     keywords: ['economia', 'economía', 'dinero', 'bank'],     label: '💰 Economía' },
      { clave: 'robos',        keywords: ['robo', 'robos', 'atraco', 'criminal'],        label: '🏴‍☠️ Robos' },
      { clave: 'emergencias',  keywords: ['emergencia', 'emergencias', '911', 'sos'],    label: '🚨 Emergencias' },
      { clave: 'mecanicos',    keywords: ['mecanico', 'mecánico', 'taller', 'garage'],   label: '🔧 Mecánicos' },
      { clave: 'policia',      keywords: ['policia', 'policía', 'comisaria', 'lspd'],    label: '👮 Policía' },
      { clave: 'tickets',      keywords: ['ticket', 'tickets', 'soporte', 'support'],    label: '🎫 Tickets' },
      { clave: 'logs',         keywords: ['log', 'logs', 'registro'],                    label: '📋 Logs' },
      { clave: 'modLogs',      keywords: ['mod-log', 'modlog', 'mod_log', 'sanciones'],  label: '🔨 Mod-Logs' },
      { clave: 'twitter',      keywords: ['twitter', 'redes', 'social'],                 label: '🐦 Twitter RP' },
    ];

    for (const { clave, keywords, label } of busquedaCanales) {
      const ch = findChannel(keywords);
      if (ch) {
        gc.canales[clave] = ch.id;
        if (clave === 'bienvenida') gc.bienvenida.activo = true;
        encontrados.push(`✅ ${label}: <#${ch.id}>`);
      } else {
        noEncontrados.push(`❌ ${label} — no encontrado (busqué: \`${keywords.join('`, `')}\`)`);
      }
    }

    // ── ROLES ──────────────────────────────────────────────────────────────
    const busquedaRoles = [
      { clave: 'muted',      keywords: ['muted', 'silenciado', 'mute'],                  label: '🔇 Muted' },
      { clave: 'miembro',    keywords: ['ciudadano', 'miembro', 'member', 'civil'],       label: '👤 Ciudadano/Miembro' },
      { clave: 'bienvenida', keywords: ['ciudadano', 'miembro', 'member', 'nuevo'],       label: '🎁 Rol de bienvenida' },
      { clave: 'policia',    keywords: ['lspd', 'policía', 'policia'],                    label: '🔵 LSPD' },
      { clave: 'sheriff',    keywords: ['lscsd', 'sheriff'],                              label: '🟤 LSCSD/Sheriff' },
      { clave: 'medico',     keywords: ['lscfd', 'lsfd', 'bombero', 'médico', 'medico'],  label: '🔴 LSFD/Médico' },
      { clave: 'mecanico',   keywords: ['mecánico', 'mecanico', 'taller'],                label: '🔧 Mecánico' },
      { clave: 'banda',      keywords: ['banda', 'gang', 'criminal'],                     label: '👥 Banda' },
      { clave: 'moderador',  keywords: ['moderador', 'mod', 'staff'],                     label: '🟢 Moderador/Staff' },
      { clave: 'admin',      keywords: ['admin', 'administrador'],                        label: '🔴 Admin' },
    ];

    for (const { clave, keywords, label } of busquedaRoles) {
      const rol = findRole(keywords);
      if (rol) {
        gc.roles[clave] = rol.id;
        encontrados.push(`✅ ${label}: <@&${rol.id}>`);
      } else {
        noEncontrados.push(`❌ ${label} — no encontrado (busqué: \`${keywords.join('`, `')}\`)`);
      }
    }

    await gc.save();

    // ── Resultado ──────────────────────────────────────────────────────────
    const hayFaltantes = noEncontrados.length > 0;

    embed
      .setColor(hayFaltantes ? config.colors.warning : config.colors.success)
      .setTitle(hayFaltantes ? '⚠️ Setup completado con avisos' : '✅ Setup completado')
      .setDescription(null)
      .addFields(
        {
          name: `✅ Encontrados (${encontrados.length})`,
          value: encontrados.length ? encontrados.join('\n') : '*Ninguno*',
          inline: false,
        },
      );

    if (hayFaltantes) {
      embed.addFields({
        name: `❌ No encontrados (${noEncontrados.length}) — configúralos manualmente`,
        value: noEncontrados.join('\n'),
        inline: false,
      });
      embed.addFields({
        name: '💡 Cómo arreglarlo',
        value: 'Usa `/admin config [clave] [ID del canal/rol]` para configurar los que faltan.\nO renombra los canales/roles y vuelve a ejecutar `/admin setup`.',
        inline: false,
      });
    }

    embed.setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  // ── DAR ─────────────────────────────────────────────────────────────────────
  if (sub === 'dar') {
    const target = interaction.options.getUser('usuario');
    const tipo = interaction.options.getString('tipo');
    const cantidad = interaction.options.getInteger('cantidad');
    const player = await getPlayer(target.id, target.username);

    if (tipo === 'cash') { player.cash += cantidad; }
    else if (tipo === 'banco') { player.bank += cantidad; }
    else if (tipo === 'sucio') { player.dineroSucio += cantidad; }
    else if (tipo === 'xp') {
      player.addXP(cantidad);
    } else if (tipo === 'item') {
      const itemNombre = interaction.options.getString('item');
      if (!itemNombre) return interaction.reply({ embeds: [E.err('Falta item', 'Especifica el nombre del item.')], flags: 64 });
      const inv = await getInventory(target.id);
      inv.addItem({ nombre: itemNombre, tipo: 'objeto', emoji: '📦', cantidad, precio: 0 });
      await inv.save();
      return interaction.reply({ embeds: [E.ok('Item dado', `Diste **${cantidad}x ${itemNombre}** a ${target.tag}.`)] });
    }

    await player.save();

    const labels = { cash: 'Cash', banco: 'Banco', sucio: 'Dinero sucio', xp: 'XP' };
    return interaction.reply({
      embeds: [E.ok('Dado', `💰 Diste **${tipo === 'xp' ? cantidad : formatMoney(cantidad)} ${labels[tipo] || tipo}** a **${target.tag}**`)],
    });
  }

  // ── QUITAR ──────────────────────────────────────────────────────────────────
  if (sub === 'quitar') {
    const target = interaction.options.getUser('usuario');
    const tipo = interaction.options.getString('tipo');
    const cantidad = interaction.options.getInteger('cantidad');
    const player = await getPlayer(target.id, target.username);

    if (tipo === 'cash') player.cash = Math.max(0, player.cash - cantidad);
    else if (tipo === 'banco') player.bank = Math.max(0, player.bank - cantidad);
    else if (tipo === 'sucio') player.dineroSucio = Math.max(0, player.dineroSucio - cantidad);

    await player.save();
    return interaction.reply({ embeds: [E.ok('Quitado', `Quitaste ${formatMoney(cantidad)} (${tipo}) a ${target.tag}.`)] });
  }

  // ── CONFIG ──────────────────────────────────────────────────────────────────
  if (sub === 'config') {
    const clave = interaction.options.getString('clave');
    const valor = interaction.options.getString('valor');

    const toggles = {
      automod_toggle: () => { gc.automod.activo = valor === 'true'; return `AutoMod: **${gc.automod.activo ? 'ON' : 'OFF'}**`; },
      bienvenida_toggle: () => { gc.bienvenida.activo = valor === 'true'; return `Bienvenida: **${gc.bienvenida.activo ? 'ON' : 'OFF'}**`; },
      antispam_toggle: () => { gc.automod.antiSpam = valor === 'true'; return `AntiSpam: **${gc.automod.antiSpam ? 'ON' : 'OFF'}**`; },
    };

    if (toggles[clave]) {
      const msg = toggles[clave]();
      await gc.save();
      return interaction.reply({ embeds: [E.ok('Configurado', msg)] });
    }

    const mappings = {
      prefix: () => { gc.prefix = valor.slice(0, 3); return `Prefijo: **${gc.prefix}**`; },
      canal_logs: () => { gc.canales.logs = valor; return `Canal logs: <#${valor}>`; },
      canal_modlogs: () => { gc.canales.modLogs = valor; return `Canal mod-logs: <#${valor}>`; },
      canal_rp: () => { gc.canales.rp = valor; return `Canal RP: <#${valor}>`; },
      canal_economia: () => { gc.canales.economia = valor; return `Canal economía: <#${valor}>`; },
      canal_bienvenida: () => { gc.canales.bienvenida = valor; return `Canal bienvenida: <#${valor}>`; },
      rol_muted: () => { gc.roles.muted = valor; return `Rol muted: <@&${valor}>`; },
      rol_admin: () => { gc.roles.admin = valor; return `Rol admin: <@&${valor}>`; },
      rol_moderador: () => { gc.roles.moderador = valor; return `Rol moderador: <@&${valor}>`; },
    };

    if (mappings[clave]) {
      const msg = mappings[clave]();
      await gc.save();
      return interaction.reply({ embeds: [E.ok('Configurado', msg)] });
    }

    return interaction.reply({ embeds: [E.err('Clave inválida', `"${clave}" no es una configuración válida.`)], flags: 64 });
  }

  // ── RESET ───────────────────────────────────────────────────────────────────
  if (sub === 'reset') {
    const target = interaction.options.getUser('usuario');
    const tipo = interaction.options.getString('tipo');
    const player = await getPlayer(target.id, target.username);

    if (tipo === 'personaje') {
      player.personajeCreado = false;
      player.nombre = ''; player.apellido = '';
      player.cash = 0; player.bank = 0; player.dineroSucio = 0;
      player.nivel = 1; player.xp = 0;
      player.gangId = null; player.gangRango = null;
    } else if (tipo === 'dinero') {
      player.cash = 0; player.bank = 0; player.dineroSucio = 0;
    } else if (tipo === 'inventario') {
      const inv = await getInventory(target.id);
      inv.items = [];
      await inv.save();
    } else if (tipo === 'cooldowns') {
      player.cooldowns = new Map();
    } else if (tipo === 'estado') {
      player.muerto = false;
      player.enHospital = false;
      player.tiempoHospital = null;
      player.salud = 100;
    }

    await player.save();
    return interaction.reply({ embeds: [E.ok('Reset completado', `✅ **${tipo}** de ${target.tag} ha sido reseteado.`)] });
  }

  // ── STATS ───────────────────────────────────────────────────────────────────
  if (sub === 'stats') {
    const Player = require('../database/models/Player');
    const Gang = require('../database/models/Gang');
    const DrugPlot = require('../database/models/DrugPlot');
    const Ticket = require('../database/models/Ticket');

    const [players, gangs, plots, tickets] = await Promise.all([
      Player.countDocuments({ personajeCreado: true }),
      Gang.countDocuments(),
      DrugPlot.countDocuments({ fase: 'creciendo' }),
      Ticket.countDocuments({ estado: 'abierto' }),
    ]);

    const richest = await Player.findOne({ personajeCreado: true }).sort({ bank: -1 });

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📊 Estadísticas — ${interaction.guild.name}`)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👥 Personajes activos', value: `${players}`, inline: true },
        { name: '🔫 Bandas', value: `${gangs}`, inline: true },
        { name: '🌿 Plantaciones activas', value: `${plots}`, inline: true },
        { name: '🎫 Tickets abiertos', value: `${tickets}`, inline: true },
        { name: '👤 Miembros Discord', value: `${interaction.guild.memberCount}`, inline: true },
        { name: '💰 Más rico', value: richest ? `${richest.getFullName()} (${formatMoney(richest.bank)})` : 'N/A', inline: true },
        { name: '⚙️ Configuración', value: `Prefijo: \`${gc.prefix}\`\nAutoMod: ${gc.automod.activo ? '✅' : '❌'}\nBienvenida: ${gc.bienvenida.activo ? '✅' : '❌'}`, inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── BUSCADO ─────────────────────────────────────────────────────────────────
  if (sub === 'buscado') {
    const target = interaction.options.getUser('usuario');
    const estado = interaction.options.getBoolean('estado');
    const player = await getPlayer(target.id, target.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese jugador no tiene personaje.')], flags: 64 });

    player.buscado = estado;
    await player.save();

    try {
      const u = await client.users.fetch(target.id);
      await u.send(estado ? '🚨 Has sido marcado como **BUSCADO** por la policía.' : '✅ Ya no estás en la lista de buscados.');
    } catch {}

    return interaction.reply({ embeds: [E.ok(estado ? 'Marcado como buscado' : 'Eliminado de buscados', `**${player.getFullName()}** ${estado ? 'aparece en la lista de buscados' : 'ha sido eliminado de la lista de buscados'}.`)] });
  }

  // ── ARRESTAR ─────────────────────────────────────────────────────────────────
  if (sub === 'arrestar') {
    const target = interaction.options.getUser('usuario');
    const tiempo = interaction.options.getInteger('tiempo');
    const player = await getPlayer(target.id, target.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese jugador no tiene personaje.')], flags: 64 });

    player.enHospital = true; // Encarcelado (usamos mismo sistema que hospital)
    player.tiempoHospital = new Date(Date.now() + tiempo * 60 * 1000);
    player.arrestos++;
    await player.save();

    try {
      const u = await client.users.fetch(target.id);
      await u.send(`🚔 Has sido **arrestado** por ${tiempo} minutos. Saldrás en: <t:${Math.floor(player.tiempoHospital.getTime() / 1000)}:R>`);
    } catch {}

    return interaction.reply({ embeds: [E.warn('Arrestado', `**${player.getFullName()}** ha sido arrestado por **${tiempo} minutos**.`)] });
  }

  // ── ANTIRAID ──────────────────────────────────────────────────────────
  if (sub === 'antiraid') {
    const estado = interaction.options.getString('estado');
    gc.security = gc.security || {};
    gc.security.activo = estado === 'on';
    gc.markModified('security');
    await gc.save();
    return interaction.reply({ embeds: [E.ok(`${estado === 'on' ? '🟡' : '🔴'} Anti-Raid`, `Sistema anti-raid **${estado === 'on' ? 'activado' : 'desactivado'}**.`)] });
  }
}

module.exports = { data, execute };

// ─── Prefix ───────────────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'antiraid',
    aliases: ['security', 'seguridad'],
    description: '!antiraid [on/off] — Activar o desactivar el sistema anti-raid',
    async run(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('❌ Solo administradores.');
      }
      const gc = await GuildConfig.findOne({ guildId: message.guildId });
      if (!gc) return message.reply('❌ Config no encontrada.');
      if (!args.length) {
        const estado = gc.security?.activo !== false ? '🟢 ACTIVO' : '🔴 DESACTIVADO';
        return message.reply(`🛡️ **Anti-Raid:** ${estado}\nUsa \`!antiraid on\` o \`!antiraid off\``);
      }
      const accion = args[0].toLowerCase();
      if (accion === 'on' || accion === 'true' || accion === '1') {
        gc.security = gc.security || {};
        gc.security.activo = true;
        gc.markModified('security');
        await gc.save();
        return message.reply('🛡️ **Anti-Raid activado.**');
      }
      if (accion === 'off' || accion === 'false' || accion === '0') {
        gc.security = gc.security || {};
        gc.security.activo = false;
        gc.markModified('security');
        await gc.save();
        return message.reply('🛡️ **Anti-Raid desactivado.**');
      }
      message.reply('Uso: `!antiraid on` o `!antiraid off`');
    },
  },
];

module.exports.prefixCommands = prefixCommands;
