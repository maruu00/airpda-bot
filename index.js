require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { connectDB } = require('./database/connection');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const config = require('./config');
const cron = require('node-cron');

// ─── Validación de entorno ────────────────────────────────────────────────────
const requiredEnv = [
  ['DISCORD_BOT_TOKEN',        config.token],
  ['DISCORD_CLIENT_ID',        config.clientId],
  ['MONGODB_URI',              config.mongoUri],
  ['DISCORD_GUILD_ID',         config.guildId],
  ['PDA_BACKEND_URL',          config.pdaBackend],
];
const missing = requiredEnv.filter(([, v]) => !v);
if (missing.length) {
  console.error(`❌ Variables de entorno faltantes:\n  ${missing.map(([k]) => k).join('\n  ')}`);
  console.error('Revisa tu archivo .env');
  process.exit(1);
}

// ─── Error handlers globales ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User],
});

// Collections
client.commands    = new Collection(); // slash commands { name -> {data, execute} }
client.prefixCmds  = new Collection(); // prefix commands { name -> {name, aliases, run} }

(async () => {
  try {
    await connectDB();
    loadCommands(client);
    loadEvents(client);
    await client.login(config.token);
    const { startStatusSync } = require('./commands/status');
    startStatusSync(client);
  } catch (err) {
    console.error('❌ Error al iniciar el bot:', err);
    process.exit(1);
  }
})();

// Check Canvas availability
try { require('@napi-rs/canvas'); console.log('[Canvas] ✅ Disponible'); } catch { console.log('[Canvas] ❌ No disponible'); }

// ─── Log de errores y reinicios → canal 1510107636157386853 ────────────────
const { sendToLogChannel } = require('./utils/logChannel');
process.on('uncaughtException', async (err) => {
  console.error('[uncaughtException]', err);
  try {
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('💥 uncaughtException').setDescription(`\`\`\`js\n${String(err.stack || err).slice(0, 1900)}\n\`\`\``).setTimestamp();
    await sendToLogChannel(client, { embeds: [embed] });
  } catch {}
});
process.on('unhandledRejection', async (reason) => {
  console.error('[unhandledRejection]', reason);
  try {
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('⚠️ unhandledRejection').setDescription(`\`\`\`js\n${String(reason).slice(0, 1900)}\n\`\`\``).setTimestamp();
    await sendToLogChannel(client, { embeds: [embed] });
  } catch {}
});
const _origError = console.error;
console.error = (...args) => {
  _origError(...args);
  try {
    const text = args.map(a => a instanceof Error ? (a.stack || a.message) : String(a)).join(' ').slice(0, 1900);
    if (!text.trim()) return;
    if (text.includes('[Canvas]') || text.includes('DeprecationWarning')) return;
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder().setColor(0xef4444).setTitle('📋 Error en consola').setDescription(`\`\`\`js\n${text}\n\`\`\``).setTimestamp();
    sendToLogChannel(client, { embeds: [embed] }).catch(() => {});
  } catch {}
};

// ─── Command Queue — Consola Web ────────────────────────────────────────────
const CommandQueue = require('./database/models/CommandQueue');

async function processCommandQueue() {
  try {
    const pending = await CommandQueue.findOne({ ejecutado: false }).sort({ creadoEn: 1 });
    if (!pending) return;

    const channel = await client.channels.fetch(pending.canalId).catch(() => null);
    if (!channel) {
      pending.ejecutado = true;
      await pending.save();
      return;
    }

    const guildConfig = await require('./database/models/GuildConfig').findOne({ guildId: channel.guildId }).catch(() => null);
    const prefix = guildConfig?.prefix || require('./config').prefix;

    // Mostrar el comando en el canal como mensaje del bot
    await channel.send(pending.comando).catch(() => {});

    // Procesar el comando usando la identidad del admin que lo envió
    if (pending.comando.startsWith(prefix)) {
      const adminUser = pending.adminId ? await client.users.fetch(pending.adminId).catch(() => null) : null;
      const adminMember = pending.adminId && channel.guild ? await channel.guild.members.fetch(pending.adminId).catch(() => null) : null;

      // Auto-crear personaje admin si no tiene
      if (adminUser && pending.adminId) {
        try {
          const Player = require('./database/models/Player');
          const existing = await Player.findOne({ discordId: pending.adminId });
          if (!existing) {
            await Player.create({
              discordId: pending.adminId,
              discordUsername: adminUser.username,
              nombre: 'Consola',
              apellido: 'Admin',
              personajeCreado: true,
              cash: 0, bank: 0,
              nivel: 1, xp: 0, xpSiguienteNivel: 100,
              salud: 100, hambre: 100, sed: 100, energia: 100,
            });
          }
        } catch {}
      }

      const fakeMsg = {
        author: adminUser || client.user,
        member: adminMember || channel.guild?.members?.me || null,
        guild: channel.guild,
        channel,
        content: pending.comando,
        guildId: channel.guildId,
        channelId: channel.id,
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        cleanContent: pending.comando,
        inGuild: () => true,
        reply: async (opts) => channel.send(opts),
        react: async () => {},
        edit: async () => {},
        delete: async () => {},
        embeds: [],
        attachments: new Map(),
        mentions: {
          users: new Map(), roles: new Map(), channels: new Map(),
          _members: new Map(), _channels: new Map(),
          everyone: false, crosspostedChannels: new Map(),
          has: () => false, toJSON: () => ({}),
        },
        url: '',
        system: false,
        tts: false,
        pinned: false,
        type: 0,
        webhookId: null,
        activity: null,
        application: null,
      };

      const args = pending.comando.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();
      const cmd = client.prefixCmds.get(cmdName);
      if (cmd) {
        try {
          await cmd.run(fakeMsg, args, client);
        } catch (e) {
          console.error(`[CommandQueue/${cmdName}]`, e);
        }
      }
    }

    pending.ejecutado = true;
    await pending.save();
  } catch (e) {
    console.error('[CommandQueue] Error:', e.message);
  }
}

