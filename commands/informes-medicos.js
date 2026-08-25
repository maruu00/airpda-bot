/**
 * INFORMES MÉDICOS — Informes de pacientes (LSCFD) e informes personales de agentes
 * Slash: /informe-paciente crear | lista
 *        /informe-personal crear | lista
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pdaApi = require('../utils/pdaApi');
const { getPlayer, requireBadge } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');

const data = [
  // new SlashCommandBuilder()
  //   .setName('informe-paciente')
  //   .setDescription('Gestión de informes de pacientes — LSCFD / EMS')
  //   .addSubcommand(s => s.setName('crear')
  //     .setDescription('[BOMBEROS/EMS] Registrar informe de paciente en el dashboard')
  //     .addStringOption(o => o.setName('paciente').setDescription('Nombre del paciente').setRequired(true).setMaxLength(100))
  //     .addStringOption(o => o.setName('incidente').setDescription('Descripción del incidente').setRequired(true).setMaxLength(400))
  //     .addStringOption(o => o.setName('tratamiento').setDescription('Tratamiento aplicado').setRequired(true).setMaxLength(300))
  //     .addStringOption(o => o.setName('edad').setDescription('Edad aproximada del paciente').setRequired(false).setMaxLength(10))
  //     .addStringOption(o => o.setName('estado').setDescription('Estado del paciente').setRequired(false)
  //       .addChoices(
  //         { name: '✅ Estable', value: 'estable' },
  //         { name: '⚠️ Grave', value: 'grave' },
  //         { name: '🔴 Crítico', value: 'critico' },
  //         { name: '💀 Fallecido', value: 'fallecido' },
  //         { name: '🏥 Hospitalizado', value: 'hospitalizado' },
  //       ))
  //     .addStringOption(o => o.setName('notas').setDescription('Notas adicionales').setRequired(false).setMaxLength(300)))
  //   .addSubcommand(s => s.setName('lista')
  //     .setDescription('Ver últimos informes de pacientes')),

  new SlashCommandBuilder()
    .setName('informe-personal')
    .setDescription('Gestión de informes personales de servicio')

    .addSubcommand(s => s.setName('crear')
      .setDescription('[POLICÍA/BOMBEROS] Registrar informe personal de servicio')
      .addStringOption(o => o.setName('titulo').setDescription('Título del informe').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('descripcion').setDescription('Descripción detallada').setRequired(true).setMaxLength(500))
      .addStringOption(o => o.setName('tipo').setDescription('Tipo de informe').setRequired(false)
        .addChoices(
          { name: '🚔 Servicio policial', value: 'servicio' },
          { name: '🏥 Servicio médico', value: 'medico' },
          { name: '🚒 Servicio bomberos', value: 'bomberos' },
          { name: '📋 Informe general', value: 'general' },
        )))

    .addSubcommand(s => s.setName('lista')
      .setDescription('Ver mis informes personales')
      .addBooleanOption(o => o.setName('todos').setDescription('Ver todos los informes (solo admin)').setRequired(false))),
];

async function execute(interaction) {
  const cmd = interaction.commandName;
  const sub = interaction.options.getSubcommand();

  // ── INFORME PACIENTE ─────────────────────────────────────────────────────────
  if (cmd === 'informe-paciente') {
    if (sub === 'crear') {
      if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff, config.roles.bombero])) {
        return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial/bombero puede usar estos comandos.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const paciente    = interaction.options.getString('paciente');
      const incidente   = interaction.options.getString('incidente');
      const tratamiento = interaction.options.getString('tratamiento');
      const edad        = interaction.options.getString('edad') || 'N/A';
      const estado      = interaction.options.getString('estado') || 'estable';
      const notas       = interaction.options.getString('notas') || '';

      const player = await getPlayer(interaction.user.id, interaction.user.username);
      const nombreAgente = player.personajeCreado ? player.getFullName() : interaction.user.tag;

      const informe = await pdaApi.crearInformePaciente({
        paciente,
        edad,
        incidente,
        tratamiento,
        estado,
        notas,
        agente: nombreAgente,
      }).catch(() => null);

      if (!informe) return interaction.editReply({ embeds: [E.err('Error', 'No se pudo registrar el informe.')] });

      const estadoColors = { estable: config.colors.success, grave: config.colors.warning, critico: config.colors.danger, fallecido: 0x000000, hospitalizado: config.colors.info };

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(estadoColors[estado] || config.colors.success)
          .setTitle('🏥 Informe de paciente registrado')
          .addFields(
            { name: '👤 Paciente',     value: paciente,   inline: true },
            { name: '🎂 Edad',         value: edad,       inline: true },
            { name: '💊 Estado',       value: estado,     inline: true },
            { name: '🚑 Incidente',    value: incidente.slice(0, 200),   inline: false },
            { name: '💉 Tratamiento',  value: tratamiento.slice(0, 200), inline: false },
          )
          .setFooter({ text: `Registrado por ${nombreAgente} · Visible en dashboard` })
          .setTimestamp()],
      });
    }

    if (sub === 'lista') {
      if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff, config.roles.bombero])) {
        return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial/bombero puede usar estos comandos.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const informes = await pdaApi.getInformesPacientes().catch(() => []);
      if (!informes.length) return interaction.editReply({ embeds: [E.info('Sin informes', 'No hay informes de pacientes registrados.')] });

      const embed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🏥 Últimos informes de pacientes')
        .setTimestamp();

      for (const inf of informes.slice(0, 8)) {
        const estadoEmoji = { estable: '✅', grave: '⚠️', critico: '🔴', fallecido: '💀', hospitalizado: '🏥' };
        embed.addFields({
          name: `${estadoEmoji[inf.estado] || '❓'} ${inf.paciente || 'N/A'} — ${inf.edad || '?'} años`,
          value: `🚑 ${inf.incidente?.slice(0, 100) || 'N/A'}\n💉 ${inf.tratamiento?.slice(0, 80) || 'N/A'}\n👮 ${inf.agente || 'N/A'} · 📅 ${new Date(inf.fecha).toLocaleDateString('es-ES')}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  }

  // ── INFORME PERSONAL ─────────────────────────────────────────────────────────
  if (cmd === 'informe-personal') {
    if (sub === 'crear') {
      if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff, config.roles.bombero])) {
        return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial/bombero puede usar estos comandos.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const titulo      = interaction.options.getString('titulo');
      const descripcion = interaction.options.getString('descripcion');
      const tipo        = interaction.options.getString('tipo') || 'servicio';

      const player = await getPlayer(interaction.user.id, interaction.user.username);
      const nombreAgente = player.personajeCreado ? player.getFullName() : interaction.user.tag;

      const informe = await pdaApi.crearInformePersonal({
        titulo,
        descripcion,
        tipo,
        agenteId:  interaction.user.id,
        agente:    nombreAgente,
      }).catch(() => null);

      if (!informe) return interaction.editReply({ embeds: [E.err('Error', 'No se pudo registrar el informe.')] });

      return interaction.editReply({
        embeds: [E.ok('Informe personal registrado', `**${titulo}** ha sido guardado en el dashboard PDA.\nTipo: ${tipo.toUpperCase()}`)],
      });
    }

    if (sub === 'lista') {
      if (!requireBadge(interaction.member, [config.roles.policia, config.roles.sheriff, config.roles.bombero])) {
        return interaction.reply({ embeds: [E.err('Sin autorización', 'Solo el personal policial/bombero puede usar estos comandos.')], ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const todos = interaction.options.getBoolean('todos') && interaction.member.permissions.has('Administrator');
      const agenteId = todos ? null : interaction.user.id;

      const informes = await pdaApi.getInformesPersonales(agenteId).catch(() => []);
      if (!informes.length) return interaction.editReply({ embeds: [E.info('Sin informes', todos ? 'No hay informes personales.' : 'No tienes informes personales registrados.')] });

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(todos ? '📋 Todos los informes personales' : '📋 Mis informes personales')
        .setTimestamp();

      for (const inf of informes.slice(0, 8)) {
        embed.addFields({
          name: `📋 ${inf.titulo || 'Sin título'} — ${(inf.tipo || 'servicio').toUpperCase()}`,
          value: `${inf.descripcion?.slice(0, 120) || 'N/A'}\n👮 ${inf.agente || 'N/A'} · 📅 ${new Date(inf.fecha).toLocaleDateString('es-ES')}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }
  }
}

module.exports = { data, execute };
