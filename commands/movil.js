/**
 * MÓVIL — Sistema de teléfono virtual con apps mejoradas
 * Slash: /movil  ·  Prefix: !movil !phone
 */
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');
const { getPlayer, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');

// ─── Barra visual ─────────────────────────────────────────────────────────────
function barra(v, len = 8) {
  const n = Math.round(Math.min(Math.max(v, 0), 100) / 100 * len);
  const col = v > 60 ? '🟩' : v > 30 ? '🟨' : '🟥';
  return col.repeat(n) + '⬛'.repeat(len - n);
}

// ─── Pantalla principal del móvil ─────────────────────────────────────────────
function buildMainEmbed(player, user) {
  const hora = new Date().toLocaleString('es-ES', { timeStyle: 'short', dateStyle: 'short' });
  const em = new EmbedBuilder()
    .setColor(0x0d1117)
    .setTitle(`📱  ${player.getFullName()}`)
    .setDescription(
      `> **${hora}**\n\n` +
      `Selecciona una aplicación:`,
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '📶 Señal',   value: `${barra(100, 8)} 100%`, inline: true },
      { name: '🔋 Batería', value: `${barra(100, 8)} 100%`, inline: true },
    )
    .setFooter({ text: 'AmericanRP  ·  Sistema Móvil' })
    .setTimestamp();
  if (E.IMG.movil) em.setImage(E.IMG.movil);
  return em;
}

const data = [
  new SlashCommandBuilder()
    .setName('movil')
    .setDescription('Abre tu teléfono móvil virtual'),
];

