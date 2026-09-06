const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../database/models/GuildConfig');

const data = new SlashCommandBuilder()
  .setName('autorole')
  .setDescription('[ADMIN] Gestionar autoroles para nuevos miembros/bots')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(s => s.setName('add').setDescription('Añadir autorol')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo').setRequired(true).addChoices({ name: 'Usuarios', value: 'users' }, { name: 'Bots', value: 'bots' }))
    .addRoleOption(o => o.setName('rol').setDescription('Rol a asignar').setRequired(true)))
  .addSubcommand(s => s.setName('remove').setDescription('Quitar autorol')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo').setRequired(true).addChoices({ name: 'Usuarios', value: 'users' }, { name: 'Bots', value: 'bots' }))
    .addRoleOption(o => o.setName('rol').setDescription('Rol a quitar').setRequired(true)))
  .addSubcommand(s => s.setName('list').setDescription('Listar autoroles'));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const gc = await GuildConfig.findOne({ guildId: interaction.guildId }) || await GuildConfig.create({ guildId: interaction.guildId });
  if (!gc.autoroles) gc.autoroles = { users: [], bots: [] };
  if (sub === 'list') {
    const users = (gc.autoroles.users || []).map(id => `<@&${id}>`).join(', ') || '*Vacío*';
    const bots = (gc.autoroles.bots || []).map(id => `<@&${id}>`).join(', ') || '*Vacío*';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x3b82f6).setTitle('⚙️ Autoroles').addFields({ name: '👤 Usuarios', value: users, inline: false }, { name: '🤖 Bots', value: bots, inline: false })], ephemeral: true });
  }
  const tipo = interaction.options.getString('tipo');
  const rol = interaction.options.getRole('rol');
  if (sub === 'add') {
    if (gc.autoroles[tipo].includes(rol.id)) return interaction.reply({ content: `❌ <@&${rol.id}> ya está en autoroles de ${tipo}.`, ephemeral: true });
    gc.autoroles[tipo].push(rol.id);
    gc.markModified('autoroles');
    await gc.save();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Autorol añadido').setDescription(`<@&${rol.id}> → **${tipo}**`)] });
  }
  if (sub === 'remove') {
    if (!gc.autoroles[tipo].includes(rol.id)) return interaction.reply({ content: `❌ <@&${rol.id}> no está en ${tipo}.`, ephemeral: true });
    gc.autoroles[tipo] = gc.autoroles[tipo].filter(id => id !== rol.id);
    gc.markModified('autoroles');
    await gc.save();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🗑️ Autorol quitado').setDescription(`<@&${rol.id}> ← **${tipo}**`)] });
  }
}

const prefixCommands = [
  {
    name: 'autorole-add',
    aliases: ['autorole-add', 'autorol-add'],
    description: '!autorole-add <users|bots> @ROL — Añadir autorol (admin)',
    async run(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Solo admin.');
      const tipo = (args[0] || '').toLowerCase();
      const rol = message.mentions.roles.first();
      if (!['users','bots'].includes(tipo) || !rol) return message.reply('Uso: `!autorole-add <users|bots> @ROL`');
      const gc = await GuildConfig.findOne({ guildId: message.guild.id }) || await GuildConfig.create({ guildId: message.guild.id });
      if (!gc.autoroles) gc.autoroles = { users: [], bots: [] };
      if (gc.autoroles[tipo].includes(rol.id)) return message.reply(`❌ Ya está.`);
      gc.autoroles[tipo].push(rol.id);
      gc.markModified('autoroles');
      await gc.save();
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Autorol añadido').setDescription(`<@&${rol.id}> → **${tipo}**`)] });
    }
  },
  {
    name: 'autorole-remove',
    aliases: ['autorole-remove', 'autorol-remove'],
    description: '!autorole-remove <users|bots> @ROL — Quitar autorol',
    async run(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Solo admin.');
      const tipo = (args[0] || '').toLowerCase();
      const rol = message.mentions.roles.first();
      if (!['users','bots'].includes(tipo) || !rol) return message.reply('Uso: `!autorole-remove <users|bots> @ROL`');
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      if (!gc?.autoroles?.[tipo]?.includes(rol.id)) return message.reply('❌ No está.');
      gc.autoroles[tipo] = gc.autoroles[tipo].filter(id => id !== rol.id);
      gc.markModified('autoroles');
      await gc.save();
      return message.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('🗑️ Quitado').setDescription(`<@&${rol.id}> ← ${tipo}`)] });
    }
  },
  {
    name: 'autorole-list',
    aliases: ['autorole-list', 'autoroles', 'autorol-list'],
    description: '!autorole-list — Listar autoroles',
    async run(message) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Solo admin.');
      const gc = await GuildConfig.findOne({ guildId: message.guild.id });
      const users = (gc?.autoroles?.users || []).map(id => `<@&${id}>`).join(', ') || '*Vacío*';
      const bots = (gc?.autoroles?.bots || []).map(id => `<@&${id}>`).join(', ') || '*Vacío*';
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x3b82f6).setTitle('⚙️ Autoroles').addFields({ name: '👤 Usuarios', value: users }, { name: '🤖 Bots', value: bots })] });
    }
  },
];

module.exports = { data, execute, prefixCommands };