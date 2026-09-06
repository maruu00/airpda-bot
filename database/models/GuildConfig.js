const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
  guildId: { type: String, unique: true, required: true },
  prefix: { type: String, default: '!' },

  canales: {
    logs:          { type: String, default: null },
    modLogs:       { type: String, default: null },
    bienvenida:    { type: String, default: null },
    despedida:     { type: String, default: null },
    tickets:       { type: String, default: null },
    anuncios:      { type: String, default: null },
    rp:            { type: String, default: null },
    economia:      { type: String, default: null },
    drogas:        { type: String, default: null },
    bandas:        { type: String, default: null },
    emergencias:   { type: String, default: null },
    policia:       { type: String, default: null },
    mecanicos:     { type: String, default: null },
    robos:         { type: String, default: null },
    twitter:       { type: String, default: null },
  },

  roles: {
    admin:      { type: String, default: null },
    moderador:  { type: String, default: null },
    staff:      { type: String, default: null },
    miembro:    { type: String, default: null },
    muted:      { type: String, default: null },
    bienvenida: { type: String, default: null },
    policia:    { type: String, default: null },
    sheriff:    { type: String, default: null },
    medico:     { type: String, default: null },
    mecanico:   { type: String, default: null },
    banda:      { type: String, default: null },
  },

  bienvenida: {
    activo: { type: Boolean, default: false },
    mensaje: { type: String, default: '¡Bienvenido/a {user} al servidor {server}! 🎉' },
    imagen: { type: String, default: null },
  },

  despedida: {
    activo: { type: Boolean, default: false },
    mensaje: { type: String, default: '{user} ha abandonado el servidor.' },
  },

  security: {
    activo:           { type: Boolean, default: true },
    antiSpam:         { type: Boolean, default: true },
    antiLinks:        { type: Boolean, default: true },
    antiInvites:      { type: Boolean, default: true },
    antiMentions:     { type: Boolean, default: true },
    antiRaid:         { type: Boolean, default: true },
    antiBots:         { type: Boolean, default: true },
    raidMode:         { type: Boolean, default: false },
    raidModeSince:    { type: Date, default: null },
    raidCooldownMinutes: { type: Number, default: 15 },
    minAccountAgeDays:   { type: Number, default: 3 },
    autoActionNewAccounts: { type: String, enum: ['none', 'kick', 'timeout'], default: 'none' },
    verificationLockdown: { type: Boolean, default: true },
    linkWhitelist:    [String],
    whitelistRoles:   [String],
    canalesExentos:   [String],
    logChannelId:     { type: String, default: null },
    antiExternalApps: { type: Boolean, default: true },
    externalAppAction: { type: String, enum: ['ban', 'kick', 'timeout', 'none'], default: 'ban' },
  },

  tickets: {
    categoriaId:     { type: String, default: null },
    staffRoleId:     { type: String, default: null },
    staffRoles:      [String],
    contador:        { type: Number, default: 0 },
    mensajePanelId:  { type: String, default: null },
    transcripciones: { type: Boolean, default: true },
    transcriptChannelId: { type: String, default: null },
    panelChannelId:  { type: String, default: null },
  },

  economia: {
    activa:        { type: Boolean, default: true },
    salarioBase:   { type: Number, default: 500 },
    monedaNombre:  { type: String, default: 'Dólares' },
    monedaSimb:    { type: String, default: '$' },
  },

  rp: {
    activo:        { type: Boolean, default: true },
    sistemaDP:     { type: Boolean, default: true },   // drogas & criminal
    sistemaGangs:  { type: Boolean, default: true },
  },

  logs: {
    bans:       { type: Boolean, default: true },
    kicks:      { type: Boolean, default: true },
    mutes:      { type: Boolean, default: true },
    warns:      { type: Boolean, default: true },
    mensajes:   { type: Boolean, default: false },
    entradas:   { type: Boolean, default: true },
    salidas:    { type: Boolean, default: true },
  },

  autoroles: {
    users: { type: [String], default: [] },
    bots:  { type: [String], default: [] },
  },
});

module.exports = mongoose.model('GuildConfig', guildConfigSchema);