setInterval(processCommandQueue, 3000);

// ─── CRON: Drug growing (cada 5 min) ─────────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const DrugPlot = require('./database/models/DrugPlot');
    const DrugData = require('./data/drogas');
    const now = new Date();

    // Verificar riego — plantas sin regar se pudren
    const growing = await DrugPlot.find({ fase: 'creciendo' });
    for (const plot of growing) {
      const info = DrugData[plot.tipo];
      if (!info) continue;
      const tiempoSinRiego = now - plot.ultimoRiego;
      const riegoInterval = plot.conPaneles ? info.riegoInterval * 1.5 : info.riegoInterval;
      if (tiempoSinRiego > riegoInterval * 2) {
        plot.fase = 'podrido';
        await plot.save();
        try {
          const user = await client.users.fetch(plot.discordId);
          await user.send(`💀 **Tu plantación de ${info.nombre} se ha podrido** por falta de riego.`);
        } catch {}
      }
    }

    // Plantaciones listas para cosechar
    const ready = await DrugPlot.find({ fase: 'creciendo', listoEn: { $lte: now } });
    for (const plot of ready) {
      plot.fase = 'listo';
      plot.podridoEn = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h para cosechar
      await plot.save();
      try {
        const user = await client.users.fetch(plot.discordId);
        await user.send(`🌿 **Tu ${DrugData[plot.tipo]?.nombre || plot.tipo} está lista!** Usa \`!cosechar\` o \`/drogas cosechar\`.`);
      } catch {}
    }

    // Plantaciones podridas — eliminar
    await DrugPlot.deleteMany({ fase: 'podrido' });
    await DrugPlot.deleteMany({ fase: 'listo', podridoEn: { $lte: now } });
  } catch (e) {
    console.error('[CRON drugs]', e.message);
  }
});

// ─── CRON: Hospital release (cada minuto) ────────────────────────────────────
cron.schedule('* * * * *', async () => {
  try {
    const Player = require('./database/models/Player');
    const now = new Date();
    const released = await Player.find({ enHospital: true, tiempoHospital: { $lte: now } });
    for (const p of released) {
      p.enHospital = false;
      p.muerto = false;
      p.salud = 100;
      p.tiempoHospital = null;
      await p.save();
      try {
        const user = await client.users.fetch(p.discordId);
        await user.send('🏥 Has sido dado de alta del hospital. ¡Tu salud ha sido restaurada al **100%**!');
      } catch {}
    }
  } catch (e) {
    console.error('[CRON hospital]', e.message);
  }
});

