const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { sendToLogChannel } = require('../utils/logChannel');

const data = [
  new SlashCommandBuilder()
    .setName('consola')
    .setDescription('[ADMIN] Enviar un mensaje a la consola del bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('mensaje').setDescription('Texto a enviar a la consola').setRequired(true).setMaxLength(1500))
    .addStringOption(o => o.setName('nivel').setDescription('Nivel de log').setRequired(false).addChoices(
      { name: 'info', value: 'info' },
      { name: 'warn', value: 'warn' },
      { name: 'error', value: 'error' },
    )),
  new SlashCommandBuilder()
    .setName('consola-eval')
    .setDescription('[ADMIN] Ejecutar código JS en la consola (solo owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('codigo').setDescription('Código JS a ejecutar').setRequired(true).setMaxLength(1000)),
];

async function execute(interaction) {
  const cmd = interaction.commandName;
  if (cmd === 'consola') {
    const msg = interaction.options.getString('mensaje');
    const nivel = interaction.options.getString('nivel') || 'info';
    const tag = `[Consola:${nivel.toUpperCase()}] ${interaction.user.tag}: ${msg}`;
    if (nivel === 'error') console.error(tag);
    else if (nivel === 'warn') console.warn(tag);
    else console.log(tag);
    const embed = new EmbedBuilder().setColor(nivel === 'error' ? 0xef4444 : nivel === 'warn' ? 0xf59e0b : 0x3b82f6).setTitle('📟 Consola').setDescription(`\`\`\`js\n${msg.slice(0,1900)}\n\`\`\``).addFields({ name: 'Enviado por', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true }, { name: 'Nivel', value: nivel, inline: true }).setTimestamp();
    await sendToLogChannel(interaction.client, { embeds: [embed] });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Enviado a consola').setDescription(`\`\`\`js\n${msg.slice(0,500)}\n\`\`\``)], ephemeral: true });
  }
  if (cmd === 'consola-eval') {
    // Solo el owner del bot (primer admin) puede evaluar código
    const ownerId = process.env.OWNER_ID || interaction.guild.ownerId;
    if (interaction.user.id !== ownerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('Sin permisos').setDescription('Solo el owner puede usar este comando.')], ephemeral: true });
    }
    const code = interaction.options.getString('codigo');
    await interaction.deferReply({ ephemeral: true });
    try {
      // eslint-disable-next-line no-eval
      const result = eval(code);
      const out = String(result ?? 'undefined').slice(0, 1900);
      console.log(`[consola-eval] ${interaction.user.tag}: ${code} => ${out}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Eval OK').setDescription(`\`\`\`js\n${code}\n\`\`\`\n**Resultado:**\n\`\`\`js\n${out}\n\`\`\``)] });
    } catch (e) {
      console.error('[consola-eval]', e);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ Error').setDescription(`\`\`\`js\n${String(e.message || e).slice(0,1900)}\n\`\`\``)] });
    }
  }
}

const prefixCommands = [
  {
    name: 'consola',
    aliases: ['log', 'clog', 'consolalog'],
    description: '!consola [nivel] [mensaje] — Enviar a consola y canal de logs (admin)',
    async run(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Sin permisos.');
      const nivel = ['info','warn','error'].includes(args[0]?.toLowerCase()) ? args.shift().toLowerCase() : 'info';
      const msg = args.join(' ');
      if (!msg) return message.reply('Uso: `!consola [info|warn|error] <mensaje>`');
      const tag = `[Consola:${nivel.toUpperCase()}] ${message.author.tag}: ${msg}`;
      if (nivel === 'error') console.error(tag);
      else if (nivel === 'warn') console.warn(tag);
      else console.log(tag);
      const { EmbedBuilder } = require('discord.js');
      const { sendToLogChannel } = require('../utils/logChannel');
      const embed = new EmbedBuilder().setColor(nivel === 'error' ? 0xef4444 : nivel === 'warn' ? 0xf59e0b : 0x3b82f6).setTitle('📟 Consola').setDescription(`\`\`\`js\n${msg.slice(0,1900)}\n\`\`\``).setTimestamp();
      await sendToLogChannel(message.client, { embeds: [embed] });
      await message.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Enviado').setDescription(`\`\`\`js\n${msg.slice(0,500)}\n\`\`\``)] });
    },
  },
];

module.exports = { data, execute, prefixCommands };