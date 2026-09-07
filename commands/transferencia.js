/**
 * TRANSFERENCIA — Enviar dinero limpio/sucio a otro jugador
 * Slash: /dar-dinero /dar-item
 * Prefix: !transferir !dar-dinero !dar-item
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPlayer, formatMoney, isAdmin } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');

const data = [
  new SlashCommandBuilder()
    .setName('dar-dinero')
    .setDescription('[ADMIN] Dar dinero a un jugador')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('usuario').setDescription('Jugador').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de dinero').setRequired(true)
      .addChoices(
        { name: '💵 Dinero limpio (cash)', value: 'cash' },
        { name: '💰 Dinero sucio', value: 'sucio' },
        { name: '🏦 Banco', value: 'banco' },
      )),

  new SlashCommandBuilder()
    .setName('dar-item')
    .setDescription('Dar un item a otro jugador')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador destino').setRequired(true))
    .addStringOption(o => o.setName('item').setDescription('ID o nombre del item').setRequired(true).setMaxLength(64))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(false).setMinValue(1)),
];

async function execute(interaction, client) {
  const cmd = interaction.commandName;

  // Bloqueo por facturas — /dar-item es transferencia de items, también bloqueado
  if (['dar-item'].includes(cmd)) {
    const { checkFacturaBlock } = require('../utils/facturaBlock');
    if (await checkFacturaBlock(interaction)) return;
  }

  // ── DAR DINERO / ADD-MONEY ─────────────────────────────────────────────────
  if (cmd === 'dar-dinero') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [E.err('Sin permisos', 'Solo administradores pueden usar este comando.')], ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    const target   = interaction.options.getUser('usuario');
    const cantidad = interaction.options.getInteger('cantidad');
    const tipo     = interaction.options.getString('tipo') || 'cash';

    const receptor = await getPlayer(target.id, target.username);
    const tipoLabels = { cash: 'Cash', sucio: 'Dinero sucio', banco: 'Banco' };
    const campoMap   = { cash: 'cash', sucio: 'dineroSucio', banco: 'bank' };

    receptor[campoMap[tipo]] = (receptor[campoMap[tipo]] || 0) + cantidad;
    await receptor.save();

    return interaction.editReply({ embeds: [E.ok('Dinero añadido', `Se añadieron **${formatMoney(cantidad)}** de ${tipoLabels[tipo]} a **${receptor.getFullName()}**.`)] });
  }

  // ── DAR ITEM ───────────────────────────────────────────────────────────────
  if (cmd === 'dar-item') {
    await interaction.deferReply({ ephemeral: true });

    const target   = interaction.options.getUser('usuario');
    const itemStr  = interaction.options.getString('item');
    const cantidad = interaction.options.getInteger('cantidad') || 1;

    const Inventory = require('../database/models/Inventory');
    const emisorInv   = await Inventory.findOne({ discordId: interaction.user.id });
    const receptorInv = await Inventory.findOne({ discordId: target.id }) || await Inventory.create({ discordId: target.id });

    if (!emisorInv) return interaction.editReply({ embeds: [E.err('Sin inventario', 'No tienes inventario.')] });

    // Buscar item por ID o nombre
    const item = emisorInv.items.find(i =>
      i.id.toLowerCase() === itemStr.toLowerCase() ||
      i.nombre.toLowerCase().includes(itemStr.toLowerCase()),
    );

    if (!item) return interaction.editReply({ embeds: [E.err('Item no encontrado', `No tienes "${itemStr}" en tu inventario.`)] });
    if (item.cantidad < cantidad) return interaction.editReply({ embeds: [E.err('Cantidad insuficiente', `Solo tienes ${item.cantidad}x ${item.nombre}.`)] });

    // Transferir item
    emisorInv.removeItem(item.id, cantidad);
    receptorInv.addItem({ id: item.id, nombre: item.nombre, emoji: item.emoji, tipo: item.tipo, valor: item.valor }, cantidad);

    await emisorInv.save();
    await receptorInv.save();

    const emisor = await getPlayer(interaction.user.id, interaction.user.username);
    const receptor = await getPlayer(target.id, target.username);

    return interaction.editReply({ embeds: [E.ok('Item transferido', `Diste **${cantidad}x ${item.emoji} ${item.nombre}** a **${receptor.getFullName()}**.`)] });
  }
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'transferir',
    aliases: ['transfer', 'enviar'],
    description: '!transferir @usuario [cantidad] [limpio/sucio/banco]',
    async run(message, args) {
      const { hasFacturasPendientes } = require('../utils/facturaBlock');
      if (await hasFacturasPendientes(message.author.id)) {
        return message.reply('🔴 **Bloqueado:** Tienes facturas pendientes. Usa `/factura-lista` y paga con `/pagar-factura [ID]`. Solo puedes ver tu dinero.');
      }
      const target   = message.mentions.users.first();
      const cantidad = parseInt(args[1]);
      const tipo     = args[2]?.toLowerCase() || 'limpio';
      if (!target || !cantidad) return message.reply('❌ Uso: `!transferir @usuario [cantidad] [limpio/sucio/banco]`');
      if (target.id === message.author.id) return message.reply('❌ No puedes transferirte a ti mismo.');

      const emisor   = await getPlayer(message.author.id, message.author.username);
      const receptor = await getPlayer(target.id, target.username);
      const campoMap = { limpio: 'cash', sucio: 'dineroSucio', banco: 'bank' };
      const campo    = campoMap[tipo] || 'cash';

      if (emisor[campo] < cantidad) return message.reply(`❌ No tienes suficiente ${tipo}. Tienes: ${formatMoney(emisor[campo])}`);

      emisor[campo]   -= cantidad;
      receptor[campo] += cantidad;
      await emisor.save();
      await receptor.save();

      await message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💸 Transferencia')
        .setDescription(`Enviaste **${formatMoney(cantidad)}** (${tipo}) a **${receptor.getFullName()}**.`).setTimestamp()] });
    },
  },
  {
    name: 'dar-dinero',
    aliases: ['addmoney'],
    description: '!dar-dinero @usuario [cantidad] [tipo] — Admin only',
    async run(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('Sin permisos.');
      const target   = message.mentions.users.first();
      const cantidad = parseInt(args[1]);
      const tipo     = args[2]?.toLowerCase() || 'cash';
      if (!target || !cantidad) return message.reply('❌ Uso: `!dar-dinero @usuario [cantidad] [cash/sucio/banco]`');
      const receptor = await getPlayer(target.id, target.username);
      const campoMap = { cash: 'cash', sucio: 'dineroSucio', banco: 'bank' };
      receptor[campoMap[tipo] || 'cash'] += cantidad;
      await receptor.save();
      await message.reply(`✅ Añadidos **${formatMoney(cantidad)}** a ${receptor.getFullName()}.`);
    },
  },
  {
    name: 'dar-item',
    description: '!dar-item @usuario [item] [cantidad]',
    async run(message, args) {
      const target   = message.mentions.users.first();
      const itemStr  = args[1];
      const cantidad = parseInt(args[2]) || 1;
      if (!target || !itemStr) return message.reply('❌ Uso: `!dar-item @usuario [item] [cantidad]`');

      const Inventory = require('../database/models/Inventory');
      const emisorInv   = await Inventory.findOne({ discordId: message.author.id });
      const receptorInv = await Inventory.findOne({ discordId: target.id }) || await Inventory.create({ discordId: target.id });

      const item = emisorInv?.items?.find(i => i.id.toLowerCase() === itemStr.toLowerCase() || i.nombre.toLowerCase().includes(itemStr.toLowerCase()));
      if (!item) return message.reply(`❌ No tienes "${itemStr}".`);
      if (item.cantidad < cantidad) return message.reply(`❌ Solo tienes ${item.cantidad}x ${item.nombre}.`);

      emisorInv.removeItem(item.id, cantidad);
      receptorInv.addItem({ id: item.id, nombre: item.nombre, emoji: item.emoji, tipo: item.tipo, valor: item.valor }, cantidad);
      await emisorInv.save();
      await receptorInv.save();

      await message.reply(`✅ Diste **${cantidad}x ${item.emoji} ${item.nombre}** a ${target.username}.`);
    },
  },
];

module.exports = { data, execute, prefixCommands };
