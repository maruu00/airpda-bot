const Invite = require('../database/models/Invite');

module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    try {
      // Buscar quién lo había invitado y moverlo a "left"
      const doc = await Invite.findOne({ guildId: member.guild.id, invited: member.id });
      if (doc) {
        await Invite.updateOne(
          { guildId: member.guild.id, userId: doc.userId },
          { $pull: { invited: member.id }, $push: { left: member.id } }
        );
      }
    } catch {}
  },
};