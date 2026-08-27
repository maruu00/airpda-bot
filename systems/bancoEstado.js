'use strict';

const BancoEstado = require('../database/models/BancoEstado');
const Player = require('../database/models/Player');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const INTERVALO_MS = 168 * 60 * 60 * 1000; // 168h = 7 días
const PORCENTAJE = 0.02;
const MINIMO = 10000;

async function ejecutarRecaudacion(guild, motivo = 'Recaudación automática 2% cada 7 días') {
  const banco = await BancoEstado.findOneAndUpdate(
    { guildId: guild.id },
    { $setOnInsert: { saldo: 0, totalRecaudado: 0 } },
    { upsert: true, new: true }
  );

  const jugadores = await Player.find({ personajeCreado: true }).lean();
  let recaudado = 0;
  let afectados = 0;
  let exentos = 0;

  for (const p of jugadores) {
    const total = (p.cash || 0) + (p.bank || 0);
    if (total < MINIMO) { exentos++; continue; }
    const quitar = Math.floor(total * PORCENTAJE);
    if (quitar <= 0) { exentos++; continue; }
    // Quitar proporcional de cash y banco
    let restante = quitar;
    let cash = p.cash || 0;
    let bank = p.bank || 0;
    const deCash = Math.min(cash, restante);
    cash -= deCash; restante -= deCash;
    const deBank = Math.min(bank, restante);
    bank -= deBank; restante -= deBank;
    // Si aún queda (por redondeo), quitar de banco
    if (restante > 0) bank = Math.max(0, bank - restante);

    await Player.updateOne({ discordId: p.discordId }, { $set: { cash, bank } });
    recaudado += quitar;
    afectados++;
  }

  banco.saldo += recaudado;
  banco.totalRecaudado += recaudado;
  banco.ultimaRecaudacion = new Date();
  banco.historial.push({ fecha: new Date(), recaudado, afectados, exentos });
  if (banco.historial.length > 20) banco.historial = banco.historial.slice(-20);
  await banco.save();

  // Log en canal de logs si existe
  try {
    const GuildConfig = require('../database/models/GuildConfig');
    const gc = await GuildConfig.findOne({ guildId: guild.id }).lean();
    const chId = gc?.canales?.modLogs || gc?.canales?.economia;
    if (chId) {
      const ch = await guild.channels.fetch(chId).catch(() => null);
      if (ch) {
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('🏦 Banco del Estado — Recaudación 2%')
          .setDescription(`${motivo}\n\n**Recaudado:** ${recaudado.toLocaleString('es-ES')} €\n**Afectados:** ${afectados} · **Exentos (<10k):** ${exentos}\n**Saldo Estado:** ${(banco.saldo).toLocaleString('es-ES')} €`)
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch {}

  return { recaudado, afectados, exentos, saldo: banco.saldo };
}

function iniciarBancoEstado(client) {
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        const banco = await BancoEstado.findOne({ guildId: guild.id }).lean();
        const ultima = banco?.ultimaRecaudacion ? new Date(banco.ultimaRecaudacion).getTime() : 0;
        if (!ultima || Date.now() - ultima >= INTERVALO_MS) {
          await ejecutarRecaudacion(guild);
        }
      } catch (e) { console.error('[BancoEstado] Intervalo error:', e.message); }
    }
  }, 60 * 60 * 1000); // revisar cada hora
}

module.exports = { ejecutarRecaudacion, iniciarBancoEstado, INTERVALO_MS, PORCENTAJE, MINIMO };