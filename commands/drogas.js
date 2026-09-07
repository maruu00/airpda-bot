'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getPlayer, getInventory, rand, formatMoney, calcXpNivel, applyVitalDecay } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const DROGAS = require('../data/drogas');
const DrugPlot = require('../database/models/DrugPlot');

function getTipoInfo(tipo) {
  return DROGAS[tipo] || null;
}

// ─── Slash ────────────────────────────────────────────────────────────────────
const data = new (require('discord.js').SlashCommandBuilder)()
  .setName('drogas')
  .setDescription('Sistema de narcotráfico')
  .addSubcommand(s => s.setName('tipos').setDescription('Ver todos los tipos de droga disponibles'))
  .addSubcommand(s => s.setName('plantar').setDescription('Plantar una droga')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de droga').setRequired(true)
      .addChoices(
        { name: '🌿 Marihuana (Nivel banda 1)', value: 'marihuana' },
        { name: '🌈 LSD (Nivel banda 1)', value: 'lsd' },
        { name: '❄️ Cocaína (Nivel banda 2)', value: 'cocaina' },
        { name: '💎 Éxtasis (Nivel banda 2)', value: 'extasis' },
        { name: '💊 Metanfetamina (Nivel banda 3)', value: 'metanfetamina' },
        { name: '🔵 Ketamina (Nivel banda 3)', value: 'ketamina' },
        { name: '💉 Heroína (Nivel banda 4)', value: 'heroina' },
        { name: '☠️ Fentanilo (Nivel banda 5)', value: 'fentanilo' },
      )))
  .addSubcommand(s => s.setName('plantaciones').setDescription('Ver tus plantaciones activas'))
  .addSubcommand(s => s.setName('regar').setDescription('Regar todas tus plantas'))
  .addSubcommand(s => s.setName('cosechar').setDescription('Cosechar tus plantas listas'))
  .addSubcommand(s => s.setName('estadisticas').setDescription('Ver estadísticas de narcotráfico'))
  .addSubcommand(s => s.setName('vender').setDescription('Vender todas tus drogas')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a vender (opcional)').setRequired(false)))
  .addSubcommand(s => s.setName('laboratorio').setDescription('Gestionar tu laboratorio')
    .addStringOption(o => o.setName('accion').setDescription('Acción').setRequired(true)
      .addChoices(
        { name: 'Montar laboratorio', value: 'montar' },
        { name: 'Procesar droga', value: 'procesar' },
        { name: 'Estado', value: 'estado' },
      )));

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  const player = await getPlayer(interaction.user.id, interaction.user.username);
  if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea un personaje con /personaje crear.')], flags: 64 });

  if (sub === 'tipos') {
    const desc = Object.entries(DROGAS).map(([k, v]) =>
      `${v.emoji} **${v.nombre}** — ⏱ ${ms(v.tiempo)} · 💰 $${v.valorBase} · ⚠️ ${Math.round(v.riesgo * 100)}% confiscación · 💧 ${v.riegos} riegos · 🏴 Nivel banda ${v.nivelBanda}`
    ).join('\n');
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('💊 Tipos de Droga')
        .setDescription(desc).setFooter({ text: 'Usa /drogas plantar [tipo] para comenzar' }).setTimestamp()],
      flags: 64,
    });
  }

  if (sub === 'plantar') {
    const tipo = interaction.options.getString('tipo');
    const info = getTipoInfo(tipo);
    if (!info) return interaction.reply({ embeds: [E.err('Error', 'Tipo de droga inválido.')], flags: 64 });

    // Verificar nivel de banda
    const Gang = require('../database/models/Gang');
    const ganga = player.gangId ? await Gang.findById(player.gangId).catch(() => null) : null;
    const nivelBanda = ganga?.nivel || 0;
    if (nivelBanda < info.nivelBanda) {
      return interaction.reply({ embeds: [E.err('Nivel de banda insuficiente', `Necesitas nivel de banda **${info.nivelBanda}** para plantar ${info.nombre}. Tu banda tiene nivel **${nivelBanda}**.`)], flags: 64 });
    }

    const activeCount = await DrugPlot.countDocuments({ discordId: interaction.user.id, fase: 'creciendo' });
    if (activeCount >= 5) return interaction.reply({ embeds: [E.warn('Límite alcanzado', 'Máximo **5** plantaciones activas a la vez.')], flags: 64 });

    // Verificar semilla en inventario
    const inv = await getInventory(interaction.user.id);
    const seedId = `semilla_${tipo}`;
    const semilla = inv.items.find(i => i.id === seedId);
    if (!semilla || semilla.cantidad < 1) {
      return interaction.reply({ embeds: [E.err('Sin semillas', `Necesitas una **semilla de ${info.nombre}** para plantar. Cómprala en \`/tienda\` (🏴 Mercado Negro).`)], flags: 64 });
    }
    inv.removeItem(seedId, 1);
    await inv.save();

    const now = Date.now();
    const listoEn = new Date(now + info.tiempo);
    const riegos = info.riegos;
    const riegoInt = info.riegoInterval;
    const tienePaneles = player.inventario?.items?.some(i => i.id === 'panel_luz') || false;

    await DrugPlot.create({
      discordId: interaction.user.id, guildId: interaction.guildId, tipo,
      listoEn, riegosNecesarios: riegos,
      conPaneles: tienePaneles,
      conLuz: tienePaneles,
    });

    const totalTime = info.tiempo;
    const riegoText = tienePaneles
      ? `💡 Paneles de luz detectados — crecimiento óptimo`
      : `💧 Necesita ${riegos} riegos cada ${ms(riegoInt)}`;

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.success)
        .setTitle(`${info.emoji} ${info.nombre} plantada`)
        .setDescription(
          `**${info.nombre}** plantada con éxito.\n\n` +
          `⏱ **Tiempo total:** ${ms(totalTime)}\n` +
          `💰 **Valor base:** $${info.valorBase}\n` +
          `${riegoText}\n` +
          `📅 **Lista en:** <t:${Math.floor(listoEn.getTime() / 1000)}:R>`
        ).setTimestamp()],
    });
  }

  if (sub === 'plantaciones') {
    const plots = await DrugPlot.find({ discordId: interaction.user.id }).sort({ plantadoEn: -1 });
    if (!plots.length) return interaction.reply({ embeds: [E.warn('Sin plantaciones', 'No tienes plantaciones activas.')], flags: 64 });

    const list = await Promise.all(plots.map(async p => {
      const info = getTipoInfo(p.tipo);
      if (!info) return '';
      const estado = p.fase === 'creciendo' ? '🟡 Creciendo' : p.fase === 'listo' ? '🟢 Listo' : '🔴 Podrido';
      const faltaRiego = p.fase === 'creciendo' && p.riegosRealizados < p.riegosNecesarios;
      const riegoStr = faltaRiego ? `💧 ${p.riegosRealizados}/${p.riegosNecesarios} riegos` : '✅ Riego completo';
      return `${info.emoji} **${info.nombre}** x${p.cantidad} — ${estado} · ${riegoStr}\n📅 ${p.listoEn ? `<t:${Math.floor(p.listoEn.getTime() / 1000)}:R>` : '—'}`;
    }));
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('🌱 Tus Plantaciones')
        .setDescription(list.join('\n\n') || '*Sin plantaciones*').setFooter({ text: `Total: ${plots.length} plantaciones` }).setTimestamp()],
      flags: 64,
    });
  }

  if (sub === 'regar') {
    const plots = await DrugPlot.find({ discordId: interaction.user.id, fase: 'creciendo', riegosRealizados: { $lt: 10 } });
    if (!plots.length) return interaction.reply({ embeds: [E.warn('Sin plantas', 'No tienes plantas que necesiten riego.')], flags: 64 });

    let regadas = 0;
    for (const p of plots) {
      const info = getTipoInfo(p.tipo);
      if (!info) continue;
      if (p.riegosRealizados < info.riegos) {
        p.riegosRealizados += 1;
        p.ultimoRiego = new Date();
        await p.save();
        regadas++;
      }
    }
    return interaction.reply({ content: `💧 **${regadas}** plantas regadas correctamente.`, flags: 64 });
  }

  if (sub === 'cosechar') {
    const ready = await DrugPlot.find({ discordId: interaction.user.id, fase: 'listo' });
    if (!ready.length) return interaction.reply({ embeds: [E.warn('Sin cosecha', 'No tienes plantas listas para cosechar. Usa /drogas plantaciones para ver el estado.')], flags: 64 });

    let total = 0;
    let perdidas = 0;
    const inv = await getInventory(interaction.user.id);

    for (const p of ready) {
      const info = getTipoInfo(p.tipo);
      if (!info) continue;
      if (Math.random() < info.riesgo) {
        perdidas++;
        player.arrestos = (player.arrestos || 0) + 1;
      } else {
        const id = p.conLab ? `${p.tipo}_pura` : p.tipo;
        const nombre = p.conLab ? `${info.nombre} Pura` : info.nombre;
        inv.addItem({ id, nombre, tipo: 'droga', emoji: info.emoji, precio: info.valorBase });
        total += p.cantidad;
      }
      p.fase = 'podrido';
      await p.save();
    }
    await inv.save();
    await player.save();

    const msg = `✅ Cosechadas **${total}** unidades.${perdidas ? `\n🚔 La policía confiscó **${perdidas}** plantaciones (+${perdidas} arrestos).` : ''}`;
    // Dar XP
    if (total > 0) {
      player.addXP(total * 5);
      await player.save();
    }

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('🌾 Cosecha completada')
        .setDescription(msg).setFooter({ text: `XP ganada: ${total * 5}` }).setTimestamp()],
    });
  }

  if (sub === 'estadisticas') {
    const total = await DrugPlot.countDocuments({ discordId: interaction.user.id });
    const listas = await DrugPlot.countDocuments({ discordId: interaction.user.id, fase: 'listo' });
    const inv = await getInventory(interaction.user.id);
    const drogasEnInv = inv.items.filter(i => i.tipo === 'droga').length;
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('📊 Estadísticas de Narcotráfico')
        .addFields(
          { name: '🌱 Total plantadas', value: `${total}`, inline: true },
          { name: '🟢 Listas para cosechar', value: `${listas}`, inline: true },
          { name: '📦 Drogas en inventario', value: `${drogasEnInv}`, inline: true },
          { name: '🧹 Dinero sucio', value: formatMoney(player.dineroSucio), inline: true },
          { name: '🚔 Arrestos', value: `${player.arrestos || 0}`, inline: true },
          { name: '🏴 Nivel de banda', value: `${player.gangId ? 'Activo' : 'Sin banda'}`, inline: true },
        ).setTimestamp()],
      flags: 64,
    });
  }

  if (sub === 'vender') {
    const inv = await getInventory(interaction.user.id);
    const drugs = inv.items.filter(i => i.tipo === 'droga');
    if (!drugs.length) return interaction.reply({ embeds: [E.warn('Sin drogas', 'No tienes drogas en el inventario.')], flags: 64 });
    await interaction.deferReply({ flags: 64 });
    return iniciarVenta(interaction, interaction.user, player, inv, client);
  }

  if (sub === 'laboratorio') {
    const accion = interaction.options.getString('accion');
    const inv = await getInventory(interaction.user.id);

    if (accion === 'estado') {
      const tieneLab = inv.items.some(i => i.id === 'laboratorio');
      const piezas = ['reactor', 'condensador', 'tubos', 'quimicos'];
      const tienePiezas = piezas.map(p => ({ id: p, tiene: inv.items.some(i => i.id === p) }));
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('🔬 Laboratorio')
          .setDescription(
            `**Estado:** ${tieneLab ? '✅ Montado' : '❌ No montado'}\n\n` +
            `**Piezas necesarias:**\n` +
            tienePiezas.map(p => `${p.tiene ? '✅' : '❌'} ${p.id}`).join('\n') +
            `\n\nUsa \`/drogas laboratorio montar\` si tienes todas las piezas.`
          ).setTimestamp()],
        flags: 64,
      });
    }

    if (accion === 'montar') {
      const piezas = ['reactor', 'condensador', 'tubos', 'quimicos'];
      const tieneTodo = piezas.every(p => inv.items.some(i => i.id === p));
      if (!tieneTodo) return interaction.reply({ embeds: [E.err('Faltan piezas', 'Necesitas: reactor, condensador, tubos de ensayo y químicos. Cómpralos en la tienda.')], flags: 64 });
      piezas.forEach(p => inv.removeItem(p));
      inv.addItem({ id: 'laboratorio', nombre: 'Laboratorio montado', tipo: 'herramienta', emoji: '🔬', precio: 0 });
      await inv.save();
      // Marcar todas las plantaciones activas con conLab
      await DrugPlot.updateMany({ discordId: interaction.user.id }, { conLab: true });
      return interaction.reply({ embeds: [E.ok('🔬 Laboratorio montado', 'Todas tus nuevas plantaciones podrán procesarse en laboratorio para obtener droga pura (+50% valor).')], flags: 64 });
    }

    if (accion === 'procesar') {
      const tieneLab = inv.items.some(i => i.id === 'laboratorio');
      if (!tieneLab) return interaction.reply({ embeds: [E.err('Sin laboratorio', 'Necesitas montar un laboratorio primero con /drogas laboratorio montar.')], flags: 64 });
      const normales = inv.items.filter(i => i.tipo === 'droga' && !i.id.endsWith('_pura'));
      if (!normales.length) return interaction.reply({ embeds: [E.warn('Sin drogas', 'No tienes drogas para procesar.')], flags: 64 });
      let procesadas = 0;
      for (const d of normales) {
        inv.removeItem(d.id, d.cantidad);
        const puraId = `${d.id}_pura`;
        const puraNombre = `${d.nombre} Pura`;
        inv.addItem({ id: puraId, nombre: puraNombre, tipo: 'droga', emoji: d.emoji, precio: Math.round((d.precio || 500) * 1.5) });
        procesadas += d.cantidad;
      }
      await inv.save();
      return interaction.reply({ embeds: [E.ok('🧪 Procesadas', `**${procesadas}** unidades procesadas en laboratorio. Valor aumentado un **50%**.`)], flags: 64 });
    }
  }
}

