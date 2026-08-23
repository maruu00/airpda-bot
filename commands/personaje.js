/**
 * PERSONAJE — Crear, ver y gestionar el personaje RP
 * Slash: /personaje crear | /personaje perfil | /personaje editar | /personaje estadisticas | /perfil
 * Prefix: !perfil, !stats, !muerte
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getPlayer, getInventory, calcXpNivel, applyVitalDecay, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const TRABAJOS = require('../data/trabajos');
const { ICONS, BANNERS, addImage } = require('../utils/images');
const { PAISES, getPaisLabel, getPaisNombre } = require('../data/paises');

// ─── Slash ────────────────────────────────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('personaje')
  .setDescription('Gestiona tu personaje RP')
  .addSubcommand(s => s.setName('sincronizar').setDescription('Sincronizar tu personaje desde la web PDA'))
  .addSubcommand(s => s.setName('crear').setDescription('Crea tu personaje RP')
    .addStringOption(o => o.setName('nombre').setDescription('Nombre de tu personaje').setRequired(true).setMaxLength(32))
    .addStringOption(o => o.setName('apellido').setDescription('Apellido de tu personaje').setRequired(true).setMaxLength(32))
    .addIntegerOption(o => o.setName('edad').setDescription('Edad (18-80)').setRequired(true).setMinValue(18).setMaxValue(80))
    .addStringOption(o => o.setName('genero').setDescription('Género').setRequired(true)
      .addChoices({ name: 'Masculino', value: 'M' }, { name: 'Femenino', value: 'F' }, { name: 'No binario', value: 'NB' }))
    .addStringOption(o => o.setName('origen').setDescription('Ciudad de origen').setRequired(false).setMaxLength(50))
    .addStringOption(o => o.setName('nacionalidad').setDescription('Nacionalidad').setRequired(false)
      .addChoices(
        { name: '🇦🇷 Argentina', value: 'argentina' },
        { name: '🇧🇴 Bolivia', value: 'bolivia' },
        { name: '🇧🇷 Brasil', value: 'brasil' },
        { name: '🇨🇱 Chile', value: 'chile' },
        { name: '🇨🇴 Colombia', value: 'colombia' },
        { name: '🇨🇷 Costa Rica', value: 'costa_rica' },
        { name: '🇨🇺 Cuba', value: 'cuba' },
        { name: '🇩🇴 República Dominicana', value: 'republica_dominicana' },
        { name: '🇪🇨 Ecuador', value: 'ecuador' },
        { name: '🇸🇻 El Salvador', value: 'el_salvador' },
        { name: '🇪🇸 España', value: 'spain' },
        { name: '🇺🇸 Estados Unidos', value: 'usa' },
        { name: '🇫🇷 Francia', value: 'france' },
        { name: '🇬🇹 Guatemala', value: 'guatemala' },
        { name: '🇭🇳 Honduras', value: 'honduras' },
        { name: '🇮🇹 Italia', value: 'italy' },
        { name: '🇲🇽 México', value: 'mexico' },
        { name: '🇳🇮 Nicaragua', value: 'nicaragua' },
        { name: '🇵🇦 Panamá', value: 'panama' },
        { name: '🇵🇾 Paraguay', value: 'paraguay' },
        { name: '🇵🇪 Perú', value: 'peru' },
        { name: '🇵🇷 Puerto Rico', value: 'puerto_rico' },
        { name: '🇨🇦 Canadá', value: 'canada' },
        { name: '🇺🇾 Uruguay', value: 'uruguay' },
        { name: '🇻🇪 Venezuela', value: 'venezuela' },
      ))
  )
  .addSubcommand(s => s.setName('perfil').setDescription('Ver tu ficha de personaje')
    .addUserOption(o => o.setName('usuario').setDescription('Ver perfil de otro usuario').setRequired(false))
  )
  .addSubcommand(s => s.setName('editar').setDescription('Editar datos de tu personaje')
    .addStringOption(o => o.setName('campo').setDescription('Campo a editar').setRequired(true)
      .addChoices(
        { name: 'Trabajo', value: 'trabajo' },
        { name: 'Bio / descripción', value: 'bio' },
        { name: 'Origen', value: 'origen' },
        { name: 'Nacionalidad', value: 'nacionalidad' },
      ))
    .addStringOption(o => o.setName('valor').setDescription('Nuevo valor').setRequired(true).setMaxLength(100))
  )
  .addSubcommand(s => s.setName('estadisticas').setDescription('Ver estadísticas detalladas')
    .addUserOption(o => o.setName('usuario').setDescription('Estadísticas de otro usuario').setRequired(false))
  )
  .addSubcommand(s => s.setName('borrar').setDescription('⚠️ Eliminar tu personaje permanentemente')
  )
  .addSubcommand(s => s.setName('nacionalidad').setDescription('Establecer tu nacionalidad'));

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();

  // ── SINCRONIZAR DESDE PDA ──────────────────────────────────────────────────
  if (sub === 'sincronizar') {
    await interaction.deferReply({ ephemeral: true });
    const player = await getPlayer(interaction.user.id, interaction.user.username);

    try {
      const { User } = require('../database/models/PdaModels');
      const pdaUser  = await User.findOne({ discordId: interaction.user.id }).lean();

      if (!pdaUser) {
        return interaction.editReply({ embeds: [E.err('No encontrado', 'No tienes cuenta en la PDA web.\n\nVe a **[airpda.xyz](https://www.airpda.xyz)**, inicia sesión con Discord y registra tu ID.')] });
      }

      if (!pdaUser.nombre || !pdaUser.apellido) {
        return interaction.editReply({ embeds: [E.warn('Incompleto', 'Tu cuenta PDA existe pero no tienes nombre/apellido registrado.\n\nCompleta tu perfil en **[airpda.xyz](https://www.airpda.xyz)**.')] });
      }

      // Sincronizar
      player.nombre          = pdaUser.nombre;
      player.apellido        = pdaUser.apellido;
      player.personajeCreado = true;
      if (pdaUser.esBuscado)   player.buscado   = true;
      if (pdaUser.esPeligroso) player.peligroso = true;
      const depToJob = { LSPD: 'policía', LSCSD: 'sheriff', LSCFD: 'bombero' };
      if (pdaUser.departamento) player.trabajo = depToJob[pdaUser.departamento] || player.trabajo;
      await player.save();

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('✅ Sincronización completada')
          .setDescription(`Tu personaje de la PDA web ha sido vinculado al bot.`)
          .addFields(
            { name: '👤 Nombre', value: `${pdaUser.nombre} ${pdaUser.apellido}`, inline: true },
            { name: '🪪 ID PDA', value: pdaUser.idNumero || 'N/A', inline: true },
            { name: '🏛️ Departamento', value: pdaUser.departamento || 'Civil', inline: true },
          )
          .setFooter({ text: 'Ya puedes usar !billetera, !perfil, etc.' })
          .setTimestamp()],
      });
    } catch (e) {
      console.error('[sincronizar]', e.message);
      return interaction.editReply({ embeds: [E.err('Error', 'No se pudo conectar con la base de datos PDA.')] });
    }
  }

  // ── CREAR ──────────────────────────────────────────────────────────────────
  if (sub === 'crear') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);

    if (player.personajeCreado) {
      return interaction.reply({ embeds: [E.warn('Personaje existente', `Ya tienes un personaje creado: **${player.getFullName()}**.\nUsa \`/personaje editar\` para modificarlo.`)], ephemeral: true });
    }

    player.nombre = interaction.options.getString('nombre');
    player.apellido = interaction.options.getString('apellido');
    player.edad = interaction.options.getInteger('edad');
    player.genero = interaction.options.getString('genero');
    player.origen = interaction.options.getString('origen') || 'Los Santos';
    player.nacionalidad = interaction.options.getString('nacionalidad') || null;
    player.personajeCreado = true;
    player.cash = config.economia.cashInicial;
    player.bank = config.economia.bankInicial;
    player.xpSiguienteNivel = calcXpNivel(1);
    await player.save();

    // Sincronizar nombre con el usuario PDA si ya existe cuenta
    try {
      const { User: PdaUser } = require('../database/models/PdaModels');
      await PdaUser.findOneAndUpdate(
        { discordId: interaction.user.id },
        { nombre: player.nombre, apellido: player.apellido, nacionalidad: player.nacionalidad, discordUsername: interaction.user.tag },
      );
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('🎉 ¡Personaje creado!')
      .setDescription(`**${player.getFullName()}** ha llegado a Los Santos.`)
      .addFields(
        { name: '👤 Datos', value: `**Edad:** ${player.edad} años · **Género:** ${player.genero === 'M' ? 'Masculino' : player.genero === 'F' ? 'Femenino' : 'No binario'} · **Origen:** ${player.origen}${player.nacionalidad ? ` · **Nacionalidad:** ${getPaisLabel(player.nacionalidad)}` : ''}`, inline: false },
        { name: '💰 Dinero inicial', value: `💵 Cash: ${formatMoney(player.cash)} · 🏦 Banco: ${formatMoney(player.bank)}`, inline: false },
        { name: '📋 Primeros pasos', value: '• `/trabajo lista` para buscar empleo\n• `/tienda` para comprar items\n• `/banco crear` para abrir cuenta bancaria\n• `!me` o `!do` para narrar acciones RP', inline: false },
      )
      .setFooter({ text: 'American Island Rp · ¡Bienvenido!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── PERFIL ─────────────────────────────────────────────────────────────────
  if (sub === 'perfil') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const player = await getPlayer(target.id, target.username);

    if (!player.personajeCreado) {
      return interaction.reply({ embeds: [E.warn('Sin personaje', `${target.id === interaction.user.id ? 'No tienes' : 'Este usuario no tiene'} un personaje creado.\nUsa \`/personaje crear\` para comenzar.`)], ephemeral: true });
    }

    applyVitalDecay(player);
    await player.save();

    const embed = E.perfil(player, target);
    if (player.bio) embed.addFields({ name: '📝 Descripción', value: player.bio, inline: false });

    // Si no tiene nacionalidad, preguntar
    if (!player.nacionalidad && target.id === interaction.user.id) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`nacionalidad_${interaction.user.id}`)
        .setPlaceholder('🌍 Selecciona tu nacionalidad...')
        .addOptions(PAISES);
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.reply({
        content: '🌍 **¿Cuál es tu nacionalidad?** Selecciona tu país en el menú.',
        components: [row],
        ephemeral: true,
      });
    }

    return interaction.reply({ embeds: [embed] });
  }

  // ── EDITAR ─────────────────────────────────────────────────────────────────
  if (sub === 'editar') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Primero crea tu personaje con `/personaje crear`.')], ephemeral: true });

    const campo = interaction.options.getString('campo');
    const valor = interaction.options.getString('valor');

    if (campo === 'trabajo') {
      if (!TRABAJOS[valor.toLowerCase()]) {
        const lista = Object.entries(TRABAJOS).map(([k, v]) => `\`${k}\` ${v.emoji}`).join(' · ');
        return interaction.reply({ embeds: [E.warn('Trabajo inválido', `Trabajos disponibles:\n${lista}`)], ephemeral: true });
      }
      player.trabajo = valor.toLowerCase();
    } else if (campo === 'bio') {
      player.bio = valor.slice(0, 200);
    } else if (campo === 'origen') {
      player.origen = valor;
    } else if (campo === 'nacionalidad') {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`nacionalidad_${interaction.user.id}`)
        .setPlaceholder('🌍 Selecciona tu nacionalidad...')
        .addOptions(PAISES);
      const row = new ActionRowBuilder().addComponents(select);
      return interaction.reply({ content: '🌍 **¿Cuál es tu nacionalidad?**', components: [row], ephemeral: true });
    }

    await player.save();
    return interaction.reply({ embeds: [E.ok('Actualizado', `**${campo}** actualizado a: ${valor}`)] });
  }

  // ── ESTADISTICAS ───────────────────────────────────────────────────────────
  if (sub === 'estadisticas') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const player = await getPlayer(target.id, target.username);

    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Este usuario no tiene personaje.')], ephemeral: true });

    const inv = await getInventory(target.id);
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📊 Estadísticas de ${player.getFullName()}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⭐ Progreso', value: `Nivel: **${player.nivel}**\nXP: ${player.xp}/${player.xpSiguienteNivel}\nTrab. realizados: ${player.trabajosRealizados}`, inline: true },
        { name: '💰 Economía', value: `Cash: ${formatMoney(player.cash)}\nBanco: ${formatMoney(player.bank)}\nSucio: ${formatMoney(player.dineroSucio)}`, inline: true },
        { name: '❤️ Vitales', value: `Salud: ${Math.floor(player.salud)}%\nHambre: ${Math.floor(player.hambre)}%\nSed: ${Math.floor(player.sed)}%`, inline: true },
        { name: '🏴‍☠️ Criminal', value: `Arrestos: ${player.arrestos}\nMultas: ${player.multasRecibidas}\nRobos: ${player.robosRealizados}\nMuertes: ${player.muertesRP}`, inline: true },
        { name: '🎒 Inventario', value: `Items: ${inv.countItems()}/${inv.capacidadMax}\nValor total: aprox. ${formatMoney(inv.items.reduce((a, i) => a + (i.precio || 0) * i.cantidad, 0))}`, inline: true },
        { name: '🚗 Vehículos', value: `${player.vehicles?.length || 0} vehículos`, inline: true },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── BORRAR ─────────────────────────────────────────────────────────────────
  if (sub === 'borrar') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'No tienes personaje creado.')], ephemeral: true });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_delete_char').setLabel('Sí, borrar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_delete_char').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      embeds: [E.warn('⚠️ Confirmar borrado', `¿Seguro que quieres **eliminar permanentemente** a **${player.getFullName()}**?\nPerderás todo: dinero, inventario, vehículos, propiedades.`)],
      components: [row],
      ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({ time: 30000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.deferUpdate();
      if (i.customId === 'confirm_delete_char') {
        // Reset completo del personaje
        player.personajeCreado   = false;
        player.nombre            = '';
        player.apellido          = '';
        player.edad              = 25;
        player.genero            = 'M';
        player.bio               = '';
        player.origen            = 'Los Santos';
        player.cash              = 0;
        player.bank              = 0;
        player.bankAhorros       = 0;
        player.dineroSucio       = 0;
        player.pinBanco          = null;
        player.pinBancoAhorros   = null;
        player.nivel             = 1;
        player.xp                = 0;
        player.xpSiguienteNivel  = 100;
        player.trabajo           = 'desempleado';
        player.salud             = 100;
        player.hambre            = 100;
        player.sed               = 100;
        player.energia           = 100;
        player.arrestos          = 0;
        player.multasRecibidas   = 0;
        player.robosRealizados   = 0;
        player.trabajosRealizados = 0;
        player.muertesRP         = 0;
        player.killsRP           = 0;
        player.drogasVendidas    = 0;
        player.vehicles          = [];
        player.vehiculos         = [];
        player.gangId            = null;
        player.gangRango         = null;
        player.esposado          = false;
        player.esposadoPor       = null;
        player.buscado           = false;
        player.peligroso         = false;
        player.enCarcel          = false;
        player.enHospital        = false;
        player.muerto            = false;
        player.adminOn           = false;
        player.proteccion        = 0;
        player.efectoDroga       = null;
        player.cooldowns         = new Map();
        await player.save();
        await i.update({ embeds: [E.ok('Personaje eliminado', 'Tu personaje ha sido eliminado por completo.\nPuedes crear uno nuevo con `/personaje crear`.')], components: [] });
      } else {
        await i.update({ embeds: [E.info('Cancelado', 'Borrado cancelado.')], components: [] });
      }
      collector.stop();
    });
  }

  // ── NACIONALIDAD ──────────────────────────────────────────────────────────
  if (sub === 'nacionalidad') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Primero crea tu personaje con `/personaje crear`.')], ephemeral: true });

    const select = new StringSelectMenuBuilder()
      .setCustomId(`nacionalidad_${interaction.user.id}`)
      .setPlaceholder('🌍 Selecciona tu nacionalidad...')
      .addOptions(PAISES);
    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({ content: '🌍 **¿Cuál es tu nacionalidad?**', components: [row], ephemeral: true });
  }
}

// ─── Prefix: !perfil, !stats ───────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'perfil',
    aliases: ['p', 'ficha', 'profile'],
    description: 'Ver tu perfil RP',
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const player = await getPlayer(target.id, target.username);
      if (!player.personajeCreado) return message.reply('No tienes personaje creado. Usa `/personaje crear`.');
      applyVitalDecay(player);
      await player.save();
      return message.reply({ embeds: [E.perfil(player, target)] });
    },
  },
  {
    name: 'stats',
    aliases: ['estadisticas'],
    description: 'Ver estadísticas',
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const player = await getPlayer(target.id, target.username);
      if (!player.personajeCreado) return message.reply('Sin personaje. Usa `/personaje crear`.');
      const inv = await getInventory(target.id);
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📊 Stats de ${player.getFullName()}`)
        .addFields(
          { name: '⭐ Nivel', value: `${player.nivel} (${player.xp} XP)`, inline: true },
          { name: '💰 Dinero', value: `Cash: ${formatMoney(player.cash)}\nBanco: ${formatMoney(player.bank)}`, inline: true },
          { name: '❤️ Vitales', value: `Salud: ${Math.floor(player.salud)}% | Hambre: ${Math.floor(player.hambre)}% | Sed: ${Math.floor(player.sed)}%`, inline: false },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands };
