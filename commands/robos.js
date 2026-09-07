/**
 * ROBOS — Sistema completo de atracos con minijuegos
 * Slash: /atracar /secuestrar /robos
 * Prefix: !atracar !secuestrar !robos
 *
 * Niveles según reglamento:
 *  EXPRESS  → Licorerías, Peluquerías, Tatuajes, Casas, Desguace, Importación
 *  MEDIANOS → Badulaque/LTD, Tiendas Ropa, Desguace (establecimiento)
 *  MAYORES  → Electrónica, Pawnshop, Farmacia/Ammu, Yate, Joyería
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require('discord.js');
const { getPlayer, getInventory, formatCooldown, formatMoney, rand } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const { ICONS, BANNERS, addImage } = require('../utils/images');
const GuildConfig = require('../database/models/GuildConfig');
const Gang = require('../database/models/Gang');

// ─── Progresión de banda por atracos ──────────────────────────────────────────
async function registrarAtracoDeBanda(player, client) {
  if (!player.gangId) return null;
  try {
    const gang = await Gang.findById(player.gangId);
    if (!gang) return null;
    // Fix: bandas antiguas sin tag rompen la validación de Mongoose en save()
    if (!gang.tag) {
      const gen = String(gang.nombre || 'TAG').replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase() || 'TAG';
      gang.tag = gen;
    }
    gang.atracos = (gang.atracos || 0) + 1;
    const miembro = (gang.miembros || []).find(m => m && m.discordId === String(player.discordId));
    if (miembro) {
      miembro.contribucion = (miembro.contribucion || 0) + 1;
    } else {
      gang.miembros = gang.miembros || [];
      gang.miembros.push({ discordId: String(player.discordId), rango: player.gangRango || 'Recluta', contribucion: 1, unidoEn: new Date() });
    }
    // Sistema INFINITO: nunca se acaban las misiones
    // Cada nivel requiere nivel*10 atracos (cap 100 para que no sea imposible en niveles altos)
    const required = Math.min((gang.nivel || 1) * 10, 100);
    let subio = false;
    let esReyes = false;
    let nivelPrevio = gang.nivel || 1;
    if (gang.atracos >= required) {
      gang.nivel = (gang.nivel || 1) + 1;
      gang.atracos = 0;
      // Reputación escala con nivel: +5 por nivel, +10 extra al llegar a Reyes
      gang.reputacion = (gang.reputacion || 0) + 5 + (gang.nivel >= 10 ? 5 : 0);
      subio = true;
      // Detectar si acaba de llegar a Reyes (nivel 10) - primer ascenso a reyes
      if (nivelPrevio < 10 && gang.nivel >= 10) esReyes = true;
      // Niveles infinitos: no hay tope, sigue subiendo para siempre
    }
    // validateBeforeSave: false evita que bandas con datos legacy fallen por validación
    await gang.save({ validateBeforeSave: false });
    if (subio) {
      try {
        const u = await client.users.fetch(gang.lider);
        // Mensaje diferente si es ascenso a Reyes
        if (esReyes) {
          await u.send({
            embeds: [new EmbedBuilder()
              .setColor(0xFFD700)
              .setTitle(`👑 ¡${gang.nombre} son ahora REYES!`)
              .setDescription(`¡Felicidades! Vuestra banda alcanzó el **nivel ${gang.nivel}** y se ha coronado como **REYES de Los Santos**.\n\n` +
                `> 👑 Las misiones **NUNCA se acaban** — seguís subiendo: nivel ${gang.nivel} -> ${gang.nivel+1} requiere **${Math.min((gang.nivel)*10,100)} atracos**.\n` +
                `> Sigan haciendo atracos, guerras, drogas y territorios para seguir reinando.`)
              .setTimestamp()],
          }).catch(() => {});
        } else {
          const nextReq = Math.min(gang.nivel * 10, 100);
          await u.send({
            embeds: [new EmbedBuilder()
              .setColor(0x00ff88)
              .setTitle(`⬆️ ¡${gang.nombre} subió de nivel!`)
              .setDescription(`Tu banda alcanzó el **nivel ${gang.nivel}** a base de atracos.\n` +
                `**Progreso:** 0/${nextReq} atracos para nivel ${gang.nivel+1}\n` +
                `> 🔁 Misiones infinitas — nunca se acaban, ¡sigan así!` + (gang.nivel >= 10 ? `\n> 👑 **REYES** — nivel ${gang.nivel}` : ''))
              .setTimestamp()],
          }).catch(() => {});
        }
      } catch {}
    }
    return { gangNombre: gang.nombre, subio, nivel: gang.nivel, esReyes, atracos: gang.atracos, required: Math.min(gang.nivel*10,100) };
  } catch (err) {
    console.error('[Gang XP]', err.message);
    return null;
  }
}

// ─── Catálogo de robos ────────────────────────────────────────────────────────
const ROBOS = {
  // ── EXPRESS ─────────────────────────────────────────────────────────────────
  licoreria: {
    nombre: 'Licorería',
    nivel: 'express',
    emoji: '🍾',
    rewardMin: 500,  rewardMax: 1500,
    failChance: 0.20,
    cooldown: 20 * 60 * 1000,
    minPolicia: 1, maxPolicia: 2,
    maxAtracadores: 1,
    armas: 'Solo armas blancas',
    descripcion: 'Una rápida licorería. Botín en efectivo y bebidas.',
    items: [{ id: 'alcohol', nombre: 'Botella de alcohol', emoji: '🍾', cantidad: [1, 3] }],
    esTienda: true,
  },
  peluqueria: {
    nombre: 'Peluquería',
    nivel: 'express',
    emoji: '✂️',
    rewardMin: 300,  rewardMax: 800,
    failChance: 0.18,
    cooldown: 15 * 60 * 1000,
    minPolicia: 1, maxPolicia: 2,
    maxAtracadores: 1,
    armas: 'Solo armas blancas',
    descripcion: 'La peluquería del barrio. No esperes mucho.',
    items: [],
    esTienda: true,
  },
  tatuajes: {
    nombre: 'Estudio de Tatuajes',
    nivel: 'express',
    emoji: '🖊️',
    rewardMin: 400,  rewardMax: 1000,
    failChance: 0.20,
    cooldown: 20 * 60 * 1000,
    minPolicia: 1, maxPolicia: 2,
    maxAtracadores: 1,
    armas: 'Solo armas blancas',
    descripcion: 'El dinero de la caja y algo de equipo.',
    items: [{ id: 'tinta', nombre: 'Tinta de tatuaje', emoji: '🖊️', cantidad: [1, 2] }],
    esTienda: true,
  },
  casa: {
    nombre: 'Robo de Casa',
    nivel: 'express',
    emoji: '🏠',
    rewardMin: 200,  rewardMax: 600,
    failChance: 0.22,
    cooldown: 25 * 60 * 1000,
    minPolicia: 1, maxPolicia: 2,
    maxAtracadores: 1,
    armas: 'Solo armas blancas',
    descripcion: 'Entrar sigilosamente a robar una casa. Cuidado con la familia.',
    items: [
      { id: 'electronico', nombre: 'Electrónico robado', emoji: '📱', cantidad: [1, 2] },
      { id: 'joya_barata', nombre: 'Joya barata', emoji: '💍', cantidad: [0, 1] },
    ],
  },
  importacion: {
    nombre: 'Coche de Importación',
    nivel: 'express',
    emoji: '🚗',
    rewardMin: 1200,  rewardMax: 4000,
    failChance: 0.30,
    cooldown: 30 * 60 * 1000,
    minPolicia: 2, maxPolicia: 4,
    maxAtracadores: 2,
    armas: 'Pistola permitida',
    descripcion: 'Robar un coche de alta gama para llevarlo al desguace.',
    items: [{ id: 'piezas_lujo', nombre: 'Piezas de lujo', emoji: '⚙️', cantidad: [1, 3] }],
  },

  // ── MEDIANOS ─────────────────────────────────────────────────────────────────
  badulaque: {
    nombre: 'Badulaque / LTD',
    nivel: 'mediano',
    emoji: '🏪',
    rewardMin: 800,  rewardMax: 2000,
    failChance: 0.28,
    cooldown: 35 * 60 * 1000,
    minPolicia: 1, maxPolicia: 4,
    maxAtracadores: 2,
    armas: 'Solo armas blancas',
    descripcion: 'La tienda de la esquina. Más botín que una licorería.',
    items: [{ id: 'comida', nombre: 'Comida robada', emoji: '🥫', cantidad: [2, 5] }],
    esTienda: true,
  },
  ropa: {
    nombre: 'Tienda de Ropa',
    nivel: 'mediano',
    emoji: '👕',
    rewardMin: 600,  rewardMax: 1500,
    failChance: 0.26,
    cooldown: 30 * 60 * 1000,
    minPolicia: 1, maxPolicia: 4,
    maxAtracadores: 2,
    armas: 'Solo armas blancas',
    descripcion: 'Ropa de marca y algo de caja.',
    items: [{ id: 'ropa_robada', nombre: 'Ropa robada', emoji: '👕', cantidad: [2, 6] }],
    esTienda: true,
  },
  desguace: {
    nombre: 'Desguace (Establecimiento)',
    nivel: 'mediano',
    emoji: '🔧',
    rewardMin: 1000,  rewardMax: 2500,
    failChance: 0.30,
    cooldown: 40 * 60 * 1000,
    minPolicia: 1, maxPolicia: 4,
    maxAtracadores: 2,
    armas: 'Solo armas blancas',
    descripcion: 'El almacén de piezas. Rehenes aleatorios 1-4.',
    items: [{ id: 'piezas_coche', nombre: 'Piezas de coche', emoji: '⚙️', cantidad: [3, 8] }],
    esTienda: true,
  },

  // ── MAYORES (Solo Bandas Oficiales) ─────────────────────────────────────────
  electronica: {
    nombre: 'Tienda de Electrónica',
    nivel: 'mayor',
    emoji: '📱',
    rewardMin: 3000,  rewardMax: 8000,
    failChance: 0.40,
    cooldown: 60 * 60 * 1000,
    minPolicia: 2, maxPolicia: 6,
    maxAtracadores: 3,
    armas: 'Pistola permitida',
    bandaOficial: true,
    descripcion: 'Dispositivos electrónicos y dinero en caja.',
    items: [
      { id: 'laptop', nombre: 'Laptop robada', emoji: '💻', cantidad: [1, 3] },
      { id: 'movil_gama', nombre: 'Móvil gama alta', emoji: '📱', cantidad: [2, 5] },
    ],
    esTienda: true,
  },
  pawnshop: {
    nombre: 'Pawnshop',
    nivel: 'mayor',
    emoji: '🏷️',
    rewardMin: 2500,  rewardMax: 6000,
    failChance: 0.38,
    cooldown: 60 * 60 * 1000,
    minPolicia: 2, maxPolicia: 6,
    maxAtracadores: 3,
    armas: 'Pistola permitida',
    bandaOficial: true,
    descripcion: 'Casa de empeños. Joyas y efectivo.',
    items: [
      { id: 'joya', nombre: 'Joya empeñada', emoji: '💍', cantidad: [1, 4] },
      { id: 'reloj_lujo', nombre: 'Reloj de lujo', emoji: '⌚', cantidad: [0, 2] },
    ],
    esTienda: true,
  },
  farmacia: {
    nombre: 'Farmacia / Ammu-Nation',
    nivel: 'mayor',
    emoji: '💊',
    rewardMin: 4000,  rewardMax: 10000,
    failChance: 0.42,
    cooldown: 75 * 60 * 1000,
    minPolicia: 4, maxPolicia: 6,
    maxAtracadores: 4,
    armas: 'Pistola permitida',
    bandaOficial: true,
    descripcion: 'Medicamentos y armas. Gran riesgo, gran recompensa.',
    items: [
      { id: 'medicamento', nombre: 'Medicamentos robados', emoji: '💊', cantidad: [5, 15] },
      { id: 'municion', nombre: 'Munición robada', emoji: '🔫', cantidad: [2, 6] },
    ],
    esTienda: true,
  },
  yate: {
    nombre: 'Yate',
    nivel: 'mayor',
    emoji: '🛥️',
    rewardMin: 8000,  rewardMax: 20000,
    failChance: 0.45,
    cooldown: 90 * 60 * 1000,
    minPolicia: 5, maxPolicia: 6,
    maxAtracadores: 8,
    armas: 'Pistola permitida',
    bandaOficial: true,
    descripcion: 'Un yate de lujo anclado en el puerto. Mucho dinero en juego.',
    items: [
      { id: 'joya_lujo', nombre: 'Joya de lujo', emoji: '💎', cantidad: [2, 5] },
      { id: 'alcohol_lujo', nombre: 'Champán de lujo', emoji: '🍾', cantidad: [3, 8] },
    ],
  },
  joyeria: {
    nombre: 'Joyería',
    nivel: 'mayor',
    emoji: '💎',
    rewardMin: 15000,  rewardMax: 40000,
    failChance: 0.50,
    cooldown: 120 * 60 * 1000,
    minPolicia: 6, maxPolicia: 7,
    maxAtracadores: 5,
    armas: 'Pistola, Escopeta, SMG',
    bandaOficial: true,
    inicia2Tiros: true,
    descripcion: 'La joyería más grande de Los Santos. Rol a muerte. Se inicia con 2 tiros al aire.',
    items: [
      { id: 'diamante', nombre: 'Diamante', emoji: '💎', cantidad: [1, 4] },
      { id: 'collar_lujo', nombre: 'Collar de lujo', emoji: '📿', cantidad: [2, 6] },
      { id: 'anillo_oro', nombre: 'Anillo de oro', emoji: '💍', cantidad: [3, 8] },
    ],
  },
};

// ─── Minijuego de atraco ──────────────────────────────────────────────────────

async function ejecutarMinijuego(interaction, player, robo, inv) {
  const fases = robo.nivel === 'mayor' ? 3 : robo.nivel === 'mediano' ? 2 : 1;
  const rehenes = robo.esTienda ? rand(1, 4) : 0;

  // Fase 1 — Preparación
  const prepEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle(`${robo.emoji} Atraco — ${robo.nombre}`)
    .setDescription(
      `**Nivel:** ${robo.nivel.toUpperCase()}  **|**  **Policía:** ${robo.minPolicia}-${robo.maxPolicia}  **|**  **Máx:** ${robo.maxAtracadores}\n` +
      `**Armas:** ${robo.armas}\n` +
      (rehenes ? `👥 **Rehenes:** ${rehenes} ${rehenes === 1 ? 'rehén tomado' : 'rehenes tomados'} (aleatorio 1-4)\n` : '') + `\n` +
      `> ${robo.descripcion}\n\n` +
      `💰 **Botín:** ${formatMoney(robo.rewardMin)} — ${formatMoney(robo.rewardMax)} (sucio)\n` +
      `⚠️ **Riesgo:** ${Math.round(robo.failChance * 100)}%` +
      (robo.inicia2Tiros ? '  ·  🔫 2 disparos al aire' : '') +
      (robo.bandaOficial ? '  ·  👥 Solo Bandas' : ''),
    )
    .setFooter({ text: 'Tienes 30 segundos para confirmar' })
    .setTimestamp();

  const rowPrep = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rob_iniciar').setLabel('🔫 Iniciar atraco').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('rob_cancelar').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
  );

  const msg = await interaction.editReply({ embeds: [prepEmbed], components: [rowPrep] });

  let confirmacion;
  try {
    confirmacion = await msg.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && ['rob_iniciar', 'rob_cancelar'].includes(i.customId),
      time: 30_000,
      componentType: ComponentType.Button,
    });
  } catch {
    await interaction.editReply({ embeds: [E.warn('Tiempo agotado', 'No confirmaste el atraco a tiempo.')], components: [] });
    return;
  }

  if (confirmacion.customId === 'rob_cancelar') {
    await confirmacion.update({ embeds: [E.info('Cancelado', 'Atraco cancelado.')], components: [] });
    return;
  }

  // Fase 2 — Minijuego de memoria (Simon Says)
  const colores = ['🔴', '🟡', '🟢', '🔵'];
  const nombreColor = { '🔴': 'Rojo', '🟡': 'Amarillo', '🟢': 'Verde', '🔵': 'Azul' };

  for (let fase = 1; fase <= fases; fase++) {
    // Generar secuencia aleatoria (3 + fase)
    const seqLen = 2 + fase;
    const secuencia = [];
    for (let i = 0; i < seqLen; i++) secuencia.push(colores[Math.floor(Math.random() * colores.length)]);

    // Mostrar secuencia al jugador (un color cada 1s)
    for (let i = 0; i < seqLen; i++) {
      const showEmbed = new EmbedBuilder()
        .setColor(0x222244)
        .setTitle(`🔫 ATRACO — Fase ${fase}/${fases}`)
        .setDescription(
          `**Memoriza la secuencia de colores:**\n\n` +
          `#${i + 1}: **${nombreColor[secuencia[i]]}** ${secuencia[i]}\n\n` +
          `🔵🟢🟡🔴 *Prepárate para repetirla...*`
        )
        .setFooter({ text: `Secuencia: ${i + 1}/${seqLen}` })
        .setTimestamp();
      const showMsg = fase === 1 && i === 0
        ? await confirmacion.update({ embeds: [showEmbed], components: [], withResponse: true })
        : await interaction.editReply({ embeds: [showEmbed], components: [] });
      await new Promise(r => setTimeout(r, 1200));
    }

    // Pedir al jugador que repita la secuencia
    const inputEmbed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle(`🔫 REPITE LA SECUENCIA — Fase ${fase}/${fases}`)
      .setDescription(
        `Haz clic en los **${seqLen} colores** en el orden correcto.\n\n` +
        `*Tienes 5s por cada color.*`
      )
      .setFooter({ text: `Haz clic en el color #1` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      colores.map(c => new ButtonBuilder().setCustomId(`simon_${c}`).setLabel(c).setStyle(ButtonStyle.Primary)),
    );

    let inputMsg = await interaction.editReply({ embeds: [inputEmbed], components: [row] });

    let aciertos = 0;
    let fallo = false;

    for (let paso = 0; paso < seqLen; paso++) {
      try {
        const click = await inputMsg.awaitMessageComponent({
          filter: i => i.user.id === interaction.user.id && i.customId.startsWith('simon_'),
          time: 6000,
        });
        const elegido = click.customId.replace('simon_', '');
        await click.deferUpdate();

        if (elegido !== secuencia[paso]) {
          fallo = true;
          break;
        }
        aciertos++;

        if (paso < seqLen - 1) {
          await inputMsg.edit({
            embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ Correcto. Ahora el color #${paso + 2}`).setFooter({ text: `Paso ${paso + 2}/${seqLen}` }).setTimestamp()],
            components: [row],
          });
        }
      } catch {
        fallo = true;
        break;
      }
    }

    if (fallo) {
      await interaction.editReply({ embeds: [falloEmbed(robo, player, 'botón')], components: [] });
      await aplicarFallo(player, robo);
      return;
    }

    if (fase < fases) {
      await inputMsg.edit({ embeds: [new EmbedBuilder().setColor(0x00ff88).setTitle(`✅ Fase ${fase} superada`).setDescription(`¡Secuencia correcta! Prepárate para la siguiente fase.`).setTimestamp()], components: [] });
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Comprobar fallo aleatorio final
  if (Math.random() < robo.failChance * 0.5) {
    await interaction.editReply({ embeds: [falloEmbed(robo, player, 'policía')], components: [] });
    await aplicarFallo(player, robo);
    return;
  }

  // ─── Éxito ────────────────────────────────────────────────────────────────
  const botín = rand(robo.rewardMin, robo.rewardMax);
  player.dineroSucio += botín;
  player.ultimoAtracoBotin = botín;
  player.ultimoAtracoFecha = new Date();
  player.robosRealizados++;
  player.setCooldown(`rob_${robo.nombre}`, new Date());
  player.addXP(rand(30, 100));
  await player.save();

  const gangXp = await registrarAtracoDeBanda(player, interaction.client);

  // Items de botín
  const itemsGanados = [];
  for (const itemDef of robo.items) {
    const cant = rand(itemDef.cantidad[0], itemDef.cantidad[1]);
    if (cant > 0) {
      const added = inv.addItem({ id: itemDef.id, nombre: itemDef.nombre, emoji: itemDef.emoji, tipo: 'robo', valor: 100 }, cant);
      if (added) itemsGanados.push(`${itemDef.emoji} **${itemDef.nombre}** x${cant}`);
    }
  }
  await inv.save();

  const exitoEmbed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`✅ ATRACO EXITOSO — ${robo.emoji} ${robo.nombre}`)
    .setDescription(`¡Robaste la tienda con Exito! Ahora toca esperar a que venga la policia para negociar.${rehenes ? `\n👥 **${rehenes} ${rehenes === 1 ? 'rehén liberado' : 'rehenes liberados'}**` : ''}`)
    .addFields(
      { name: '💊 Dinero sucio ganado', value: `**${formatMoney(botín)}**`, inline: true },
      { name: '🧹 Total dinero sucio', value: formatMoney(player.dineroSucio), inline: true },
      rehenes ? { name: '👥 Rehenes', value: `**${rehenes}** ${rehenes === 1 ? 'rehén' : 'rehenes'} tomado${rehenes === 1 ? '' : 's'}`, inline: true } : { name: '​', value: '​', inline: true },
      itemsGanados.length
        ? { name: '🎒 Items robados', value: itemsGanados.join('\n'), inline: false }
        : { name: '​', value: '​', inline: false },
      gangXp
        ? { name: gangXp.subio ? '⬆️ Banda subió de nivel' : gangXp.gangNombre, value: gangXp.subio ? `**${gangXp.gangNombre}** ahora es **nivel ${gangXp.nivel}**` : `Atraco sumado a la banda de ${gangXp.gangNombre}`, inline: true }
        : { name: '​', value: '​', inline: true },
    )
    .setFooter({ text: `💡 Blanquea el dinero sucio con /blanquear — Hoy a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [exitoEmbed], components: [] });

  // ── Alerta automática al canal de policía ──────────────────────────────────
  try {
    const gc = await GuildConfig.findOne({ guildId: interaction.guildId });
    const canales = gc?.canales || {};
    // Prioridad: canal robos → policía → modLogs
    const alertChId = canales.robos || canales.policia || canales.modLogs;
    if (alertChId) {
      const ch = await interaction.guild.channels.fetch(alertChId).catch(() => null);
      if (ch) {
        const dni = require('../utils/embeds').getDNI(interaction.user.id);
        const alertEmbed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle(`🚨 ALERTA POLICIAL — ATRACO ACTIVO`)
          .setDescription(
            `Se ha registrado un atraco en **${robo.emoji} ${robo.nombre}**.\n` +
            `El perpetrador ha escapado con el botín.${rehenes ? `\n👥 **Rehenes:** ${rehenes} civile${rehenes === 1 ? '' : 's'} retenido${rehenes === 1 ? '' : 's'}` : ''}`,
          )
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '🏴‍☠️ Perpetrador',  value: `<@${interaction.user.id}> — **${player.getFullName()}**`, inline: true },
            { name: '🪪 DNI',           value: `\`${dni}\``,                                               inline: true },
            { name: '💼 Trabajo',       value: player.trabajo || 'Desempleado',                           inline: true },
            { name: '📍 Establecimiento', value: `${robo.emoji} ${robo.nombre} (Nivel: ${robo.nivel.toUpperCase()})`, inline: true },
            { name: '💊 Botín estimado', value: `**${formatMoney(botín)}** en dinero sucio`,               inline: true },
            { name: '⚠️ Armas',         value: robo.armas,                                                inline: true },
            ...(rehenes ? [{ name: '👥 Rehenes', value: `**${rehenes}** ${rehenes === 1 ? 'rehén' : 'rehenes'}`, inline: true }] : []),
            { name: '📊 Historial',     value: `Arrestos: ${player.arrestos} · Robos: ${player.robosRealizados}`, inline: false },
          )
          .setFooter({ text: `American Island Rp  ·  Sistema de Robos  •  ${new Date().toLocaleTimeString('es-ES')}` })
          .setTimestamp();

        if (robo.imagen) alertEmbed.setThumbnail(robo.imagen);

        await ch.send({ content: '🚨 @here', embeds: [alertEmbed] }).catch(() =>
          ch.send({ embeds: [alertEmbed] }),
        );
      }
    }
  } catch (e) {
    console.error('[Robos alert]', e.message);
  }
}

// ─── Minijuego para prefix (!atracar) ─────────────────────────────────────────
async function ejecutarMinijuegoPrefix(message, player, robo, inv) {
  const fases = robo.nivel === 'mayor' ? 3 : robo.nivel === 'mediano' ? 2 : 1;
  const rehenesPrefix = robo.esTienda ? rand(1, 4) : 0;

  const colores = ['🔴', '🟡', '🟢', '🔵'];
  const empezar = async (faseActual) => {
    const correcto = Math.floor(Math.random() * 4);
    const btns = colores.map((c, i) =>
      new ButtonBuilder().setCustomId(`robo_${i}`).setLabel(c).setStyle(i === correcto ? ButtonStyle.Success : ButtonStyle.Danger).setDisabled(false)
    );
    // Randomizar orden
    const shuffled = btns.sort(() => Math.random() - 0.5);

    const embed = new EmbedBuilder()
      .setColor(0x1a1a2e)
      .setTitle(`🔧 Fase ${faseActual}/${fases} — ${robo.emoji} ${robo.nombre}`)
      .setDescription(`Elige el cable **correcto** para desactivar la alarma.\n*${colores.length} cables, solo uno es el correcto.*\n\nTienes **15 segundos**.`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(shuffled.map(b => ButtonBuilder.from(b)));
    const sent = await message.channel.send({ embeds: [embed], components: [row] });

    try {
      const click = await sent.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 15000 });
      const idx = parseInt(click.customId.replace('robo_', ''));
      await click.deferUpdate();

      if (idx === correcto) {
        if (faseActual < fases) {
          sent.edit({ embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ Fase ${faseActual} superada. Prepárate para la siguiente.`).setTimestamp()], components: [] });
          await new Promise(r => setTimeout(r, 1500));
          return empezar(faseActual + 1);
        }
        // Todas las fases completadas → ÉXITO
        const botín = rand(robo.rewardMin, robo.rewardMax);
        player.dineroSucio += botín;
        player.ultimoAtracoBotin = botín;
        player.ultimoAtracoFecha = new Date();
        player.robosRealizados++;
        player.addXP(rand(30, 80));
        await player.save();

        const gangXp = await registrarAtracoDeBanda(player, message.client);

        await enviarAlertaPolicia(message, robo, player, false);

        return sent.edit({
          embeds: [new EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle(`✅ Atraco exitoso — ${robo.emoji} ${robo.nombre}`)
            .setDescription(`Has completado las **${fases} fases** con éxito.\n💰 Botín: **${formatMoney(botín)}** (dinero sucio)${rehenesPrefix ? `\n👥 **${rehenesPrefix} ${rehenesPrefix === 1 ? 'rehén' : 'rehenes'}**` : ''}${gangXp ? `\n\n${gangXp.subio ? `⬆️ **${gangXp.gangNombre} subió a nivel ${gangXp.nivel}!**` : `👥 Atraco sumado a ${gangXp.gangNombre}`}` : ''}`)
            .setTimestamp()],
          components: [],
        });
      }

      await sent.delete().catch(() => {});
      const daño = rand(15, 35);
      player.salud = Math.max(0, player.salud - daño);
      player.arrestos++;
      await player.save();
      await enviarAlertaPolicia(message, robo, player, true);
      return message.channel.send({ embeds: [falloEmbed(robo, player, 'botón')] });
    } catch {
      await sent.delete().catch(() => {});
      const daño = rand(15, 35);
      player.salud = Math.max(0, player.salud - daño);
      player.arrestos++;
      await player.save();
      return message.channel.send({ embeds: [falloEmbed(robo, player, 'tiempo')] });
    }
  };

  // Confirmación
  const confEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e)
    .setTitle(`${robo.emoji} Atraco — ${robo.nombre}`)
    .setDescription(
      `**Nivel:** ${robo.nivel.toUpperCase()}\n` +
      `**Fases:** ${fases}\n` +
      `**Botín:** ${formatMoney(robo.rewardMin)} — ${formatMoney(robo.rewardMax)}\n` +
      `**Riesgo:** ${Math.round(robo.failChance * 100)}%\n\n` +
      `_Tendrás que superar **${fases} fases** de desactivación de alarmas._`
    )
    .setTimestamp();

  const confRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('robo_si').setLabel('🔫 Iniciar atraco').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('robo_no').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
  );

  const sent = await message.channel.send({ embeds: [confEmbed], components: [confRow] });
  try {
    const conf = await sent.awaitMessageComponent({ filter: i => i.user.id === message.author.id, time: 30000 });
    if (conf.customId === 'robo_no') {
      player.setCooldown(`rob_${robo.nombre}`, null);
      await player.save();
      return conf.update({ embeds: [E.info('Atraco cancelado', 'Has cancelado el atraco.')], components: [] });
    }
    await conf.deferUpdate();
    sent.edit({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription('🔧 Preparando el atraco...').setTimestamp()], components: [] });
    await new Promise(r => setTimeout(r, 1000));
    await empezar(1);
  } catch {
    sent.edit({ embeds: [E.err('Tiempo agotado', 'No confirmaste a tiempo.')], components: [] });
  }
}

async function enviarAlertaPolicia(message, robo, player, fallo) {
  try {
    const gc = await GuildConfig.findOne({ guildId: message.guild.id });
    const chId = gc?.canales?.policia || gc?.canales?.emergencias;
    if (!chId) return;
    const ch = await message.guild.channels.fetch(chId).catch(() => null);
    if (!ch) return;

    const rehenesAlert = robo.esTienda ? rand(1, 4) : 0;
    const embed = new EmbedBuilder()
      .setColor(fallo ? 0xef4444 : 0xf59e0b)
      .setTitle(fallo ? '🚨 ALARMA — Atraco fallido' : '🔔 Posible atraco en curso')
      .setDescription(
        `**Establecimiento:** ${robo.emoji} ${robo.nombre}\n` +
        `**Sospechoso:** ${message.author.tag}\n` +
        `**Nivel:** ${robo.nivel.toUpperCase()}\n` +
        `**Estado:** ${fallo ? '❌ Fallido — Sospechoso arrestado' : '⚠️ En curso — Posible huida'}` +
        (fallo ? '' : `\n**Botín:** ${formatMoney(rand(robo.rewardMin, robo.rewardMax))}`) +
        (rehenesAlert ? `\n👥 **Rehenes:** ${rehenesAlert}` : '')
      )
      .setTimestamp()
      .setFooter({ text: 'American Island Rp · Alerta de robos' });

    await ch.send({ content: '🚨 @here', embeds: [embed] }).catch(() => {});
  } catch {}
}

function falloEmbed(robo, player, motivo) {
  const motivos = {
    tiempo: '⏰ No actuaste a tiempo. ¡La policía te atrapó!',
    botón: '🚨 Pulsaste el botón equivocado. ¡Alarma disparada!',
    policía: '🚔 La policía llegó demasiado rápido. No pudiste escapar.',
  };
  const em = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle(`❌ ATRACO FALLIDO — ${robo.emoji} ${robo.nombre}`)
    .setThumbnail(ICONS.policia)
    .setDescription(motivos[motivo] || 'El atraco falló.')
    .addFields(
      { name: '📉 Consecuencias', value: 'Pierdes salud y quedas expuesto a la policía.', inline: false },
    )
    .setFooter({ text: `Cooldown activo: ${formatCooldown(robo.cooldown)}` })
    .setTimestamp();
  if (robo.imagen) em.setImage(robo.imagen);
  return em;
}

async function aplicarFallo(player, robo) {
  const daño = rand(15, 40);
  player.salud = Math.max(0, player.salud - daño);
  player.arrestos++;
  player.setCooldown(`rob_${robo.nombre}`, new Date());
  if (player.salud <= 0) {
    player.muerto = true;
    player.enHospital = true;
    player.tiempoHospital = new Date(Date.now() + 5 * 60 * 1000);
  }
  await player.save();
}

// ─── Slash commands ───────────────────────────────────────────────────────────
const data = [
  new SlashCommandBuilder()
    .setName('atracar')
    .setDescription('Atracar un establecimiento con minijuego interactivo')
    .addStringOption(o =>
      o.setName('lugar')
        .setDescription('¿Dónde vas a atracar?')
        .setRequired(true)
        .addChoices(
          { name: '🍾 Licorería (Express)', value: 'licoreria' },
          { name: '✂️ Peluquería (Express)', value: 'peluqueria' },
          { name: '🖊️ Tatuajes (Express)', value: 'tatuajes' },
          { name: '🏠 Casa (Express)', value: 'casa' },
          { name: '🚗 Coche de Importación (Express)', value: 'importacion' },
          { name: '🏪 Badulaque/LTD (Mediano)', value: 'badulaque' },
          { name: '👕 Tienda de Ropa (Mediano)', value: 'ropa' },
          { name: '🔧 Desguace (Mediano)', value: 'desguace' },
          { name: '📱 Tienda Electrónica (Mayor)', value: 'electronica' },
          { name: '🏷️ Pawnshop (Mayor)', value: 'pawnshop' },
          { name: '💊 Farmacia/Ammu-Nation (Mayor)', value: 'farmacia' },
          { name: '🛥️ Yate (Mayor)', value: 'yate' },
          { name: '💎 Joyería (Mayor)', value: 'joyeria' },
        ),
    ),

  new SlashCommandBuilder()
    .setName('robos')
    .setDescription('Ver disponibilidad de robos y lista de establecimientos'),

  new SlashCommandBuilder()
    .setName('secuestrar')
    .setDescription('Secuestrar a un usuario')
    .addUserOption(o => o.setName('victima').setDescription('Usuario a secuestrar').setRequired(true))
    .addStringOption(o => o.setName('metodo').setDescription('Método').setRequired(false)
      .addChoices(
        { name: '🎯 Por la espalda', value: 'espalda' },
        { name: '🚗 Metido en un coche', value: 'coche' },
        { name: '👊 Inconsciente', value: 'inconsciente' },
      )),

  new SlashCommandBuilder()
    .setName('allanar')
    .setDescription('🏠 Allanar una casa para robar')
    .addStringOption(o => o.setName('zona').setDescription('Zona de la casa').setRequired(true)
      .addChoices(
        { name: '🏘️ Casa en Vinewood (Alta)', value: 'alta' },
        { name: '🏡 Casa en el centro (Media)', value: 'media' },
        { name: '🏚️ Casa en LS Este (Baja)', value: 'baja' },
      )),
];

async function execute(interaction, client) {
  const cmd = interaction.commandName;

  if (cmd === 'robos') {
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🏴‍☠️ Sistema de Robos — American Island Rp')
      .setThumbnail(ICONS.atracar)
      .setDescription('Lista de todos los robos disponibles y sus requisitos.')
      .addFields(
        {
          name: '⚡ EXPRESS — Sin aviso policial',
          value: Object.entries(ROBOS)
            .filter(([, r]) => r.nivel === 'express')
            .map(([k, r]) => `${r.emoji} **${r.nombre}** · Botín: ${formatMoney(r.rewardMin)}-${formatMoney(r.rewardMax)} · Policía: ${r.minPolicia}-${r.maxPolicia}`)
            .join('\n'),
        },
        {
          name: '⚠️ MEDIANOS — Usar /robos para verificar',
          value: Object.entries(ROBOS)
            .filter(([, r]) => r.nivel === 'mediano')
            .map(([k, r]) => `${r.emoji} **${r.nombre}** · Botín: ${formatMoney(r.rewardMin)}-${formatMoney(r.rewardMax)} · Policía: ${r.minPolicia}-${r.maxPolicia}`)
            .join('\n'),
        },
        {
          name: '🔥 MAYORES — Solo Bandas Oficiales + Esperar policía',
          value: Object.entries(ROBOS)
            .filter(([, r]) => r.nivel === 'mayor')
            .map(([k, r]) => `${r.emoji} **${r.nombre}** · Botín: ${formatMoney(r.rewardMin)}-${formatMoney(r.rewardMax)} · Policía: ${r.minPolicia}-${r.maxPolicia}`)
            .join('\n'),
        },
      )
      .setFooter({ text: 'Usa /atracar [lugar] para iniciar un robo' })
      .setTimestamp();
    addImage(embed, 'robar');

    return interaction.reply({ embeds: [embed], ephemeral: false });
  }

  if (cmd === 'secuestrar') {
    const victima = interaction.options.getUser('victima');
    const metodo = interaction.options.getString('metodo') || 'espalda';
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje para secuestrar.')], ephemeral: true });

    const targetPlayer = await getPlayer(victima.id, victima.username);
    if (!targetPlayer.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Esa persona no tiene personaje.')], ephemeral: true });

    const metodos = {
      espalda: `**${player.getFullName()}** agarra a **${targetPlayer.getFullName()}** por la espalda y le apunta a la cabeza con un arma. *"No te muevas o disparo."*`,
      coche: `**${player.getFullName()}** fuerza a **${targetPlayer.getFullName()}** a subir a un vehículo a punta de pistola.`,
      inconsciente: `**${player.getFullName()}** deja inconsciente a **${targetPlayer.getFullName()}** y lo secuestra.`,
    };

    const embed = new EmbedBuilder()
      .setColor(0x1a0000)
      .setTitle('🚨 SECUESTRO')
      .setDescription(metodos[metodo])
      .addFields(
        { name: '👤 Secuestrador', value: `<@${interaction.user.id}> — ${player.getFullName()}`, inline: true },
        { name: '🎯 Víctima', value: `<@${victima.id}> — ${targetPlayer.getFullName()}`, inline: true },
      )
      .setFooter({ text: 'American Island Rp RP · Secuestro activo' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Notificar a la víctima por DM
    try {
      await victima.send({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🚨 Has sido secuestrado')
          .setDescription(`**${player.getFullName()}** te ha secuestrado en el servidor.\n\nMétodo: **${metodos[metodo].split('**')[4] || metodo}**\n\n*Coopera con el rol.*`)
          .setTimestamp()],
      });
    } catch {}
    return;
  }

  // ─── ALLANAR ────────────────────────────────────────────────────────────────
  if (cmd === 'allanar') {
    const zona = interaction.options.getString('zona');
    const casa = CASAS[zona];
    if (!casa) return interaction.reply({ embeds: [E.err('Error', 'Zona inválida.')], ephemeral: true });
    await interaction.deferReply();
    const p = await getPlayer(interaction.user.id, interaction.user.username);
    if (!p.personajeCreado) return interaction.editReply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje.')] });
    if (p.muerto || p.enHospital || p.enCarcel) return interaction.editReply({ embeds: [E.err('No disponible', 'No puedes allanar en tu estado actual.')] });
    const cd = p.getCooldown('allanar');
    if (cd && Date.now() - cd.getTime() < 3600000) {
      const r = 3600000 - (Date.now() - cd.getTime());
      return interaction.editReply({ embeds: [E.warn('Cooldown', `Espera **${Math.floor(r/60000)}m** para allanar otra casa.`)] });
    }
    p.setCooldown('allanar', new Date());
    await p.save();
    return ejecutarAllanamiento(interaction, p, zona);
  }

  // cmd === 'atracar'
  const lugarKey = interaction.options.getString('lugar');
  const robo = ROBOS[lugarKey];
  if (!robo) return interaction.reply({ embeds: [E.err('Error', 'Lugar inválido.')], ephemeral: true });

  await interaction.deferReply();

  const player = await getPlayer(interaction.user.id, interaction.user.username);
  if (!player.personajeCreado) return interaction.editReply({ embeds: [E.err('Sin personaje', 'Necesitas un personaje.')] });
  if (player.muerto || player.enHospital) return interaction.editReply({ embeds: [E.err('No disponible', 'No puedes atracar estando herido o en el hospital.')] });
  if (player.enCarcel) return interaction.editReply({ embeds: [E.err('En cárcel', 'No puedes atracar desde la cárcel.')] });

  // Cooldown check
  const lastRob = player.getCooldown(`rob_${robo.nombre}`);
  if (lastRob) {
    const remaining = lastRob.getTime() + robo.cooldown - Date.now();
    if (remaining > 0) {
      return interaction.editReply({ embeds: [E.warn('Cooldown', `Debes esperar **${formatCooldown(remaining)}** para atracar ${robo.nombre} de nuevo.`)] });
    }
  }

  if (robo.bandaOficial && !player.gangId) {
    return interaction.editReply({ embeds: [E.err('Solo Bandas Oficiales', `El robo de **${robo.nombre}** es de nivel mayor y requiere pertenecer a una **banda oficial**. Únete a una banda (web o /banda) e inténtalo de nuevo.`)] });
  }

  const inv = await getInventory(interaction.user.id);
  await ejecutarMinijuego(interaction, player, robo, inv);
}

// ─── ALLANAR (Robo de casas) ──────────────────────────────────────────────────
const CASAS = {
  alta: { nombre: 'Villa en Vinewood', min: 5000, max: 15000, habitaciones: 5, imagen: 'https://i.imgur.com/8pYxqQ4.png' },
  media: { nombre: 'Casa en el Centro', min: 2000, max: 6000, habitaciones: 3, imagen: 'https://i.imgur.com/5jYCgNs.png' },
  baja: { nombre: 'Casa en LS Este', min: 500, max: 2000, habitaciones: 2, imagen: 'https://i.imgur.com/0QeFx37.png' },
};

async function ejecutarAllanamiento(interaction, player, zona) {
  const casa = CASAS[zona];
  const fases = casa.habitaciones;
  const colores = ['🔴', '🟡', '🟢', '🔵'];
  const nombreColor = { '🔴': 'Rojo', '🟡': 'Amarillo', '🟢': 'Verde', '🔵': 'Azul' };

  // ─── Confirmación ───────────────────────────────────────────────────────
  const startEmbed = new EmbedBuilder()
    .setColor(0x1a1a2e).setTitle(`🏠 Allanar — ${casa.nombre}`)
    .setDescription(`**Habitaciones:** ${fases}\n**Botín estimado:** $${casa.min.toLocaleString()} — $${casa.max.toLocaleString()}\n\n_Tendrás que memorizar secuencias de colores para desactivar alarmas._`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('al_iniciar').setLabel('🔫 Iniciar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('al_cancelar').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary),
  );

  const msg = await interaction.editReply({ embeds: [startEmbed], components: [row] });
  try {
    const conf = await msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30000 });
    if (conf.customId === 'al_cancelar') return conf.update({ embeds: [E.info('Cancelado', 'Allanamiento cancelado.')], components: [] });
    await conf.deferUpdate();
  } catch { return msg.edit({ embeds: [E.err('Tiempo', 'No confirmaste a tiempo.')], components: [] }); }

  // ─── Por cada habitación ────────────────────────────────────────────────
  for (let hab = 1; hab <= fases; hab++) {
    const objetos = ['💎 Joyas', '💵 Efectivo', '📱 Electrónicos', '🔫 Arma', '💊 Medicamentos', '🍷 Alcohol'];
    const encontrados = Math.floor(Math.random() * 3) + 1;
    const encontrado = objetos.sort(() => Math.random() - 0.5).slice(0, encontrados);

    const seqLen = 2 + Math.floor(hab / 2);
    const secuencia = [];
    for (let i = 0; i < seqLen; i++) secuencia.push(colores[Math.floor(Math.random() * colores.length)]);

    // Mostrar secuencia
    for (let i = 0; i < seqLen; i++) {
      const showEmbed = new EmbedBuilder()
        .setColor(0x222244)
        .setTitle(`🏠 Allanamiento — Habitación ${hab}/${fases}`)
        .setDescription(
          `**Encontraste:** ${encontrado.join(', ')}\n\n` +
          `🔢 **Memoriza esta combinación:**\n\n` +
          `**#${i + 1}:** ${nombreColor[secuencia[i]]} ${secuencia[i]}`
        )
        .setFooter({ text: `Secuencia: ${i + 1}/${seqLen}` }).setTimestamp();
      await interaction.editReply({ embeds: [showEmbed], components: [] });
      await new Promise(r => setTimeout(r, 1200));
    }

    // Pedir repetir
    const inputEmbed = new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle(`🏠 Repite la combinación — Habitación ${hab}/${fases}`)
      .setDescription(`Haz clic en los **${seqLen} colores** en el orden correcto.\n\n*6 segundos por color.*`)
      .setFooter({ text: `Color #1` }).setTimestamp();

    const btnRow = new ActionRowBuilder().addComponents(
      colores.map(c => new ButtonBuilder().setCustomId(`simon_${c}`).setLabel(c).setStyle(ButtonStyle.Primary)),
    );

    let inputMsg = await interaction.editReply({ embeds: [inputEmbed], components: [btnRow] });
    let aciertos = 0;
    let fallo = false;

    for (let paso = 0; paso < seqLen; paso++) {
      try {
        const click = await inputMsg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id && i.customId.startsWith('simon_'), time: 6000 });
        const elegido = click.customId.replace('simon_', '');
        await click.deferUpdate();
        if (elegido !== secuencia[paso]) { fallo = true; break; }
        aciertos++;
        if (paso < seqLen - 1) {
          await inputMsg.edit({ embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ Correcto. Color #${paso + 2}`).setFooter({ text: `Paso ${paso + 2}/${seqLen}` }).setTimestamp()], components: [btnRow] });
        }
      } catch { fallo = true; break; }
    }

    if (fallo) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ ¡Alarma!').setDescription('La policía ha sido alertada. El dueño llegó.').setTimestamp()], components: [] });
      player.arrestos++; await player.save();
      return;
    }

    if (hab < fases) {
      await inputMsg.edit({ embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ Habitación ${hab} asegurada. Pasa a la siguiente.`).setTimestamp()], components: [] });
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ─── Éxito ──────────────────────────────────────────────────────────────
  const botín = Math.floor(Math.random() * (casa.max - casa.min + 1)) + casa.min;
  player.dineroSucio += botín; player.robosRealizados++; player.addXP(rand(20, 60)); await player.save();

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(0x00ff88).setTitle(`✅ Allanamiento exitoso — ${casa.nombre}`)
      .setDescription(`Registraste las **${fases} habitaciones** y escapaste con **$${botín.toLocaleString()}** en dinero sucio.`).setTimestamp()],
    components: [],
  });

  try {
    const gc = await GuildConfig.findOne({ guildId: interaction.guildId });
    const chId = gc?.canales?.policia || gc?.canales?.emergencias;
    if (chId) {
      const ch = await interaction.guild.channels.fetch(chId).catch(() => null);
      if (ch) await ch.send({ content: '🚨 @here', embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('🔔 Casa allanada').setDescription(`**Zona:** ${casa.nombre}\n**Sospechoso:** ${interaction.user.tag}\n**Botín:** ~$${botín.toLocaleString()}`).setTimestamp()] }).catch(() => {});
    }
  } catch {}
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'atracar',
    aliases: ['rob', 'heist'],
    description: '!atracar [lugar] — Atracar un establecimiento',
    async run(message, args) {
      if (!args[0]) {
        const lista = Object.entries(ROBOS).map(([k, r]) => `\`!atracar ${k}\` — ${r.emoji} ${r.nombre}`).join('\n');
        return message.reply({ embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('🏴‍☠️ Lugares disponibles').setDescription(lista).setTimestamp()] });
      }
      const robo = ROBOS[args[0].toLowerCase()];
      if (!robo) return message.reply('❌ Lugar inválido. Usa `!atracar` para ver la lista.');

      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      if (player.muerto || player.enHospital) return message.reply('❌ No puedes atracar estando herido.');
      if (player.enCarcel) return message.reply('❌ Estás en la cárcel.');

      const lastRob = player.getCooldown(`rob_${robo.nombre}`);
      if (lastRob) {
        const remaining = lastRob.getTime() + robo.cooldown - Date.now();
        if (remaining > 0) return message.reply(`⏳ Espera **${formatCooldown(remaining)}** para volver a atracar ${robo.nombre}.`);
      }

      if (robo.bandaOficial && !player.gangId) {
        return message.reply({ embeds: [E.err('Solo Bandas Oficiales', `El robo de **${robo.nombre}** es de nivel mayor y requiere pertenecer a una **banda oficial**.`)] });
      }

      player.setCooldown(`rob_${robo.nombre}`, new Date());
      await player.save();

      // Minijuego interactivo con botones
      const inv = await getInventory(message.author.id);
      await ejecutarMinijuegoPrefix(message, player, robo, inv);
    },
  },
  {
    name: 'robos',
    aliases: ['listrobos'],
    description: '!robos — Ver lista de robos disponibles',
    async run(message) {
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('🏴‍☠️ Robos Disponibles')
        .setDescription('Usa `!atracar [lugar]` o `/atracar [lugar]`')
        .addFields(
          { name: '⚡ Express', value: Object.values(ROBOS).filter(r => r.nivel === 'express').map(r => `${r.emoji} ${r.nombre}`).join(', ') },
          { name: '⚠️ Medianos', value: Object.values(ROBOS).filter(r => r.nivel === 'mediano').map(r => `${r.emoji} ${r.nombre}`).join(', ') },
          { name: '🔥 Mayores', value: Object.values(ROBOS).filter(r => r.nivel === 'mayor').map(r => `${r.emoji} ${r.nombre}`).join(', ') },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
  {
    name: 'allanar',
    aliases: ['casa', 'robo_casa'],
    description: '!allanar [alta/media/baja] — Allanar una casa para robar',
    async run(message, args) {
      if (!args[0] || !CASAS[args[0]]) return message.reply('Zonas: `alta` (Vinewood), `media` (Centro), `baja` (LS Este). Ej: `!allanar alta`');
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('❌ Sin personaje.');
      if (player.muerto || player.enHospital || player.enCarcel) return message.reply('❌ No puedes allanar ahora.');
      const cd = player.getCooldown('allanar');
      if (cd && Date.now()-cd.getTime()<3600000) { const r=3600000-(Date.now()-cd.getTime()); return message.reply(`⏳ ${Math.floor(r/60000)}m`); }
      player.setCooldown('allanar',new Date()); await player.save();
      const casa = CASAS[args[0]]; const fases = casa.habitaciones;
      const colores = ['🔴','🟡','🟢','🔵'];
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      for (let hab=1; hab<=fases; hab++) {
        const seqLen = 2+Math.floor(hab/2);
        const seq = []; for(let i=0;i<seqLen;i++) seq.push(colores[Math.floor(Math.random()*colores.length)]);
        for(let i=0;i<seqLen;i++) {
          await message.channel.send({ embeds:[new EmbedBuilder().setColor(0x222244).setTitle(`🏠 Habitación ${hab}/${fases}`).setDescription(`**#${i+1}:** ${seq[i]}`).setTimestamp()] });
          await new Promise(r=>setTimeout(r,1200));
        }
        const btnRow = new ActionRowBuilder().addComponents(colores.map(c=>new ButtonBuilder().setCustomId(`simon_${c}`).setLabel(c).setStyle(ButtonStyle.Primary)));
        const sent = await message.channel.send({ embeds:[new EmbedBuilder().setColor(0xef4444).setTitle(`🏠 Repite: Habitación ${hab}/${fases}`).setDescription(`Colores en orden. 6s cada uno.`).setTimestamp()], components:[btnRow] });
        let fallo = false;
        for(let paso=0;paso<seqLen;paso++) {
          try { const click=await sent.awaitMessageComponent({filter:i=>i.user.id===message.author.id&&i.customId.startsWith('simon_'),time:6000}); const e=click.customId.replace('simon_',''); await click.deferUpdate(); if(e!==seq[paso]){fallo=true;break;} } catch{fallo=true;break;}
        }
        if(fallo){ player.arrestos++;await player.save(); return sent.edit({embeds:[new EmbedBuilder().setColor(0xef4444).setTitle('❌ Alarma!').setDescription('Te pillaron.')],components:[]}); }
        if(hab<fases) await sent.edit({embeds:[new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ Hab ${hab} lista.`).setTimestamp()],components:[]});
      }
      const botín=Math.floor(Math.random()*(casa.max-casa.min+1))+casa.min; player.dineroSucio+=botín;player.robosRealizados++;await player.save();
      message.reply(`✅ **${casa.nombre}** allanada. Botín: **$${botín.toLocaleString()}** (dinero sucio).`);
    },
  },
];

module.exports = { data, execute, prefixCommands };
