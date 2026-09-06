/**
 * MECÁNICO — Sistema de mecánicos y reparaciones
 * Slash: /reparar /factura /taximetro-on /taximetro-off
 * Prefix: !reparar !factura !taximetro-on !taximetro-off
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, formatMoney, rand } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const Sesion = require('../database/models/Sesion');

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
];

// Almacén temporal de facturas (en producción usar BD)
const facturasTmp = new Map();
let facturaCounter = 1;

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

    const factId = `FAC-REP-${String(facturaCounter++).padStart(4, '0')}`;
    facturasTmp.set(factId, { clienteId: cliente.id, monto: precio, tipo: 'reparacion', pagada: false });

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('🔧 REPARACIÓN — Taller Mecánico')
      .addFields(
        { name: '🔑 ID Factura', value: `\`${factId}\``, inline: true },
        { name: '👨‍🔧 Mecánico', value: mecanicoName, inline: true },
        { name: '👤 Cliente', value: clientePlayer.getFullName(), inline: true },
        { name: '🔧 Descripción', value: descripcion, inline: false },
        { name: '💰 Precio', value: formatMoney(precio), inline: true },
      )
      .setFooter({ text: `El cliente paga con /pagar-factura ${factId}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    try {
      await cliente.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🔧 Factura de taller recibida')
        .setDescription(`**${mecanicoName}** ha reparado tu vehículo.\n\n**${descripcion}**\n\n💰 **Total:** ${formatMoney(precio)}\n🔑 **ID:** \`${factId}\`\n\nPaga con \`/pagar-factura ${factId}\``)
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

    const factId = `FAC-${String(facturaCounter++).padStart(4, '0')}`;
    facturasTmp.set(factId, { clienteId: cliente.id, monto: importe, tipo: 'factura', emisorId: interaction.user.id, pagada: false });

    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(`📄 FACTURA — ${negocio}`)
      .addFields(
        { name: '🔑 ID Factura', value: `\`${factId}\``, inline: true },
        { name: '🏢 Emisor', value: negocio, inline: true },
        { name: '👤 Cliente', value: clientePlayer.getFullName(), inline: true },
        { name: '📋 Concepto', value: concepto, inline: false },
        { name: '💰 Importe', value: formatMoney(importe), inline: true },
      )
      .setFooter({ text: `Pagar: /pagar-factura ${factId}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    try {
      await cliente.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`📄 Nueva factura de ${negocio}`)
        .setDescription(`**Concepto:** ${concepto}\n**Importe:** ${formatMoney(importe)}\n**ID:** \`${factId}\`\n\nPaga con \`/pagar-factura ${factId}\``)
        .setTimestamp()] });
    } catch {}
    return;
  }

  // ── PAGAR FACTURA ──────────────────────────────────────────────────────────
  if (cmd === 'pagar-factura') {
    await interaction.deferReply({ ephemeral: true });
    const factId = interaction.options.getString('id').toUpperCase();
    const factura = facturasTmp.get(factId);

    if (!factura || factura.clienteId !== interaction.user.id) {
      return interaction.editReply({ embeds: [E.err('No encontrada', 'No tienes esa factura pendiente.')] });
    }
    if (factura.pagada) {
      return interaction.editReply({ embeds: [E.warn('Ya pagada', 'Esta factura ya fue pagada.')] });
    }

    const total = player.cash + player.bank;
    if (total < factura.monto) {
      return interaction.editReply({ embeds: [E.err('Sin fondos', `Necesitas ${formatMoney(factura.monto)} pero tienes ${formatMoney(total)}.`)] });
    }

    let restante = factura.monto;
    if (player.cash >= restante) { player.cash -= restante; restante = 0; }
    else { restante -= player.cash; player.cash = 0; player.bank -= restante; }
    await player.save();

    // Reparto: 65% creador, 20% eliminado (piezas), 15% Banco del Estado
    const montoTotal = factura.monto;
    const paraEmisor = Math.floor(montoTotal * 0.65);
    const paraPiezas = Math.floor(montoTotal * 0.20);
    const paraEstado = montoTotal - paraEmisor - paraPiezas; // 15% restante
    if (factura.emisorId) {
      const emisor = await getPlayer(factura.emisorId, 'emisor');
      emisor.cash += paraEmisor;
      await emisor.save();
    }
    // 20% se elimina (no se asigna a nadie, es coste de piezas)
    // 15% al Banco del Estado
    try {
      const BancoEstado = require('../database/models/BancoEstado');
      await BancoEstado.findOneAndUpdate(
        { guildId: interaction.guildId },
        { $inc: { saldo: paraEstado, totalRecaudado: paraEstado }, $setOnInsert: { guildId: interaction.guildId } },
        { upsert: true }
      );
    } catch {}

    factura.pagada = true;
    facturasTmp.set(factId, factura);

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Factura pagada')
      .setDescription(`Pagaste \`${factId}\` por ${formatMoney(factura.monto)}.`)
      .addFields(
        { name: '👤 Creador (65%)', value: formatMoney(paraEmisor), inline: true },
        { name: '🔧 Piezas (20%)', value: `Eliminado ${formatMoney(paraPiezas)}`, inline: true },
        { name: '🏦 Estado (15%)', value: formatMoney(paraEstado), inline: true },
      ).setTimestamp()] });
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

module.exports = { data, execute, prefixCommands };
