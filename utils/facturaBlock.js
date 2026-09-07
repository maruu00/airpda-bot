const Factura = require('../database/models/Factura');
const { EmbedBuilder } = require('discord.js');

/**
 * Comprueba si un usuario tiene facturas pendientes.
 * Si tiene, responde con embed de bloqueo y retorna true (bloqueado).
 * Si no, retorna false (puede continuar).
 * Permite solo: /billetera, /banco estado, /factura-lista, /pagar-factura
 */
async function checkFacturaBlock(interaction, discordId) {
  const targetId = discordId || interaction.user.id;
  const count = await Factura.countDocuments({ clienteId: targetId, pagada: false });
  if (count > 0) {
    const pendientes = await Factura.find({ clienteId: targetId, pagada: false }).sort({ creadoEn: -1 }).limit(3).lean();
    const lista = pendientes.map(f => `\`${f.facturaId}\` — ${f.concepto} — **$${f.importe.toLocaleString('es-ES')}**`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🔴 Acción bloqueada — Facturas pendientes')
      .setDescription(
        `Tienes **${count} factura(s) pendiente(s)** y estás **bloqueado** para transferencias/pagos.\n\n` +
        `${lista}\n\n` +
        `> Solo puedes usar:\n` +
        `> • \`/billetera\` — ver tu dinero\n` +
        `> • \`/factura-lista\` — ver facturas\n` +
        `> • \`/pagar-factura [ID]\` — pagar\n\n` +
        `Paga con \`/pagar-factura ${pendientes[0].facturaId}\` o usa los botones de \`/factura-lista\`.`
      )
      .setFooter({ text: 'Sistema de Facturas — Debes saldar todas para desbloquearte' })
      .setTimestamp();

    // Intentar responder según estado de interacción
    try {
      if (interaction.deferred) await interaction.editReply({ embeds: [embed] });
      else if (interaction.replied) await interaction.followUp({ embeds: [embed], ephemeral: true });
      else await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch {}
    return true;
  }
  return false;
}

async function hasFacturasPendientes(discordId) {
  const c = await Factura.countDocuments({ clienteId: discordId, pagada: false });
  return c > 0;
}

module.exports = { checkFacturaBlock, hasFacturasPendientes };
