const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { checkRaid } = require('../systems/security/securitySystem');
const Invite = require('../database/models/Invite');

const WELCOME_CHANNEL_ID = '1441818963809144902';
const WELCOME_API = 'https://backend-gamma-sepia-17.vercel.app/api/welcome/image';

// Cache de invites por guild
const inviteCache = new Map();
async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
  } catch {}
}
if (!global._inviteCacheInit) {
  global._inviteCacheInit = true;
  setTimeout(async () => {
    const { client } = require('../index');
    // client may not be ready yet, will be filled on ready
  }, 5000);
}

const MIN_ACCOUNT_AGE_DAYS = 5 * 30; // 5 meses ≈ 150 días

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    // ─── Antigüedad mínima de cuenta: 5 meses ──────────────────────────
    if (!member.user.bot) {
      const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
      if (ageDays < MIN_ACCOUNT_AGE_DAYS) {
        const creadaEl = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`;
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`⛔ Entrada denegada — ${member.guild.name}`)
            .setDescription(
              `Hola **${member.user.username}**, no has podido entrar a **${member.guild.name}**.\n\n` +
              `**Motivo:** tu cuenta de Discord es demasiado nueva.\n` +
              `> 📅 Tu cuenta fue creada el ${creadaEl} (hace **${Math.floor(ageDays)} días**).\n` +
              `> ✅ Exigimos una antigüedad mínima de **5 meses (~150 días)**.\n\n` +
              `Cuando tu cuenta cumpla la antigüedad podrás volver a entrar sin problema.\n` +
              `Si crees que es un error, contacta con el staff desde otro servidor o por la web: https://airpda.xyz`
            )
            .setFooter({ text: 'AmericanRP · Control de acceso' })
            .setTimestamp();
          await member.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}
        try {
          await member.kick(`Cuenta con ${Math.floor(ageDays)} días de antigüedad — mínimo 5 meses (~150 días)`);
        } catch {}
        try {
          const GuildConfig = require('../database/models/GuildConfig');
          const gc = await GuildConfig.findOne({ guildId: member.guild.id }).lean().catch(() => null);
          const chId = gc?.security?.logChannelId || '1528125569643057244';
          const ch = await member.guild.channels.fetch(chId).catch(() => null);
          if (ch) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle('⛔ Entrada denegada — cuenta muy nueva')
              .setDescription(
                `**Usuario:** ${member.user.tag} (\`${member.id}\`)\n` +
                `**Antigüedad:** ${Math.floor(ageDays)} días (mínimo 150)\n` +
                `**Acción:** expulsado + DM enviado`
              )
              .setTimestamp();
            await ch.send({ embeds: [logEmbed] }).catch(() => {});
          }
        } catch {}
        return;
      }
    }

    // Anti-raid check
    const isRaid = await checkRaid(member);
    if (isRaid) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const edadCuenta = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    const miembroNum = member.guild.memberCount;

    // ─── Embed ─────────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setAuthor({ name: `🎉 ${member.guild.name}`, iconURL: member.guild.iconURL({ dynamic: true }) })
      .setTitle(`👋 ¡Bienvenido/a, ${member.user.username}!`)
      .setDescription(
        `Nos alegra tenerte en **${member.guild.name}**.\n\n` +
        `> 📖 Lee las **reglas** del servidor para empezar\n` +
        `> 📋 Crea tu **personaje** en la web https://airpda.xyz\n` +
        `> 🎭 Sumérgete en el **roleplay**\n\n` +
        `**¿Necesitas ayuda?** Abre un ticket con \`/ticket panel\``
      )
      .addFields(
        { name: '👤 Usuario', value: member.user.tag, inline: true },
        { name: '🔢 Miembro #', value: `${miembroNum}`, inline: true },
        { name: '📅 Cuenta', value: `${edadCuenta} días`, inline: true },
        { name: '🆔 Discord ID', value: `\`${member.id}\``, inline: true },
        { name: '📅 Se unió', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '🌐 Servidor', value: member.guild.name, inline: true },
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .setImage(`${WELCOME_API}?username=${encodeURIComponent(member.user.username)}&avatar=${encodeURIComponent(member.user.displayAvatarURL({ extension: 'png', size: 128 }))}&memberCount=${miembroNum}&discriminator=${member.user.discriminator}`)
      .setFooter({ text: `AmericanRP · Miembro #${miembroNum}` })
      .setTimestamp();

    // ─── Botones ───────────────────────────────────────────────────────────
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bienvenida_personaje').setLabel('📋 Crear Personaje').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bienvenida_reglas').setLabel('📜 Ver Reglas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('bienvenida_movil').setLabel('📱 Mi Móvil').setStyle(ButtonStyle.Success),
    );

    await channel.send({ embeds: [embed], components: [row] }).catch(() => {});

    // ─── Invite tracking ──────────────────────────────────────────────────
    try {
      const guild = member.guild;
      const newInvites = await guild.invites.fetch().catch(() => null);
      const cached = inviteCache.get(guild.id);
      let inviterId = null;
      if (newInvites && cached) {
        for (const [code, inv] of newInvites) {
          const prev = cached.get(code) || 0;
          if (inv.uses > prev) { inviterId = inv.inviterId; break; }
        }
      }
      if (inviterId) {
        await Invite.findOneAndUpdate(
          { guildId: guild.id, userId: inviterId },
          { $push: { invited: member.id }, $inc: { invitedCount: 1 }, $setOnInsert: { left: [] } },
          { upsert: true }
        );
      }
      if (newInvites) inviteCache.set(guild.id, new Map(newInvites.map(i => [i.code, i.uses])));
    } catch {}

    // ─── Autoroles ────────────────────────────────────────────────────────
    try {
      const g2 = await require('../database/models/GuildConfig').findOne({ guildId: member.guild.id }).lean();
      const lista = member.user.bot ? (g2?.autoroles?.bots || []) : (g2?.autoroles?.users || []);
      for (const roleId of lista) {
        await member.roles.add(roleId).catch(() => {});
      }
    } catch {}
  },
};