// ─── Prefix ───────────────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'drogas',
    aliases: ['drugs', 'narcos'],
    description: '!drogas — Ver estadísticas de narcotráfico',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('❌ No tienes personaje.');
      const total = await DrugPlot.countDocuments({ discordId: message.author.id });
      const listas = await DrugPlot.countDocuments({ discordId: message.author.id, fase: 'listo' });
      const inv = await getInventory(message.author.id);
      const drogasEnInv = inv.items.filter(i => i.tipo === 'droga').length;
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle('📊 Estadísticas de Narcotráfico')
          .addFields(
            { name: '🌱 Total plantadas', value: `${total}`, inline: true },
            { name: '🟢 Listas para cosechar', value: `${listas}`, inline: true },
            { name: '📦 Drogas en inventario', value: `${drogasEnInv}`, inline: true },
            { name: '🧹 Dinero sucio', value: formatMoney(player.dineroSucio), inline: true },
            { name: '🚔 Arrestos', value: `${player.arrestos || 0}`, inline: true },
            { name: '🏴 Nivel de banda', value: player.gangId ? 'Activo' : 'Sin banda', inline: true },
          ).setTimestamp()],
      });
    },
  },
  {
    name: 'plantar',
    aliases: ['cultivar', 'sembrar'],
    description: '!plantar [tipo] — Plantar droga',
    async run(message, args) {
      if (!args.length) return message.reply('Uso: `!plantar [marihuana|cocaina|metanfetamina|heroina|lsd|extasis|ketamina|fentanilo]`');
      const tipo = args[0].toLowerCase();
      if (!DROGAS[tipo]) return message.reply('❌ Droga inválida. Usa `!drogas tipos` para ver las disponibles.');
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('❌ No tienes personaje.');
      const activeCount = await DrugPlot.countDocuments({ discordId: message.author.id, fase: 'creciendo' });
      if (activeCount >= 5) return message.reply('❌ Máximo 5 plantaciones activas.');
      const info = DROGAS[tipo];
      const now = Date.now();
      await DrugPlot.create({ discordId: message.author.id, guildId: message.guildId, tipo, listoEn: new Date(now + info.tiempo) });
      return message.reply(`${info.emoji} Has plantado **${info.nombre}**. Estará lista <t:${Math.floor((now + info.tiempo) / 1000)}:R>.`);
    },
  },
  {
    name: 'cosechar',
    aliases: ['recolectar', 'cosecha'],
    description: '!cosechar — Cosechar plantas listas',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      const ready = await DrugPlot.find({ discordId: message.author.id, fase: 'listo' });
      if (!ready.length) return message.reply('❌ No tienes plantas listas.');
      let total = 0, perdidas = 0;
      const inv = await getInventory(message.author.id);
      for (const p of ready) {
        const info = DROGAS[p.tipo];
        if (!info) continue;
        if (Math.random() < info.riesgo) { perdidas++; player.arrestos++; }
        else { inv.addItem({ id: p.tipo, nombre: info.nombre, tipo: 'droga', emoji: info.emoji, precio: info.valorBase }); total++; }
        p.fase = 'podrido'; await p.save();
      }
      await inv.save(); await player.save();
      message.reply(`✅ Cosechadas **${total}** unidades.${perdidas ? ` 🚔 ${perdidas} confiscadas.` : ''}`);
    },
  },
  {
    name: 'regar',
    aliases: ['water', 'riego'],
    description: '!regar — Regar todas tus plantas',
    async run(message) {
      const plots = await DrugPlot.find({ discordId: message.author.id, fase: 'creciendo' });
      if (!plots.length) return message.reply('❌ No tienes plantas para regar.');
      let regadas = 0;
      for (const p of plots) {
        const info = DROGAS[p.tipo];
        if (!info) continue;
        if (p.riegosRealizados < info.riegos) { p.riegosRealizados++; p.ultimoRiego = new Date(); await p.save(); regadas++; }
      }
      message.reply(`💧 **${regadas}** plantas regadas.`);
    },
  },
  {
    name: 'vender',
    aliases: ['venderdroga', 'sell'],
    description: '!vender — Vender tus drogas (requiere vestimenta, vehículo, ubicación)',
    async run(message, args, client) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('❌ No tienes personaje.');
      const inv = await getInventory(message.author.id);
      const drugs = inv.items.filter(i => i.tipo === 'droga');
      if (!drugs.length) return message.reply('❌ No tienes drogas.');
      return iniciarVenta(message, message.author, player, inv, client);
    },
  },
  {
    name: 'plantaciones',
    aliases: ['plots', 'misplantas'],
    description: '!plantaciones — Ver tus plantaciones activas',
    async run(message) {
      const plots = await DrugPlot.find({ discordId: message.author.id }).sort({ plantadoEn: -1 });
      if (!plots.length) return message.reply('❌ No tienes plantaciones.');
      const list = await Promise.all(plots.map(async p => {
        const info = DROGAS[p.tipo];
        if (!info) return '';
        const estado = p.fase === 'creciendo' ? '🟡 Creciendo' : p.fase === 'listo' ? '🟢 Listo' : '🔴 Podrido';
        const riegoStr = p.riegosRealizados < info.riegos ? `💧 ${p.riegosRealizados}/${info.riegos}` : '✅ Riego OK';
        return `${info.emoji} **${info.nombre}** — ${estado} · ${riegoStr}`;
      }));
      message.channel.send(`🌱 **Tus plantaciones:**\n${list.join('\n')}`);
    },
  },
  {
    name: 'laboratorio',
    aliases: ['lab'],
    description: '!laboratorio [montar/procesar] — Gestionar laboratorio',
    async run(message, args) {
      if (!args.length) return message.reply('Uso: `!laboratorio montar` o `!laboratorio procesar`');
      const accion = args[0].toLowerCase();
      const inv = await getInventory(message.author.id);
      if (accion === 'montar') {
        const piezas = ['reactor', 'condensador', 'tubos', 'quimicos'];
        const tieneTodo = piezas.every(p => inv.items.some(i => i.id === p));
        if (!tieneTodo) return message.reply('❌ Faltan piezas: reactor, condensador, tubos, químicos.');
        piezas.forEach(p => inv.removeItem(p));
        inv.addItem({ id: 'laboratorio', nombre: 'Laboratorio montado', tipo: 'herramienta', emoji: '🔬', precio: 0 });
        await inv.save();
        await DrugPlot.updateMany({ discordId: message.author.id }, { conLab: true });
        return message.reply('✅ Laboratorio montado. Ahora puedes procesar droga pura (+50%).');
      }
      if (accion === 'procesar') {
        const tieneLab = inv.items.some(i => i.id === 'laboratorio');
        if (!tieneLab) return message.reply('❌ Monta un laboratorio primero con `!laboratorio montar`.');
        const normales = inv.items.filter(i => i.tipo === 'droga' && !i.id.endsWith('_pura'));
        if (!normales.length) return message.reply('❌ No tienes drogas para procesar.');
        let proc = 0;
        for (const d of normales) {
          inv.removeItem(d.id, d.cantidad);
          inv.addItem({ id: `${d.id}_pura`, nombre: `${d.nombre} Pura`, tipo: 'droga', emoji: d.emoji, precio: Math.round((d.precio || 500) * 1.5) });
          proc += d.cantidad;
        }
        await inv.save();
        return message.reply(`🧪 **${proc}** unidades procesadas. Valor +50%.`);
      }
      message.reply('Uso: `!laboratorio montar` o `!laboratorio procesar`');
    },
  },
];

