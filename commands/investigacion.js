/**
 * INVESTIGACION — Crear y gestionar investigaciones desde Discord
 * Slash: /investigacion crear | /investigacion lista | /investigacion actualizar
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pdaApi = require('../utils/pdaApi');
const { getPlayer, requireBadge } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');

const data = new SlashCommandBuilder()
  .setName('investigacion')
  .setDescription('Gestión de investigaciones confidenciales (sincronizado con PDA)')

  .addSubcommand(s => s.setName('crear')
    .setDescription('[POLICÍA] Abrir una nueva investigación en el dashboard')
    .addStringOption(o => o.setName('titulo').setDescription('Título de la investigación').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('descripcion').setDescription('Descripción de la investigación').setRequired(true).setMaxLength(500))
    .addStringOption(o => o.setName('clasificacion').setDescription('Nivel de clasificación').setRequired(false)
      .addChoices(
        { name: '🟡 Confidencial', value: 'confidencial' },
        { name: '🟠 Secreto', value: 'secreto' },
        { name: '🔴 Alto Secreto', value: 'alto secreto' },
      ))
    .addStringOption(o => o.setName('sospechosos').setDescription('Sospechosos (separados por coma)').setRequired(false).setMaxLength(300))
    .addStringOption(o => o.setName('notas').setDescription('Notas iniciales').setRequired(false).setMaxLength(300)))

  .addSubcommand(s => s.setName('lista')
    .setDescription('Ver investigaciones abiertas'))

  .addSubcommand(s => s.setName('actualizar')
    .setDescription('[POLICÍA] Actualizar el estado de una investigación')
    .addStringOption(o => o.setName('id').setDescription('ID MongoDB de la investigación').setRequired(true))
    .addStringOption(o => o.setName('estado').setDescription('Nuevo estado').setRequired(true)
      .addChoices(
        { name: '🔍 Abierta', value: 'abierta' },
        { name: '🔄 En curso', value: 'en curso' },
        { name: '✅ Cerrada', value: 'cerrada' },
      ))
    .addStringOption(o => o.setName('notas').setDescription('Notas de actualización').setRequired(false).setMaxLength(300)));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'lista') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar investigaciones.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const investigs = await pdaApi.getInvestigaciones().catch(() => []);
    if (!investigs.length) {
      return interaction.editReply({ embeds: [E.info('Sin investigaciones', 'No hay investigaciones abiertas.')] });
    }

    const clasifEmoji = { 'alto secreto': '🔴', 'secreto': '🟠', 'confidencial': '🟡' };
    const embed = new EmbedBuilder()
      .setColor(config.colors.purple)
      .setTitle('🔍 Investigaciones abiertas')
      .setTimestamp();

    for (const inv of investigs.slice(0, 8)) {
      embed.addFields({
        name: `${clasifEmoji[inv.clasificacion] || '⚪'} ${inv.titulo || 'Sin título'}`,
        value: `🔒 ${inv.clasificacion || 'N/A'} · 📁 ${inv.estado || 'N/A'}\n👤 Sospechosos: ${(inv.sospechosos || []).join(', ') || 'Ninguno'}\n📅 ${new Date(inv.fecha).toLocaleDateString('es-ES')}\n🆔 \`${inv._id}\``,
        inline: false,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'crear') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar investigaciones.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const titulo        = interaction.options.getString('titulo');
    const descripcion   = interaction.options.getString('descripcion');
    const clasificacion = interaction.options.getString('clasificacion') || 'confidencial';
    const sospechososStr = interaction.options.getString('sospechosos') || '';
    const notas         = interaction.options.getString('notas') || '';
    const sospechosos   = sospechososStr ? sospechososStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    const player = await getPlayer(interaction.user.id, interaction.user.username);
    const nombreAgente = player.personajeCreado ? player.getFullName() : interaction.user.tag;

    const investigacion = await pdaApi.crearInvestigacion({
      titulo,
      descripcion,
      clasificacion,
      sospechosos,
      agentes: [nombreAgente],
      notas,
      estado: 'abierta',
    }).catch(() => null);

    if (!investigacion) return interaction.editReply({ embeds: [E.err('Error', 'No se pudo crear la investigación.')] });

    const clasifColors = { 'alto secreto': config.colors.danger, 'secreto': 0xf97316, 'confidencial': config.colors.warning };

    // Log en mod-logs (investigaciones son confidenciales)
    const gc = await GuildConfig.findOne({ guildId: interaction.guildId }).catch(() => null);
    const logCh = gc?.canales?.modLogs ? interaction.guild.channels.cache.get(gc.canales.modLogs) : null;
    if (logCh) {
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor(clasifColors[clasificacion] || config.colors.warning)
          .setTitle(`🔍 Nueva investigación — ${clasificacion.toUpperCase()}`)
          .addFields(
            { name: '📌 Título',         value: titulo,                            inline: true },
            { name: '🔒 Clasificación',   value: clasificacion,                    inline: true },
            { name: '👤 Sospechosos',     value: sospechosos.join(', ') || 'N/A',  inline: false },
            { name: '👮 Abierta por',     value: nombreAgente,                      inline: true },
          ).setTimestamp()],
      }).catch(() => {});
    }

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(clasifColors[clasificacion] || config.colors.warning)
        .setTitle('✅ Investigación abierta')
        .setDescription(`**${titulo}** registrada en el dashboard PDA.`)
        .addFields(
          { name: '🔒 Clasificación', value: clasificacion.toUpperCase(),         inline: true },
          { name: '📁 Estado',        value: 'Abierta',                           inline: true },
          { name: '👤 Sospechosos',   value: sospechosos.join(', ') || 'Ninguno', inline: false },
        )
        .setFooter({ text: `ID: ${investigacion._id} · Visible en el dashboard` })
        .setTimestamp()],
    });
  }

  if (sub === 'actualizar') {
    if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff])) {
      return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial puede gestionar investigaciones.')], flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });

    const id     = interaction.options.getString('id');
    const estado = interaction.options.getString('estado');
    const notas  = interaction.options.getString('notas') || undefined;

    const updateData = { estado };
    if (notas) updateData.notas = notas;

    const result = await pdaApi.actualizarInvestigacion(id, updateData).catch(() => null);
    if (!result) return interaction.editReply({ embeds: [E.err('Error', 'No se encontró la investigación con ese ID MongoDB.')] });

    const estadoEmoji = { abierta: '🔍', 'en curso': '🔄', cerrada: '✅' };
    return interaction.editReply({
      embeds: [E.ok('Investigación actualizada', `**${result.titulo || 'Investigación'}** → Estado: ${estadoEmoji[estado] || ''} **${estado.toUpperCase()}**`)],
    });
  }
}

module.exports = { data, execute };