// ─── CRON: Vital decay (cada 30 min) ─────────────────────────────────────────
// Notificación con cooldown de 3 horas para no spamear al jugador
cron.schedule('*/30 * * * *', async () => {
  try {
    const Player = require('./database/models/Player');
    const { applyVitalDecay } = require('./utils/helpers');
    const players = await Player.find({ personajeCreado: true, muerto: false });
    const COOLDOWN_ALERTA = 3 * 60 * 60 * 1000; // 3 horas entre alertas

    for (const p of players) {
      const antes = { hambre: p.hambre, sed: p.sed };
      applyVitalDecay(p);

      const cambio = p.hambre !== antes.hambre || p.sed !== antes.sed;
      if (!cambio) continue;

      if (p.hambre < 20 || p.sed < 20) {
        const ultimaAlerta = p.cooldowns?.get?.('alerta_vital');
        const ahora = Date.now();
        const tiempoPasado = ultimaAlerta ? ahora - new Date(ultimaAlerta).getTime() : Infinity;

        if (tiempoPasado >= COOLDOWN_ALERTA) {
          try {
            const user = await client.users.fetch(p.discordId);
            const alerts = [];
            if (p.hambre < 20) alerts.push(`🍔 Hambre crítica: **${Math.floor(p.hambre)}%**`);
            if (p.sed < 20)    alerts.push(`💧 Sed crítica: **${Math.floor(p.sed)}%**`);
            await user.send(
              `⚠️ **Alerta vital — ${p.getFullName ? p.getFullName() : 'Tu personaje'}**\n\n` +
              `${alerts.join('\n')}\n\n` +
              `📲 Abre la tienda: \`/tienda\` → Compra comida/bebida → \`/usar [item]\`\n` +
              `📊 Ver vitales: \`/vitales\``,
            );
            p.cooldowns.set('alerta_vital', new Date());
            p.markModified('cooldowns');
          } catch {}
        }
      }

      await p.save();
    }
  } catch (e) {
    console.error('[CRON vitals]', e.message);
  }
});

// ─── CRON: CK auto-reset (cada 5 min) ────────────────────────────────────────
// Detecta CKs aprobados en la PDA y resetea el Player del bot automáticamente
cron.schedule('*/5 * * * *', async () => {
  try {
    const { CK } = require('./database/models/PdaModels');
    const Player  = require('./database/models/Player');

    const aprobados = await CK.find({ estado: 'aprobado', botProcessed: { $ne: true } }).lean();
    for (const ck of aprobados) {
      try {
        if (ck.solicitanteId) {
          const bp = await Player.findOne({ discordId: ck.solicitanteId });
          if (bp && bp.personajeCreado) {
            bp.personajeCreado = false;
            bp.nombre = null; bp.apellido = null; bp.edad = null; bp.genero = null;
            bp.bio = null; bp.origen = null;
            bp.cash = 0; bp.bank = 0; bp.bankAhorros = 0; bp.dineroSucio = 0;
            bp.pinBanco = null; bp.pinBancoAhorros = null;
            bp.nivel = 1; bp.xp = 0; bp.xpSiguienteNivel = 100; bp.trabajo = 'desempleado';
            bp.salud = 100; bp.hambre = 100; bp.sed = 100; bp.energia = 100;
            bp.arrestos = 0; bp.multasRecibidas = 0; bp.robosRealizados = 0;
            bp.muertesRP = 0; bp.killsRP = 0; bp.drogasVendidas = 0; bp.trabajosRealizados = 0;
            bp.vehicles = []; bp.vehiculos = [];
            bp.gangId = null; bp.gangRango = null;
            bp.esposado = false; bp.esposadoPor = null;
            bp.buscado = false; bp.peligroso = false;
            bp.enCarcel = false; bp.enHospital = false; bp.muerto = false;
            bp.proteccion = false; bp.efectoDroga = null; bp.adminOn = false;
            bp.cooldowns = new Map();
            await bp.save();
          }

          // DM al jugador
          try {
            const u = await client.users.fetch(ck.solicitanteId);
            const nota = ck.notas ? `\n📝 Nota del staff: *${ck.notas}*` : '';
            await u.send(`💀 **Tu Character Kill ha sido aprobado.**\n\nTu personaje **${ck.solicitanteNombre || 'tu personaje'}** ha llegado al final de su historia en Los Santos.${nota}\n\nYa puedes crear un nuevo personaje con \`/personaje crear\`.`);
          } catch {}
        }

        await CK.findByIdAndUpdate(ck._id, { botProcessed: true });
      } catch (err) {
        console.error('[CRON CK]', err.message);
      }
    }
  } catch (e) {
    console.error('[CRON CK]', e.message);
  }
});

// ─── CRON: Ticket auto-close (cada hora) ─────────────────────────────────────
cron.schedule('0 * * * *', async () => {
  try {
    const Ticket = require('./database/models/Ticket');
    const limit = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h inactivo
    const stale = await Ticket.find({ estado: 'abierto', ultimoMensaje: { $lte: limit } });
    for (const t of stale) {
      t.estado = 'cerrado';
      t.cerradoEn = new Date();
      t.motivoCierre = 'Auto-cerrado por inactividad (48h)';
      await t.save();
      try {
        const ch = await client.channels.fetch(t.channelId);
        if (ch) await ch.send('🔒 Este ticket ha sido **cerrado automáticamente** por inactividad de 48 horas.');
      } catch {}
    }
  } catch (e) {
    console.error('[CRON tickets]', e.message);
  }
});

module.exports = client;