async function execute(interaction, client) {
  const player = await getPlayer(interaction.user.id, interaction.user.username);

  if (!player.personajeCreado) {
    return interaction.reply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje para usar el móvil.')], flags: 64 });
  }

  // ─── Función para mostrar la pantalla principal ──────────────────────────
  async function mostrarPantallaPrincipal(inter, editar = false) {
    const embed = buildMainEmbed(player, interaction.user);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('phone_banco').setLabel('🏦 Banco').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('phone_mensajes').setLabel('💬 Mensajes').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('phone_contactos').setLabel('📞 Contactos').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('phone_tienda').setLabel('🛍️ Tienda').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('phone_twitter').setLabel('𝕏 Twitter').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('phone_mapa').setLabel('🗺️ Mapa').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('phone_multas').setLabel('🚔 Multas').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('phone_emergencias').setLabel('🚨 Emergencias').setStyle(ButtonStyle.Danger),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('phone_inventario').setLabel('🎒 Mochila').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('phone_vitales').setLabel('❤️ Vitales').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('phone_pda').setLabel('💻 PDA Web').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('phone_cerrar').setLabel('❌ Cerrar').setStyle(ButtonStyle.Danger),
    );

    const opts = { embeds: [embed], components: [row1, row2, row3], flags: 64 };
    return editar ? inter.update(opts) : inter.reply(opts);
  }

  await mostrarPantallaPrincipal(interaction);

  // ─── Collector de botones y select menus ────────────────────────────────
  const collector = interaction.channel.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id &&
      (i.customId.startsWith('phone_') || i.customId === 'phone_tienda_cat'),
    time: 120_000,
  });

  const backRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('phone_inicio').setLabel('← Volver').setStyle(ButtonStyle.Secondary),
  );

  collector.on('collect', async i => {

    // SelectMenu de tienda
    if (i.customId === 'phone_tienda_cat') {
      const { CATALOGO } = require('./tienda');
      const catKey = i.values[0];
      const cat    = CATALOGO[catKey];
      const lines  = cat.items.map(it => `${it.emoji} **${it.nombre}** — ${formatMoney(it.precio)}\n*${it.desc}*`).join('\n');
      const catEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`${cat.emoji}  ${cat.label}`)
        .setDescription(lines.slice(0, 1000))
        .setFooter({ text: 'Compra con /comprar [nombre]  ·  Usa con /usar [nombre]' });

      const cats = Object.keys(CATALOGO);
      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('phone_tienda_cat')
          .setPlaceholder('📦 Cambiar categoría...')
          .addOptions(cats.map(k =>
            new StringSelectMenuOptionBuilder()
              .setLabel(CATALOGO[k].label)
              .setValue(k)
              .setEmoji(CATALOGO[k].emoji),
          )),
      );
      return i.update({ embeds: [catEmbed], components: [selectRow, backRow()] });
    }

    const app = i.customId.replace('phone_', '');

    switch (app) {

      // ── BANCO ────────────────────────────────────────────────────────────
      case 'banco': {
        const updP = await getPlayer(interaction.user.id, interaction.user.username);
        const tieneCuenta = !!updP.pinBanco;
        const dni = E.getDNI(interaction.user.id);

        const em = new EmbedBuilder()
          .setColor(0x1a4fc4)
          .setTitle('🏦  LS National Bank')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '👤 Titular',         value: updP.getFullName(),                        inline: true },
            { name: '🪪 DNI',             value: `\`${dni}\``,                              inline: true },
            { name: '🔒 Cuenta',          value: tieneCuenta ? '✅ Activa' : '❌ Sin cuenta', inline: true },
            { name: '💵 Cash en mano',    value: `**${formatMoney(updP.cash)}**`,            inline: true },
            { name: '🏦 Saldo bancario',  value: `**${formatMoney(updP.bank)}**`,            inline: true },
            { name: '🧹 Dinero sucio',    value: formatMoney(updP.dineroSucio),              inline: true },
            { name: '💰 Patrimonio neto', value: `**${formatMoney(updP.cash + updP.bank)}**`, inline: false },
          )
          .setFooter({ text: tieneCuenta ? 'PIN configurado  ·  LS National Bank' : 'Usa /banco crear para abrir tu cuenta con PIN' })
          .setTimestamp();

        if (!tieneCuenta) {
          em.setDescription('⚠️ _No tienes cuenta bancaria creada. Usa `/banco crear` en cualquier canal para abrir tu cuenta con PIN de seguridad._');
        }
        if (E.IMG.banco) em.setImage(E.IMG.banco);

        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── MENSAJES ─────────────────────────────────────────────────────────
      case 'mensajes': {
        const em = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('💬  Mensajes')
          .setDescription(
            '📭 _No tienes mensajes nuevos._\n\n' +
            '**Acciones disponibles:**\n' +
            '• `!llamar @usuario [mensaje]` — Llamar a alguien\n' +
            '• `!radio [texto]` — Comunicación por radio\n' +
            '• `!susurro [texto]` — Hablar en voz baja RP',
          )
          .setFooter({ text: 'AmericanRP  ·  Mensajes' })
          .setTimestamp();
        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── CONTACTOS ────────────────────────────────────────────────────────
      case 'contactos': {
        const em = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle('📞  Contactos')
          .addFields(
            { name: '🚨 Emergencias', value: '**911** — Policía / Médicos / Bomberos\n`!911 [descripción]` para llamar', inline: false },
            { name: '🚔 Policía (LSPD)', value: 'Canal de emergencias del servidor', inline: true },
            { name: '🚑 Médicos (EMS)',  value: 'Canal de emergencias del servidor', inline: true },
            { name: '🚒 Bomberos (LSFD)', value: 'Canal de emergencias del servidor', inline: true },
            { name: '📞 Llamadas RP', value: '_Usa `!llamar @usuario [mensaje]` o `/llamar @usuario` para llamadas RP entre jugadores_', inline: false },
          )
          .setFooter({ text: 'AmericanRP  ·  Contactos' })
          .setTimestamp();
        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── TIENDA ───────────────────────────────────────────────────────────
      case 'tienda': {
        const { CATALOGO } = require('./tienda');
        const cats = Object.keys(CATALOGO);
        const em = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('🏪  Los Santos Marketplace')
          .setDescription('Selecciona una categoría:')
          .addFields(cats.map(k => ({ name: `${CATALOGO[k].emoji} ${CATALOGO[k].label}`, value: `${CATALOGO[k].items.length} items`, inline: true })))
          .setFooter({ text: 'Compra con /comprar [item]  ·  Usa con /usar [item]' });
        if (E.IMG.tienda) em.setImage(E.IMG.tienda);

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('phone_tienda_cat')
            .setPlaceholder('📦 Ver categoría...')
            .addOptions(cats.map(k =>
              new StringSelectMenuOptionBuilder()
                .setLabel(CATALOGO[k].label)
                .setValue(k)
                .setEmoji(CATALOGO[k].emoji),
            )),
        );
        return i.update({ embeds: [em], components: [selectRow, backRow()] });
      }

      // ── TWITTER ──────────────────────────────────────────────────────────
      case 'twitter': {
        const em = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('𝕏  Twitter LS')
          .setDescription(
            '> *Funcionalidad en desarrollo.*\n\n' +
            'Próximamente podrás publicar tweets en el canal de Twitter RP del servidor.\n\n' +
            '_Sigue el feed de la ciudad en el canal de Twitter RP._',
          )
          .setFooter({ text: 'AmericanRP  ·  Twitter LS' });
        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── MAPA ─────────────────────────────────────────────────────────────
      case 'mapa': {
        const em = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle('🗺️  Mapa de Los Santos')
          .addFields(
            { name: '🏙️ Centro Ciudad',    value: 'Rockford Hills · Vinewood · Downtown', inline: true },
            { name: '🏖️ Zona Costera',     value: 'Vespucci Beach · Del Perro', inline: true },
            { name: '🏔️ Vinewood Hills',   value: 'Zona residencial alta gama', inline: true },
            { name: '🌾 Blaine County',    value: 'Sandy Shores · Grapeseed', inline: true },
            { name: '🌊 Costa Oeste',      value: 'Chumash · Great Ocean Hwy', inline: true },
            { name: '🏭 Zona Industrial',  value: 'LSIA · Puerto marítimo', inline: true },
          )
          .setFooter({ text: 'AmericanRP  ·  Mapa' });
        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── MULTAS ───────────────────────────────────────────────────────────
      case 'multas': {
        const Multa = require('../database/models/Multa');
        const multasBot = await Multa.find({ ciudadanoId: interaction.user.id, pagada: false }).limit(5);
        let sancionesPda = [];
        try {
          const pdaApi = require('../utils/pdaApi');
          sancionesPda = await pdaApi.getSancionesByDiscordId(interaction.user.id) || [];
          const botIds = new Set(multasBot.map(m => m.multaId));
          sancionesPda = sancionesPda.filter(s => !s.botMultaId || !botIds.has(s.botMultaId));
        } catch {}

        const total    = multasBot.reduce((s, m) => s + m.cantidad, 0) + sancionesPda.reduce((s, s2) => s + (s2.cantidad || 0), 0);
        const hayMultas = multasBot.length > 0 || sancionesPda.length > 0;

        let desc = '';
        if (multasBot.length) desc += multasBot.map(m => `🚔 **${m.multaId}** — ${formatMoney(m.cantidad)}\n> ${m.motivo}`).join('\n\n');
        if (sancionesPda.length) {
          if (desc) desc += '\n\n**🌐 PDA Dashboard:**\n';
          desc += sancionesPda.map(s => `[${(s.tipo || 'MULTA').toUpperCase()}] ${formatMoney(s.cantidad || 0)} — ${s.motivo || 'Sin motivo'}`).join('\n');
        }
        if (!hayMultas) desc = '✅ No tienes multas ni sanciones pendientes.';

        const em = new EmbedBuilder()
          .setColor(hayMultas ? 0xf59e0b : 0x22c55e)
          .setTitle('🚔  Multas & Sanciones')
          .setDescription(desc.slice(0, 1000))
          .setFooter({ text: 'Pagar: /pagar-multa [ID]  ·  Ver todo: /multas' });
        if (hayMultas) em.addFields({ name: '💰 Total pendiente', value: `**${formatMoney(total)}**`, inline: true });

        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── EMERGENCIAS ──────────────────────────────────────────────────────
      case 'emergencias': {
        const em = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('🚨  Servicios de Emergencia')
          .setDescription(
            '**¿Qué tipo de emergencia tienes?**\n\n' +
            '> También puedes usar `!911 [descripción]` para enviar directamente al canal de emergencias con toda tu información.',
          )
          .setFooter({ text: 'AmericanRP  ·  Emergencias' });

        const rowEm = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('phone_em_policia').setLabel('🚔 Policía (911)').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('phone_em_medico').setLabel('🚑 Médico / EMS').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('phone_em_bomberos').setLabel('🚒 Bomberos').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('phone_inicio').setLabel('← Volver').setStyle(ButtonStyle.Secondary),
        );
        return i.update({ embeds: [em], components: [rowEm] });
      }

      // ── EMERGENCIAS — Llamadas ────────────────────────────────────────────
      case 'em_policia':
      case 'em_medico':
      case 'em_bomberos': {
        const tipos = {
          em_policia:  { emoji: '🚔', nombre: 'Policía',      color: 0x003f9f },
          em_medico:   { emoji: '🚑', nombre: 'Médicos/EMT',  color: 0x22c55e },
          em_bomberos: { emoji: '🚒', nombre: 'Bomberos',     color: 0xcc0000 },
        };
        const t   = tipos[app];
        const tipo = app === 'em_policia' ? 'policia' : app === 'em_medico' ? 'medico' : 'bomberos';

        const updP = await getPlayer(interaction.user.id, interaction.user.username);
        const embed911 = E.emergencia911(updP, tipo, '_Llamada iniciada desde el móvil. Especifica tu posición en el canal RP._');

        // Enviar al canal de emergencias
        let enviado = false;
        try {
          const GuildConfig = require('../database/models/GuildConfig');
          const gc = await GuildConfig.findOne({ guildId: interaction.guildId });
          const canales = gc?.canales || {};
          const chId = (tipo === 'policia' ? canales.policia : tipo === 'medico' ? canales.medico : null)
                     || canales.emergencias
                     || canales.rp;
          if (chId) {
            const ch = await interaction.guild.channels.fetch(chId).catch(() => null);
            if (ch) {
              await ch.send({ content: tipo === 'policia' ? '🚨 @here' : undefined, embeds: [embed911] });
              enviado = true;
            }
          }
        } catch {}

        const confirmEmbed = new EmbedBuilder()
          .setColor(t.color)
          .setTitle(`${t.emoji}  Llamada al ${t.nombre} enviada`)
          .setDescription(
            enviado
              ? `✅ Tu llamada de emergencia fue enviada.\n\n> *Espera la llegada de los servicios y especifica tu ubicación en el canal RP.*`
              : `⚠️ Llamada procesada. No se encontró canal de emergencias configurado.\n\n*Pide a un admin que configure \`/config canales emergencias\`.*`,
          )
          .setFooter({ text: 'AmericanRP  ·  911' });

        return i.update({ embeds: [confirmEmbed], components: [backRow()] });
      }

      // ── INVENTARIO ───────────────────────────────────────────────────────
      case 'inventario': {
        const Inventory = require('../database/models/Inventory');
        const inv = await Inventory.findOne({ discordId: interaction.user.id });
        const items = inv?.items?.length
          ? inv.items.slice(0, 15).map(it => `${it.emoji || '📦'} **${it.nombre}** ×${it.cantidad}`).join('\n')
          : '*Mochila vacía*';

        const em = new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle(`🎒  Mochila de ${player.getFullName()}`)
          .setDescription(items)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields({ name: '📊 Slots', value: `${inv?.countItems() || 0}/${inv?.capacidadMax || 20}`, inline: true })
          .setFooter({ text: 'Usa /inventario para más detalles  ·  !comer / !beber para consumir' })
          .setTimestamp();

        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── VITALES ──────────────────────────────────────────────────────────
      case 'vitales': {
        const updP = await getPlayer(interaction.user.id, interaction.user.username);
        const s = Math.floor(updP.salud), h = Math.floor(updP.hambre), se = Math.floor(updP.sed);
        const color = s < 30 ? 0xef4444 : s < 60 ? 0xf59e0b : 0x22c55e;

        const em = new EmbedBuilder()
          .setColor(color)
          .setTitle(`❤️  Vitales — ${updP.getFullName()}`)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '❤️ Salud',  value: `${barra(s)}  **${s}%**  ${s < 30 ? '⚠️ CRÍTICO' : ''}`,   inline: false },
            { name: '🍔 Hambre', value: `${barra(h)}  **${h}%**  ${h < 20 ? '⚠️ Hambriento' : ''}`, inline: false },
            { name: '💧 Sed',    value: `${barra(se)} **${se}%**  ${se < 20 ? '⚠️ Deshidratado' : ''}`, inline: false },
            { name: '🟢 Estado', value: updP.muerto ? '💀 Muerto' : updP.enHospital ? '🏥 Hospital' : updP.buscado ? '🚨 Buscado' : '✅ Normal', inline: true },
          )
          .setFooter({ text: '!comer [item] / !beber [item] para consumir  ·  /tienda para comprar' })
          .setTimestamp();

        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── PDA WEB ──────────────────────────────────────────────────────────
      case 'pda': {
        const pdaUrl = process.env.PDA_FRONTEND_URL || 'https://airp-pda.vercel.app';
        const em = new EmbedBuilder()
          .setColor(0x1a1a2e)
          .setTitle('💻  PDA Web — AmericanRP')
          .setDescription(
            `Accede a la PDA desde el navegador:\n\n🔗 [Abrir PDA Web](${pdaUrl})\n\n` +
            `_Inicia sesión con tu cuenta de Discord._`,
          )
          .setFooter({ text: 'PDA  ·  Sistema Digital AmericanRP' });
        return i.update({ embeds: [em], components: [backRow()] });
      }

      // ── VOLVER AL INICIO ─────────────────────────────────────────────────
      case 'inicio': {
        const updPlayer = await getPlayer(interaction.user.id, interaction.user.username);
        Object.assign(player, updPlayer.toObject ? updPlayer.toObject() : updPlayer);
        return mostrarPantallaPrincipal(i, true);
      }

      case 'cerrar': {
        collector.stop('user');
        return i.update({ embeds: [E.info('Móvil cerrado', 'Has cerrado el teléfono.')], components: [] });
      }
    }
  });

  collector.on('end', (_, reason) => {
    if (reason !== 'user') {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}

const prefixCommands = [
  {
    name: 'movil',
    aliases: ['phone', 'telefono'],
    description: '!movil — Abrir tu móvil virtual',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      await message.reply('📱 Usa el comando slash `/movil` para una experiencia completa con todos los botones interactivos.');
    },
  },
];

module.exports = { data, execute, prefixCommands };
