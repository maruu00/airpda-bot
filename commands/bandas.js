/**
 * BANDAS — Sistema de bandas/gangs completo
 * Slash: /banda crear | /banda invitar | /banda expulsar | /banda info | /banda territorio | /banda banco | /banda promover | /banda salir | /banda disolver
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPlayer, formatMoney, rand } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const GANG_RANGOS = require('../data/gangs');
const { ICONS, BANNERS, addImage } = require('../utils/images');
const Gang = require('../database/models/Gang');

const data = new SlashCommandBuilder()
  .setName('banda')
  .setDescription('Sistema de bandas')
  .addSubcommand(s => s.setName('crear').setDescription('Crear una banda')
    .addStringOption(o => o.setName('nombre').setDescription('Nombre de la banda').setRequired(true).setMaxLength(40))
    .addStringOption(o => o.setName('tag').setDescription('Tag corto (2-5 letras)').setRequired(true).setMinLength(2).setMaxLength(5))
    .addStringOption(o => o.setName('color').setDescription('Color hex (ej: #ff0000)').setRequired(false))
  )
  .addSubcommand(s => s.setName('invitar').setDescription('Invitar a un miembro')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a invitar').setRequired(true)))
  .addSubcommand(s => s.setName('expulsar').setDescription('Expulsar a un miembro')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true)))
  .addSubcommand(s => s.setName('info').setDescription('Ver información de la banda')
    .addStringOption(o => o.setName('nombre').setDescription('Nombre de la banda (dejar vacío para la tuya)').setRequired(false)))
  .addSubcommand(s => s.setName('lista').setDescription('Ver todas las bandas del servidor'))
  .addSubcommand(s => s.setName('banco').setDescription('Gestionar el banco de la banda')
    .addStringOption(o => o.setName('accion').setDescription('depositar o retirar').setRequired(true)
      .addChoices({ name: 'Depositar', value: 'depositar' }, { name: 'Retirar', value: 'retirar' }))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1)))
  .addSubcommand(s => s.setName('promover').setDescription('Promover a un miembro')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a promover').setRequired(true)))
  .addSubcommand(s => s.setName('degradar').setDescription('Degradar a un miembro')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a degradar').setRequired(true)))
  .addSubcommand(s => s.setName('salir').setDescription('Salir de la banda'))
  .addSubcommand(s => s.setName('disolver').setDescription('⚠️ Disolver la banda (solo líder)'))
  .addSubcommand(s => s.setName('territorio').setDescription('Ver territorios controlados'))
  .addSubcommand(s => s.setName('guerra').setDescription('Declarar la guerra a otra banda')
    .addStringOption(o => o.setName('banda').setDescription('Nombre de la banda enemiga').setRequired(true)));

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
    return await interaction.reply({ ...payload, flags: 64 });
  } catch { try { return await interaction.followUp({ ...payload, flags: 64 }); } catch {} }
}
async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  // Deferir para evitar Unknown interaction (3s)
  const needsDefer = sub !== 'lista';
  if (needsDefer && !interaction.deferred && !interaction.replied) {
    try { await interaction.deferReply({ flags: 64 }); } catch {}
  }
  const player = await getPlayer(interaction.user.id, interaction.user.username);

  if (!player.personajeCreado && sub !== 'lista') {
    try { return await interaction.editReply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje primero con `/personaje crear`.')] }); } catch { return safeReply(interaction, { embeds: [E.warn('Sin personaje', 'Crea tu personaje primero con `/personaje crear`.')], flags: 64 }).catch(() => {}); }
  }

  // ── CREAR ──────────────────────────────────────────────────────────────────
  if (sub === 'crear') {
    if (player.gangId) {
      try { return await interaction.editReply({ embeds: [E.err('Ya en banda', 'Sal de tu banda actual antes de crear una nueva.')] }); } catch { return safeReply(interaction, { embeds: [E.err('Ya en banda', 'Sal de tu banda actual antes de crear una nueva.')], flags: 64 }).catch(()=>{}); }
    }

    const nombre = interaction.options.getString('nombre');
    const tag = interaction.options.getString('tag').toUpperCase();
    const color = interaction.options.getString('color') || '#8b5cf6';

    const existing = await Gang.findOne({ $or: [{ nombre: { $regex: `^${nombre}$`, $options: 'i' } }, { tag }] });
    if (existing) { try { return await interaction.editReply({ embeds: [E.err('Nombre/tag ocupado', 'Ya existe una banda con ese nombre o tag.')] }); } catch { return safeReply(interaction, { embeds: [E.err('Nombre/tag ocupado', 'Ya existe una banda con ese nombre o tag.')], flags: 64 }).catch(()=>{}); } }

    const gang = await Gang.create({
      nombre,
      tag,
      color,
      lider: interaction.user.id,
      miembros: [{ discordId: interaction.user.id, rango: 'Líder', unidoEn: new Date() }],
      dinero: 1500000,
      capitalInicial: 1500000,
      desmantelada: false,
    });

    // Roles de Discord: rol normal + rol "Jefe NOMBRE"
    try {
      if (interaction.guild) {
        const colorInt = parseInt(String(color).replace('#', ''), 16) || config.colors.gang;
        const rolNormal = await interaction.guild.roles.create({
          name: `${nombre}`.slice(0, 100),
          color: colorInt,
          reason: `Rol de organización ${nombre} (${tag})`,
        }).catch(() => null);
        const rolJefe = await interaction.guild.roles.create({
          name: `Jefe ${nombre}`.slice(0, 100),
          color: colorInt,
          reason: `Rol de jefe de ${nombre} (${tag})`,
        }).catch(() => null);
        gang.rolId = rolNormal?.id || null;
        gang.jefeRolId = rolJefe?.id || null;
        if (rolNormal) await interaction.member.roles.add(rolNormal.id).catch(() => {});
        if (rolJefe) await interaction.member.roles.add(rolJefe.id).catch(() => {});
        await gang.save();
      }
    } catch {}

    player.gangId = gang._id;
    player.gangRango = 'Líder';
    await player.save();

    return safeReply(interaction, {
      embeds: [new EmbedBuilder()
        .setColor(parseInt(color.replace('#', ''), 16) || config.colors.gang)
        .setTitle(`👥 Banda [${tag}] creada`)
        .setDescription(`**${nombre}** ha sido fundada por **${player.getFullName()}**`)
        .addFields(
          { name: 'Líder', value: player.getFullName(), inline: true },
          { name: 'Tag', value: `[${tag}]`, inline: true },
          { name: 'Miembros', value: '1', inline: true },
        )
        .setTimestamp()],
    });
  }

  // ── INVITAR ────────────────────────────────────────────────────────────────
  if (sub === 'invitar') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });
    if (!gang.isLider(interaction.user.id) && gang.getMiembro(interaction.user.id)?.rango !== 'Capitán') {
      return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el líder o capitanes pueden invitar.')], flags: 64 });
    }

    const target = interaction.options.getUser('usuario');
    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) return safeReply(interaction, { embeds: [E.err('Sin personaje', 'Ese usuario no tiene personaje.')], flags: 64 });
    if (targetPlayer.gangId) return safeReply(interaction, { embeds: [E.err('Ya en banda', 'Ese jugador ya pertenece a una banda.')], flags: 64 });

    if (gang.miembros.length >= (gang.slots || 4)) return safeReply(interaction, { embeds: [E.err('Banda llena', `La banda tiene el máximo de ${gang.slots || 4} miembros. Pide al staff más slots.`)], flags: 64 });

    // Añadir directamente (confirmación por DM)
    try {
      const u = await client.users.fetch(target.id);
      await u.send({ embeds: [new EmbedBuilder()
        .setColor(config.colors.gang)
        .setTitle(`👥 ¡Bienvenido a ${gang.nombre}!`)
        .setDescription(`**${player.getFullName()}** te ha añadido a la banda **[${gang.tag}] ${gang.nombre}** como **Recluta**.\nÚnete al rol de Discord y demuestra tu lealtad.`)
        .setTimestamp()] });
    } catch {}

    gang.miembros.push({ discordId: target.id, rango: 'Recluta', unidoEn: new Date() });
    targetPlayer.gangId = gang._id;
    targetPlayer.gangRango = 'Recluta';
    await gang.save();
    await targetPlayer.save();

    if (gang.rolId) {
      try {
        const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member) await member.roles.add(gang.rolId).catch(() => {});
      } catch {}
    }

    return safeReply(interaction, { embeds: [E.ok('Miembro añadido', `**${targetPlayer.getFullName()}** se ha unido a **${gang.nombre}** como Recluta.`)] });
  }

  // ── EXPULSAR ───────────────────────────────────────────────────────────────
  if (sub === 'expulsar') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a una banda.')], flags: 64 });
    if (!gang.isLider(interaction.user.id)) return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el líder puede expulsar.')], flags: 64 });

    const target = interaction.options.getUser('usuario');
    if (target.id === interaction.user.id) return safeReply(interaction, { embeds: [E.err('Error', 'No puedes expulsarte a ti mismo. Usa /banda salir.')], flags: 64 });
    if (!gang.isMiembro(target.id)) return safeReply(interaction, { embeds: [E.err('No es miembro', 'Ese usuario no está en tu banda.')], flags: 64 });

    gang.miembros = gang.miembros.filter(m => m.discordId !== target.id);
    const targetPlayer = await getPlayer(target.id, target.username);
    targetPlayer.gangId = null;
    targetPlayer.gangRango = null;
    await gang.save();
    await targetPlayer.save();

    if (gang.rolId) {
      try {
        const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member) await member.roles.remove(gang.rolId).catch(() => {});
      } catch {}
    }

    try {
      const u = await client.users.fetch(target.id);
      await u.send(`👢 Has sido expulsado de la banda **${gang.nombre}**.`);
    } catch {}

    return safeReply(interaction, { embeds: [E.ok('Miembro expulsado', `**${targetPlayer.personajeCreado ? targetPlayer.getFullName() : target.username}** ha sido expulsado de la banda.`)] });
  }

  // ── INFO ───────────────────────────────────────────────────────────────────
  if (sub === 'info') {
    const nombreBuscar = interaction.options.getString('nombre');
    let gang;
    if (nombreBuscar) {
      gang = await Gang.findOne({ nombre: { $regex: nombreBuscar, $options: 'i' } });
    } else {
      gang = await Gang.findById(player.gangId);
    }
    if (!gang) return safeReply(interaction, { embeds: [E.err('Banda no encontrada', nombreBuscar ? `No existe la banda "${nombreBuscar}".` : 'No perteneces a ninguna banda.')], flags: 64 });

    const rangos = (gang.rangos && gang.rangos.length && gang.rangos.length <= 5) ? gang.rangos : GANG_RANGOS;
    const miembrosFormatted = gang.miembros
      .sort((a, b) => rangos.indexOf(a.rango) - rangos.indexOf(b.rango))
      .map(m => `**${m.rango}:** <@${m.discordId}>`)
      .join('\n') || '*Sin miembros*';

    // Sistema infinito: cap 100 atracos por nivel para que sea farmeable, y tier Reyes en nivel 10+
    const lvl = gang.nivel || 1;
    const req = Math.min(lvl * 10, 100);
    const isReyes = lvl >= 10;
    const tierName = isReyes ? (lvl >= 20 ? '💀 Leyendas' : lvl >= 15 ? '🌟 Imperio' : '👑 Reyes') : `Nivel ${lvl}`;
    const nivelStr = isReyes
      ? `${tierName} **${lvl}** (${gang.atracos || 0}/${req} atracos) 🔁 infinito`
      : `${lvl} (${gang.atracos || 0}/${req} atracos) 🔁`;

    const embed = new EmbedBuilder()
      .setColor(isReyes ? 0xFFD700 : parseInt(String(gang.color).replace('#', ''), 16) || config.colors.gang)
      .setTitle(`${isReyes ? '👑' : '👥'} [${gang.tag}] ${gang.nombre} ${isReyes ? '— ' + tierName : ''}`)
      .addFields(
        { name: '👑 Líder', value: `<@${gang.lider}>`, inline: true },
        { name: '👥 Miembros', value: `${gang.miembros.length}/${gang.slots || 4}`, inline: true },
        { name: '🏦 Banco', value: formatMoney(gang.dinero || 0), inline: true },
        { name: '🏴 Territorios', value: `${gang.territorios?.length || 0}`, inline: true },
        { name: '⬆️ Nivel', value: nivelStr, inline: true },
        { name: '⚔️ Guerra activa', value: `${gang.enGuerra ? `Sí (contra ${gang.guerraContra || 'N/A'})` : 'No'}`, inline: true },
        { name: '📅 Fundada', value: `<t:${Math.floor(gang.creadoEn?.getTime() / 1000 || Date.now() / 1000)}:R>`, inline: true },
        { name: '👥 Lista de miembros', value: miembrosFormatted.slice(0, 1024), inline: false },
      )
      .setTimestamp();

    const descBase = gang.descripcion || '';
    // Mensaje de misiones infinitas siempre visible
    const infiniteMsg = isReyes
      ? `\n\n> 👑 **${tierName}** — ¡Misiones NUNCA se acaban! Siguiente nivel: ${lvl+1} requiere **${Math.min((lvl+1)*10,100)} atracos**. ¡Sigan dominando!`
      : `\n\n> 🔁 **Misiones infinitas** — Al llegar a ${req} atracos subís a nivel ${lvl+1} y se resetea a 0/${Math.min((lvl+1)*10,100)}. ¡Nunca se acaban!`;
    embed.setDescription((descBase + infiniteMsg).slice(0, 4096));

    return safeReply(interaction, { embeds: [embed] });
  }

  // ── LISTA ──────────────────────────────────────────────────────────────────
  if (sub === 'lista') {
    const gangs = await Gang.find().sort({ 'miembros.length': -1 }).limit(10);
    if (!gangs.length) return safeReply(interaction, { embeds: [E.info('Sin bandas', 'No hay bandas registradas aún.')] });

    const desc = gangs.map((g, i) => `**${i + 1}.** [${g.tag}] **${g.nombre}** — ${g.miembros.length} miembros | Banco: ${formatMoney(g.dinero || 0)}`).join('\n');

    return safeReply(interaction, {
      embeds: [new EmbedBuilder()
        .setColor(config.colors.gang)
        .setTitle('👥 Bandas de Los Santos')
        .setDescription(desc)
        .setTimestamp()],
    });
  }

  // ── BANCO ──────────────────────────────────────────────────────────────────
  if (sub === 'banco') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a una banda.')], flags: 64 });

    const accion = interaction.options.getString('accion');
    const cantidad = interaction.options.getInteger('cantidad');

    if (accion === 'depositar') {
      if (player.cash < cantidad) return safeReply(interaction, { embeds: [E.err('Fondos insuficientes', `Solo tienes ${formatMoney(player.cash)} en cash.`)], flags: 64 });
      player.cash -= cantidad;
      gang.dinero = (gang.dinero || 0) + cantidad;
      await player.save();
      await gang.save();
      return safeReply(interaction, { embeds: [E.ok('Depósito realizado', `💰 Depositaste ${formatMoney(cantidad)} en el banco de la banda.\nBanco banda: ${formatMoney(gang.dinero)}`)] });
    }

    if (accion === 'retirar') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has('1441818963133731016')) return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el staff (Admin) puede retirar del banco de la banda.')], flags: 64 });
      if ((gang.dinero || 0) < cantidad) return safeReply(interaction, { embeds: [E.err('Fondos insuficientes', 'El banco de la banda no tiene suficiente.')], flags: 64 });
      gang.dinero -= cantidad;
      player.cash += cantidad;
      await player.save();
      await gang.save();
      return safeReply(interaction, { embeds: [E.ok('Retiro realizado', `💰 Retiraste ${formatMoney(cantidad)} del banco de la banda.`)] });
    }
  }

  // ── PROMOVER / DEGRADAR ────────────────────────────────────────────────────
  if (sub === 'promover' || sub === 'degradar') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });
    if (!gang.isLider(interaction.user.id)) return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el líder puede promover/degradar.')], flags: 64 });

    const target = interaction.options.getUser('usuario');
    const miembro = gang.getMiembro(target.id);
    if (!miembro) return safeReply(interaction, { embeds: [E.err('No es miembro', 'Ese usuario no está en tu banda.')], flags: 64 });

    const rangos = GANG_RANGOS;
    const currentIdx = rangos.indexOf(miembro.rango);

    let newRango;
    if (sub === 'promover') {
      if (currentIdx <= 1) return safeReply(interaction, { embeds: [E.warn('Límite', 'No se puede promover más.')], flags: 64 });
      newRango = rangos[currentIdx - 1];
    } else {
      if (currentIdx >= rangos.length - 1) return safeReply(interaction, { embeds: [E.warn('Límite', 'Ya está en el rango más bajo.')], flags: 64 });
      newRango = rangos[currentIdx + 1];
    }

    miembro.rango = newRango;
    const targetPlayer = await getPlayer(target.id, target.username);
    targetPlayer.gangRango = newRango;
    await gang.save();
    await targetPlayer.save();

    return safeReply(interaction, { embeds: [E.ok(sub === 'promover' ? 'Promovido' : 'Degradado', `<@${target.id}> ahora es **${newRango}** en **${gang.nombre}**`)] });
  }

  // ── SALIR ──────────────────────────────────────────────────────────────────
  if (sub === 'salir') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });
    if (gang.isLider(interaction.user.id)) return safeReply(interaction, { embeds: [E.warn('Eres el líder', 'Transfiere el liderazgo o disuelve la banda con `/banda disolver`.')], flags: 64 });

    gang.miembros = gang.miembros.filter(m => m.discordId !== interaction.user.id);
    player.gangId = null;
    player.gangRango = null;
    await gang.save();
    await player.save();

    return safeReply(interaction, { embeds: [E.ok('Has salido', `Saliste de **${gang.nombre}**.`)] });
  }

  // ── DISOLVER ───────────────────────────────────────────────────────────────
  if (sub === 'disolver') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });
    if (!gang.isLider(interaction.user.id)) return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el líder puede disolver la banda.')], flags: 64 });

    // Limpiar miembros
    const Player = require('../database/models/Player');
    await Player.updateMany(
      { discordId: { $in: gang.miembros.map(m => m.discordId) } },
      { $set: { gangId: null, gangRango: null } }
    );
    await Gang.deleteOne({ _id: gang._id });

    return safeReply(interaction, { embeds: [E.warn('Banda disuelta', `La banda **${gang.nombre}** ha sido disuelta.`)] });
  }

  // ── TERRITORIO ─────────────────────────────────────────────────────────────
  if (sub === 'territorio') {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });

    const terrs = gang.territorios || [];
    const embed = new EmbedBuilder()
      .setColor(config.colors.gang)
      .setTitle(`🏴 Territorios de ${gang.nombre}`)
      .setDescription(terrs.length ? terrs.map(t => `📍 ${t.nombre}`).join('\n') : '*Sin territorios controlados*')
      .addFields({ name: 'Total', value: `${terrs.length} territorios`, inline: true })
      .setTimestamp();
    return safeReply(interaction, { embeds: [embed] });
  }

  // ── GUERRA ─────────────────────────────────────────────────────────────────
  if (sub === 'guerra') {
    const myGang = await Gang.findById(player.gangId);
    if (!myGang) return safeReply(interaction, { embeds: [E.err('Sin banda', 'No perteneces a ninguna banda.')], flags: 64 });
    if (!myGang.isLider(interaction.user.id)) return safeReply(interaction, { embeds: [E.err('Sin permisos', 'Solo el líder puede declarar guerras.')], flags: 64 });

    const nombreEnemigo = interaction.options.getString('banda');
    const enemy = await Gang.findOne({ nombre: { $regex: nombreEnemigo, $options: 'i' } });
    if (!enemy) return safeReply(interaction, { embeds: [E.err('Banda no encontrada', `No existe la banda "${nombreEnemigo}".`)], flags: 64 });
    if (enemy._id.toString() === myGang._id.toString()) return safeReply(interaction, { embeds: [E.err('Error', 'No puedes declararte la guerra a ti mismo.')], flags: 64 });

    myGang.enGuerra = true;
    myGang.guerraContra = enemy._id.toString();
    myGang.guerraKills = 0;
    myGang.guerraExpira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await myGang.save();

    return safeReply(interaction, {
      embeds: [new EmbedBuilder()
        .setColor(config.colors.danger)
        .setTitle('⚔️ ¡Guerra declarada!')
        .setDescription(`**${myGang.nombre}** [${myGang.tag}] ha declarado la guerra a **${enemy.nombre}** [${enemy.tag}]`)
        .setTimestamp()],
    });
  }
}

// ─── Prefix ────────────────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'mibanda',
    aliases: ['gang', 'migang'],
    description: 'Ver tu banda',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.gangId) return message.reply('No perteneces a ninguna banda. Usa `/banda crear` o pide que te inviten.');
      const gang = await Gang.findById(player.gangId);
      if (!gang) return message.reply('Error al cargar la banda.');
      const embed = new EmbedBuilder()
        .setColor(parseInt(gang.color?.replace('#', ''), 16) || config.colors.gang)
        .setTitle(`👥 [${gang.tag}] ${gang.nombre}`)
        .addFields(
          { name: 'Tu rango', value: player.gangRango || 'Miembro', inline: true },
          { name: 'Miembros', value: `${gang.miembros.length}`, inline: true },
          { name: 'Banco', value: formatMoney(gang.dinero || 0), inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands };
