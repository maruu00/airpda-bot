const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');
const { handleSecurity } = require('../systems/security/securitySystem');

// Cache de guild configs
const configCache = new Map();
async function getGuildConfig(guildId) {
  if (configCache.has(guildId)) return configCache.get(guildId);
  let gc = await GuildConfig.findOne({ guildId });
  if (!gc) gc = await GuildConfig.create({ guildId });
  configCache.set(guildId, gc);
  setTimeout(() => configCache.delete(guildId), 60000); // 1 min TTL
  return gc;
}

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    if (message.author.bot || !message.guild) return;

    // ─── Canales prohibidos ─────────────────────────────────────────────────
    const forbiddenChannels = ['1441818965218431029', '1500230610071982090', '1441818964748537990', '1441818964748537988'];
    const bypassRole = '1441818963133731016';
    const isBypass = message.member?.roles.cache.has(bypassRole) || message.member?.permissions.has('Administrator');
    const is911Exempt = message.channelId === '1441818965218431029' && message.content.startsWith('!911');
    if (!isBypass && !is911Exempt && forbiddenChannels.includes(message.channelId)) {
      if (message.content.startsWith(config.prefix) || message.content.startsWith('/')) {
        await message.delete().catch(() => {});
        // Track infracciones para aislar
        const key = `forbid_${message.author.id}`;
        const count = (client.spamTracker?.get(key) || 0) + 1;
        if (!client.spamTracker) client.spamTracker = new Map();
        client.spamTracker.set(key, count);
        setTimeout(() => client.spamTracker.delete(key), 60000);

        const warnMsg = await message.channel.send(`⚠️ <@${message.author.id}> No puedes ejecutar comandos aquí.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);

        if (count >= 3) {
          await message.member?.timeout(5 * 60_000, 'Aislamiento automático: comandos en canal prohibido').catch(() => {});
          const aislamiento = await message.channel.send(`🔇 <@${message.author.id}> Has sido aislado **5 minutos** por insistir en ejecutar comandos aquí.`);
          setTimeout(() => aislamiento.delete().catch(() => {}), 8000);
          client.spamTracker.set(key, 0);
        }
        return;
      }
      if (message.content.startsWith('/')) return;
    }

    // ─── Sistema de Seguridad ─────────────────────────────────────────────
    await handleSecurity(message);

    const gc = await getGuildConfig(message.guild.id).catch(() => null);
    const prefix = gc?.prefix || config.prefix;

    // ─── Prefix Commands ───────────────────────────────────────────────────
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();

    const cmd = client.prefixCmds.get(cmdName);
    if (!cmd) {
      // Comandos dinámicos: !almacen-NOMBRE (staff) — soporta con/sin espacios y guiones
      if (cmdName.startsWith('almacen-') && cmdName.length > 'almacen-'.length) {
        let nombre = cmdName.slice('almacen-'.length).replace(/-/g, ' ');
        // Si el comando fue "!almacen-Los Black Cat", el resto viene en args
        if (args.length) nombre = (nombre + ' ' + args.join(' ')).trim();
        try {
          const orgModule = require('../commands/org');
          await orgModule.almAlmacenPorNombre(message, nombre, client);
        } catch (err) {
          console.error('[Prefix/almacen-*]', err);
          message.reply('❌ Ocurrió un error al cargar el almacén.').catch(() => {});
        }
      }
      return;
    }

    try {
      await cmd.run(message, args, client);
    } catch (err) {
      console.error(`[Prefix/${cmd.name}]`, err);
      message.reply('❌ Ocurrió un error al ejecutar el comando.').catch(() => {});
    }
  },
};
