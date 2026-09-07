/**
 * MECÁNICO — Sistema de mecánicos y facturas con bloqueo económico
 * Slash: /reparar /factura /taximetro-on /taximetro-off /pagar-factura /factura-lista
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getPlayer, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const Sesion = require('../database/models/Sesion');
const Factura = require('../database/models/Factura');

const data = [
  new SlashCommandBuilder()
    .setName('reparar')
    .setDescription('[MECÁNICO] Reparar el vehículo de un cliente')
    .addUserOption(o => o.setName('cliente').setDescription('Cliente cuyo coche reparar').setRequired(true))
    .addStringOption(o => o.setName('descripcion').setDescription('Descripción de la reparación').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('precio').setDescription('Precio de la reparación').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('factura')
    .setDescription('[NEGOCIO] Emitir una factura a un cliente')
    .addUserOption(o => o.setName('cliente').setDescription('Cliente al que facturar').setRequired(true))
    .addStringOption(o => o.setName('concepto').setDescription('Concepto de la factura').setRequired(true).setMaxLength(200))
    .addIntegerOption(o => o.setName('importe').setDescription('Importe de la factura').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('negocio').setDescription('Nombre del negocio/empresa').setRequired(false).setMaxLength(100)),

  new SlashCommandBuilder()
    .setName('taximetro-on')
    .setDescription('[TAXI] Activar el taxímetro — Iniciar viaje'),

  new SlashCommandBuilder()
    .setName('taximetro-off')
    .setDescription('[TAXI] Desactivar el taxímetro — Fin de viaje')
    .addUserOption(o => o.setName('pasajero').setDescription('Pasajero a cobrar').setRequired(false)),

  new SlashCommandBuilder()
    .setName('pagar-factura')
    .setDescription('Pagar una factura pendiente')
    .addStringOption(o => o.setName('id').setDescription('ID de la factura').setRequired(true)),

  new SlashCommandBuilder()
    .setName('factura-lista')
    .setDescription('Ver facturas pendientes y pagadas de un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar (vacío = tú mismo)').setRequired(false)),
];

// Helper: tiene facturas pendientes?
async function tieneFacturasPendientes(discordId) {
  const count = await Factura.countDocuments({ clienteId: discordId, pagada: false });
  return count > 0;
}
async function getFacturasPendientes(discordId) {
  return Factura.find({ clienteId: discordId, pagada: false }).sort({ creadoEn: -1 }).lean();
}

// Pagar factura interna (usada por slash y botones)
async function pagarFacturaInternal(facturaId, pagadorInteractionOrUser, guildId) {
  const factura = await Factura.findOne({ facturaId: facturaId.toUpperCase() });
  if (!factura) return { ok: false, error: 'Factura no encontrada.' };
  if (factura.pagada) return { ok: false, error: 'Esta factura ya fue pagada.' };

  const pagadorId = pagadorInteractionOrUser.id || pagadorInteractionOrUser.user?.id;
  // Solo el cliente o admin puede pagar? Por ahora solo cliente
  if (factura.clienteId !== pagadorId) return { ok: false, error: 'No eres el titular de esta factura.' };

  const player = await getPlayer(pagadorId, pagadorInteractionOrUser.username || pagadorInteractionOrUser.user?.username);
  const total = (player.cash || 0) + (player.bank || 0);
  if (total < factura.importe) {
    return { ok: false, error: `Necesitas ${formatMoney(factura.importe)} pero tienes ${formatMoney(total)} (cash + banco).` };
  }

  let restante = factura.importe;
  if (player.cash >= restante) { player.cash -= restante; restante = 0; }
  else { restante -= player.cash; player.cash = 0; player.bank -= restante; }
  await player.save();

  // Reparto: 65% creador, 20% eliminado (piezas), 15% Banco del Estado
  const montoTotal = factura.importe;
  const paraEmisor = Math.floor(montoTotal * 0.65);
  const paraPiezas = Math.floor(montoTotal * 0.20);
  const paraEstado = montoTotal - paraEmisor - paraPiezas;
  if (factura.emisorId) {
    const emisor = await getPlayer(factura.emisorId, 'emisor');
    emisor.cash += paraEmisor;
    await emisor.save();
  }
  try {
    const BancoEstado = require('../database/models/BancoEstado');
    await BancoEstado.findOneAndUpdate(
      { guildId: guildId || factura.guildId },
      { $inc: { saldo: paraEstado, totalRecaudado: paraEstado }, $setOnInsert: { guildId: guildId || factura.guildId } },
      { upsert: true }
    );
  } catch {}

  factura.pagada = true;
  factura.pagadaEn = new Date();
  await factura.save();

  return { ok: true, factura, paraEmisor, paraPiezas, paraEstado, player };
}

async function execute(interaction, client) {
  const cmd = interaction.commandName;
  const player = await getPlayer(interaction.user.id, interaction.user.username);

  if (!player.personajeCreado) {
    return interaction.reply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje.')], ephemeral: true });
  }

  // ── REPARAR ────────────────────────────────────────────────────────────────
  if (cmd === 'reparar') {
    const cliente      = interaction.options.getUser('cliente');
    const descripcion  = interaction.options.getString('descripcion');
    const precio       = interaction.options.getInteger('precio');
    const mecanicoName = player.getFullName();
    const clientePlayer = await getPlayer(cliente.id, cliente.username);

    const factura = await Factura.create({
      clienteId: cliente.id,
      clienteNombre: clientePlayer.getFullName(),
      emisorId: interaction.user.id,
      emisorNombre: mecanicoName,
      negocio: 'Taller Mecánico',
      concepto: descripcion,
      importe: precio,
      tipo: 'reparacion',
      guildId: interaction.guildId,
    });

    const factId = factura.facturaId;

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('🔧 REPARACIÓN — Taller Mecánico')
      .addFields(
        { name: '🔑 ID Factura', value: `\`${factId}\``, inline: true },
        { name: '👨‍🔧 Mecánico', value: mecanicoName, inline: true },
        { name: '👤 Cliente', value: `${clientePlayer.getFullName()} (<@${cliente.id}>)`, inline: true },
        { name: '🔧 Descripción', value: descripcion, inline: false },
        { name: '💰 Precio', value: formatMoney(precio), inline: true },
      )
      .setFooter({ text: `El cliente paga con /pagar-factura ${factId}` })
      .setTimestamp();

    // Mensaje público con ping + instrucciones
    await interaction.reply({ content: `<@${cliente.id}> 🔔 **Tienes una nueva factura** — Debes pagar con \`/pagar-factura ${factId}\``, embeds: [embed] });

    try {
      await cliente.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🔧 Factura de taller recibida')
        .setDescription(`**${mecanicoName}** ha reparado tu vehículo.\n\n**${descripcion}**\n\n💰 **Total:** ${formatMoney(precio)}\n🔑 **ID:** \`${factId}\`\n\n⚠️ **Quedas bloqueado** para transferir/pagar a otros hasta saldar tus facturas.\nPaga con \`/pagar-factura ${factId}\` o usa \`/factura-lista\``)
        .setTimestamp()] });
    } catch {}
    return;
  }

  // ── FACTURA ────────────────────────────────────────────────────────────────
  if (cmd === 'factura') {
    const cliente  = interaction.options.getUser('cliente');
    const concepto = interaction.options.getString('concepto');
    const importe  = interaction.options.getInteger('importe');
    const negocio  = interaction.options.getString('negocio') || player.getFullName();
    const clientePlayer = await getPlayer(cliente.id, cliente.username);

    const factura = await Factura.create({
      clienteId: cliente.id,
      clienteNombre: clientePlayer.getFullName(),
      emisorId: interaction.user.id,
      emisorNombre: player.getFullName(),
      negocio,
      concepto,
      importe,
      tipo: 'factura',
      guildId: interaction.guildId,
    });

    const factId = factura.facturaId;

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`📄 FACTURA — ${negocio}`)
      .addFields(
        { name: '🔑 ID Factura', value: `\`${factId}\``, inline: true },
        { name: '🏢 Emisor', value: negocio, inline: true },
        { name: '👨‍🔧 Creada por', value: player.getFullName(), inline: true },
        { name: '👤 Cliente', value: `${clientePlayer.getFullName()} (<@${cliente.id}>)`, inline: true },
        { name: '📋 Concepto', value: concepto, inline: false },
        { name: '💰 Importe', value: formatMoney(importe), inline: true },
      )
      .setFooter({ text: `Pagar: /pagar-factura ${factId} — Quedarás bloqueado hasta pagar` })
      .setTimestamp();

    await interaction.reply({ content: `<@${cliente.id}> 📄 **Nueva factura de ${negocio}** — Debes pagar con \`/pagar-factura ${factId}\` (\`/factura-lista\` para ver)`, embeds: [embed] });

    try {
      await cliente.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`📄 Nueva factura de ${negocio}`)
        .setDescription(`**Concepto:** ${concepto}\n**Importe:** ${formatMoney(importe)}\n**ID:** \`${factId}\`\n**Emisor:** ${player.getFullName()}\n\n⚠️ **Quedas bloqueado** para transferencias/pagos hasta saldarla.\nPaga con \`/pagar-factura ${factId}\` o \`/factura-lista\``)
        .setTimestamp()] });
    } catch {}
    return;
  }

  // ── PAGAR FACTURA ──────────────────────────────────────────────────────────
  if (cmd === 'pagar-factura') {
    await interaction.deferReply({ ephemeral: true });
    const factId = interaction.options.getString('id').toUpperCase();
    const res = await pagarFacturaInternal(factId, interaction.user, interaction.guildId);
    if (!res.ok) return interaction.editReply({ embeds: [E.err('Error', res.error)] });

    const { factura, paraEmisor, paraPiezas, paraEstado } = res;
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Factura pagada')
      .setDescription(`Pagaste \`${factura.facturaId}\` por ${formatMoney(factura.importe)}.`)
      .addFields(
        { name: '👨‍🔧 Mecánico/Trabajador (65%)', value: formatMoney(paraEmisor), inline: true },
        { name: '🔧 Piezas (20%)', value: `Eliminado ${formatMoney(paraPiezas)}`, inline: true },
        { name: '🏦 Estado (15%)', value: formatMoney(paraEstado), inline: true },
      ).setTimestamp()] });
  }

  // ── FACTURA-LISTA ─────────────────────────────────────────────────────────
  if (cmd === 'factura-lista') {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const targetId = targetUser.id;
    const targetPlayer = await getPlayer(targetId, targetUser.username);

    const pendientes = await Factura.find({ clienteId: targetId, pagada: false }).sort({ creadoEn: -1 }).lean();
    const pagadas = await Factura.find({ clienteId: targetId, pagada: true }).sort({ pagadaEn: -1 }).limit(10).lean();

    const saldoBanco = targetPlayer.bank || 0;
    const saldoCash = targetPlayer.cash || 0;
    const total = saldoBanco + saldoCash;
    const bloqueado = pendientes.length > 0;

    const embed = new EmbedBuilder()
      .setColor(bloqueado ? 0xef4444 : 0x22c55e)
      .setTitle(`📄 Facturas — ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `**Titular:** <@${targetId}> — ${targetPlayer.getFullName()}\n` +
        `**Estado:** ${bloqueado ? '🔴 **BLOQUEADO** — Tiene facturas pendientes' : '🟢 Sin bloqueos'}\n` +
        `**Facturas pendientes:** ${pendientes.length} · **Pagadas:** ${pagadas.length}`
      )
      .addFields(
        { name: '🏦 Saldo banco', value: formatMoney(saldoBanco), inline: true },
        { name: '💵 Cash', value: formatMoney(saldoCash), inline: true },
        { name: '💰 Total', value: `**${formatMoney(total)}**`, inline: true },
      )
      .setTimestamp();

    if (pendientes.length) {
      const list = pendientes.slice(0,5).map(f => 
        `\`${f.facturaId}\` — **${formatMoney(f.importe)}** — ${f.concepto} — 👨‍🔧 ${f.emisorNombre || f.negocio} — <t:${Math.floor(new Date(f.creadoEn).getTime()/1000)}:R>`
      ).join('\n');
      const resto = pendientes.length > 5 ? `\n*...y ${pendientes.length-5} más*` : '';
      embed.addFields({ name: `🔴 Pendientes (${pendientes.length}) — Usa /pagar-factura ID`, value: list + resto, inline: false });
      // Total pendiente
      const totalPendiente = pendientes.reduce((a,b)=>a+b.importe,0);
      embed.addFields({ name: '💸 Total a pagar', value: `**${formatMoney(totalPendiente)}**`, inline: true });
    } else {
      embed.addFields({ name: '🔴 Pendientes', value: '*No tienes facturas pendientes — ¡Estás libre de bloqueos!*', inline: false });
    }

    if (pagadas.length) {
      const listPag = pagadas.map(f => 
        `\`${f.facturaId}\` — **${formatMoney(f.importe)}** — ${f.concepto} — 👨‍🔧 ${f.emisorNombre} (${f.negocio}) — pagada <t:${Math.floor(new Date(f.pagadaEn).getTime()/1000)}:R>`
      ).join('\n');
      embed.addFields({ name: `✅ Pagadas (últimas ${pagadas.length})`, value: listPag.slice(0,1024), inline: false });
    } else {
      embed.addFields({ name: '✅ Pagadas', value: '*Aún no has pagado ninguna factura*', inline: false });
    }
    embed.setFooter({ text: `ID para pagar: /pagar-factura [ID] · Saldo banco: ${formatMoney(saldoBanco)}` });

    // Botones para pagar pendientes (máx 5 por fila, 25 total — aquí mostramos 5)
    const components = [];
    if (pendientes.length) {
      const row = new ActionRowBuilder();
      for (let i=0; i<Math.min(pendientes.length, 5); i++) {
        const f = pendientes[i];
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`factura_pagar_${f.facturaId}`)
            .setLabel(`Pagar ${f.facturaId} (${formatMoney(f.importe).replace('$','')})`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('💳')
        );
      }
      components.push(row);
    }

    return interaction.editReply({ embeds: [embed], components });
  }

  // ── TAXÍMETRO ON ──────────────────────────────────────────────────────────
  if (cmd === 'taximetro-on') {
    const sesionActiva = await Sesion.findOne({ discordId: interaction.user.id, tipo: 'taximetro', activa: true });
    if (sesionActiva) {
      return interaction.reply({ embeds: [E.warn('Ya activo', 'Tu taxímetro ya está encendido.')] });
    }

    await Sesion.create({ discordId: interaction.user.id, tipo: 'taximetro', activa: true, datos: { inicioMs: Date.now() } });

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('🚕 TAXÍMETRO — ENCENDIDO')
      .setDescription(`**${player.getFullName()}** ha iniciado el taxímetro.\n\n_Cuando termines el viaje usa \`/taximetro-off\` para calcular el precio._`)
      .addFields({ name: '⏰ Inicio', value: new Date().toLocaleTimeString('es-ES'), inline: true })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── TAXÍMETRO OFF ─────────────────────────────────────────────────────────
  if (cmd === 'taximetro-off') {
    const sesion = await Sesion.findOne({ discordId: interaction.user.id, tipo: 'taximetro', activa: true });
    if (!sesion) {
      return interaction.reply({ embeds: [E.warn('Sin sesión', 'No tienes el taxímetro encendido.')] });
    }

    const pasajero = interaction.options.getUser('pasajero');
    const duracionMs = Date.now() - sesion.datos.inicioMs;
    const duracionMin = Math.max(1, Math.floor(duracionMs / 60000));

    // Precio: $100 base + $25/min
    const precio = 100 + (duracionMin * 25);

    sesion.activa = false;
    await sesion.save();

    // Cobrar al pasajero si se especificó
    if (pasajero) {
      const pasajeroPlayer = await getPlayer(pasajero.id, pasajero.username);
      if (pasajeroPlayer.cash >= precio) {
        pasajeroPlayer.cash -= precio;
        player.cash += precio;
        await pasajeroPlayer.save();
        await player.save();
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('🚕 TAXÍMETRO — APAGADO')
      .addFields(
        { name: '⏱️ Duración', value: `${duracionMin} minuto(s)`, inline: true },
        { name: '💰 Tarifa', value: formatMoney(precio), inline: true },
        pasajero ? { name: '👤 Pasajero', value: `<@${pasajero.id}>`, inline: true } : { name: '​', value: '​', inline: false },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

// Handler para botones factura_pagar_*
async function handleFacturaButton(interaction, client) {
  if (!interaction.customId.startsWith('factura_pagar_')) return false;
  const facturaId = interaction.customId.replace('factura_pagar_', '');
  await interaction.deferReply({ ephemeral: true });
  const res = await pagarFacturaInternal(facturaId, interaction.user, interaction.guildId);
  if (!res.ok) {
    await interaction.editReply({ embeds: [E.err('Error', res.error)] });
    return true;
  }
  const { factura, paraEmisor } = res;
  await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Factura pagada (botón)')
    .setDescription(`Pagaste \`${factura.facturaId}\` por ${formatMoney(factura.importe)}.\nMecánico: **${factura.emisorNombre}**`)
    .setTimestamp()] });
  return true;
}

const prefixCommands = [
  { name: 'taximetro-on', aliases: ['taximetro'], description: '!taximetro-on — Encender taxímetro', async run(message) {
    await Sesion.create({ discordId: message.author.id, tipo: 'taximetro', activa: true, datos: { inicioMs: Date.now() } }).catch(() => {});
    await message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('🚕 Taxímetro encendido').setTimestamp()] });
  }},
  { name: 'taximetro-off', description: '!taximetro-off [@pasajero] — Apagar taxímetro', async run(message) {
    const sesion = await Sesion.findOne({ discordId: message.author.id, tipo: 'taximetro', activa: true });
    if (!sesion) return message.reply('No tienes el taxímetro encendido.');
    const duracionMs = Date.now() - sesion.datos.inicioMs;
    const duracionMin = Math.max(1, Math.floor(duracionMs / 60000));
    const precio = 100 + (duracionMin * 25);
    sesion.activa = false;
    await sesion.save();
    await message.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🚕 Taxímetro apagado')
      .addFields({ name: '⏱️ Duración', value: `${duracionMin} min`, inline: true }, { name: '💰 Tarifa', value: formatMoney(precio), inline: true }).setTimestamp()] });
  }},
];

module.exports = { data, execute, prefixCommands, handleFacturaButton, tieneFacturasPendientes, pagarFacturaInternal };
