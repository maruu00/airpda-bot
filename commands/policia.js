/**
 * POLICIA — Comandos para cuerpos de seguridad
 * Slash: /esposar /desesposar /multar /multas /pagar-multa /cachear /escoltar
 *        /crear-placa /ver-placa /ver-id /ver-licencia /ver-permiso
 *        /poli-dispo /soli-dispo /curar /auxilio
 * Prefix: !esposar !desesposar !multar !multas !pagar-multa !cachear !escoltar
 *         !crear-placa !ver-placa !ver-id !ver-licencia !ver-permiso
 *         !poli-dispo !soli-dispo !curar !auxilio
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { getPlayer, formatMoney, isMod } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const { ICONS, BANNERS, addImage } = require('../utils/images');
const GuildConfig = require('../database/models/GuildConfig');
const Multa = require('../database/models/Multa');
const Placa = require('../database/models/Placa');
const Player = require('../database/models/Player');

// ─── Verificar que el usuario es policía/admin ────────────────────────────────
async function esPolicía(interaction, gc) {
  const member = interaction.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const rolesPolicia = [config.roles.policia, config.roles.sheriff, gc?.roles?.policia, gc?.roles?.sheriff]
    .filter(Boolean);
  return rolesPolicia.some(r => member.roles.cache.has(r));
}

async function esPolicíaMsg(message, gc) {
  const member = message.member;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const rolesPolicia = [config.roles.policia, config.roles.sheriff, gc?.roles?.policia, gc?.roles?.sheriff]
    .filter(Boolean);
  return rolesPolicia.some(r => member.roles.cache.has(r));
}

// ─── Slash command builders ───────────────────────────────────────────────────
const data = [
  new SlashCommandBuilder()
    .setName('esposar')
    .setDescription('[POLICÍA] Esposar a un ciudadano')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a esposar').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo del arresto').setRequired(false).setMaxLength(200)),

  new SlashCommandBuilder()
    .setName('desesposar')
    .setDescription('[POLICÍA] Desesposar a un ciudadano')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a desesposar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('multar')
    .setDescription('[POLICÍA] Poner una multa a un ciudadano')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a multar').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Importe de la multa ($)').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo de la multa').setRequired(true).setMaxLength(300))
    .addIntegerOption(o => o.setName('carcel').setDescription('Tiempo en cárcel (minutos, 0=sin cárcel)').setRequired(false).setMinValue(0).setMaxValue(1440)),

  new SlashCommandBuilder()
    .setName('multas')
    .setDescription('Ver multas pendientes (propias o de otro usuario)')
    .addUserOption(o => o.setName('usuario').setDescription('Ver multas de otro usuario (solo policías)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('pagar-multa')
    .setDescription('Pagar una multa pendiente')
    .addStringOption(o => o.setName('id').setDescription('ID de la multa (MLT-YYYY-NNNN)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('cachear')
    .setDescription('[POLICÍA] Cachear a un ciudadano para ver su inventario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a cachear').setRequired(true)),

  new SlashCommandBuilder()
    .setName('escoltar')
    .setDescription('[POLICÍA] Escoltar a un ciudadano esposado')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a escoltar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('crear-placa')
    .setDescription('[ADMIN] Crear una placa policial para un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario al que asignar la placa').setRequired(true))
    .addStringOption(o => o.setName('departamento').setDescription('Departamento').setRequired(true)
      .addChoices(
        { name: 'LSPD — Police Department', value: 'LSPD' },
        { name: 'LSCSD — County Sheriff', value: 'LSCSD' },
        { name: 'LSCFD — Fire Department', value: 'LSCFD' },
        { name: 'IAA — Intelligence Agency', value: 'IAA' },
        { name: 'FIB — Federal Investigation', value: 'FIB' },
      ))
    .addStringOption(o => o.setName('rango').setDescription('Rango del agente').setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName('numero').setDescription('Número de placa').setRequired(true).setMaxLength(20)),

  new SlashCommandBuilder()
    .setName('ver-placa')
    .setDescription('Ver la placa policial de un agente')
    .addUserOption(o => o.setName('usuario').setDescription('Agente (tu placa si no pones ninguno)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('ver-id')
    .setDescription('[POLICÍA] Ver la ID de un ciudadano')
    .addUserOption(o => o.setName('usuario').setDescription('Ciudadano').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ver-licencia')
    .setDescription('[POLICÍA] Verificar licencia de conducir')
    .addUserOption(o => o.setName('usuario').setDescription('Ciudadano').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ver-permiso')
    .setDescription('[POLICÍA] Verificar permiso de armas')
    .addUserOption(o => o.setName('usuario').setDescription('Ciudadano').setRequired(true)),

  new SlashCommandBuilder()
    .setName('poli-dispo')
    .setDescription('[POLICÍA] Establecer tu disponibilidad policial')
    .addStringOption(o => o.setName('estado').setDescription('Estado de disponibilidad').setRequired(true)
      .addChoices(
        { name: '✅ Disponible en servicio', value: 'disponible' },
        { name: '🔴 No disponible / Fuera de servicio', value: 'no_disponible' },
        { name: '🟡 Ocupado — En gestión', value: 'ocupado' },
        { name: '⚠️ Emergencia activa', value: 'emergencia' },
      )),

  new SlashCommandBuilder()
    .setName('soli-dispo')
    .setDescription('Pedir disponibilidad policial actual'),

  new SlashCommandBuilder()
    .setName('auxilio')
    .setDescription('Llamar a los servicios médicos / EMT del LSFD'),

  new SlashCommandBuilder()
    .setName('quitar-sucio')
    .setDescription('[POLICÍA] Quitar dinero sucio a un ciudadano')
    .addUserOption(o => o.setName('usuario').setDescription('Ciudadano').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a quitar (0 = todo)').setRequired(false).setMinValue(0))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo del decomiso').setRequired(true).setMaxLength(300)),
];

// ─── Execute handler ──────────────────────────────────────────────────────────
async function execute(interaction, client) {
  const cmd = interaction.commandName;
  const gc  = await GuildConfig.findOne({ guildId: interaction.guildId });

  // ── ESPOSAR ─────────────────────────────────────────────────────────────────
  if (cmd === 'esposar') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede usar este comando.')], ephemeral: true });
    }
    const target = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo') || 'Sin motivo especificado';
    const agente = await getPlayer(interaction.user.id, interaction.user.username);
    const ciudadano = await getPlayer(target.id, target.username);

    if (ciudadano.esposado) {
      return interaction.reply({ embeds: [E.warn('Ya esposado', `${ciudadano.getFullName()} ya está esposado.`)], ephemeral: true });
    }

    ciudadano.esposado = true;
    ciudadano.esposadoPor = interaction.user.id;
    await ciudadano.save();

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle('⛓️ ESPOSADO')
      .setDescription(`**${agente.getFullName()}** ha esposado a **${ciudadano.getFullName()}**`)
      .setThumbnail(ICONS.esposar)
      .addFields(
        { name: '👮 Agente', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🎯 Detenido', value: `<@${target.id}>`, inline: true },
        { name: '🪪 DNI Detenido', value: `\`${E.getDNI(target.id)}\``, inline: true },
        { name: '📋 Motivo', value: motivo, inline: false },
      )
      .setFooter({ text: 'American Island Rp · Sistema Policial' })
      .setTimestamp();
    addImage(embed, 'policia');

    await interaction.reply({ embeds: [embed] });

    // DM al detenido
    try {
      await target.send({ embeds: [new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('⛓️ Has sido esposado')
        .setDescription(`**${agente.getFullName()}** te ha esposado.\n\n**Motivo:** ${motivo}`)
        .setTimestamp()] });
    } catch {}

    // Log
    const logCh = gc?.canales?.modLogs;
    if (logCh) {
      const ch = await interaction.guild.channels.fetch(logCh).catch(() => null);
      if (ch) await ch.send({ embeds: [embed] });
    }
    return;
  }

  // ── DESESPOSAR ──────────────────────────────────────────────────────────────
  if (cmd === 'desesposar') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede usar este comando.')], ephemeral: true });
    }
    const target = interaction.options.getUser('usuario');
    const ciudadano = await getPlayer(target.id, target.username);

    ciudadano.esposado = false;
    ciudadano.esposadoPor = null;
    await ciudadano.save();

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle('🔓 DESESPOSADO')
      .setDescription(`**${ciudadano.getFullName()}** ha sido desesposado por <@${interaction.user.id}>`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    try { await target.send({ embeds: [embed] }); } catch {}
    return;
  }

  // ── MULTAR ──────────────────────────────────────────────────────────────────
  if (cmd === 'multar') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede multar.')], ephemeral: true });
    }
    await interaction.deferReply();

    const target   = interaction.options.getUser('usuario');
    const cantidad = interaction.options.getInteger('cantidad');
    const motivo   = interaction.options.getString('motivo');
    const carcel   = interaction.options.getInteger('carcel') || 0;

    const agente    = await getPlayer(interaction.user.id, interaction.user.username);
    const ciudadano = await getPlayer(target.id, target.username);

    const multa = await Multa.create({
      ciudadanoId:      target.id,
      ciudadanoNombre:  ciudadano.getFullName(),
      agente:           interaction.user.id,
      agenteNombre:     agente.getFullName(),
      motivo,
      cantidad,
      tiempoCarcel:     carcel,
      guildId:          interaction.guildId,
    });

    ciudadano.multasRecibidas++;
    if (carcel > 0) {
      ciudadano.enCarcel    = true;
      ciudadano.tiempoCarcel = new Date(Date.now() + carcel * 60 * 1000);
    }
    await ciudadano.save();

    // Sincronizar sanción con la PDA (dashboard) para que sea visible en la web
    try {
      const pdaApi  = require('../utils/pdaApi');
      const pdaUser = await pdaApi.buscarPorDiscord(target.id).catch(() => null);
      await pdaApi.crearSancion({
        ciudadanoId:        pdaUser?._id?.toString() || target.id,
        ciudadanoDiscordId: target.id,
        ciudadanoNombre:    ciudadano.getFullName(),
        tipo:               carcel > 0 ? 'arresto' : 'multa',
        motivo,
        descripcion:        motivo,
        agente:             agente.getFullName(),
        agenteDiscordId:    interaction.user.id,
        cantidad,
        tiempoCarcel:       carcel,
        activa:             true,
        botMultaId:         multa.multaId, // referencia cruzada
      });
    } catch {}

    // Notificar webhooks de la PDA (como haría el backend si se llamara via REST)
    try {
      const { notificarSancion } = require('../utils/pdaWebhook');
      notificarSancion({
        tipo:             carcel > 0 ? 'arresto' : 'multa',
        ciudadanoNombre:  ciudadano.getFullName(),
        agente:           agente.getFullName(),
        cantidad,
        tiempoCarcel:     carcel,
        motivo,
      });
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🚔 MULTA EMITIDA')
      .setThumbnail(ICONS.multa)
      .addFields(
        { name: '🪪 ID Multa', value: `\`${multa.multaId}\``,                    inline: true },
        { name: '👮 Agente',   value: agente.getFullName(),                       inline: true },
        { name: '🎯 Multado',  value: ciudadano.getFullName(),                    inline: true },
        { name: '🪪 DNI',      value: `\`${E.getDNI(target.id)}\``,               inline: true },
        { name: '💰 Importe',  value: formatMoney(cantidad),                      inline: true },
        { name: '⏰ Cárcel',   value: carcel > 0 ? `${carcel} minutos` : 'Sin cárcel', inline: true },
        { name: '📋 Motivo',   value: motivo,                                     inline: false },
      )
      .setFooter({ text: `Pagar con /pagar-multa ${multa.multaId} · Sincronizada con PDA` })
      .setTimestamp();
    addImage(embed, 'policia');

    await interaction.editReply({ embeds: [embed] });

    try {
      await target.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🚔 Has recibido una multa')
        .setDescription(`**Importe:** ${formatMoney(cantidad)}\n**Motivo:** ${motivo}\n**ID:** \`${multa.multaId}\`\n\nPaga con \`/pagar-multa ${multa.multaId}\`\nO consulta con \`/multas\``)
        .setTimestamp()] });
    } catch {}
    return;
  }

  // ── MULTAS ──────────────────────────────────────────────────────────────────
  if (cmd === 'multas') {
    const target = interaction.options.getUser('usuario');
    const userId = target ? target.id : interaction.user.id;
    const esPropio = userId === interaction.user.id;

    if (!esPropio && !(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo los agentes pueden ver multas de otros.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: esPropio });

    const ciudadano = await getPlayer(userId, target?.username || interaction.user.username);

    // Multas del bot (pagables con /pagar-multa)
    const multasBot = await Multa.find({ ciudadanoId: userId, pagada: false }).sort({ creadoEn: -1 }).limit(10);

    // Sanciones del dashboard PDA (creadas desde la web)
    let sancionesPda = [];
    try {
      const pdaApi = require('../utils/pdaApi');
      sancionesPda = await pdaApi.getSancionesByDiscordId(userId) || [];
      // Filtrar las que ya están en el bot para no duplicar
      const botIds = new Set(multasBot.map(m => m.multaId));
      sancionesPda = sancionesPda.filter(s => !s.botMultaId || !botIds.has(s.botMultaId));
    } catch {}

    const totalEntradas = multasBot.length + sancionesPda.length;

    if (!totalEntradas) {
      return interaction.editReply({
        embeds: [E.ok('Sin multas pendientes', `✅ **${ciudadano.getFullName()}** no tiene multas pendientes.`)],
      });
    }

    const totalBot = multasBot.reduce((s, m) => s + (m.cantidad || 0), 0);
    const totalPda = sancionesPda.reduce((s, s2) => s + (s2.cantidad || 0), 0);
    const totalFinal = totalBot + totalPda;

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`🚔 Multas de ${ciudadano.getFullName()}`)
      .setThumbnail(ICONS.multa)
      .setTimestamp();

    // Multas bot
    if (multasBot.length) {
      const listaBot = multasBot.map(m =>
        `**${m.multaId}** — ${formatMoney(m.cantidad)}\n> ${m.motivo}\n> _${new Date(m.creadoEn).toLocaleDateString('es-ES')} · ${m.agenteNombre}_`,
      ).join('\n\n');
      embed.addFields({ name: `📋 Multas del servidor (${multasBot.length})`, value: listaBot.slice(0, 900), inline: false });
    }

    // Sanciones PDA/dashboard
    if (sancionesPda.length) {
      const listaPda = sancionesPda.map(s => {
        const fecha = s.fecha ? new Date(s.fecha).toLocaleDateString('es-ES') : 'N/A';
        const tipo  = (s.tipo || 'SANCIÓN').toUpperCase();
        const importe = s.cantidad ? formatMoney(s.cantidad) : 'Sin importe';
        return `**[${tipo}]** — ${importe}\n> ${s.motivo || 'Sin motivo'}\n> _${fecha} · ${s.agente || 'Sistema'}_`;
      }).join('\n\n');
      embed.addFields({ name: `🌐 Sanciones PDA/Dashboard (${sancionesPda.length})`, value: listaPda.slice(0, 900), inline: false });
    }

    embed.addFields({ name: '💰 Total pendiente', value: formatMoney(totalFinal), inline: true });
    embed.setFooter({ text: `Usa /pagar-multa [ID] para multas del servidor · Las PDA se gestionan en el dashboard` });

    return interaction.editReply({ embeds: [embed] });
  }

  // ── PAGAR MULTA ─────────────────────────────────────────────────────────────
  if (cmd === 'pagar-multa') {
    await interaction.deferReply({ ephemeral: true });
    const multaId = interaction.options.getString('id').toUpperCase();
    const multa = await Multa.findOne({ multaId, ciudadanoId: interaction.user.id, pagada: false });

    if (!multa) return interaction.editReply({ embeds: [E.err('No encontrada', 'No tienes esa multa pendiente o ya está pagada.')] });

    const player = await getPlayer(interaction.user.id, interaction.user.username);
    const total = player.cash + player.bank;

    if (total < multa.cantidad) {
      return interaction.editReply({ embeds: [E.err('Fondos insuficientes', `Necesitas ${formatMoney(multa.cantidad)} pero solo tienes ${formatMoney(total)}.`)] });
    }

    // Descontar (primero del cash, luego del banco)
    let restante = multa.cantidad;
    if (player.cash >= restante) { player.cash -= restante; restante = 0; }
    else { restante -= player.cash; player.cash = 0; player.bank -= restante; }

    multa.pagada = true;
    multa.pagadaEn = new Date();
    await multa.save();
    await player.save();

    // Desactivar también la sanción en la PDA dashboard
    try {
      const pdaApi = require('../utils/pdaApi');
      const { Sancion } = require('../database/models/PdaModels');
      const pdaSancion = await Sancion.findOne({ botMultaId: multa.multaId, activa: true });
      if (pdaSancion) await pdaApi.desactivarSancion(pdaSancion._id);
    } catch {}

    return interaction.editReply({
      embeds: [E.ok('Multa pagada', `Pagaste la multa **${multa.multaId}** por ${formatMoney(multa.cantidad)}.\n💵 Cash restante: ${formatMoney(player.cash)} | 🏦 Banco: ${formatMoney(player.bank)}`)],
    });
  }

  // ── CACHEAR ─────────────────────────────────────────────────────────────────
  if (cmd === 'cachear') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede cachear.')], ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    const target    = interaction.options.getUser('usuario');
    const ciudadano = await getPlayer(target.id, target.username);
    const inv       = require('../database/models/Inventory');
    const inventario = await inv.findOne({ discordId: target.id });

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle('🔍 Cacheo Policial')
      .setAuthor({ name: ciudadano.getFullName(), iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(BANNERS.cachear)
      .setDescription(
        inventario?.items?.length
          ? inventario.items.map(i => `${i.emoji || '📦'} **${i.nombre}** x${i.cantidad}${i.tipo === 'arma' ? ' ⚠️ **ARMA**' : i.tipo === 'droga' ? ' 🚨 **DROGA**' : ''}`).join('\n')
          : '*Inventario vacío*',
      )
      .addFields(
        { name: '💵 Cash visible', value: formatMoney(ciudadano.cash), inline: true },
        { name: '🚨 Buscado',      value: ciudadano.buscado ? '⚠️ SÍ' : '✅ No', inline: true },
        { name: '⛓️ Esposado',     value: ciudadano.esposado ? '⛓️ SÍ' : '✅ No', inline: true },
        { name: '🎒 Items',        value: `${inventario?.items?.length || 0} tipos`, inline: true },
      )
      .setFooter({ text: `Cacheado por ${interaction.user.username}  ·  American Island Rp` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── ESCOLTAR ────────────────────────────────────────────────────────────────
  if (cmd === 'escoltar') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede escoltar.')], ephemeral: true });
    }
    const target    = interaction.options.getUser('usuario');
    const agente    = await getPlayer(interaction.user.id, interaction.user.username);
    const ciudadano = await getPlayer(target.id, target.username);

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('👮 ESCOLTANDO')
      .setDescription(`**${agente.getFullName()}** está escoltando a **${ciudadano.getFullName()}**`)
      .addFields(
        { name: '👮 Agente', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🎯 Escoltado', value: `<@${target.id}>`, inline: true },
      )
      .setFooter({ text: 'American Island Rp · Escolta activa' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── CREAR PLACA ─────────────────────────────────────────────────────────────
  if (cmd === 'crear-placa') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo admins pueden crear placas.')], ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    const target  = interaction.options.getUser('usuario');
    const depto   = interaction.options.getString('departamento');
    const rango   = interaction.options.getString('rango');
    const numero  = interaction.options.getString('numero');
    const citizen = await getPlayer(target.id, target.username);

    await Placa.findOneAndUpdate(
      { discordId: target.id },
      { discordId: target.id, nombre: citizen.getFullName(), departamento: depto, rango, numeroPlaca: numero, activa: true, creadoPor: interaction.user.id },
      { upsert: true, new: true },
    );

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('🪪 PLACA CREADA')
      .addFields(
        { name: '👮 Agente', value: citizen.getFullName(), inline: true },
        { name: '🏛️ Departamento', value: depto, inline: true },
        { name: '⭐ Rango', value: rango, inline: true },
        { name: '🔢 Nº Placa', value: numero, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    try { await target.send({ embeds: [embed] }); } catch {}
    return;
  }

  // ── VER PLACA ───────────────────────────────────────────────────────────────
  if (cmd === 'ver-placa') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const placa  = await Placa.findOne({ discordId: target.id, activa: true });

    if (!placa) {
      return interaction.reply({ embeds: [E.err('Sin placa', `<@${target.id}> no tiene placa registrada.`)], ephemeral: true });
    }

    const deptoColors = { LSPD: 0x003f7f, LSCSD: 0x8b4513, LSCFD: 0xcc0000, IAA: 0x1a1a1a, FIB: 0x003366 };
    const deptoEmoji  = { LSPD: '🔵', LSCSD: '🟤', LSCFD: '🔴', IAA: '⚫', FIB: '🟦' };

    const embed = new EmbedBuilder()
      .setColor(deptoColors[placa.departamento] || 0x3b82f6)
      .setTitle(`${deptoEmoji[placa.departamento] || '🪪'} PLACA OFICIAL — ${placa.departamento}`)
      .addFields(
        { name: '👤 Nombre', value: placa.nombre, inline: true },
        { name: '⭐ Rango', value: placa.rango, inline: true },
        { name: '🔢 Nº Placa', value: placa.numeroPlaca, inline: true },
        { name: '🏛️ Departamento', value: placa.departamento, inline: true },
        { name: '✅ Estado', value: placa.activa ? '🟢 Activa' : '🔴 Inactiva', inline: true },
      )
      .setFooter({ text: `American Island Rp · ${placa.departamento}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── VER ID ──────────────────────────────────────────────────────────────────
  if (cmd === 'ver-id') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede verificar IDs.')], ephemeral: true });
    }
    const target    = interaction.options.getUser('usuario');
    const ciudadano = await getPlayer(target.id, target.username);

    if (!ciudadano.personajeCreado) {
      return interaction.reply({ embeds: [E.warn('Sin personaje', 'Ese ciudadano no tiene personaje registrado.')], ephemeral: true });
    }

    // Buscar en PDA si existe
    let pdaData = null;
    try {
      const pdaApi = require('../utils/pdaApi');
      const resultados = await pdaApi.buscarUsuario(ciudadano.getFullName());
      pdaData = resultados?.[0] || null;
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(ciudadano.buscado ? 0xef4444 : ciudadano.peligroso ? 0xf59e0b : 0x22c55e)
      .setTitle('🪪 VERIFICACIÓN DE ID')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👤 Nombre completo', value: ciudadano.getFullName(), inline: true },
        { name: '🎂 Edad', value: `${ciudadano.edad} años`, inline: true },
        { name: '🚨 Buscado', value: ciudadano.buscado ? '⚠️ SÍ — BUSCADO' : '✅ No', inline: true },
        { name: '⚠️ Peligroso', value: ciudadano.peligroso ? '⚠️ SÍ — PELIGROSO' : '✅ No', inline: true },
        { name: '📊 Historial', value: `Arrestos: ${ciudadano.arrestos} | Multas: ${ciudadano.multasRecibidas}`, inline: false },
        pdaData ? { name: '🔗 PDA ID', value: `\`${pdaData.idNumero || 'N/A'}\``, inline: true } : { name: '​', value: '​', inline: false },
      )
      .setFooter({ text: `Verificado por ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── VER LICENCIA ────────────────────────────────────────────────────────────
  if (cmd === 'ver-licencia') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede verificar licencias.')], ephemeral: true });
    }
    const target    = interaction.options.getUser('usuario');
    const ciudadano = await getPlayer(target.id, target.username);

    // Simular sistema de licencias basado en nivel del personaje
    const tieneLicencia = ciudadano.nivel >= 2 && ciudadano.personajeCreado;
    const embed = new EmbedBuilder()
      .setColor(tieneLicencia ? 0x22c55e : 0xef4444)
      .setTitle('🚗 LICENCIA DE CONDUCIR')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👤 Titular', value: ciudadano.getFullName(), inline: true },
        { name: '✅ Estado', value: tieneLicencia ? '🟢 VÁLIDA' : '🔴 NO TIENE / INVÁLIDA', inline: true },
        { name: '📋 Tipo', value: tieneLicencia ? 'Clase B — Vehículo ligero' : 'Sin licencia', inline: true },
      )
      .setFooter({ text: `Verificado por ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── VER PERMISO ─────────────────────────────────────────────────────────────
  if (cmd === 'ver-permiso') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede verificar permisos.')], ephemeral: true });
    }
    const target    = interaction.options.getUser('usuario');
    const ciudadano = await getPlayer(target.id, target.username);

    const inv       = require('../database/models/Inventory');
    const inventario = await inv.findOne({ discordId: target.id });
    const tieneArmaLegal = inventario?.items?.some(i => i.tipo === 'arma' && i.metadata?.legal);
    const tienePermiso   = tieneArmaLegal || (ciudadano.nivel >= 5 && Math.random() > 0.5);

    const embed = new EmbedBuilder()
      .setColor(tienePermiso ? 0x22c55e : 0xef4444)
      .setTitle('🔫 PERMISO DE ARMAS')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👤 Titular', value: ciudadano.getFullName(), inline: true },
        { name: '✅ Estado', value: tienePermiso ? '🟢 VÁLIDO' : '🔴 NO TIENE / ILEGAL', inline: true },
        { name: '🔫 Tipo', value: tienePermiso ? 'Arma corta — Uso personal' : 'Sin permiso', inline: true },
      )
      .setFooter({ text: `Verificado por ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── POLI-DISPO ──────────────────────────────────────────────────────────────
  if (cmd === 'poli-dispo') {
    if (!(await esPolicía(interaction, gc))) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal policial puede cambiar su disponibilidad.')], ephemeral: true });
    }
    const estado = interaction.options.getString('estado');
    const agente = await getPlayer(interaction.user.id, interaction.user.username);

    const estados = {
      disponible:   { label: '✅ Disponible en servicio', color: 0x22c55e },
      no_disponible: { label: '🔴 Fuera de servicio', color: 0xef4444 },
      ocupado:      { label: '🟡 Ocupado / En gestión', color: 0xf59e0b },
      emergencia:   { label: '⚠️ Emergencia activa', color: 0xff0000 },
    };

    const info = estados[estado];
    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle('📡 DISPONIBILIDAD POLICIAL')
      .setDescription(`**${agente.getFullName()}** ha actualizado su disponibilidad.`)
      .addFields({ name: '📊 Estado', value: info.label, inline: true })
      .setFooter({ text: 'American Island Rp · Sistema de Disponibilidad' })
      .setTimestamp();

    // Guardar en player metadata
    agente.cooldowns = agente.cooldowns || new Map();
    agente.cooldowns.set('poli_estado', estado);
    await agente.save();

    return interaction.reply({ embeds: [embed] });
  }

  // ── SOLI-DISPO ──────────────────────────────────────────────────────────────
  if (cmd === 'soli-dispo') {
    await interaction.deferReply();

    // Buscar todos los agentes con placa activa en este servidor
    const placas = await Placa.find({ activa: true });
    if (!placas.length) {
      return interaction.editReply({ embeds: [E.warn('Sin agentes', 'No hay agentes con placa registrada.')] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('📡 DISPONIBILIDAD POLICIAL ACTUAL')
      .setDescription(`${placas.length} agente(s) registrado(s)`)
      .setTimestamp();

    for (const placa of placas.slice(0, 10)) {
      const member = await interaction.guild.members.fetch(placa.discordId).catch(() => null);
      const estado = member ? (member.presence?.status === 'online' ? '🟢 En línea' : member.presence?.status === 'idle' ? '🟡 AFK' : '🔴 Desconectado') : '❓ Desconocido';
      embed.addFields({ name: `${placa.nombre} — ${placa.rango}`, value: `**Departamento:** ${placa.departamento} | **Placa:** ${placa.numeroPlaca} | ${estado}`, inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // ── CURAR ────────────────────────────────────────────────────────────────────
  if (cmd === 'curar') {
    const gc2 = await GuildConfig.findOne({ guildId: interaction.guildId });
    const member = interaction.member;
    const esMedico = member.permissions.has(PermissionFlagsBits.Administrator) ||
      [config.roles.bombero, gc2?.roles?.medico].filter(Boolean).some(r => member.roles.cache.has(r));

    if (!esMedico) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo el personal médico (LSFD/EMT) puede curar.')], ephemeral: true });
    }

    const target    = interaction.options.getUser('usuario');
    const cantidad  = interaction.options.getInteger('cantidad') || 50;
    const paciente  = await getPlayer(target.id, target.username);
    const medico    = await getPlayer(interaction.user.id, interaction.user.username);

    const anterior = paciente.salud;
    paciente.salud = Math.min(100, paciente.salud + cantidad);
    if (paciente.muerto && paciente.salud > 0) {
      paciente.muerto = false;
      paciente.enHospital = false;
    }
    await paciente.save();

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('🏥 CURACIÓN APLICADA')
      .setDescription(`**${medico.getFullName()}** ha curado a **${paciente.getFullName()}**`)
      .addFields(
        { name: '❤️ Salud anterior', value: `${anterior}%`, inline: true },
        { name: '❤️ Salud actual', value: `${paciente.salud}%`, inline: true },
        { name: '💊 HP recuperado', value: `+${cantidad}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    try { await target.send({ embeds: [embed] }); } catch {}
    return;
  }

  // ── AUXILIO ─────────────────────────────────────────────────────────────────
  if (cmd === 'auxilio') {
    const player  = await getPlayer(interaction.user.id, interaction.user.username);
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🚨 ¡AUXILIO! — Llamada de emergencia')
      .setDescription(`**${player.getFullName()}** necesita asistencia médica urgente.`)
      .addFields(
        { name: '👤 Paciente', value: `<@${interaction.user.id}>`, inline: true },
        { name: '❤️ Salud', value: `${player.salud}%`, inline: true },
        { name: '🚑 Servicio', value: 'LSFD — Unidad médica requerida', inline: false },
      )
      .setFooter({ text: 'American Island Rp · Emergencias' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Enviar al canal de emergencias si existe
    try {
      const gc3   = await GuildConfig.findOne({ guildId: interaction.guildId });
      const emCh  = gc3?.canales?.emergencias;
      if (emCh) {
        const ch = await interaction.guild.channels.fetch(emCh).catch(() => null);
        if (ch) await ch.send({ content: `@here 🚨 **LLAMADA DE EMERGENCIA**`, embeds: [embed] });
      }
    } catch {}
    return;
  }

  // ── QUITAR SUCIO (DECOMISAR) — solo último atraco ─────────────────────────
  if (cmd === 'quitar-sucio') {
    if (!(await esPolicía(interaction, gc))) return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo policías pueden decomisar dinero sucio.')], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('usuario');
    const cantidadReq = interaction.options.getInteger('cantidad') || 0;
    const motivo = interaction.options.getString('motivo');
    const ciudadano = await getPlayer(target.id, target.username);
    const agente = await getPlayer(interaction.user.id, interaction.user.username);
    const ultimoBotin = ciudadano?.ultimoAtracoBotin || 0;
    if (!ciudadano || ciudadano.dineroSucio <= 0 || ultimoBotin <= 0) {
      return interaction.editReply({ embeds: [E.warn('Sin botín reciente', `${ciudadano ? ciudadano.getFullName() : target.username} no tiene un atraco reciente con dinero sucio pendiente.${ultimoBotin === 0 && ciudadano?.dineroSucio > 0 ? ' (tiene sucio acumulado pero no del último atraco)' : ''}`)] });
    }
    const maxDecomisable = Math.min(ultimoBotin, ciudadano.dineroSucio);
    const cantidad = cantidadReq <= 0 ? maxDecomisable : Math.min(cantidadReq, maxDecomisable);
    ciudadano.dineroSucio -= cantidad;
    if (cantidad >= ultimoBotin) {
      ciudadano.ultimoAtracoBotin = 0;
      ciudadano.ultimoAtracoFecha = null;
    } else {
      ciudadano.ultimoAtracoBotin -= cantidad;
    }
    await ciudadano.save();
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🧹 Decomiso — Dinero sucio')
      .setThumbnail('https://i.imgur.com/3U9wBG1.png')
      .addFields(
        { name: '👮 Agente', value: `${agente.getFullName()} (<@${interaction.user.id}>)`, inline: true },
        { name: '🎯 Ciudadano', value: `${ciudadano.getFullName()} (<@${target.id}>)`, inline: true },
        { name: '🪪 DNI', value: `\`${require('../utils/embeds').getDNI(target.id)}\``, inline: true },
        { name: '💸 Decomisado', value: `**${formatMoney(cantidad)}**`, inline: true },
        { name: '🧹 Restante sucio', value: formatMoney(ciudadano.dineroSucio), inline: true },
        { name: '📋 Motivo', value: motivo, inline: false },
      )
      .setFooter({ text: `Decomisado por ${agente.getFullName()} • ${new Date().toLocaleTimeString('es-ES')}` })
      .setTimestamp();
    try {
      await target.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🚨 Dinero sucio decomisado').setDescription(`Un agente te ha decomisado **${formatMoney(cantidad)}** de dinero sucio.\n**Motivo:** ${motivo}\n**Agente:** ${agente.getFullName()}`)] }).catch(() => {});
    } catch {}
    return interaction.editReply({ embeds: [embed] });
  }
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'esposar',
    aliases: ['arrestar', 'detener'],
    description: '!esposar @usuario [motivo] — Esposar a un ciudadano',
    async run(message, args) {
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!(await esPolicíaMsg(message, gc))) return message.reply('❌ Sin permisos de agente.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Menciona un usuario. `!esposar @usuario`');
      const motivo = args.slice(1).join(' ') || 'Sin motivo especificado';
      const agente    = await getPlayer(message.author.id, message.author.username);
      const ciudadano = await getPlayer(target.id, target.username);
      ciudadano.esposado = true;
      ciudadano.esposadoPor = message.author.id;
      await ciudadano.save();
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x1a1a2e).setTitle('⛓️ ESPOSADO')
        .setDescription(`**${agente.getFullName()}** ha esposado a **${ciudadano.getFullName()}**\n**Motivo:** ${motivo}`).setTimestamp()] });
    },
  },
  {
    name: 'desesposar',
    aliases: ['liberar', 'soltar'],
    description: '!desesposar @usuario',
    async run(message) {
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!(await esPolicíaMsg(message, gc))) return message.reply('❌ Sin permisos de agente.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Menciona un usuario.');
      const ciudadano = await getPlayer(target.id, target.username);
      ciudadano.esposado = false;
      ciudadano.esposadoPor = null;
      await ciudadano.save();
      await message.channel.send({ embeds: [E.ok('DESESPOSADO', `${ciudadano.getFullName()} ha sido desesposado.`)] });
    },
  },
  {
    name: 'multar',
    description: '!multar @usuario [cantidad] [motivo]',
    async run(message, args) {
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!(await esPolicíaMsg(message, gc))) return message.reply('❌ Sin permisos de agente.');
      const target   = message.mentions.users.first();
      const cantidad = parseInt(args[1]) || 0;
      const motivo   = args.slice(2).join(' ') || 'Sin motivo';
      if (!target || !cantidad) return message.reply('❌ Uso: `!multar @usuario [cantidad] [motivo]`');
      const agente    = await getPlayer(message.author.id, message.author.username);
      const ciudadano = await getPlayer(target.id, target.username);
      const multa = await Multa.create({ ciudadanoId: target.id, ciudadanoNombre: ciudadano.getFullName(), agente: message.author.id, agenteNombre: agente.getFullName(), motivo, cantidad, guildId: message.guild.id });
      ciudadano.multasRecibidas++;
      await ciudadano.save();
      try {
        const pdaApi  = require('../utils/pdaApi');
        const pdaUser = await pdaApi.buscarPorDiscord(target.id).catch(() => null);
        await pdaApi.crearSancion({
          ciudadanoId:        pdaUser?._id?.toString() || target.id,
          ciudadanoDiscordId: target.id,
          ciudadanoNombre:    ciudadano.getFullName(),
          tipo:               'multa',
          motivo,
          descripcion:        motivo,
          agente:             agente.getFullName(),
          agenteDiscordId:    message.author.id,
          cantidad,
          activa:             true,
          botMultaId:         multa.multaId,
        });
      } catch {}
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🚔 MULTA').setDescription(`**${ciudadano.getFullName()}** multado por ${formatMoney(cantidad)}\n**ID:** \`${multa.multaId}\`\n**Motivo:** ${motivo}`).setTimestamp()] });
    },
  },
  {
    name: 'multas',
    description: '!multas [@usuario] — Ver multas',
    async run(message) {
      const target    = message.mentions.users.first() || message.author;
      const multas    = await Multa.find({ ciudadanoId: target.id, pagada: false }).sort({ creadoEn: -1 }).limit(5);
      const ciudadano = await getPlayer(target.id, target.username);

      let sancionesPda = [];
      try {
        const pdaApi = require('../utils/pdaApi');
        sancionesPda = await pdaApi.getSancionesByDiscordId(target.id) || [];
        const botIds = new Set(multas.map(m => m.multaId));
        sancionesPda = sancionesPda.filter(s => !s.botMultaId || !botIds.has(s.botMultaId));
      } catch {}

      if (!multas.length && !sancionesPda.length) {
        return message.reply(`✅ **${ciudadano.getFullName()}** no tiene multas pendientes.`);
      }

      const totalBot = multas.reduce((s, m) => s + m.cantidad, 0);
      const totalPda = sancionesPda.reduce((s, s2) => s + (s2.cantidad || 0), 0);
      const embed = new EmbedBuilder().setColor(0xf59e0b)
        .setTitle(`🚔 Multas de ${ciudadano.getFullName()}`);

      if (multas.length) embed.addFields({ name: '📋 Multas servidor', value: multas.map(m => `\`${m.multaId}\` — ${formatMoney(m.cantidad)}: ${m.motivo}`).join('\n'), inline: false });
      if (sancionesPda.length) embed.addFields({ name: '🌐 Sanciones PDA', value: sancionesPda.map(s => `[${(s.tipo||'multa').toUpperCase()}] ${formatMoney(s.cantidad||0)}: ${s.motivo}`).join('\n'), inline: false });
      embed.addFields({ name: '💰 Total', value: formatMoney(totalBot + totalPda), inline: true });

      await message.reply({ embeds: [embed] });
    },
  },
  {
    name: 'cachear',
    description: '!cachear @usuario — Cachear a un ciudadano',
    async run(message) {
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!(await esPolicíaMsg(message, gc))) return message.reply('❌ Sin permisos de agente.');
      const target    = message.mentions.users.first();
      if (!target) return message.reply('❌ Menciona un usuario.');
      const ciudadano = await getPlayer(target.id, target.username);
      const inv       = require('../database/models/Inventory');
      const inventario = await inv.findOne({ discordId: target.id });
      const items = inventario?.items?.length ? inventario.items.map(i => `${i.emoji || '📦'} **${i.nombre}** x${i.cantidad}${i.tipo === 'arma' ? ' ⚠️ **ARMA**' : i.tipo === 'droga' ? ' 🚨 **DROGA**' : ''}`).join('\n') : '*Inventario vacío*';
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x1a1a2e)
          .setTitle('🔍 Cacheo Policial')
          .setAuthor({ name: ciudadano.getFullName(), iconURL: target.displayAvatarURL({ dynamic: true }) })
          .setThumbnail(BANNERS.cachear)
          .setDescription(items)
          .addFields(
            { name: '💵 Cash visible', value: formatMoney(ciudadano.cash), inline: true },
            { name: '🚨 Buscado', value: ciudadano.buscado ? '⚠️ SÍ' : '✅ No', inline: true },
            { name: '⛓️ Esposado', value: ciudadano.esposado ? '⛓️ SÍ' : '✅ No', inline: true },
            { name: '🎒 Items', value: `${inventario?.items?.length || 0} tipos`, inline: true },
          )
          .setFooter({ text: `Cacheado por ${message.author.username}  ·  American Island Rp` })
          .setTimestamp()],
      });
    },
  },
  {
    name: 'auxilio',
    description: '!auxilio — Llamar al LSFD',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🚨 ¡AUXILIO!')
        .setDescription(`**${player.getFullName()}** necesita asistencia médica urgente.\n❤️ Salud: ${player.salud}%`).setTimestamp()] });
    },
  },
  {
    name: 'curar',
    description: '!curar @usuario [hp] — Curar a un ciudadano (EMT)',
    async run(message, args) {
      const target   = message.mentions.users.first();
      const cantidad = parseInt(args[1]) || 50;
      if (!target) return message.reply('❌ Menciona un usuario.');
      const medico   = await getPlayer(message.author.id, message.author.username);
      const paciente = await getPlayer(target.id, target.username);
      paciente.salud = Math.min(100, paciente.salud + cantidad);
      if (paciente.muerto) { paciente.muerto = false; paciente.enHospital = false; }
      await paciente.save();
      await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('🏥 CURACIÓN')
        .setDescription(`**${medico.getFullName()}** ha curado a **${paciente.getFullName()}** +${cantidad} HP (${paciente.salud}%)`).setTimestamp()] });
    },
  },
  {
    name: 'soli-dispo',
    aliases: ['disponibilidad', 'dispo'],
    description: '!soli-dispo — Ver disponibilidad policial',
    async run(message) {
      const placas = await Placa.find({ activa: true });
      if (!placas.length) return message.reply('No hay agentes con placa registrada.');
      const embed = new EmbedBuilder().setColor(0x3b82f6).setTitle('📡 Disponibilidad Policial')
        .setDescription(placas.map(p => `👮 **${p.nombre}** — ${p.rango} (${p.departamento})`).join('\n')).setTimestamp();
      await message.reply({ embeds: [embed] });
    },
  },
  {
    name: 'quitar-sucio',
    aliases: ['decomisar', 'confiscar'],
    description: '!quitar-sucio @usuario [cantidad|0=todo] [motivo] — Quitar dinero sucio',
    async run(message, args) {
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!(await esPolicíaMsg(message, gc))) return message.reply('❌ Sin permisos de agente.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Menciona un usuario. Ej: `!quitar-sucio @usuario 500 motivo`');
      let cantidad = parseInt(args[1]);
      let motivo = args.slice(2).join(' ');
      if (isNaN(cantidad)) { cantidad = 0; motivo = args.slice(1).join(' ') || 'Decomiso policial'; }
      if (!motivo) motivo = 'Decomiso policial';
      const ciudadano = await getPlayer(target.id, target.username);
      const agente = await getPlayer(message.author.id, message.author.username);
      const ultimoBotin = ciudadano?.ultimoAtracoBotin || 0;
      if (!ciudadano || ciudadano.dineroSucio <= 0 || ultimoBotin <= 0) return message.reply(`✅ **${ciudadano ? ciudadano.getFullName() : target.username}** no tiene un atraco reciente con dinero sucio pendiente.${ultimoBotin === 0 && ciudadano?.dineroSucio > 0 ? ' (tiene sucio acumulado pero no del último atraco)' : ''}`);
      const maxDecomisable = Math.min(ultimoBotin, ciudadano.dineroSucio);
      const cant = cantidad <= 0 ? maxDecomisable : Math.min(cantidad, maxDecomisable);
      ciudadano.dineroSucio -= cant;
      if (cant >= ultimoBotin) { ciudadano.ultimoAtracoBotin = 0; ciudadano.ultimoAtracoFecha = null; } else { ciudadano.ultimoAtracoBotin -= cant; }
      await ciudadano.save();
      const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🧹 Decomiso — Dinero sucio').setThumbnail('https://i.imgur.com/3U9wBG1.png')
        .addFields(
          { name: '👮 Agente', value: agente.getFullName(), inline: true },
          { name: '🎯 Ciudadano', value: ciudadano.getFullName(), inline: true },
          { name: '💸 Decomisado', value: formatMoney(cant), inline: true },
          { name: '🧹 Restante sucio', value: formatMoney(ciudadano.dineroSucio), inline: true },
          { name: '📋 Motivo', value: motivo, inline: false },
        ).setTimestamp();
      try { await target.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🚨 Dinero sucio decomisado').setDescription(`Un agente te ha decomisado **${formatMoney(cant)}**.\n**Motivo:** ${motivo}\n**Agente:** ${agente.getFullName()}`)] }).catch(() => {}); } catch {}
      await message.reply({ embeds: [embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands };
