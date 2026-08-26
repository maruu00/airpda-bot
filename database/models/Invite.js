const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  invited: { type: [String], default: [] },
  left: { type: [String], default: [] },
  invitedCount: { type: Number, default: 0 },
}, { timestamps: true });

inviteSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Invite', inviteSchema);