const ms = require('ms');
const Player = require('../database/models/Player');
const Inventory = require('../database/models/Inventory');

// Sincronizar datos del usuario PDA → BotPlayer
async function syncFromPda(botPlayer, pdaUser) {
  if (!pdaUser) return;

  // Solo sincronizar si tienen nombre y apellido en la PDA
  if (!pdaUser.nombre || !pdaUser.apellido) return;

  botPlayer.nombre          = pdaUser.nombre;
  botPlayer.apellido        = pdaUser.apellido;
  botPlayer.personajeCreado = true;

  if (pdaUser.esBuscado)   botPlayer.buscado    = true;
  if (pdaUser.esPeligroso) botPlayer.peligroso  = true;
  if (pdaUser.departamento) {
    // Marcar trabajo según departamento PDA
    const depToJob = { LSPD: 'policía', LSCSD: 'sheriff', LSCFD: 'bombero' };
    botPlayer.trabajo = depToJob[pdaUser.departamento] || botPlayer.trabajo;
  }
}

// Obtener o crear jugador — con auto-sync desde la PDA
async function getPlayer(discordId, username) {
  let p = await Player.findOne({ discordId });

  if (!p) {
    // Jugador nuevo: intentar sincronizar desde la PDA antes de crear
    p = new Player({ discordId, discordUsername: username });

    try {
      const { User } = require('../database/models/PdaModels');
      const pdaUser  = await User.findOne({ discordId }).lean();
      await syncFromPda(p, pdaUser);
    } catch {}

    await p.save();

    // Crear inventario si no existe
    const invExiste = await Inventory.findOne({ discordId });
    if (!invExiste) await Inventory.create({ discordId });

  } else if (!p.personajeCreado) {
    // Jugador ya existe en el bot pero sin personaje: comprobar si lo creó en la web
    try {
      const { User } = require('../database/models/PdaModels');
      const pdaUser  = await User.findOne({ discordId }).lean();
      if (pdaUser?.nombre && pdaUser?.apellido) {
        await syncFromPda(p, pdaUser);
        await p.save();
      }
    } catch {}
  }

  return p;
}

// Obtener inventario
async function getInventory(discordId) {
  let inv = await Inventory.findOne({ discordId });
  if (!inv) inv = await Inventory.create({ discordId });
  return inv;
}

// Formatear tiempo restante
function formatCooldown(ms_remaining) {
  const s = Math.floor(ms_remaining / 1000);
  if (s < 60) return `${s} segundo${s !== 1 ? 's' : ''}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minuto${m !== 1 ? 's' : ''}`;
  const h = Math.floor(m / 60);
  return `${h} hora${h !== 1 ? 's' : ''} y ${m % 60} min`;
}

// Número aleatorio entre min y max (inclusive)
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Número aleatorio decimal
function randF(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// Comprobar si el jugador tiene personaje creado
function requirePersonaje(player) {
  return player.personajeCreado;
}

// Calcular XP necesario para siguiente nivel
function calcXpNivel(nivel) {
  return Math.floor(100 * Math.pow(1.5, nivel - 1));
}

// Aplicar decay de hambre/sed con el tiempo
// Decay: hambre -0.008%/min (~8 días), sed -0.01%/min (~7 días), energia -0.005%/min (~14 días) — muy lento
function applyVitalDecay(player) {
  const ahora = Date.now();
  const ultimaActividad = player.ultimaActividad.getTime();
  const minPasados = Math.floor((ahora - ultimaActividad) / 60000);
  if (minPasados > 0) {
    player.hambre = Math.max(0, player.hambre - minPasados * 0.008);
    player.sed    = Math.max(0, player.sed    - minPasados * 0.01);
    player.energia = Math.max(0, (player.energia ?? 100) - minPasados * 0.005);
    player.ultimaActividad = new Date();
  }
  return player;
}

// Verificar si usuario tiene rol de moderador
function isMod(member, guildConfig) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  if (member.permissions.has('ModerateMembers')) return true;
  if (guildConfig?.roles?.moderador && member.roles.cache.has(guildConfig.roles.moderador)) return true;
  if (guildConfig?.roles?.admin && member.roles.cache.has(guildConfig.roles.admin)) return true;
  return false;
}

// Verificar si es admin
function isAdmin(member) {
  return member?.permissions?.has('Administrator') || false;
}

// Formato de moneda
function formatMoney(amount) {
  return `$${Math.floor(amount).toLocaleString('es-ES')}`;
}

// Generar matrícula aleatoria
function generarMatricula() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '0123456789';
  const l = () => letras[rand(0, letras.length - 1)];
  const n = () => nums[rand(0, 9)];
  return `${l()}${l()}${l()}-${n()}${n()}${n()}`;
}

// Verificar que un miembro tiene uno de los roles permitidos
function requireBadge(member, allowedRoles = []) {
  if (member.permissions.has('Administrator')) return true;
  return allowedRoles.some(r => r && member.roles.cache.has(r));
}

// Reducir salud de un jugador
async function dañarJugador(player, cantidad) {
  player.salud = Math.max(0, player.salud - cantidad);
  if (player.salud === 0) {
    player.muerto = true;
    player.enHospital = true;
    player.tiempoHospital = new Date(Date.now() + 5 * 60 * 1000); // 5 min en hospital
    player.muertesRP++;
  }
  await player.save();
  return player;
}

module.exports = {
  getPlayer,
  getInventory,
  formatCooldown,
  rand,
  randF,
  requirePersonaje,
  calcXpNivel,
  applyVitalDecay,
  isMod,
  isAdmin,
  formatMoney,
  generarMatricula,
  requireBadge,
  dañarJugador,
};
