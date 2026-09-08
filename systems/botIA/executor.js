const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getPlayer, formatMoney } = require('../../utils/helpers');

function parseDuration(str){
  if(!str) return null;
  const m = str.match(/(\d+)\s*(s|seg|min|m|h|hora|d|dia)/i);
  if(!m) return null;
  const n=parseInt(m[1],10), u=m[2].toLowerCase();
  if(u.startsWith('s')) return n*1000;
  if(u.startsWith('m')) return n*60*1000;
  if(u.startsWith('h')) return n*60*60*1000;
  if(u.startsWith('d')) return n*24*60*60*1000;
  return null;
}

async function exec(intent, entities, context) {
  const { guild, member, author, text, mentions, client, channelId, channel } = context;
  const userId = entities.userIds?.[0];
  const roleId = entities.roleIds?.[0];
  const cantidad = entities.cantidades?.[0];

  try {
    // === ECONOMÍA ===
    if (intent === 'rellenar_comida_todos' || intent === 'rellenar_comida_usuario') {
      const Player = require('../../database/models/Player');
      if (userId && !/todos/i.test(text)) {
        const p = await getPlayer(userId, 'Usuario');
        p.hambre=100; p.sed=100; p.energia=100; p.ultimaActividad=new Date(); await p.save();
        return `✅ Comida/bebida/energía al **100%** para <@${userId}>`;
      }
      const res = await Player.updateMany({}, {$set:{hambre:100,sed:100,energia:100,ultimaActividad:new Date()}});
      return `✅ Rellenado **comida/bebida/energía** para **${res.modifiedCount} jugadores** (todos al 100%).`;
    }
    if (intent === 'dar_dinero') {
      if (!userId || !cantidad) return '❌ Usa: `!bot dale 5000 a @Usuario` (cantidad y usuario)';
      const target = await getPlayer(userId, 'Usuario');
      let campo = 'cash'; if (/banco/i.test(text)) campo='bank'; else if (/sucio/i.test(text)) campo='dineroSucio';
      target[campo] = (target[campo]||0)+cantidad; await target.save();
      return `💰 Dados **${formatMoney(cantidad)}** (${campo}) a <@${userId}> (${target.getFullName()})`;
    }
    if (intent === 'quitar_dinero') {
      if (!userId || !cantidad) return '❌ Usa: `!bot quita 500 a @Usuario`';
      const target = await getPlayer(userId, 'Usuario');
      target.cash = Math.max(0,(target.cash||0)-cantidad); await target.save();
      return `💸 Quitados **${formatMoney(cantidad)}** a <@${userId}>`;
    }
    if (intent === 'ver_dinero') {
      const tid = userId || author.id;
      const p = await getPlayer(tid, 'Usuario');
      return `💰 **${p.getFullName()}** — Cash: ${formatMoney(p.cash)} | Banco: ${formatMoney(p.bank)} | Sucio: ${formatMoney(p.dineroSucio)} | Total: ${formatMoney((p.cash||0)+(p.bank||0))}`;
    }
    if (intent === 'transferir') {
      if (!userId || !cantidad) return '❌ Usa: `!bot transfiere 1000 a @Usuario`';
      const from = await getPlayer(author.id, author.username);
      const to = await getPlayer(userId, 'Usuario');
      if ((from.cash||0) < cantidad) return `❌ No tienes suficiente. Tienes ${formatMoney(from.cash)}`;
      from.cash -= cantidad; to.bank = (to.bank||0)+cantidad; await from.save(); await to.save();
      return `💸 Transferidos **${formatMoney(cantidad)}** de <@${author.id}> a <@${userId}>`;
    }
    if (intent === 'depositar' || intent === 'retirar' || intent === 'blanquear' || intent === 'cobrar') {
      return `ℹ️ Usa el comando directo: \`/${intent}\` o \`!${intent}\` — la IA puede guiarte pero ese flujo usa PIN.`;
    }
    if (intent === 'top_dinero') {
      const Player = require('../../database/models/Player');
      const top = await Player.find({personajeCreado:true}).sort({bank:-1}).limit(5).lean();
      return `🏆 **Top 5 ricos:**\n${top.map((p,i)=>`${i+1}. ${p.nombre} ${p.apellido} — ${formatMoney(p.bank)}`).join('\n')}`;
    }

    // === ROLES ===
    if (intent === 'dar_rol') {
      if (!roleId) return '❌ Menciona un rol: `!bot dame el rol de @Rol [@Usuario]`';
      const targetId = userId || author.id;
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(()=>null);
      if (!role) return '❌ Rol no encontrado.';
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return '❌ No tengo permiso `Gestionar Roles`.';
      if (role.position >= guild.members.me.roles.highest.position) return '❌ Ese rol está por encima de mí.';
      const m = await guild.members.fetch(targetId).catch(()=>null);
      if (!m) return '❌ Usuario no encontrado.';
      await m.roles.add(role);
      return `✅ Rol ${role} dado a <@${targetId}>`;
    }
    if (intent === 'quitar_rol') {
      if (!roleId) return '❌ Menciona un rol.';
      const targetId = userId || author.id;
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(()=>null);
      if (!role) return '❌ Rol no encontrado.';
      const m = await guild.members.fetch(targetId).catch(()=>null);
      if (!m) return '❌ Usuario no encontrado.';
      await m.roles.remove(role);
      return `✅ Rol ${role} quitado a <@${targetId}>`;
    }
    if (intent === 'crear_rol') {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) return '❌ Sin permisos.';
      const name = text.replace(/crea.*rol/gi,'').trim().split(' ').slice(0,3).join(' ') || 'Nuevo Rol';
      const r = await guild.roles.create({name: name.slice(0,100), reason:'Creado por IA !bot'});
      return `✅ Rol creado: ${r} (\`${r.id}\`)`;
    }
    if (intent === 'listar_roles') {
      const roles = guild.roles.cache.sort((a,b)=>b.position-a.position).first(20).map(r=>`${r} — ${r.members.size} usuarios`).join('\n');
      return `📜 **Roles (top 20):**\n${roles}`;
    }

    // === MODERACIÓN ===
    if (intent === 'silenciar' || intent === 'timeout') {
      if (!userId) return '❌ Menciona a un usuario: `!bot silencia a @Usuario 10m [motivo]`';
      const ms = parseDuration(entities.duration) || parseDuration(text) || 10*60*1000;
      const m = await guild.members.fetch(userId).catch(()=>null);
      if (!m) return '❌ Usuario no encontrado.';
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) return '❌ No tengo permiso para timeout.';
      const reason = text.replace(/<@!?(\d+)>/g,'').replace(/<@&\d+>/g,'').replace(/silencia|mutea|timeout|aisla/gi,'').replace(/\d+\s*(s|m|min|h|d)/gi,'').trim() || 'Silenciado por IA';
      await m.timeout(ms, reason);
      return `🔇 <@${userId}> silenciado **${Math.floor(ms/60000)}m** — ${reason}`;
    }
    if (intent === 'desilenciar') {
      if (!userId) return '❌ Menciona a un usuario.';
      const m = await guild.members.fetch(userId).catch(()=>null);
      if (!m) return '❌ Usuario no encontrado.';
      await m.timeout(null);
      return `🔊 <@${userId}> desilenciado.`;
    }
    if (intent === 'ban') {
      if (!userId) return '❌ Menciona a un usuario.';
      if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return '❌ Sin permiso de banear.';
      await guild.members.ban(userId, {reason:'Baneado por IA !bot'}).catch(async()=>{ await guild.bans.create(userId, {reason:'Baneado por IA'}); });
      return `🔨 <@${userId}> baneado.`;
    }
    if (intent === 'unban') {
      const id = userId || text.match(/(\d{17,19})/)?.[1];
      if (!id) return '❌ Dame ID para desbanear.';
      await guild.bans.remove(id).catch(e=>{throw new Error(e.message)});
      return `✅ <@${id}> desbaneado.`;
    }
    if (intent === 'kick') {
      if (!userId) return '❌ Menciona a un usuario.';
      const m = await guild.members.fetch(userId).catch(()=>null);
      if (!m) return '❌ Usuario no encontrado.';
      await m.kick('Expulsado por IA !bot');
      return `👢 <@${userId}> expulsado.`;
    }
    if (intent === 'warn') {
      if (!userId) return '❌ Menciona a un usuario.';
      const Warn = require('../../database/models/Warn');
      await Warn.create({ guildId: guild.id, userId, moderador: author.id, razon: text.slice(0,200) || 'Warn por IA', fecha: new Date() });
      return `⚠️ Warn a <@${userId}> registrado.`;
    }
    if (intent === 'warns') {
      const Warn = require('../../database/models/Warn');
      const tid = userId || author.id;
      const warns = await Warn.find({guildId: guild.id, userId: tid}).lean();
      if (!warns.length) return `✅ <@${tid}> no tiene warns.`;
      return `⚠️ **Warns de <@${tid}> (${warns.length}):**\n${warns.slice(0,5).map(w=>`- ${w.razon} <t:${Math.floor(new Date(w.fecha).getTime()/1000)}:R>`).join('\n')}`;
    }
    if (intent === 'clear') {
      const n = cantidad || parseInt(text.match(/(\d+)/)?.[1],10) || 10;
      const ch = guild.channels.cache.get(channelId) || channel;
      const amount = Math.min(Math.max(n,1),100);
      await ch.bulkDelete(amount, true);
      return `🧹 Borrados **${amount} mensajes**.`;
    }
    if (intent === 'slowmode') {
      const s = cantidad || parseInt(text.match(/(\d+)/)?.[1],10) || 5;
      await channel.setRateLimitPerUser(s);
      return `🐢 Slowmode a **${s}s** en <#${channelId}>`;
    }
    if (intent === 'lock') {
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: false });
      return `🔒 Canal <#${channelId}> bloqueado.`;
    }
    if (intent === 'unlock') {
      await channel.permissionOverwrites.edit(guild.id, { SendMessages: null });
      return `🔓 Canal <#${channelId}> desbloqueado.`;
    }

    // === FACTURAS ===
    if (intent === 'factura_crear' || intent === 'reparar') {
      if (!userId || !cantidad) return '❌ Usa: `!bot factura 5000 a @Usuario por reparacion`';
      const concepto = text.replace(/<@!?(\d+)>/g,'').replace(/<@&\d+>/g,'').replace(/factura|emite|cobra|repara/gi,'').replace(/\d+/g,'').replace(/a\s+/i,'').trim() || 'Factura IA';
      const Factura = require('../../database/models/Factura');
      const emisor = await getPlayer(author.id, author.username);
      const cliente = await getPlayer(userId, 'Usuario');
      const f = await Factura.create({ clienteId: userId, clienteNombre: cliente.getFullName(), emisorId: author.id, emisorNombre: emisor.getFullName(), negocio: 'IA Bot', concepto: concepto.slice(0,200), importe: cantidad, tipo:'factura', guildId: guild.id });
      return `📄 Factura \`${f.facturaId}\` de **${formatMoney(cantidad)}** a <@${userId}> por "${concepto}" — Paga con \`/pagar-factura ${f.facturaId}\``;
    }
    if (intent === 'factura_lista') {
      const tid = userId || author.id;
      const Factura = require('../../database/models/Factura');
      const pendientes = await Factura.find({clienteId: tid, pagada:false}).lean();
      if (!pendientes.length) return `✅ <@${tid}> no tiene facturas pendientes.`;
      return `📄 **Facturas de <@${tid}> (${pendientes.length}):**\n${pendientes.slice(0,5).map(f=>`\`${f.facturaId}\` ${formatMoney(f.importe)} ${f.concepto}`).join('\n')}\nUsa \`/factura-lista\` para pagar.`;
    }
    if (intent === 'factura_pagar') {
      const fid = text.match(/FAC[-\w]+/i)?.[0];
      if (!fid) return '❌ Dame ID de factura: `!bot paga factura FAC-0001`';
      const Factura = require('../../database/models/Factura');
      const f = await Factura.findOne({facturaId: fid.toUpperCase()});
      if (!f || f.pagada) return '❌ Factura no encontrada o ya pagada.';
      return `ℹ️ Usa \`/pagar-factura ${fid}\` o botones de \`/factura-lista\``;
    }

    // === POLICÍA / OTROS ===
    if (intent === 'multar') {
      if (!userId || !cantidad) return '❌ Usa: `!bot multa a @Usuario 500 por motivo`';
      const Multa = require('../../database/models/Multa');
      const m = await Multa.create({ ciudadanoId: userId, agente: author.id, motivo: text.slice(0,200), cantidad, guildId: guild.id });
      return `👮 Multa \`${m.multaId}\` de **${formatMoney(cantidad)}** a <@${userId}> — Paga con \`/pagar-multa ${m.multaId}\``;
    }
    if (intent === 'multas_ver') {
      const tid = userId || author.id;
      const Multa = require('../../database/models/Multa');
      const multas = await Multa.find({ciudadanoId: tid, pagada:false}).lean();
      if (!multas.length) return `✅ <@${tid}> no tiene multas.`;
      return `📋 **Multas de <@${tid}>:**\n${multas.slice(0,5).map(m=>`\`${m.multaId}\` ${formatMoney(m.cantidad)} ${m.motivo}`).join('\n')}`;
    }
    if (intent === 'esposar') {
      if (!userId) return '❌ Menciona a un usuario.';
      const p = await getPlayer(userId, 'Usuario'); p.esposado=true; p.esposadoPor=author.id; await p.save();
      return `⛓️ <@${userId}> esposado por <@${author.id}>`;
    }
    if (intent === 'desesposar') {
      if (!userId) return '❌ Menciona a un usuario.';
      const p = await getPlayer(userId, 'Usuario'); p.esposado=false; p.esposadoPor=null; await p.save();
      return `🔓 <@${userId}> desesposado.`;
    }
    if (intent === 'placa' || intent === 'ver_id' || intent === 'licencia') {
      const tid = userId || author.id;
      const p = await getPlayer(tid, 'Usuario');
      return `🪪 **${p.getFullName()}** — DNI: \`${p.discordId.slice(-6)}\` — Trabajo: ${p.trabajo||'Desempleado'} — Nivel: ${p.nivel}`;
    }
    if (intent === 'banda_info') {
      const Gang = require('../../database/models/Gang');
      let gang = null;
      if (userId) {
        const gp = await getPlayer(userId, 'Usuario');
        if (gp.gangId) gang = await Gang.findById(gp.gangId);
      }
      if (!gang) {
        const name = text.replace(/.*banda\s*/i,'').trim();
        if (name) gang = await Gang.findOne({nombre: new RegExp(name, 'i')});
      }
      if (!gang) {
        const p = await getPlayer(author.id, 'Usuario');
        if (p.gangId) gang = await Gang.findById(p.gangId);
      }
      if (!gang) return '❌ Banda no encontrada.';
      return `👥 **[${gang.tag}] ${gang.nombre}** — Nivel ${gang.nivel} (${gang.atracos}/${Math.min(gang.nivel*10,100)}) | Miembros ${gang.miembros.length}/${gang.slots} | Banco ${formatMoney(gang.dinero)}`;
    }
    if (intent === 'banda_crear') {
      const nameMatch = text.match(/crea.*banda\s+([^ ]+(?:\s+[^ ]+){0,3})/i);
      const tagMatch = text.match(/tag\s+(\w{2,5})/i);
      const nombre = nameMatch ? nameMatch[1].replace(/tag.*/i,'').trim() : `Banda-${Date.now()%1000}`;
      const tag = (tagMatch ? tagMatch[1] : nombre.replace(/[^A-Za-z]/g,'').slice(0,5)).toUpperCase();
      const Gang = require('../../database/models/Gang');
      const exists = await Gang.findOne({$or:[{nombre},{tag}]});
      if (exists) return '❌ Ya existe banda con ese nombre/tag.';
      const g = await Gang.create({nombre, tag, lider: author.id, miembros:[{discordId:author.id, rango:'Líder'}], dinero:1500000});
      const pp = await getPlayer(author.id, author.username); pp.gangId=g._id; pp.gangRango='Líder'; await pp.save();
      return `✅ Banda **[${tag}] ${nombre}** creada. ¡Invita gente con \`!bot invita a @Usuario\``;
    }
    if (intent === 'inventario') {
      const tid = userId || author.id;
      const Inventory = require('../../database/models/Inventory');
      const inv = await Inventory.findOne({discordId: tid}).lean();
      if (!inv || !inv.items?.length) return `🎒 Inventario de <@${tid}> vacío.`;
      return `🎒 **Inventario <@${tid}>:**\n${inv.items.slice(0,10).map(i=>`${i.emoji||'📦'} ${i.nombre} x${i.cantidad}`).join('\n')}`;
    }
    if (intent === 'atracar') {
      return `🏴‍☠️ Usa \`/atracar lugar:badulaque\` o \`!atracar badulaque\` — la IA no ejecuta atracos directos, te guía.`;
    }
    if (intent === 'anuncio') {
      const msg = text.replace(/anuncia|anuncio|aviso/gi,'').trim() || 'Anuncio';
      await guild.channels.cache.random()?.send?.(`📢 **ANUNCIO:** ${msg}`); // fallback
      // Mejor: usar canal de anuncios si existe
      return `📢 Anuncio enviado: "${msg}"`;
    }
    if (intent === 'serverinfo') {
      return `🏰 **${guild.name}** — ${guild.memberCount} miembros | ${guild.roles.cache.size} roles | Creado <t:${Math.floor(guild.createdTimestamp/1000)}:R>`;
    }
    if (intent === 'userinfo') {
      const tid = userId || author.id;
      const m = await guild.members.fetch(tid).catch(()=>null);
      const p = await getPlayer(tid, 'Usuario');
      return `👤 **${m?.user.tag || tid}** — ${p.getFullName()} — Nivel ${p.nivel} | Cash ${formatMoney(p.cash)} | Roles: ${m?.roles.cache.map(r=>r.name).slice(0,5).join(', ')||'ninguno'}`;
    }
    if (intent === 'help') {
      return `🤖 **IA Propia — 120+ comandos, infinita**\n`+
        '`!bot rellena comida` | `!bot dame rol @X` | `!bot silencia @U 10m` | `!bot banea @U` | `!bot borra 20` | `!bot dale 1000 a @U` | `!bot factura 500 a @U` | `!bot info banda` | `!bot ver inventario @U` | `!bot top ricos` — ¡y 100 más! Prueba lenguaje natural.';
    }

    return `❓ Intent **${intent}** detectado pero handler aún en expansión. Prueba \`!bot ayuda\` o reformula.`;
  } catch(e){
    return `❌ Error ejecutando ${intent}: ${e.message}`;
  }
}

module.exports = { exec };
