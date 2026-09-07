const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

module.exports = {
  name: 'interactionCreate',
  async execute(client, interaction) {
    // ─── Canales prohibidos ─────────────────────────────────────────────────
    const forbiddenChannels = ['1441818965218431029', '1500230610071982090', '1441818964748537990', '1441818964748537988'];
    const bypassRole = '1441818963133731016';
    const isBypass = interaction.member?.roles.cache.has(bypassRole) || interaction.member?.permissions.has('Administrator');
    if (!isBypass && forbiddenChannels.includes(interaction.channelId) && interaction.isChatInputCommand()) {
      const key = `forbid_${interaction.user.id}`;
      if (!client.spamTracker) client.spamTracker = new Map();
      const count = (client.spamTracker.get(key) || 0) + 1;
      client.spamTracker.set(key, count);
      setTimeout(() => { if (client.spamTracker.get(key) === count) client.spamTracker.delete(key); }, 60000);

      if (count >= 3) {
        await interaction.member?.timeout(5 * 60_000, 'Aislamiento: comandos en canal prohibido').catch(() => {});
        await interaction.reply({ content: `🔇 Has sido aislado **5 minutos** por insistir en ejecutar comandos aquí.`, ephemeral: true });
        client.spamTracker.set(key, 0);
      } else {
        const warnText = count === 1
          ? '⚠️ No puedes ejecutar comandos aquí.'
          : `⚠️ Último aviso. Próxima vez serás aislado automáticamente.`;
        await interaction.reply({ content: warnText, ephemeral: true });
      }
      return;
    }

    // ─── Slash Command ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;

      try {
        await cmd.execute(interaction, client);
      } catch (err) {
        console.error(`[Slash/${interaction.commandName}]`, err);
        const errEmbed = new EmbedBuilder()
          .setColor(config.colors.danger)
          .setTitle('❌ Error interno')
          .setDescription('Ocurrió un error al ejecutar este comando.')
          .setFooter({ text: err.message?.slice(0, 100) || '' });

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ...EPHEMERAL }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ...EPHEMERAL }).catch(() => {});
        }
      }
    }

    // ─── Autocomplete ───────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) {
        await cmd.autocomplete(interaction, client).catch(e => console.error('[Autocomplete]', e));
      }
    }

    // ─── Button ─────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;
      const [action] = interaction.customId.split(':');

      // Facturas — pagar desde /factura-lista
      if (id.startsWith('factura_pagar_')) {
        const { handleFacturaButton } = require('../commands/mecanico');
        const handled = await handleFacturaButton(interaction, client).catch(e => console.error('[factura_btn]', e));
        if (handled) return;
      }

      // Tickets — sistema FuriaNetworkBot
      if (id.startsWith('ticket_')) {
        const { handleTicketButton } = require('../systems/tickets/ticketSystem');
        return handleTicketButton(interaction, client).catch(e => console.error('[ticket_btn]', e));
      }

      // Botones de bienvenida (canal de bienvenida al unirse al servidor)
      if (action === 'bienvenida_personaje') {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('📋 Crear tu personaje')
            .setDescription(
              'Para comenzar el roleplay necesitas crear tu personaje.\n\n' +
              '**Usa el siguiente comando:**\n' +
              '`/personaje crear nombre:[nombre] apellido:[apellido] edad:[18-80] genero:[M/F/NB]`\n\n' +
              '**Ejemplo:**\n' +
              '`/personaje crear nombre:Marco apellido:Lopez edad:28 genero:M`\n\n' +
              '> También puedes sincronizar tu personaje desde la PDA web con `/personaje sincronizar` si ya tienes cuenta en [airpda.xyz](https://www.airpda.xyz).',
            )
            .setFooter({ text: 'AmericanRP RP · Primeros pasos' })
            .setTimestamp()],
          ...EPHEMERAL,
        }).catch(() => {});
      }

      if (action === 'bienvenida_reglas') {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('📜 Reglas del servidor')
            .setDescription(
              'Para ver las reglas completas del servidor:\n\n' +
              '📌 Busca el canal **#reglas** en el servidor.\n\n' +
              '> Lee las reglas antes de comenzar el roleplay para asegurarte de tener una buena experiencia.',
            )
            .setFooter({ text: 'AmericanRP RP' })
            .setTimestamp()],
          ...EPHEMERAL,
        }).catch(() => {});
      }

      // Status server buttons
      if (action === 'sv_mas' || action === 'sv_menos' || action === 'sv_cerrar' || action === 'sv_pico') {
        const { handleStatusButton } = require('../commands/status');
        await handleStatusButton(interaction, client).catch(e => console.error('[status_btn]', e));
      }

      if (action === 'bienvenida_movil') {
        await interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('📱 Tu móvil virtual')
            .setDescription(
              'El móvil es tu centro de control en el RP.\n\n' +
              '**Para abrir tu móvil:**\n' +
              '`/movil`\n\n' +
              '**Apps disponibles:**\n' +
              '🏦 Banco · 💬 Mensajes · 📞 Contactos · 🛍️ Tienda\n' +
              '🐦 Twitter · 🗺️ Mapa · 🚔 Multas · 🚨 Emergencias\n' +
              '🎒 Inventario · 👤 Perfil · 📲 PDA\n\n' +
              '> Necesitas tener un personaje creado para usar el móvil.',
            )
            .setFooter({ text: 'AmericanRP RP · /movil' })
            .setTimestamp()],
          ...EPHEMERAL,
        }).catch(() => {});
      }
    }

    // ─── Select Menu ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_category_select') {
        const { handleTicketCreate } = require('../systems/tickets/ticketSystem');
        await handleTicketCreate(interaction, client).catch(e => console.error('[ticket_create]', e));
      }
      if (interaction.customId.startsWith('nacionalidad_')) {
        const { getPlayer } = require('../utils/helpers');
        const { getPaisLabel } = require('../data/paises');
        const player = await getPlayer(interaction.user.id, interaction.user.username);
        const nacionalidad = interaction.values[0];
        player.nacionalidad = nacionalidad;
        await player.save();
        const label = getPaisLabel(nacionalidad);
        return interaction.reply({ content: `✅ Nacionalidad establecida: **${label}**`, ephemeral: true });
      }
    }

    // ─── Modal ──────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
    }
  },
};
