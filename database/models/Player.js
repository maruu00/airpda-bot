const mongoose = require('mongoose');

const vehiculoSchema = new mongoose.Schema({
  id: String,
  nombre: String,
  modelo: String,
  color: { type: String, default: 'Negro' },
  matricula: String,
  valor: Number,
  tipo: String,
  velocidad: Number,
  guardado: { type: Boolean, default: true },
  averiado: { type: Boolean, default: false },
}, { _id: false });

const playerSchema = new mongoose.Schema({
  discordId: { type: String, unique: true, required: true },
  discordUsername: String,

  // Personaje
  nombre: { type: String, default: null },
  apellido: { type: String, default: null },
  edad: { type: Number, default: 25 },
  genero: { type: String, enum: ['M', 'F', 'NB'], default: 'M' },
  descripcion: { type: String, default: '' },
  bio: { type: String, default: '' },
  origen: { type: String, default: 'Los Santos' },
  nacionalidad: { type: String, default: null },
  acento: { type: String, default: '' },
  personajeCreado: { type: Boolean, default: false },

  // Economía
  cash: { type: Number, default: 2000 },
  bank: { type: Number, default: 5000 },
  bankAhorros: { type: Number, default: 0 },      // Segunda cuenta (ahorros)
  pinBancoAhorros: { type: String, default: null }, // PIN cuenta de ahorros
  dineroSucio: { type: Number, default: 0 },
  ultimoAtracoBotin: { type: Number, default: 0 },
  ultimoAtracoFecha: { type: Date, default: null },
  totalGanado: { type: Number, default: 0 },
  fichas: { type: Number, default: 0 },
  rachaCasino: { type: Number, default: 0 },

  // Estadísticas vitales
  salud: { type: Number, default: 100, min: 0, max: 100 },
  hambre: { type: Number, default: 100, min: 0, max: 100 },
  sed: { type: Number, default: 100, min: 0, max: 100 },
  energia: { type: Number, default: 100, min: 0, max: 100 },

  // Nivel y XP
  nivel: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  xpSiguienteNivel: { type: Number, default: 100 },

  // Estado
  buscado: { type: Boolean, default: false },
  peligroso: { type: Boolean, default: false },
  enCarcel: { type: Boolean, default: false },
  tiempoCarcel: { type: Date, default: null },
  enHospital: { type: Boolean, default: false },
  muerto: { type: Boolean, default: false },
  tiempoHospital: { type: Date, default: null },
  efectoDroga: { type: String, default: null },
  efectoDrogaExpira: { type: Date, default: null },
  proteccion: { type: Number, default: 0 },   // % de protección (chaleco)

  // Trabajo
  trabajo: { type: String, default: 'desempleado' },
  trabaja: { type: Boolean, default: false },

  // Banda
  gangId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gang', default: null },
  gangRango: { type: String, default: null },

  // Posesiones
  vehiculos: [vehiculoSchema],    // campo legado
  vehicles: [vehiculoSchema],     // campo usado por comandos


  // Estadísticas criminales
  arrestos: { type: Number, default: 0 },
  multasRecibidas: { type: Number, default: 0 },
  robosRealizados: { type: Number, default: 0 },
  trabajosRealizados: { type: Number, default: 0 },
  drogasVendidas: { type: Number, default: 0 },
  killsRP: { type: Number, default: 0 },
  muertesRP: { type: Number, default: 0 },

  // Estado policial
  esposado:   { type: Boolean, default: false },
  esposadoPor: { type: String, default: null }, // Discord ID del agente

  // Admin IC
  adminOn:    { type: Boolean, default: false },

  // PIN bancario (4 dígitos, guardado como string hasheado en producción)
  pinBanco:   { type: String, default: null },

  // Cooldowns
  cooldowns: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },

  // Registro
  creadoEn: { type: Date, default: Date.now },
  ultimaActividad: { type: Date, default: Date.now },
});

// getCooldown — devuelve la fecha de la última acción (Date) o null
playerSchema.methods.getCooldown = function(accion) {
  const cd = this.cooldowns.get(accion);
  return cd || null;
};

// setCooldown — guarda cuándo se realizó la acción (pasa una Date o usa new Date())
playerSchema.methods.setCooldown = function(accion, fecha) {
  this.cooldowns.set(accion, fecha instanceof Date ? fecha : new Date());
};

// addXP — sube XP y sube de nivel si corresponde
playerSchema.methods.addXP = function(cantidad) {
  this.xp += cantidad;
  while (this.xp >= this.xpSiguienteNivel) {
    this.xp -= this.xpSiguienteNivel;
    this.nivel++;
    this.xpSiguienteNivel = Math.floor(this.xpSiguienteNivel * 1.5);
  }
};

playerSchema.methods.getFullName = function() {
  if (!this.nombre) return 'Sin personaje';
  return `${this.nombre} ${this.apellido}`;
};

module.exports = mongoose.model('BotPlayer', playerSchema);
