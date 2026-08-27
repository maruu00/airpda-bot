const { ActivityType, EmbedBuilder } = require('discord.js');
const { sendToLogChannel } = require('../utils/logChannel');
const { iniciarBancoEstado } = require('../systems/bancoEstado');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`\n🤖 Bot conectado como ${client.user.tag}`);
    console.log(`📊 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuarios: ${client.users.cache.size}`);
    console.log(`⚙️  Comandos slash: ${client.commands.size}`);
    console.log(`⚙️  Comandos prefix: ${client.prefixCmds.size}`);

    // Alerta de reinicio en canal 1510107636157386853
    try {
      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('🟢 Bot reiniciado')
        .setDescription(`**${client.user.tag}** se ha iniciado correctamente.\n< t:${Math.floor(Date.now()/1000)}:R>`)
        .addFields(
          { name: '📊 Servidores', value: `${client.guilds.cache.size}`, inline: true },
          { name: '👥 Usuarios', value: `${client.users.cache.size}`, inline: true },
          { name: '⚙️ Comandos', value: `${client.commands.size} slash / ${client.prefixCmds.size} prefix`, inline: true },
        )
        .setTimestamp();
      await sendToLogChannel(client, { embeds: [embed] });
    } catch {}

    // Actividad rotativa
    const activities = [
      { name: '🚔 AmericanRP', type: ActivityType.Playing },
      { name: `${client.guilds.cache.size} servidores`, type: ActivityType.Watching },
      { name: '!ayuda para comandos', type: ActivityType.Listening },
      { name: 'Los Santos PD', type: ActivityType.Watching },
    ];

    let i = 0;
    const setActivity = () => {
      client.user.setPresence({
        activities: [activities[i % activities.length]],
        status: 'online',
      });
      i++;
    };

    setActivity();
    setInterval(setActivity, 30_000);
    try { iniciarBancoEstado(client); } catch {}

    console.log('\n✅ AmericanRP Bot listo!\n');
  },
};