// ─── Sistema de venta con pasos ─────────────────────────────────────────────
async function iniciarVenta(responder, usuario, player, inv, client) {
  const drugs = inv.items.filter(i => i.tipo === 'droga');
  const totalUnids = drugs.reduce((s, d) => s + d.cantidad, 0);
  if (!totalUnids) return responder.editReply('❌ No tienes drogas.');

  const preguntas = [
    { q: '👕 **¿Qué vestimenta llevas?** Describe tu ropa para la venta.', key: 'vestimenta' },
    { q: '🚗 **¿Qué vehículo usas?** Describe marca, modelo, color y matrícula.', key: 'vehiculo' },
    { q: '📍 **¿Dónde vas a vender?** Indica la ubicación exacta.', key: 'ubicacion' },
  ];
  const respuestas = {};

  let canal = responder.channel || responder.channelId;
  if (typeof canal === 'string') canal = await client.channels.fetch(canal).catch(() => null);
  if (!canal) return responder.editReply('❌ Error al obtener el canal.');

  const filter = m => m.author.id === usuario.id;
  let msg = await responder.editReply({ content: preguntas[0].q, flags: 64 });
  if (!msg) return;

  for (let i = 0; i < preguntas.length; i++) {
    if (i > 0) {
      msg = await responder.editReply({ content: preguntas[i].q });
    }
    try {
      const collected = await msg.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
      const resp = collected.first().content;
      respuestas[preguntas[i].key] = resp;
      if (i < preguntas.length - 1) await collected.first().delete().catch(() => {});
    } catch {
      return responder.editReply('❌ Tiempo agotado. Venta cancelada.');
    }
  }

  // Procesar la venta
  const totalValor = drugs.reduce((sum, d) => sum + (d.precio || 0) * d.cantidad, 0);
  const roll = Math.random();

  if (roll < 0.60) {
    // ✅ Éxito (60%)
    const factor = 0.8 + Math.random() * 0.4; // 80%-120%
    const pago = Math.round(totalValor * factor);
    inv.clearType('droga');
    player.dineroSucio = (player.dineroSucio || 0) + pago;
    player.drogasVendidas = (player.drogasVendidas || 0) + totalUnids;
    player.addXP(totalUnids * 3);
    await inv.save(); await player.save();
    return responder.editReply({
      embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle('💰 Venta exitosa')
        .setDescription(
          `Vendiste **${totalUnids}** unidades por **$${pago.toLocaleString()}** (dinero sucio).\n\n` +
          `👕 **Vestimenta:** ${respuestas.vestimenta}\n` +
          `🚗 **Vehículo:** ${respuestas.vehiculo}\n` +
          `📍 **Ubicación:** ${respuestas.ubicacion}`
        ).setTimestamp()],
    });
  }

  if (roll < 0.85) {
    // ⚠️ Venta parcial (25%)
    const factor = 0.3 + Math.random() * 0.2; // 30%-50%
    const pago = Math.round(totalValor * factor);
    inv.clearType('droga');
    player.dineroSucio = (player.dineroSucio || 0) + pago;
    player.drogasVendidas = (player.drogasVendidas || 0) + totalUnids;
    await inv.save(); await player.save();
    return responder.editReply({
      embeds: [new EmbedBuilder().setColor(config.colors.warning).setTitle('⚠️ Venta parcial')
        .setDescription(
          `El comprador te estafó. Solo conseguiste **$${pago.toLocaleString()}** (dinero sucio).\n\n` +
          `👕 **Vestimenta:** ${respuestas.vestimenta}\n` +
          `🚗 **Vehículo:** ${respuestas.vehiculo}\n` +
          `📍 **Ubicación:** ${respuestas.ubicacion}`
        ).setTimestamp()],
    });
  }

  // 🚨 Policía (15%)
  inv.clearType('droga');
  player.dineroSucio = (player.dineroSucio || 0) + Math.round(totalValor * 0.1);
  player.arrestos = (player.arrestos || 0) + 1;
  await inv.save(); await player.save();

  // Auto 911
  await enviarAlertaPolicia(responder, usuario, player, respuestas, totalUnids, client);

  return responder.editReply({
    embeds: [new EmbedBuilder().setColor(config.colors.danger).setTitle('🚨 ¡TE HA CALLADO LA POLICÍA!')
      .setDescription(
        `Alguien llamó al **911** durante la transacción.\n` +
        `Perdiste la mercancía y te llevaste **1 arresto**.\n\n` +
        `Solo rescataste **$${Math.round(totalValor * 0.1).toLocaleString()}**.\n\n` +
        `**Datos que tenía la policía:**\n` +
        `👕 **Vestimenta:** ${respuestas.vestimenta}\n` +
        `🚗 **Vehículo:** ${respuestas.vehiculo}\n` +
        `📍 **Ubicación:** ${respuestas.ubicacion}`
      ).setTimestamp()],
  });
}

