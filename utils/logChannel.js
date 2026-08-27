'use strict';

const ALERT_CHANNEL_ID = '1480878156213780591';

async function sendToLogChannel(client, embedOrContent) {
  try {
    const ch = await client.channels.fetch(ALERT_CHANNEL_ID).catch(() => null);
    if (!ch) return;
    if (typeof embedOrContent === 'string') {
      await ch.send({ content: embedOrContent }).catch(() => {});
    } else if (embedOrContent?.embeds) {
      await ch.send(embedOrContent).catch(() => {});
    } else {
      await ch.send({ embeds: [embedOrContent] }).catch(() => {});
    }
  } catch {}
}

module.exports = { ALERT_CHANNEL_ID, sendToLogChannel };