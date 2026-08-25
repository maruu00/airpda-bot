/**
 * ORG — Organizaciones (prefix)
 * !dinero-org  — ver el dinero/capital de tu org
 * !almacen-org — ver el almacén de tu org (150 slots por defecto)
 * !veh-org     — ver los vehículos de la org
 * !guardar-org [item] [cantidad] — guardar items en el almacén de la org
 * !sacar-org [item] [cantidad]   — sacar items del almacén de la org
 * !asignar-veh [placa] [@usuario|quitar] — [ADMIN] asignar vehículo de la org
 * !almacen-NOMBRE — [ADMIN] ver el almacén de cualquier org por su nombre
 */
const { EmbedBuilder } = require('discord.js');
const { getPlayer, getInventory, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const Gang = require('../database/models/Gang');
const { GangAlmacen, GangVehicle } = require('../database/models/PdaModels');

const ADMIN_ROLE_ID = '1441818963133731016';
function isStaff(member) {
  return member?.permissions?.has('Administrator') || member?.roles?.cache?.has(ADMIN_ROLE_ID) || false;
}

async function getOrCreateAlmacen(gangId) {
  let alm = await GangAlmacen.findOne({ gangId: String(gangId) });
  if (!alm) {
    alm = await GangAlmacen.create({ gangId: String(gangId), nombre: 'Almacén', capacidad: 150, items: [] });
  }
  return alm;
}

async function erroresOrg(player, gang) {
  if (!player.personajeCreado) return '❌ Sin personaje.';
  if (!gang) return '❌ No perteneces a ninguna organización.';
  if (gang.desmantelada) return `❌ La organización **[${gang.tag || ''}] ${gang.nombre}** está desmantelada.`;
  return null;
}

function buscarItem(items, q) {
  q = q.toLowerCase();
  return items.find(i => i.id === q || (i.nombre && i.nombre.toLowerCase() === q)) ||
         items.find(i => (i.nombre || '').toLowerCase().includes(q));
}

const prefixCommands = [
  {
    name: 'dinero-org',
    aliases: ['dinero-orga', 'capital-org'],
    description: '!dinero-org — Ver el dinero/capital de tu organización',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await erroresOrg(player, gang);
      if (err) return message.reply(err);

      const [almacen, vehiculos] = await Promise.all([
        getOrCreateAlmacen(gang._id),
        GangVehicle.find({ gangId: String(gang._id) }),
      ]);
      const ocupado = (almacen.items || []).reduce((s, i) => s + (i.cantidad || 0), 0);

      const embed = new EmbedBuilder()
        .setColor(parseInt(String(gang.color || '#8b5cf6').replace('#', ''), 16) || config.colors.gang)
        .setTitle(`💰 Dinero de la organización [${gang.tag || ''}] ${gang.nombre}`)
        .addFields(
          { name: '💵 Capital actual', value: formatMoney(gang.dinero || 0), inline: true },
          { name: '🏦 Capital inicial', value: formatMoney(gang.capitalInicial || 1500000), inline: true },
          { name: '⬆️ Nivel', value: `${gang.nivel || 1}`, inline: true },
          { name: '📦 Almacén', value: `${ocupado}/${almacen.capacidad || 150} items`, inline: true },
          { name: '🚗 Vehículos', value: `${vehiculos.length}`, inline: true },
          { name: '👥 Miembros', value: `${gang.miembros?.length || 0}/${gang.slots || 4}`, inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },

  {
    name: 'almacen-org',
    aliases: ['almacen-orga'],
    description: '!almacen-org — Ver el almacén de tu organización',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await erroresOrg(player, gang);
      if (err) return message.reply(err);

      const almacen = await getOrCreateAlmacen(gang._id);
      const items = almacen.items || [];
      const ocupado = items.reduce((s, i) => s + (i.cantidad || 0), 0);

      const desc = items.length
        ? items.map(i => `${i.emoji || '📦'} **${i.nombre || i.id}** x${i.cantidad || 0}`).join('\n')
        : '*Almacén vacío. Usa `!guardar-org [item] [cantidad]`.*';

      const embed = new EmbedBuilder()
        .setColor(parseInt(String(gang.color || '#8b5cf6').replace('#', ''), 16) || config.colors.gang)
        .setTitle(`📦 Almacén de [${gang.tag || ''}] ${gang.nombre}`)
        .setDescription(desc)
        .setFooter({ text: `Capacidad: ${ocupado}/${almacen.capacidad || 150} items` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },

  {
    name: 'veh-org',
    aliases: ['vehiculos-org'],
    description: '!veh-org — Ver los vehículos de la organización',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await erroresOrg(player, gang);
      if (err) return message.reply(err);

      const vehiculos = await GangVehicle.find({ gangId: String(gang._id) });
      if (!vehiculos.length) return message.reply({ embeds: [E.info('Sin vehículos', 'Esta organización no tiene vehículos registrados.')] });

      const desc = vehiculos.map(v => {
        const asignado = v.asignadoA ? `→ asignado a <@${v.asignadoA}>` : 'sin asignar';
        return `🚗 **${v.modelo || v.nombre || 'Vehículo'}** | \`${v.placa}\` | ${v.color || 'Negro'} | ${asignado}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(parseInt(String(gang.color || '#8b5cf6').replace('#', ''), 16) || config.colors.gang)
        .setTitle(`🚗 Vehículos de [${gang.tag || ''}] ${gang.nombre}`)
        .setDescription(desc)
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },

  {
    name: 'guardar-org',
    aliases: ['guardar-orga', 'store-org'],
    description: '!guardar-org [item] [cantidad] — Guardar items de tu inventario en el almacén de la org',
    async run(message, args) {
      if (!args.length) return message.reply('Uso: `!guardar-org [item] [cantidad]`\nEj: `!guardar-org arma 2`');
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await erroresOrg(player, gang);
      if (err) return message.reply(err);

      const inv = await getInventory(message.author.id);
      const nombre = args.slice(0, -1).join(' ') || args.join(' ');
      const cantidad = parseInt(args[args.length - 1]) || 1;

      const invItem = buscarItem(inv.items, nombre);
      if (!invItem) return message.reply(`❌ No tienes "${nombre}" en el inventario.`);
      if ((invItem.cantidad || 0) < cantidad) return message.reply(`❌ Solo tienes ${invItem.cantidad}x ${invItem.nombre}.`);

      const almacen = await getOrCreateAlmacen(gang._id);
      const ocupado = (almacen.items || []).reduce((s, i) => s + (i.cantidad || 0), 0);
      if (ocupado + cantidad > (almacen.capacidad || 150)) {
        return message.reply(`❌ Almacén de la org lleno (${ocupado}/${almacen.capacidad || 150}).`);
      }

      if (!inv.removeItem(invItem.id, cantidad)) return message.reply('❌ No se pudo retirar el item de tu inventario.');

      const existente = (almacen.items || []).find(i => i.id === invItem.id);
      if (existente) {
        existente.cantidad = (existente.cantidad || 0) + cantidad;
      } else {
        almacen.items.push({
          id: invItem.id,
          nombre: invItem.nombre || invItem.id,
          cantidad,
          emoji: invItem.emoji || '📦',
          tipo: invItem.tipo || null,
          precio: invItem.precio || invItem.valor || 0,
          metadata: invItem.metadata || {},
        });
      }
      almacen.updatedAt = new Date();
      await inv.save();
      await almacen.save();

      return message.reply(`📦 Guardaste **${cantidad}x ${invItem.nombre || invItem.id}** en el almacén de **[${gang.tag || ''}] ${gang.nombre}**. (${ocupado + cantidad}/${almacen.capacidad || 150})`);
    },
  },

  {
    name: 'sacar-org',
    aliases: ['sacar-orga', 'take-org'],
    description: '!sacar-org [item] [cantidad] — Sacar items del almacén de la org a tu inventario',
    async run(message, args) {
      if (!args.length) return message.reply('Uso: `!sacar-org [item] [cantidad]`\nEj: `!sacar-org arma 2`');
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await erroresOrg(player, gang);
      if (err) return message.reply(err);

      const inv = await getInventory(message.author.id);
      const almacen = await getOrCreateAlmacen(gang._id);
      const nombre = args.slice(0, -1).join(' ') || args.join(' ');
      const cantidad = parseInt(args[args.length - 1]) || 1;

      const stItem = buscarItem(almacen.items || [], nombre);
      if (!stItem) return message.reply(`❌ No hay "${nombre}" en el almacén de la org.`);
      if ((stItem.cantidad || 0) < cantidad) return message.reply(`❌ Solo hay ${stItem.cantidad}x ${stItem.nombre || stItem.id} en el almacén.`);

      const yaTiene = inv.items.find(i => i.id === stItem.id);
      if (!yaTiene && inv.items.length >= (inv.capacidadMax || 20)) {
        return message.reply(`❌ Inventario lleno (${inv.items.length}/${inv.capacidadMax}).`);
      }

      stItem.cantidad = (stItem.cantidad || 0) - cantidad;
      almacen.items = almacen.items.filter(i => i.cantidad > 0);
      inv.addItem({ id: stItem.id, nombre: stItem.nombre || stItem.id, emoji: stItem.emoji || '📦', tipo: stItem.tipo, valor: stItem.precio || 0 }, cantidad);

      almacen.updatedAt = new Date();
      await inv.save();
      await almacen.save();

      return message.reply(`📦 Sacaste **${cantidad}x ${stItem.nombre || stItem.id}** del almacén de **[${gang.tag || ''}] ${gang.nombre}** a tu inventario.`);
    },
  },

  {
    name: 'asignar-veh',
    aliases: ['asignar-vehiculo'],
    description: '!asignar-veh [placa] [@usuario|quitar] — [ADMIN] Asignar/quitar un vehículo de la org a un miembro',
    async run(message, args) {
      if (!isStaff(message.member)) return message.reply('❌ Solo el staff puede usar `!asignar-veh`.');
      if (args.length < 1) return message.reply('Uso: `!asignar-veh [placa] [@usuario]`\nPara quitar: `!asignar-veh [placa] quitar`');

      const placa = args[0].toUpperCase().replace(/-/g, '').slice(0, 10);
      const target = message.mentions.users.first() || null;
      const quitar = (args.slice(1).join(' ').toLowerCase() === 'quitar');

      const vehicle = await GangVehicle.findOne({ placa });
      if (!vehicle) return message.reply(`❌ No existe un vehículo de org con placa \`${placa}\`.`);

      if (quitar || !target) {
        vehicle.asignadoA = null;
        await vehicle.save();
        return message.reply(`✅ Vehículo \`${vehicle.placa}\` desasignado.`);
      }

      const gang = await Gang.findById(vehicle.gangId);
      const miembro = gang ? gang.getMiembro(target.id) : null;
      if (!gang || !miembro) return message.reply(`❌ <@${target.id}> no es miembro de la org de ese vehículo.`);

      vehicle.asignadoA = target.id;
      await vehicle.save();
      return message.reply(`✅ Vehículo \`${vehicle.placa}\` (**${vehicle.modelo || 'Vehículo'}**) asignado a <@${target.id}> (${miembro.rango || 'Miembro'} de ${gang.nombre}).`);
    },
  },
  {
    name: 'comprar-org',
    aliases: ['comprar-orga', 'buy-org', 'tienda-org'],
    description: '!comprar-org [item] [cantidad] — Comprar para la org (gasta dinero de la org, va al almacén)',
    async run(message, args) {
      const player = await getPlayer(message.author.id, message.author.username);
      const gang = player.gangId ? await Gang.findById(player.gangId) : null;
      const err = await (async () => {
        if (!player.personajeCreado) return '❌ Crea tu personaje primero.';
        if (!gang) return '❌ No estás en ninguna organización.';
        return null;
      })();
      if (err) return message.reply(err);
      if (!args.length) return message.reply('Uso: `!comprar-org [item] [cantidad]`\nEj: `!comprar-org pistola 2` — mira `!tienda` para ver qué hay.');
      const itemId = args[0];
      const cantidad = Math.max(1, parseInt(args[1]) || 1);
      const res = await comprarConDineroOrga(player, gang, itemId, cantidad, message.author.tag);
      if (!res.ok) return message.reply(`❌ ${res.reason}`);
      const embed = new EmbedBuilder()
        .setColor(parseInt(String(gang.color || '#8b5cf6').replace('#', ''), 16) || 0x8b5cf6)
        .setTitle(`🛒 Compra para [${gang.tag || ''}] ${gang.nombre}`)
        .setDescription(`${res.item.emoji || '📦'} **${cantidad}x ${res.item.nombre}** comprado para la org.`)
        .addFields(
          { name: '💸 Coste', value: require('../utils/helpers').formatMoney(res.total), inline: true },
          { name: '💰 Restante org', value: require('../utils/helpers').formatMoney(res.restante), inline: true },
          { name: '📦 Almacén', value: `${(res.almacen.items || []).reduce((s,i)=>s+(i.cantidad||0),0)}/${res.almacen.capacidad || 150} items`, inline: true },
          { name: '📦 Entregado en', value: `Almacén de la org — usa \`!sacar-org ${res.item.id} [cant]\` para sacarlo`, inline: false },
        )
        .setFooter({ text: `Comprado por ${message.author.tag}` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
];

/** [ADMIN] Ver el almacén de cualquier org por nombre: !almacen-NOMBRE */
async function almAlmacenPorNombre(message, nombre) {
  if (!isStaff(message.member)) return message.reply('❌ Solo el staff puede ver el almacén de otras organizaciones.');
  if (!nombre) return message.reply('Uso: `!almacen-NOMBRE_DE_LA_ORG`\nEj: `!almacen-Los Sauces`');
  const gang = await Gang.findOne({ nombre: { $regex: _escapeRegex(nombre), $options: 'i' } });
  if (!gang) return message.reply(`❌ No existe la organización "${nombre}".`);

  const almacen = await getOrCreateAlmacen(gang._id);
  const items = almacen.items || [];
  const ocupado = items.reduce((s, i) => s + (i.cantidad || 0), 0);
  const desc = items.length
    ? items.map(i => `${i.emoji || '📦'} **${i.nombre || i.id}** x${i.cantidad || 0}`).join('\n')
    : '*Almacén vacío.*';

  const embed = new EmbedBuilder()
    .setColor(parseInt(String(gang.color || '#8b5cf6').replace('#', ''), 16) || config.colors.gang)
    .setTitle(`📦 Almacén de [${gang.tag || ''}] ${gang.nombre}`)
    .setDescription(desc)
    .setFooter({ text: `Capacidad: ${ocupado}/${almacen.capacidad || 150} items · visto por ${message.author.username}` })
    .setTimestamp();
  return message.reply({ embeds: [embed] });
}

async function comprarConDineroOrga(player, gang, itemId, cantidad, actorTag) {
  const { findItemGlobal } = require('./tienda');
  const item = findItemGlobal(itemId);
  if (!item) return { ok: false, reason: `Item "${itemId}" no encontrado en la tienda.` };
  const total = item.precio * cantidad;
  if ((gang.dinero || 0) < total) return { ok: false, reason: `La org no tiene suficiente dinero. Necesita ${require('../utils/helpers').formatMoney(total)} y tiene ${require('../utils/helpers').formatMoney(gang.dinero || 0)}.` };
  const almacen = await getOrCreateAlmacen(gang._id);
  const ocupado = (almacen.items || []).reduce((s, i) => s + (i.cantidad || 0), 0);
  if (ocupado + cantidad > (almacen.capacidad || 150)) return { ok: false, reason: `Almacén lleno (${ocupado}/${almacen.capacidad || 150}).` };
  gang.dinero -= total;
  await gang.save();
  const idx = almacen.items.findIndex(i => i.id === item.id);
  if (idx !== -1) almacen.items[idx].cantidad += cantidad;
  else almacen.items.push({ id: item.id, nombre: item.nombre, emoji: item.emoji, tipo: item.tipo, cantidad, precio: item.precio, descripcion: item.desc });
  almacen.updatedAt = new Date();
  await almacen.save();
  return { ok: true, item, cantidad, total, restante: gang.dinero, almacen };
}

function _escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { prefixCommands, almAlmacenPorNombre };