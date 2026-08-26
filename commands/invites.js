const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Invite = require('../database/models/Invite');

const data = [
  new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Ver tus invitaciones o las de otro usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar (vacío = tú)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('top-invites')
    .setDescription('Top de personas con más invites'),
  new SlashCommandBuilder()
    .setName('top-dinero')
    .setDescription('Top de personas con más dinero (cash+banco)'),
];

async function execute(interaction) {
  const cmd = interaction.commandName;
  if (cmd === 'invites') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const doc = await Invite.findOne({ guildId: interaction.guildId, userId: target.id }).lean();
    const invited = doc?.invited?.length || 0;
    const left = doc?.left?.length || 0;
    const valid = invited - left;
    const embed = new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle(`📨 Invites de ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '✅ Invitados', value: `${invited}`, inline: true },
        { name: '❌ Se fueron', value: `${left}`, inline: true },
        { name: '📊 Válidos', value: `${Math.max(0, valid)}`, inline: true },
      )
      .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
      .setTimestamp();
    if (doc?.invited?.length) {
      const list = doc.invited.slice(0, 10).map(id => `<@${id}>`).join(', ');
      embed.addFields({ name: '👥 Últimos invitados', value: list.slice(0, 1000) || '—', inline: false });
    }
    return interaction.reply({ embeds: [embed] });
  }
  if (cmd === 'top-invites') {
    const top = await Invite.find({ guildId: interaction.guildId }).sort({ invitedCount: -1 }).limit(10).lean().catch(() => []);
    // Fallback: ordenar por invited.length si no hay invitedCount
    let sorted = top;
    if (!top.length || top[0].invitedCount === undefined) {
      const all = await Invite.find({ guildId: interaction.guildId }).lean();
      sorted = all.sort((a,b) => (b.invited?.length||0) - (a.invited?.length||0)).slice(0,10);
    }
    if (!sorted.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('Top Invites').setDescription('Aún no hay datos de invites.')] });
    const desc = (await Promise.all(sorted.map(async (doc, i) => {
      try {
        const u = await interaction.client.users.fetch(doc.userId).catch(() => null);
        const tag = u ? u.tag : doc.userId;
        const valid = (doc.invited?.length||0) - (doc.left?.length||0);
        return `**${i+1}.** ${tag} — **${Math.max(0,valid)}** válidos (${doc.invited?.length||0} invitados, ${doc.left?.length||0} se fueron)`;
      } catch { return `**${i+1}.** ${doc.userId} — ${doc.invited?.length||0}`; }
    }))).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🏆 Top Invites').setDescription(desc).setTimestamp()] });
  }
  if (cmd === 'top-dinero') {
    const Player = require('../database/models/Player');
    const top = await Player.find({ personajeCreado: true }).sort({ cash: -1 }).limit(10).lean().catch(() => []);
    // Ordenar por cash+banco
    const sorted = top.sort((a,b) => (b.cash+b.bank) - (a.cash+a.bank)).slice(0,10);
    if (!sorted.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x64748b).setTitle('Top Dinero').setDescription('Sin datos.')] });
    const { formatMoney } = require('../utils/helpers');
    const desc = sorted.map((p,i) => `**${i+1}.** ${p.nombre ? `${p.nombre} ${p.apellido}` : p.discordUsername || p.discordId} — ${formatMoney((p.cash||0)+(p.bank||0))} (cash ${formatMoney(p.cash||0)} + banco ${formatMoney(p.bank||0)})`).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Top Dinero').setDescription(desc).setTimestamp()] });
  }
}

const prefixCommands = [
  {
    name: 'invites',
    aliases: ['invitaciones', 'inv'],
    description: '!invites [@usuario] — Ver invites',
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const doc = await Invite.findOne({ guildId: message.guild.id, userId: target.id }).lean();
      const invited = doc?.invited?.length || 0;
      const left = doc?.left?.length || 0;
      const valid = invited - left;
      const embed = new (require('discord.js').EmbedBuilder)().setColor(0x3b82f6).setTitle(`📨 Invites de ${target.tag}`).setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields({ name: '✅ Invitados', value: `${invited}`, inline: true }, { name: '❌ Se fueron', value: `${left}`, inline: true }, { name: '📊 Válidos', value: `${Math.max(0,valid)}`, inline: true }).setTimestamp();
      return message.reply({ embeds: [embed] });
    }
  },
  {
    name: 'top-invites',
    aliases: ['topinvites'],
    description: '!top-invites — Top invites',
    async run(message) {
      const top = await Invite.find({ guildId: message.guild.id }).sort({ invitedCount: -1 }).limit(10).lean().catch(()=>[]);
      let sorted=top;
      if(!top.length || top[0].invitedCount===undefined){ const all=await Invite.find({ guildId: message.guild.id }).lean(); sorted=all.sort((a,b)=>(b.invited?.length||0)-(a.invited?.length||0)).slice(0,10); }
      if(!sorted.length) return message.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x64748b).setTitle('Top Invites').setDescription('Sin datos.')] });
      const desc=(await Promise.all(sorted.map(async (doc,i)=>{ try{ const u=await message.client.users.fetch(doc.userId).catch(()=>null); const tag=u?u.tag:doc.userId; const valid=(doc.invited?.length||0)-(doc.left?.length||0); return `**${i+1}.** ${tag} — **${Math.max(0,valid)}** válidos`; }catch{ return `**${i+1}.** ${doc.userId}`; } }))).join('\n');
      return message.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0xf59e0b).setTitle('🏆 Top Invites').setDescription(desc)] });
    }
  },
  {
    name: 'top-dinero',
    aliases: ['topdinero', 'topmoney'],
    description: '!top-dinero — Top dinero',
    async run(message) {
      const Player=require('../database/models/Player');
      const { formatMoney }=require('../utils/helpers');
      const top=await Player.find({personajeCreado:true}).sort({cash:-1}).limit(10).lean().catch(()=>[]);
      const sorted=top.sort((a,b)=>(b.cash+b.bank)-(a.cash+a.bank)).slice(0,10);
      if(!sorted.length) return message.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x64748b).setTitle('Top Dinero').setDescription('Sin datos.')] });
      const desc=sorted.map((p,i)=>`**${i+1}.** ${p.nombre?`${p.nombre} ${p.apellido}`:p.discordUsername||p.discordId} — ${formatMoney((p.cash||0)+(p.bank||0))}`).join('\n');
      return message.reply({ embeds: [new (require('discord.js').EmbedBuilder)().setColor(0x22c55e).setTitle('💰 Top Dinero').setDescription(desc)] });
    }
  },
];

module.exports = { data, execute, prefixCommands };