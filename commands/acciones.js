/**
 * ACCIONES — Comandos de interacción física RP
 * Slash: /caballito /brazos /arrastrar /puertas /capo /maletero /ventanillas /llamar /secuestrar
 * Prefix: !caballito !brazos !arrastrar !puertas !capo !maletero !ventanillas !llamar
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');

const data = [
  new SlashCommandBuilder()
    .setName('caballito')
    .setDescription('Llevar a alguien a caballito')
    .addUserOption(o => o.setName('usuario').setDescription('Persona a llevar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('brazos')
    .setDescription('Llevar a alguien en brazos')
    .addUserOption(o => o.setName('usuario').setDescription('Persona a llevar').setRequired(true)),

  new SlashCommandBuilder()
    .setName('arrastrar')
    .setDescription('Arrastrar a un inconsciente')
    .addUserOption(o => o.setName('usuario').setDescription('Persona a arrastrar').setRequired(true)),

  // new SlashCommandBuilder()
  //   .setName('coche')
  //   .setDescription('Interactuar con partes del vehículo (puertas, capó, maletero, ventanillas)')
  //   .addStringOption(o => o.setName('parte').setDescription('Parte del vehículo').setRequired(true)
  //     .addChoices(
  //       { name: '🚪 Puertas',      value: 'puertas' },
  //       { name: '🔧 Capó',         value: 'capo' },
  //       { name: '📦 Maletero',     value: 'maletero' },
  //       { name: '🪟 Ventanillas',  value: 'ventanillas' },
  //     ))
  //   .addStringOption(o => o.setName('accion').setDescription('Acción').setRequired(false)
  //     .addChoices({ name: 'Abrir', value: 'abrir' }, { name: 'Cerrar', value: 'cerrar' })),
  // ],

  new SlashCommandBuilder()
    .setName('llamar')
    .setDescription('Hacer una llamada de teléfono a un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Persona a la que llamar').setRequired(true))
    .addStringOption(o => o.setName('mensaje').setDescription('Mensaje de la llamada').setRequired(false).setMaxLength(300)),

  new SlashCommandBuilder()
    .setName('talar')
    .setDescription('[TRABAJO] Talar madera (trabajo de leñador)')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad de troncos a talar').setRequired(false).setMinValue(1).setMaxValue(20)),

  new SlashCommandBuilder()
    .setName('picar')
    .setDescription('[TRABAJO] Picar piedra (trabajo de minero)')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad de piedra a picar').setRequired(false).setMinValue(1).setMaxValue(20)),

  new SlashCommandBuilder()
    .setName('sacar-coche')
    .setDescription('Sacar un coche del garaje')
    .addStringOption(o => o.setName('matricula').setDescription('Matrícula del coche').setRequired(false)),

  new SlashCommandBuilder()
    .setName('guardar-coche')
    .setDescription('Guardar un coche en el garaje')
    .addStringOption(o => o.setName('matricula').setDescription('Matrícula del coche').setRequired(false)),
];

async function execute(interaction, client) {
  const cmd = interaction.commandName;
  const player = await getPlayer(interaction.user.id, interaction.user.username);

  if (!player.personajeCreado) {
    return interaction.reply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje.')], ephemeral: true });
  }

  // ── Acciones con otro usuario ─────────────────────────────────────────────
  if (['caballito', 'brazos', 'arrastrar'].includes(cmd)) {
    const target  = interaction.options.getUser('usuario');
    const victima = await getPlayer(target.id, target.username);

    const descripciones = {
      caballito: `**${player.getFullName()}** lleva a caballito a **${victima.getFullName()}** 🏇`,
      brazos:    `**${player.getFullName()}** lleva en brazos a **${victima.getFullName()}** 🤝`,
      arrastrar: `**${player.getFullName()}** arrastra el cuerpo inconsciente de **${victima.getFullName()}** a través del suelo 😵`,
    };

    const embed = new EmbedBuilder()
      .setColor(config.colors.dark)
      .setDescription(`*${descripciones[cmd]}*`)
      .setAuthor({ name: `ACCIÓN | ${player.getFullName()}` })
      .addFields({ name: '🎯 Objetivo', value: `<@${target.id}>`, inline: true })
      .setFooter({ text: 'American Island Rp RP' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── Interacción de vehículo (/coche) ─────────────────────────────────────
  if (cmd === 'coche') {
    const parte  = interaction.options.getString('parte');
    const accion = interaction.options.getString('accion') || 'abrir';
    const partes = { puertas: 'las puertas del coche', capo: 'el capó', maletero: 'el maletero', ventanillas: 'las ventanillas' };

    const embed = new EmbedBuilder()
      .setColor(config.colors.dark)
      .setDescription(`*${player.getFullName()} ${accion === 'abrir' ? 'abre' : 'cierra'} ${partes[parte] || parte}.*`)
      .setAuthor({ name: `VEHÍCULO | ${player.getFullName()}` })
      .setFooter({ text: 'American Island Rp RP' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── LLAMAR ────────────────────────────────────────────────────────────────
  if (cmd === 'llamar') {
    const target   = interaction.options.getUser('usuario');
    const mensaje  = interaction.options.getString('mensaje') || '...';
    const receptor = await getPlayer(target.id, target.username);

    const callEmbed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('📞 LLAMADA ENTRANTE')
      .setDescription(`**${player.getFullName()}** te está llamando.`)
      .addFields({ name: '💬 Mensaje', value: mensaje })
      .setTimestamp();

    const rpEmbed = new EmbedBuilder()
      .setColor(config.colors.dark)
      .setDescription(`*📞 **${player.getFullName()}** llama a **${receptor.getFullName()}**: "${mensaje}"*`)
      .setAuthor({ name: `LLAMADA | ${player.getFullName()}` })
      .setFooter({ text: 'American Island Rp RP' })
      .setTimestamp();

    await interaction.reply({ embeds: [rpEmbed] });
    try { await target.send({ embeds: [callEmbed] }); } catch {}
    return;
  }

  // ── TALAR ─────────────────────────────────────────────────────────────────
  if (cmd === 'talar') {
    const { formatMoney, rand } = require('../utils/helpers');
    const Inventory = require('../database/models/Inventory');

    const last = player.getCooldown('talar');
    const cooldownMs = 15 * 60 * 1000;
    if (last && (last.getTime() + cooldownMs > Date.now())) {
      const restante = last.getTime() + cooldownMs - Date.now();
      const { formatCooldown } = require('../utils/helpers');
      return interaction.reply({ embeds: [E.warn('Cooldown', `Espera ${formatCooldown(restante)} para volver a talar.`)], ephemeral: true });
    }

    await interaction.deferReply();
    const cantidad = interaction.options.getInteger('cantidad') || rand(3, 10);
    const ganancia = cantidad * rand(50, 120);

    player.cash += ganancia;
    player.trabajosRealizados++;
    player.setCooldown('talar', new Date());
    player.addXP(rand(10, 30));
    await player.save();

    const inv = await Inventory.findOne({ discordId: interaction.user.id });
    if (inv) { inv.addItem({ id: 'tronco', nombre: 'Tronco de madera', emoji: '🪵', tipo: 'recurso', valor: 50 }, cantidad); await inv.save(); }

    return interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor(0x8B4513).setTitle('🌲 Trabajo — Talar madera')
      .setDescription(`**${player.getFullName()}** ha talado **${cantidad} troncos** y ganado **${formatMoney(ganancia)}**.`)
      .addFields({ name: '🪵 Troncos', value: `+${cantidad}`, inline: true }, { name: '💵 Ganado', value: formatMoney(ganancia), inline: true })
      .setTimestamp()] });
  }

  // ── PICAR ─────────────────────────────────────────────────────────────────
  if (cmd === 'picar') {
    const { formatMoney, rand, formatCooldown } = require('../utils/helpers');
    const Inventory = require('../database/models/Inventory');

    const last = player.getCooldown('picar');
    const cooldownMs = 20 * 60 * 1000;
    if (last && (last.getTime() + cooldownMs > Date.now())) {
      const restante = last.getTime() + cooldownMs - Date.now();
      return interaction.reply({ embeds: [E.warn('Cooldown', `Espera ${formatCooldown(restante)} para volver a picar.`)], ephemeral: true });
    }

    await interaction.deferReply();
    const cantidad = interaction.options.getInteger('cantidad') || rand(2, 8);
    const ganancia = cantidad * rand(80, 200);

    player.cash += ganancia;
    player.trabajosRealizados++;
    player.setCooldown('picar', new Date());
    player.addXP(rand(15, 40));
    await player.save();

    const inv = await Inventory.findOne({ discordId: interaction.user.id });
    if (inv) { inv.addItem({ id: 'piedra', nombre: 'Piedra', emoji: '🪨', tipo: 'recurso', valor: 80 }, cantidad); await inv.save(); }

    return interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor(0x808080).setTitle('⛏️ Trabajo — Picar piedra')
      .setDescription(`**${player.getFullName()}** ha picado **${cantidad} unidades de piedra** y ganado **${formatMoney(ganancia)}**.`)
      .addFields({ name: '🪨 Piedra', value: `+${cantidad}`, inline: true }, { name: '💵 Ganado', value: formatMoney(ganancia), inline: true })
      .setTimestamp()] });
  }

  // ── SACAR COCHE ────────────────────────────────────────────────────────────
  if (cmd === 'sacar-coche') {
    const matricula = interaction.options.getString('matricula');
    const vehiculos = player.vehicles || player.vehiculos || [];

    if (!vehiculos.length) {
      return interaction.reply({ embeds: [E.warn('Sin vehículos', 'No tienes ningún vehículo registrado.')] });
    }

    const vehiculo = matricula
      ? vehiculos.find(v => v.matricula?.toLowerCase() === matricula.toLowerCase())
      : vehiculos.find(v => v.guardado);

    if (!vehiculo) {
      return interaction.reply({ embeds: [E.err('No encontrado', 'No se encontró ese vehículo en tu garaje.')] });
    }

    vehiculo.guardado = false;
    await player.save();

    const embed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('🚗 VEHÍCULO SACADO')
      .setDescription(`**${player.getFullName()}** ha sacado su **${vehiculo.nombre || vehiculo.modelo}** del garaje.`)
      .addFields(
        { name: '🚗 Vehículo', value: vehiculo.nombre || vehiculo.modelo, inline: true },
        { name: '🔢 Matrícula', value: vehiculo.matricula || 'Sin matrícula', inline: true },
        { name: '🎨 Color', value: vehiculo.color || 'Desconocido', inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── GUARDAR COCHE ──────────────────────────────────────────────────────────
  if (cmd === 'guardar-coche') {
    const matricula = interaction.options.getString('matricula');
    const vehiculos = player.vehicles || player.vehiculos || [];

    const vehiculo = matricula
      ? vehiculos.find(v => v.matricula?.toLowerCase() === matricula.toLowerCase())
      : vehiculos.find(v => !v.guardado);

    if (!vehiculo) {
      return interaction.reply({ embeds: [E.err('No encontrado', 'No se encontró ese vehículo fuera del garaje.')] });
    }

    vehiculo.guardado = true;
    await player.save();

    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('🅿️ VEHÍCULO GUARDADO')
      .setDescription(`**${player.getFullName()}** ha guardado su **${vehiculo.nombre || vehiculo.modelo}** en el garaje.`)
      .addFields(
        { name: '🚗 Vehículo', value: vehiculo.nombre || vehiculo.modelo, inline: true },
        { name: '🔢 Matrícula', value: vehiculo.matricula || 'Sin matrícula', inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  { name: 'caballito', description: '!caballito @usuario', async run(message) {
    const player = await getPlayer(message.author.id, message.author.username);
    const target = message.mentions.users.first();
    if (!target) return message.reply('Menciona un usuario.');
    const victima = await getPlayer(target.id, target.username);
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} lleva a caballito a ${victima.getFullName()} 🏇*`).setAuthor({ name: `ACCIÓN | ${player.getFullName()}` }).setTimestamp()] });
  }},
  { name: 'brazos', description: '!brazos @usuario', async run(message) {
    const player = await getPlayer(message.author.id, message.author.username);
    const target = message.mentions.users.first();
    if (!target) return message.reply('Menciona un usuario.');
    const victima = await getPlayer(target.id, target.username);
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} lleva en brazos a ${victima.getFullName()} 🤝*`).setAuthor({ name: `ACCIÓN | ${player.getFullName()}` }).setTimestamp()] });
  }},
  { name: 'arrastrar', description: '!arrastrar @usuario', async run(message) {
    const player = await getPlayer(message.author.id, message.author.username);
    const target = message.mentions.users.first();
    if (!target) return message.reply('Menciona un usuario.');
    const victima = await getPlayer(target.id, target.username);
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} arrastra el cuerpo de ${victima.getFullName()} 😵*`).setAuthor({ name: `ACCIÓN | ${player.getFullName()}` }).setTimestamp()] });
  }},
  { name: 'llamar', aliases: ['llamar-persona', 'call'], description: '!llamar @usuario [mensaje]', async run(message, args) {
    const player   = await getPlayer(message.author.id, message.author.username);
    const target   = message.mentions.users.first();
    const mensaje  = args.slice(1).join(' ') || '...';
    if (!target) return message.reply('Menciona un usuario.');
    const receptor = await getPlayer(target.id, target.username);
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*📞 ${player.getFullName()} llama a ${receptor.getFullName()}: "${mensaje}"*`).setTimestamp()] });
    try { await target.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('📞 Llamada entrante').setDescription(`${player.getFullName()} te llama: "${mensaje}"`).setTimestamp()] }); } catch {}
  }},
  { name: 'puertas', description: '!puertas [abrir/cerrar]', async run(message, args) {
    const player = await getPlayer(message.author.id, message.author.username);
    const acc = args[0]?.toLowerCase() === 'cerrar' ? 'cierra' : 'abre';
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} ${acc} las puertas del coche.*`).setTimestamp()] });
  }},
  { name: 'capo', description: '!capo [abrir/cerrar]', async run(message, args) {
    const player = await getPlayer(message.author.id, message.author.username);
    const acc = args[0]?.toLowerCase() === 'cerrar' ? 'cierra' : 'abre';
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} ${acc} el capó del vehículo.*`).setTimestamp()] });
  }},
  { name: 'maletero', description: '!maletero [abrir/cerrar]', async run(message, args) {
    const player = await getPlayer(message.author.id, message.author.username);
    const acc = args[0]?.toLowerCase() === 'cerrar' ? 'cierra' : 'abre';
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} ${acc} el maletero.*`).setTimestamp()] });
  }},
  { name: 'ventanillas', description: '!ventanillas [abrir/cerrar]', async run(message, args) {
    const player = await getPlayer(message.author.id, message.author.username);
    const acc = args[0]?.toLowerCase() === 'cerrar' ? 'cierra' : 'abre';
    await message.delete().catch(() => {});
    await message.channel.send({ embeds: [new EmbedBuilder().setColor(config.colors.dark).setDescription(`*${player.getFullName()} ${acc} las ventanillas.*`).setTimestamp()] });
  }},
  { name: 'talar', description: '!talar — Talar madera', async run(message) {
    // Redirigir al slash handler
    message.reply('Usa el comando slash `/talar` para una mejor experiencia.');
  }},
  { name: 'picar', description: '!picar — Picar piedra', async run(message) {
    message.reply('Usa el comando slash `/picar` para una mejor experiencia.');
  }},
];

module.exports = { data, execute, prefixCommands };
