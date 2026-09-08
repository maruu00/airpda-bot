/**
 * BOT IA PROPIA — !bot <orden natural> — ilimitado, gratis, sin API key
 * Creada por OpenCode: systems/botIA (knowledge + parser + executor)
 * Ej: !bot dame el rol de @Rol
 *     !bot rellena la comida de todos
 *     !bot silencia a @Usuario 10m
 *     !bot dale 5000 a @Usuario
 *     !bot factura 3000 a @Usuario por ruedas
 * Usa IA propia local (parser rule-based extensible a 100+ comandos). Si OPENAI_API_KEY existe, la usa como mejora opcional.
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const data = new SlashCommandBuilder()
  .setName('bot')
  .setDescription('Orden natural al bot con IA propia ilimitada')
  .addStringOption(o => o.setName('orden').setDescription('Qué quieres que haga? Ej: dame el rol de @Rol, rellena comida').setRequired(true).setMaxLength(500));

async function execute(interaction, client) {
  const orden = interaction.options.getString('orden');
  await interaction.deferReply();
  const { processNaturalOrder } = require('../systems/botIA');
  // Para slash, construir mentions falsas desde texto si trae <@...>
  const userMatch = [...orden.matchAll(/<@!?(\d+)>/g)].map(m=>m[1]);
  const roleMatch = [...orden.matchAll(/<@&(\d+)>/g)].map(m=>m[1]);
  const fakeMentions = {
    users: { size: userMatch.length, first: ()=> userMatch[0] ? {id:userMatch[0]} : null, keys: ()=> userMatch[Symbol.iterator](), has:()=>false },
    roles: { size: roleMatch.length, first: ()=> roleMatch[0] ? {id:roleMatch[0]} : null, keys: ()=> roleMatch[Symbol.iterator](), has:()=>false },
  };
  // Adaptar a Map-like para executor
  const mentions = {
    users: {
      size: userMatch.length,
      first: ()=> userMatch[0] ? {id: userMatch[0]} : null,
      keys: ()=> userMatch,
      has: (id)=> userMatch.includes(id),
    },
    roles: {
      size: roleMatch.length,
      first: ()=> roleMatch[0] ? {id: roleMatch[0]} : null,
      keys: ()=> roleMatch,
      has: (id)=> roleMatch.includes(id),
    },
  };
  // Mejor: si tiene IDs, pasamos como si fueran mentions
  const ctx = {
    guild: interaction.guild,
    member: interaction.member,
    author: interaction.user,
    mentions,
    content: orden,
    channelId: interaction.channelId,
    channel: interaction.channel,
    client,
  };
  const res = await processNaturalOrder(orden, ctx);
  const embed = new EmbedBuilder()
    .setColor(res.ok ? 0x22c55e : 0xef4444)
    .setTitle(res.ok ? '🤖 IA — Orden ejecutada' : '🤖 IA — No entendí')
    .setDescription(res.msg.slice(0,4000))
    .setFooter({ text: `Intent: ${res.intent || 'ninguno'} | Conf: ${Math.round((res.parsed?.confidence||0)*100)}% | IA propia ilimitada` })
    .setTimestamp();
  if (!res.ok) embed.addFields({name:'💡 Prueba', value:'`!bot ayuda` — `!bot rellena comida` — `!bot dame rol @Rol` — `!bot silencia @U 10m`', inline:false});
  return interaction.editReply({ embeds:[embed] });
}

const prefixCommands = [
  {
    name: 'bot',
    aliases: ['ia','ai','botia'],
    description: '!bot <orden> — IA propia ilimitada',
    async run(message, args) {
      const orden = args.join(' ');
      if (!orden) {
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x3b82f6).setTitle('🤖 IA Propia — !bot').setDescription(
          '**Puedo hacer 100+ cosas, sin límites ni API key.**\n\n' +
          '`!bot rellena la comida de todos`\n' +
          '`!bot rellena la comida de @Usuario`\n' +
          '`!bot dame el rol de @Rol [@Usuario]`\n' +
          '`!bot quita el rol de @Rol`\n' +
          '`!bot silencia a @Usuario 10m [motivo]`\n' +
          '`!bot desilencia a @Usuario`\n' +
          '`!bot banea a @Usuario`\n' +
          '`!bot expulsa a @Usuario`\n' +
          '`!bot borra 20 mensajes`\n' +
          '`!bot dale 5000 a @Usuario [banco/sucio]`\n' +
          '`!bot factura 3000 a @Usuario por llantas`\n' +
          '`!bot ver facturas de @Usuario`\n' +
          '`!bot cuanto dinero tiene @Usuario`\n' +
          '`!bot info de la banda`\n\n' +
          '> **Mil comandos:** solo describe lo que quieres en lenguaje natural y lo haré. Si no entiendo, dime `!bot ayuda`.'
        ).setFooter({text:'IA propia — systems/botIA — gratis e ilimitada'}).setTimestamp()] });
      }

      const { processNaturalOrder } = require('../systems/botIA');
      const ctx = {
        guild: message.guild,
        member: message.member,
        author: message.author,
        mentions: message.mentions,
        content: orden,
        channelId: message.channelId,
        channel: message.channel,
        client: message.client,
      };
      const res = await processNaturalOrder(orden, ctx);
      const embed = new EmbedBuilder()
        .setColor(res.ok ? 0x22c55e : 0xef4444)
        .setDescription(res.msg.slice(0,4000))
        .setFooter({ text: `Intent: ${res.intent || 'ninguno'} | ${res.parsed?.intentObj?.categoria || ''}` })
        .setTimestamp();
      if (!res.ok) embed.setTitle('🤖 No entendí');
      else embed.setTitle('🤖 Hecho');
      return message.reply({ embeds:[embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands };
