require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const commands = [];
const cmdsPath = path.join(__dirname, 'commands');
const files = fs.readdirSync(cmdsPath).filter(f => f.endsWith('.js'));

for (const file of files) {
  try {
    const mod = require(path.join(cmdsPath, file));
    if (mod.data) {
      const dataArr = Array.isArray(mod.data) ? mod.data : [mod.data];
      for (const d of dataArr) {
        commands.push(d.toJSON());
        console.log(`  + ${d.name}`);
      }
    }
  } catch (err) {
    console.error(`Error en ${file}:`, err.message);
  }
}

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    if (commands.length > 100) {
      console.warn(`⚠️ Hay ${commands.length} comandos, Discord solo permite 100. Se registrarán los primeros 100.`);
      commands.splice(100);
    }
    console.log(`\n🔄 Registrando ${commands.length} slash commands...`);

    // Guild commands (instantáneo, solo en tu servidor)
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );

    console.log(`✅ ${commands.length} slash commands registrados en el servidor ${config.guildId}`);
  } catch (err) {
    console.error('❌ Error al registrar comandos:', err);
  }
})();
