/**
 * OPERATIVO — Crear y gestionar operativos desde Discord
 * Slash: /operativo crear | /operativo lista | /operativo cerrar
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pdaApi = require('../utils/pdaApi');
const { getPlayer, requireBadge } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');

const data = new SlashCommandBuilder()
  .setName('operativo')
  .setDescription('Gestión de operativos policiales (sincronizado con PDA)')

  .addSubcommand(s => s.setName('crear')
    .setDescription('[POLICÍA] Crear un nuevo operativo en el dashboard')
    .addStringOption(o => o.setName('nombre').setDescription('Nombre del operativo').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('descripcion').setDescription('Descripción del operativo').setRequired(true).setMaxLength(500))
    .addStringOption(o => o.setName('zona').setDescription('Zona de actuación').setRequired(false).setMaxLength(100))
    .addStringOption(o => o.setName('prioridad').setDescription('Nivel de prioridad').setRequired(false)
      .addChoices(
        { name: '🟢 Baja', value: 'baja' },
        { name: '🔵 Media', value: 'media' },
        { name: '🟡 Alta', value: 'alta' },
        { name: '🔴 Crítica', value: 'critica' },
      ))
    .addStringOption(o => o.setName('estado').setDescription('Estado inicial').setRequired(false)
      .addChoices(
        { name: '📋 Planificación', value: 'planificacion' },
        { name: '🟢 Activo', value: 'activo' },
      ))
    .addStringOption(o => o.setName('agentes').setDescription('Agentes asignados (separados por coma)').setRequired(false).setMaxLength(300))
    .addStringOption(o => o.setName('notas').setDescription('Notas adicionales').setRequired(false).setMaxLength(300)))

  .addSubcommand(s => s.setName('lista')
    .setDescription('Ver operativos activos y en planificación'))

  .addSubcommand(s => s.setName('cerrar')
    .setDescription('[POLICÍA] Cambiar el estado de un operativo')
    .addStringOption(o => o.setName('id').setDescription('ID MongoDB del operativo').setRequired(true))
    .addStringOption(o => o.setName('estado').setDescription('Nuevo estado').setRequired(true)
      .addChoices(
        { name: '🟢 Activo', value: 'activo' },
        { name: '✅ Completado', value: 'completado' },
        { name: '❌ Cancelado', value: 'cancelado' },
      )));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'lista') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar operativos.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const operativos = await pdaApi.getOperativos().catch(() => []);
    if (!operativos.length) {
      return interaction.editReply({ embeds: [E.info('Sin operativos', 'No hay operativos activos ni en planificación.')] });
    }

    const prioriEmoji = { critica: '🔴', alta: '🟡', media: '🔵', baja: '🟢' };
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🎯 Operativos activos')
      .setTimestamp();

    for (const op of operativos.slice(0, 8)) {
      embed.addFields({
        name: `${op.estado === 'activo' ? '🟢' : '🟡'} ${op.nombre || 'Sin nombre'}`,
        value: `${prioriEmoji[op.prioridad] || '🔵'} Prioridad **${op.prioridad || 'media'}** · 📍 ${op.zona || 'N/A'}\n📁 Estado: ${op.estado} · 👮 ${(op.agentesAsignados || []).length} agentes\n📅 ${new Date(op.fecha).toLocaleDateString('es-ES')}\n🆔 \`${op._id}\``,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'crear') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar operativos.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const nombre      = interaction.options.getString('nombre');
    const descripcion = interaction.options.getString('descripcion');
    const zona        = interaction.options.getString('zona') || 'Sin especificar';
    const prioridad   = interaction.options.getString('prioridad') || 'media';
    const estado      = interaction.options.getString('estado') || 'planificacion';
    const agentesStr  = interaction.options.getString('agentes') || '';
    const notas       = interaction.options.getString('notas') || '';
    const agentes     = agentesStr ? agentesStr.split(',').map(a => a.trim()).filter(Boolean) : [];

    const player = await getPlayer(interaction.user.id, interaction.user.username);
    const nombreAgente = player.personajeCreado ? player.getFullName() : interaction.user.tag;
    if (!agentes.includes(nombreAgente)) agentes.unshift(nombreAgente);

    const operativo = await pdaApi.crearOperativo({
      nombre,
      descripcion,
      zona,
      prioridad,
      estado,
      agentesAsignados: agentes,
      notas,
    }).catch(() => null);

    if (!operativo) return interaction.editReply({ embeds: [E.err('Error', 'No se pudo crear el operativo.')] });

    // Notificar en canal policial
    const gc = await GuildConfig.findOne({ guildId: interaction.guildId }).catch(() => null);
    const poliCh = gc?.canales?.policia ? interaction.guild.channels.cache.get(gc.canales.policia) : null;
    const prioriColors = { critica: 0xef4444, alta: 0xf59e0b, media: 0x3b82f6, baja: 0x22c55e };

    if (poliCh) {
      poliCh.send({
        embeds: [new EmbedBuilder()
          .setColor(prioriColors[prioridad] || config.colors.primary)
          .setTitle(`🎯 Nuevo operativo — ${nombre}`)
          .addFields(
            { name: '📋 Descripción',  value: descripcion.slice(0, 200),    inline: false },
            { name: '📍 Zona',         value: zona,                          inline: true },
            { name: '🎯 Prioridad',    value: prioridad.toUpperCase(),       inline: true },
            { name: '📁 Estado',       value: estado,                        inline: true },
            { name: '👮 Agentes',      value: agentes.join(', ') || 'N/A',  inline: false },
          )
          .setFooter({ text: `Creado por ${nombreAgente} · ID: ${operativo._id}` })
          .setTimestamp()],
      }).catch(() => {});
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(prioriColors[prioridad] || config.colors.primary)
        .setTitle('✅ Operativo creado')
        .setDescription(`**${nombre}** registrado en el dashboard PDA.`)
        .addFields(
          { name: '📍 Zona',      value: zona,                    inline: true },
          { name: '🎯 Prioridad', value: prioridad.toUpperCase(), inline: true },
          { name: '📁 Estado',    value: estado,                  inline: true },
        )
        .setFooter({ text: `ID: ${operativo._id} · Visible en el dashboard` })
        .setTimestamp()],
    });
  }

  if (sub === 'cerrar') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar operativos.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const id     = interaction.options.getString('id');
    const estado = interaction.options.getString('estado');

    const result = await pdaApi.actualizarOperativo(id, { estado }).catch(() => null);
    if (!result) return interaction.editReply({ embeds: [E.err('Error', 'No se encontró el operativo con ese ID MongoDB.')] });

    const estadoEmoji = { activo: '🟢', completado: '✅', cancelado: '❌' };
    return interaction.editReply({
      embeds: [E.ok('Operativo actualizado', `**${result.nombre || 'Operativo'}** → Estado: ${estadoEmoji[estado] || ''} **${estado.toUpperCase()}**`)],
    });
  }
}

module.exports = { data, execute };
