const mongoose = require('mongoose');

const bancoEstadoSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  saldo: { type: Number, default: 0 },
  totalRecaudado: { type: Number, default: 0 },
  ultimaRecaudacion: { type: Date, default: null },
  historial: [{
    fecha: { type: Date, default: Date.now },
    recaudado: Number,
    afectados: Number,
    exentos: Number,
  }],
}, { timestamps: true });

module.exports = mongoose.model('BancoEstado', bancoEstadoSchema);