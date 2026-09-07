const mongoose = require('mongoose');

const miembroSchema = new mongoose.Schema({
  discordId: String,
  nombre: String,
  rango: { type: String, default: 'Recluta' },
  fechaUnion: { type: Date, default: Date.now },
  muertes: { type: Number, default: 0 },
  kills: { type: Number, default: 0 },
  contribucion: { type: Number, default: 0 },
}, { _id: false });

const territorioSchema = new mongoose.Schema({
  nombre: String,
  zona: String,
  conquistadoEn: { type: Date, default: Date.now },
}, { _id: false });

const gangSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  tag:    { type: String, required: true, unique: true, maxlength: 5, uppercase: true },
  descripcion: { type: String, default: '' },
  lider: { type: String, required: true },     // discordId
  color: { type: mongoose.Schema.Types.Mixed, default: '#8b5cf6' },  // color hex (#rrggbb) para embeds
  emoji: { type: String, default: '⚔️' },

  // Campos compartidos con la web/staff (misma colección 'gangs')
  jefeRolId: { type: String, default: null },        // rol "Jefe NOMBRE" en Discord
  capitalInicial: { type: Number, default: 1500000 }, // capital inicial de la org (1.5M)
  desmantelada: { type: Boolean, default: false },
  desmanteladaEn: { type: Date, default: null },
  motivoDesmantelada: { type: String, default: null },
  logo: { type: String, default: '' },
  lore: { type: String, default: '' },
  ubicacion: { type: String, default: '' },
  fundador: { type: String, default: null },
  fechaFundacion: { type: Date, default: null },

  miembros: [miembroSchema],
  territorios: [territorioSchema],

  // Config web/staff
  rangos: [String],
  slots: { type: Number, default: 4 },
  rolId: { type: String, default: null },

  dinero: { type: Number, default: 0 },
  reputacion: { type: Number, default: 0 },
  nivel: { type: Number, default: 1 },
  atracos: { type: Number, default: 0 },

  // War system
  enGuerra: { type: Boolean, default: false },
  guerraContra: { type: String, default: null },  // gang id
  guerraKills: { type: Number, default: 0 },
  guerraExpira: { type: Date, default: null },

  // Estadísticas
  guerrasGanadas: { type: Number, default: 0 },
  guerrasPerdidas: { type: Number, default: 0 },
  totalKills: { type: Number, default: 0 },
  totalMuertes: { type: Number, default: 0 },

  invitaciones: [String],  // discordIds invitados pendientes
  creadoEn: { type: Date, default: Date.now },
}, { strict: false });

// Auto-generar tag si falta (bandas legacy de la web sin tag)
gangSchema.pre('validate', function(next) {
  if (!this.tag) {
    const base = String(this.nombre || 'TAG').replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase() || 'TAG';
    this.tag = base;
  } else {
    this.tag = String(this.tag).toUpperCase().substring(0, 5);
  }
  next();
});

gangSchema.methods.getMiembro = function(discordId) {
  return this.miembros.find(m => m.discordId === discordId) || null;
};

gangSchema.methods.isMiembro = function(discordId) {
  return this.miembros.some(m => m.discordId === discordId);
};

gangSchema.methods.isLider = function(discordId) {
  return this.lider === discordId;
};

gangSchema.methods.getRango = function(discordId) {
  if (this.lider === discordId) return 'Líder';
  const m = this.getMiembro(discordId);
  return m ? m.rango : null;
};

module.exports = mongoose.model('Gang', gangSchema);
