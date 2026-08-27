const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BancoEstado = require('../database/models/BancoEstado');
const Player = require('../database/models/Player');
const { formatMoney } = require('../utils/helpers');

const ADMIN_ROLE = '1441818963133731016';
function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(ADMIN_ROLE);
}

const data = [
  new SlashCommandBuilder().setName('banco-estado').setDescription('[STAFF] Ver el banco del Estado').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('sacar-dinero-estado').setDescription('[STAFF] Sacar dinero del banco del Estado').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a sacar').setRequired(true).setMinValue(1))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a dar el dinero (vacío = tú)').setRequired(false))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(false)),
  new SlashCommandBuilder().setName('ingresar-estado').setDescription('[STAFF] Ingresar dinero al banco del Estado').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo').setRequired(false)),
  new SlashCommandBuilder().setName('recaudar-estado').setDescription('[STAFF] Forzar recaudación 2% ahora').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

async function execute(interaction) {
  const cmd = interaction.commandName;
  const guildId = interaction.guildId;
  if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Solo staff.', ephemeral: true });

  if (cmd === 'banco-estado') {
    const banco = await BancoEstado.findOne({ guildId }) || { saldo: 0, totalRecaudado: 0, ultimaRecaudacion: null };
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🏦 Banco del Estado')
      .addFields(
        { name: '💰 Saldo', value: formatMoney(banco.saldo || 0), inline: true },
        { name: '📈 Total recaudado', value: formatMoney(banco.totalRecaudado || 0), inline: true },
        { name: '⏰ Última', value: banco.ultimaRecaudacion ? `<t:${Math.floor(new Date(banco.ultimaRecaudacion).getTime()/1000)}:R>` : 'Nunca', inline: true },
        { name: 'ℹ️ Regla', value: 'Cada 168h (7d) se quita el 2% a todos con ≥10k (cash+banco). Exentos <10k.', inline: false },
      ).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (cmd === 'ingresar-estado') {
    const cantidad = interaction.options.getInteger('cantidad');
    const motivo = interaction.options.getString('motivo') || 'Ingreso manual';
    const banco = await BancoEstado.findOneAndUpdate({ guildId }, { $inc: { saldo: cantidad, totalRecaudado: cantidad }, $setOnInsert: { ultimaRecaudacion: null } }, { upsert: true, new: true });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Ingresado').setDescription(`${formatMoney(cantidad)} al Banco del Estado.\nMotivo: ${motivo}\nSaldo: ${formatMoney(banco.saldo)}`)] });
  }

  if (cmd === 'sacar-dinero-estado') {
    const cantidad = interaction.options.getInteger('cantidad');
    const target = interaction.options.getUser('usuario') || interaction.user;
    const motivo = interaction.options.getString('motivo') || 'Retiro Banco Estado';
    const banco = await BancoEstado.findOne({ guildId });
    if (!banco || (banco.saldo || 0) < cantidad) return interaction.reply({ content: `❌ Fondos insuficientes en el Banco del Estado. Saldo: ${formatMoney(banco?.saldo||0)}`, ephemeral: true });
    banco.saldo -= cantidad;
    await banco.save();
    const player = await Player.findOne({ discordId: target.id });
    if (player) { player.cash = (player.cash || 0) + cantidad; await player.save(); }
    const embed = new EmbedBuilder().setColor(0x22c55e).setTitle('💸 Retiro Banco del Estado')
      .addFields(
        { name: '👤 Usuario', value: `<@${target.id}>`, inline: true },
        { name: '💰 Cantidad', value: formatMoney(cantidad), inline: true },
        { name: '🏦 Restante Estado', value: formatMoney(banco.saldo), inline: true },
        { name: '📋 Motivo', value: motivo, inline: false },
      ).setTimestamp();
    try { await target.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Dinero del Estado recibido').setDescription(`Has recibido **${formatMoney(cantidad)}** del Banco del Estado.\nMotivo: ${motivo}`)] }).catch(()=>{}); } catch {}
    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'recaudar-estado') {
    await interaction.deferReply({ ephemeral: true });
    const { ejecutarRecaudacion } = require('../systems/bancoEstado');
    const res = await ejecutarRecaudacion(interaction.guild, `Forzado por ${interaction.user.tag}`);
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🏦 Recaudación forzada').setDescription(`Recaudado: ${formatMoney(res.recaudado)}\nAfectados: ${res.afectados} · Exentos: ${res.exentos}\nSaldo Estado: ${formatMoney(res.saldo)}`)] });
  }
}

const prefixCommands = [
  {
    name: 'banco-estado',
    aliases: ['bancoestado', 'estado-banco'],
    description: '!banco-estado — Ver banco del Estado',
    async run(message) {
      if (!isStaff(message.member)) return message.reply('❌ Solo staff.');
      const banco = await BancoEstado.findOne({ guildId: message.guild.id }) || { saldo: 0, totalRecaudado: 0 };
      const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🏦 Banco del Estado')
        .addFields({ name: '💰 Saldo', value: formatMoney(banco.saldo||0), inline:true }, { name: '📈 Total', value: formatMoney(banco.totalRecaudado||0), inline:true }).setTimestamp();
      return message.reply({ embeds: [embed] });
    }
  },
  {
    name: 'sacar-dinero-estado',
    aliases: ['sacar-estado', 'retirar-estado'],
    description: '!sacar-dinero-estado @usuario <cantidad> [motivo] — Sacar del banco del Estado',
    async run(message, args) {
      if (!isStaff(message.member)) return message.reply('❌ Solo staff.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('Uso: `!sacar-dinero-estado @usuario <cantidad> [motivo]`');
      const cantidad = parseInt(args[1]) || parseInt(args[0]) || 0;
      if (!cantidad || cantidad <= 0) return message.reply('Cantidad inválida.');
      const motivo = args.slice(2).join(' ') || 'Retiro';
      const banco = await BancoEstado.findOne({ guildId: message.guild.id });
      if (!banco || (banco.saldo||0) < cantidad) return message.reply(`❌ Fondos insuficientes. Saldo: ${formatMoney(banco?.saldo||0)}`);
      banco.saldo -= cantidad; await banco.save();
      const Player = require('../database/models/Player');
      const p = await Player.findOne({ discordId: target.id });
      if (p) { p.cash = (p.cash||0) + cantidad; await p.save(); }
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💸 Retiro Estado').setDescription(`<@${target.id}> recibió ${formatMoney(cantidad)}\nMotivo: ${motivo}\nRestante Estado: ${formatMoney(banco.saldo)}`)] });
    }
  },
];

module.exports = { data, execute, prefixCommands };