async function enviarAlertaPolicia(responder, usuario, player, respuestas, totalUnids, client) {
  try {
    const guild = responder.guild || (responder.channel?.guild) || (usuario?.lastMessage?.guild);
    if (!guild) return;
    const GuildConfig = require('../database/models/GuildConfig');
    const gc = await GuildConfig.findOne({ guildId: guild.id });
    const poliChId = gc?.canales?.policia || gc?.canales?.emergencias;
    if (!poliChId) return;
    const poliCh = await guild.channels.fetch(poliChId).catch(() => null);
    if (!poliCh) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.danger)
      .setTitle('🚨 ALERTA POLICIAL — Venta de drogas')
      .setDescription(
        `Se ha reportado una **venta de drogas** en curso.\n\n` +
        `**🧑‍🌾 Sospechoso:** ${usuario.tag} (<@${usuario.id}>)\n` +
        `**📦 Cantidad:** ${totalUnids} unidades\n` +
        `**👕 Vestimenta:** ${respuestas.vestimenta}\n` +
        `**🚗 Vehículo:** ${respuestas.vehiculo}\n` +
        `**📍 Ubicación:** ${respuestas.ubicacion}\n\n` +
        `> 🚔 *Se requiere intervención policial inmediata.*`
      )
      .setThumbnail(usuario.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: 'AmericanRP · Alerta automática 911' });

    await poliCh.send({ content: '🚨 @here', embeds: [embed] });
  } catch (e) {
    console.error('[Drug911]', e.message);
  }
}

function ms(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

module.exports = { data, execute, prefixCommands };