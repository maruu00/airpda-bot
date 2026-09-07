/**
 * MÉDICO — Hospital, curación, estado médico
 * Slash: /hospital /curar /estado /revivir
 * Prefix: !hospital, !curar, !estado, !revivir
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, getInventory, formatCooldown, formatMoney, rand } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const { ICONS, BANNERS, addImage } = require('../utils/images');

const MEDIC_ROLE_ID = '1481316335496724551';

function hasMedicRole(member) {
  return member.roles.cache.has(MEDIC_ROLE_ID) || member.permissions.has('Administrator');
}

const data = [
  new SlashCommandBuilder()
    .setName('hospital')
    .setDescription('Ir al hospital a curarte (pago)')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de atención').setRequired(false)
      .addChoices(
        { name: 'Consulta básica (+30 salud) — $500', value: 'basica' },
        { name: 'Tratamiento completo (+100 salud) — $2000', value: 'completo' },
        { name: 'Urgencias (revive) — $3000', value: 'urgencias' },
      )),

  new SlashCommandBuilder()
    .setName('curar')
    .setDescription('Curar a otro jugador (requiere kit médico)')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador a curar').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Salud a restaurar').setRequired(false).setMinValue(10).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('estado')
    .setDescription('Ver tu estado médico completo')
    .addUserOption(o => o.setName('usuario').setDescription('Ver estado de otro jugador').setRequired(false)),

  new SlashCommandBuilder()
    .setName('revivir')
    .setDescription('Revivir a un jugador muerto (solo médicos/policías)')
    .addUserOption(o => o.setName('usuario').setDescription('Jugador a revivir').setRequired(true)),
];

async function execute(interaction, client) {
  const cmd = interaction.commandName;

  if (cmd === 'hospital') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje primero.')], flags: 64 });

    if (player.enHospital) {
      const restante = player.tiempoHospital ? player.tiempoHospital.getTime() - Date.now() : 0;
      if (restante > 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.info)
            .setTitle('🏥 En el hospital')
            .setDescription(`Ya estás hospitalizado. Saldrás en **${formatCooldown(restante)}**`)
            .setTimestamp()],
          flags: 64,
        });
      }
    }

    const tipo = interaction.options.getString('tipo') || 'basica';
    const atenciones = {
      basica: { costo: 500, salud: 30, tiempo: 0 },
      completo: { costo: 2000, salud: 100, tiempo: 0 },
      urgencias: { costo: 3000, salud: 100, tiempo: 0, revive: true },
    };

    const atencion = atenciones[tipo];
    if (player.bank < atencion.costo && player.cash < atencion.costo) {
      return interaction.reply({ embeds: [E.err('Sin fondos', `La atención cuesta **${formatMoney(atencion.costo)}**. No tienes suficiente.`)], flags: 64 });
    }

    // Cobrar (primero banco, luego cash)
    if (player.bank >= atencion.costo) {
      player.bank -= atencion.costo;
    } else {
      player.cash -= atencion.costo;
    }

    player.salud = Math.min(100, player.salud + atencion.salud);
    if (atencion.revive) {
      player.muerto = false;
      player.enHospital = false;
      player.tiempoHospital = null;
    }
    await player.save();

    const hosEmbed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('🏥 Atención médica recibida')
      .setDescription(`Recibiste **${tipo === 'basica' ? 'consulta básica' : tipo === 'completo' ? 'tratamiento completo' : 'urgencias'}**`)
      .addFields(
        { name: '❤️ Salud', value: `${Math.floor(player.salud)}%`, inline: true },
        { name: '💰 Costo', value: formatMoney(atencion.costo), inline: true },
      )
      .setTimestamp();
    addImage(hosEmbed, 'hospital');
    return interaction.reply({ embeds: [hosEmbed] });
  }

  if (cmd === 'curar') {
    if (!hasMedicRole(interaction.member)) return interaction.reply({ embeds: [E.err('Sin permiso', 'Solo los médicos pueden usar este comando.')], flags: 64 });
    const healer = await getPlayer(interaction.user.id, interaction.user.username);
    if (!healer.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Necesitas personaje.')], flags: 64 });

    const inv = await getInventory(interaction.user.id);
    const kitMedico = inv.items.find(i => i.tipo === 'medkit' || i.nombre.toLowerCase().includes('botiquín') || i.nombre.toLowerCase().includes('kit'));
    if (!kitMedico) return interaction.reply({ embeds: [E.err('Sin kit', 'Necesitas un kit médico en el inventario.\nCómpralo en `/tienda`.')], flags: 64 });

    const target = interaction.options.getUser('usuario');
    const cantidadCura = interaction.options.getInteger('cantidad') || kitMedico.efecto?.salud || 25;
    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese jugador no tiene personaje.')], flags: 64 });

    const saludAntes = Math.floor(targetPlayer.salud);
    targetPlayer.salud = Math.min(100, targetPlayer.salud + cantidadCura);
    inv.removeItem(kitMedico.nombre, 1);
    await targetPlayer.save();
    await inv.save();

    try {
      const u = await client.users.fetch(target.id);
      await u.send(`🏥 **${healer.getFullName()}** te curó +${cantidadCura} de salud. Salud actual: ${Math.floor(targetPlayer.salud)}%`);
    } catch {}

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('💉 Curación aplicada')
        .setDescription(`**${healer.getFullName()}** curó a **${targetPlayer.getFullName()}**`)
        .setThumbnail(ICONS.curar)
        .addFields(
          { name: 'Salud antes', value: `${saludAntes}%`, inline: true },
          { name: 'Salud ahora', value: `${Math.floor(targetPlayer.salud)}%`, inline: true },
          { name: 'Restaurado', value: `+${cantidadCura}`, inline: true },
        )
        .setTimestamp()],
    });
  }

  if (cmd === 'estado') {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const player = await getPlayer(target.id, target.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Sin personaje creado.')], flags: 64 });

    const E2 = require('../utils/embeds');
    const barra = E2.barraVida;

    const estadoEmbed = new EmbedBuilder()
      .setColor(player.muerto ? config.colors.danger : player.salud < 30 ? config.colors.warning : config.colors.success)
      .setTitle(`🏥 Estado médico — ${player.getFullName()}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));
    const embed = estadoEmbed
      .addFields(
        { name: '❤️ Salud', value: `${barra(player.salud)} **${Math.floor(player.salud)}%**`, inline: false },
        { name: '🍔 Hambre', value: `${barra(player.hambre)} **${Math.floor(player.hambre)}%**`, inline: false },
        { name: '💧 Sed', value: `${barra(player.sed)} **${Math.floor(player.sed)}%**`, inline: false },
        { name: '🚨 Estado', value: player.muerto ? '💀 **MUERTO**' : player.enHospital ? '🏥 **HOSPITALIZADO**' : player.buscado ? '🚨 **BUSCADO**' : '✅ Normal', inline: true },
      )
      .setTimestamp();

    if (player.enHospital && player.tiempoHospital) {
      const restante = player.tiempoHospital.getTime() - Date.now();
      if (restante > 0) embed.addFields({ name: '⏰ Sale del hospital', value: formatCooldown(restante), inline: true });
    }

    return interaction.reply({ embeds: [embed] });
  }

  if (cmd === 'revivir') {
    if (!hasMedicRole(interaction.member)) return interaction.reply({ embeds: [E.err('Sin permiso', 'Solo los médicos pueden revivir jugadores.')], flags: 64 });

    const target = interaction.options.getUser('usuario');
    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese jugador no tiene personaje.')], flags: 64 });
    if (!targetPlayer.muerto && !targetPlayer.enHospital) return interaction.reply({ embeds: [E.warn('No herido', 'Ese jugador no está herido ni en el hospital.')], flags: 64 });

    targetPlayer.muerto = false;
    targetPlayer.enHospital = false;
    targetPlayer.tiempoHospital = null;
    targetPlayer.salud = 50;
    await targetPlayer.save();

    try {
      const u = await client.users.fetch(target.id);
      await u.send(`🏥 Has sido revivido por el personal médico. Tu salud fue restaurada al 50%.`);
    } catch {}

    const revEmbed = E.ok('Revivido', `**${targetPlayer.getFullName()}** ha sido revivido con el 50% de salud.`);
    addImage(revEmbed, 'revivir');
    return interaction.reply({ embeds: [revEmbed] });
  }
}

// ─── Prefix ────────────────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'estado',
    aliases: ['salud', 'health', 'vida'],
    description: 'Ver tu estado de salud',
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const player = await getPlayer(target.id, target.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      const embed = new EmbedBuilder()
        .setColor(player.muerto ? config.colors.danger : config.colors.success)
        .setTitle(`❤️ Estado de ${player.getFullName()}`)
        .addFields(
          { name: 'Salud', value: `${Math.floor(player.salud)}%`, inline: true },
          { name: 'Hambre', value: `${Math.floor(player.hambre)}%`, inline: true },
          { name: 'Sed', value: `${Math.floor(player.sed)}%`, inline: true },
          { name: 'Estado', value: player.muerto ? '💀 Muerto' : player.enHospital ? '🏥 Hospitalizado' : '✅ Normal', inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands };
