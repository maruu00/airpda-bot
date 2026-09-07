const mongoose = require('mongoose');

const facturaSchema = new mongoose.Schema({
  facturaId: { type: String, unique: true }, // FAC-0001, FAC-REP-0001
  clienteId: { type: String, required: true }, // Discord ID
  clienteNombre: { type: String },
  emisorId: { type: String, required: true }, // quien crea factura
  emisorNombre: { type: String },
  negocio: { type: String, default: null },
  concepto: { type: String, required: true },
  importe: { type: Number, required: true, min: 1 },
  tipo: { type: String, enum: ['reparacion', 'factura', 'taxi', 'otro'], default: 'factura' },
  pagada: { type: Boolean, default: false },
  pagadaEn: { type: Date, default: null },
  creadoEn: { type: Date, default: Date.now },
  guildId: { type: String },
});

// Contador auto-increment para facturaId legible
let _counterLoaded = false;
let _counter = 1;
facturaSchema.pre('save', async function(next) {
  if (!this.facturaId) {
    if (!_counterLoaded) {
      const last = await mongoose.model('Factura').findOne({}).sort({ creadoEn: -1 }).lean();
      if (last && last.facturaId) {
        const num = parseInt(last.facturaId.replace(/\D/g, ''), 10);
        if (!isNaN(num)) _counter = num + 1;
      }
      _counterLoaded = true;
    }
    const prefix = this.tipo === 'reparacion' ? 'FAC-REP' : 'FAC';
    this.facturaId = `${prefix}-${String(_counter++).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Factura', facturaSchema);
