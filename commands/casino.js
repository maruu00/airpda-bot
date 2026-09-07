const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getPlayer, formatMoney, rand } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const Player = require('../database/models/Player');

const MAX_BET = 100000;
const FICHA_VALOR = 1; // 1 ficha = $1

const data = new SlashCommandBuilder()
  .setName('casino')
  .setDescription('🎰 Casino AmericanRP')
  .addSubcommand(s => s.setName('daily').setDescription('Reclama tu bono diario'))
  .addSubcommand(s => s.setName('top').setDescription('Ranking de ganadores'))
  .addSubcommand(s => s.setName('blackjack').setDescription('🃏 Blackjack contra la casa')
    .addIntegerOption(o => o.setName('apuesta').setDescription('Fichas a apostar').setRequired(true).setMinValue(10).setMaxValue(MAX_BET)))
  .addSubcommand(s => s.setName('slots').setDescription('🎰 Máquina tragaperras')
    .addIntegerOption(o => o.setName('apuesta').setDescription('Fichas').setRequired(true).setMinValue(10).setMaxValue(MAX_BET)))
  .addSubcommand(s => s.setName('ruleta').setDescription('🎡 Apuesta en la ruleta')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de apuesta').setRequired(true)
      .addChoices(
        { name: '🔴 Rojo (x2)', value: 'rojo' }, { name: '⚫ Negro (x2)', value: 'negro' },
        { name: '🟢 Par (x2)', value: 'par' }, { name: '🟢 Impar (x2)', value: 'impar' },
        { name: '🔢 Número exacto (x35)', value: 'numero' },
      ))
    .addIntegerOption(o => o.setName('apuesta').setDescription('Fichas').setRequired(true).setMinValue(10).setMaxValue(MAX_BET))
    .addIntegerOption(o => o.setName('numero').setDescription('Número (0-36, solo para apuesta exacta)').setRequired(false).setMinValue(0).setMaxValue(36)))
  .addSubcommand(s => s.setName('dados').setDescription('🎲 Apuesta a los dados')
    .addIntegerOption(o => o.setName('apuesta').setDescription('Fichas').setRequired(true).setMinValue(10).setMaxValue(MAX_BET))
    .addIntegerOption(o => o.setName('numero').setDescription('Número (1-6)').setRequired(true).setMinValue(1).setMaxValue(6)))
  .addSubcommand(s => s.setName('moneda').setDescription('🪙 Cara o cruz')
    .addStringOption(o => o.setName('lado').setDescription('Elige').setRequired(true).addChoices({ name: 'Cara', value: 'cara' }, { name: 'Cruz', value: 'cruz' }))
    .addIntegerOption(o => o.setName('apuesta').setDescription('Fichas').setRequired(true).setMinValue(10).setMaxValue(MAX_BET)))
  .addSubcommand(s => s.setName('comprar').setDescription('💰 Compra fichas de casino')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad en efectivo a convertir').setRequired(true).setMinValue(100).setMaxValue(1000000)))
  .addSubcommand(s => s.setName('retirar').setDescription('🏧 Retira tus fichas a efectivo')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Fichas a retirar').setRequired(true).setMinValue(100).setMaxValue(1000000)));

async function execute(interaction, client) {
  const player = await getPlayer(interaction.user.id, interaction.user.username);
  if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea un personaje primero.')], flags: 64 });

  const sub = interaction.options.getSubcommand();

  // ─── COMPRAR FICHAS ─────────────────────────────────────────────────────
  if (sub === 'comprar') {
    const cantidad = interaction.options.getInteger('cantidad');
    if (player.cash < cantidad) return interaction.reply({ embeds: [E.err('Fondos insuficientes', `Necesitas **${formatMoney(cantidad)}** en efectivo. Tienes: ${formatMoney(player.cash)}`)], flags: 64 });
    player.cash -= cantidad;
    player.fichas = (player.fichas || 0) + cantidad;
    await player.save();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('💰 Fichas compradas').setDescription(`Convertiste **${formatMoney(cantidad)}** en **${cantidad.toLocaleString()}** fichas.\n💰 Efectivo: ${formatMoney(player.cash)}\n🎰 Fichas: **${(player.fichas || 0).toLocaleString()}**`).setTimestamp()] });
  }

  // ─── RETIRAR FICHAS ─────────────────────────────────────────────────────
  if (sub === 'retirar') {
    const cantidad = interaction.options.getInteger('cantidad');
    const fichas = player.fichas || 0;
    if (fichas < cantidad) return interaction.reply({ embeds: [E.err('Fichas insuficientes', `Tienes **${fichas.toLocaleString()}** fichas.`)], flags: 64 });
    player.fichas = fichas - cantidad;
    player.cash += cantidad;
    await player.save();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('🏧 Fichas retiradas').setDescription(`Retiraste **${cantidad.toLocaleString()}** fichas → **${formatMoney(cantidad)}**\n💰 Efectivo: ${formatMoney(player.cash)}\n🎰 Fichas: **${(player.fichas || 0).toLocaleString()}**`).setTimestamp()] });
  }

  // ─── DAILY ──────────────────────────────────────────────────────────────
  if (sub === 'daily') {
    const last = player.getCooldown('casino_daily');
    if (last && Date.now() - last.getTime() < 86400000) {
      const r = 86400000 - (Date.now() - last.getTime());
      return interaction.reply({ embeds: [E.warn('Ya reclamaste', `Vuelve en **${Math.floor(r/3600000)}h ${Math.floor((r%3600000)/60000)}m**.`)], flags: 64 });
    }

    // Racha de días
    const lastDailyDate = player.getCooldown('casino_daily_date');
    let racha = player.rachaCasino || 0;
    if (lastDailyDate) {
      const diffDays = Math.floor((Date.now() - lastDailyDate.getTime()) / 86400000);
      if (diffDays === 1) racha++;
      else if (diffDays > 1) racha = 0;
    } else racha = 0;
    racha++;
    player.rachaCasino = racha;
    player.setCooldown('casino_daily', new Date());
    player.setCooldown('casino_daily_date', new Date());

    const bonusBase = 500;
    const bonusRacha = Math.min(racha * 100, 2000);
    const total = bonusBase + bonusRacha;
    player.cash += total;
    player.totalGanado = (player.totalGanado || 0) + total;
    await player.save();

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('🎁 Bono Diario')
        .setDescription(
          `**Día ${racha}** ${racha > 1 ? '🔥' : ''}\n\n` +
          `💰 Base: **$${bonusBase.toLocaleString()}**\n` +
          `${racha > 1 ? `🔥 Racha: **+$${bonusRacha.toLocaleString()}** (${racha} días)` : ''}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `**Total: +$${total.toLocaleString()}**\n\n` +
          `🏆 **Saldo:** ${formatMoney(player.cash)}\n` +
          `🎰 **Fichas:** ${(player.fichas || 0).toLocaleString()}`
        ).setTimestamp()],
    });
  }

  // ─── TOP ────────────────────────────────────────────────────────────────
  if (sub === 'top') {
    const top = await Player.find({ personajeCreado: true }).sort({ totalGanado: -1 }).limit(10).lean();
    const list = top.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';
      const name = p.nombre && p.apellido ? `${p.nombre} ${p.apellido}` : p.discordUsername || p.discordId;
      return `${medal} **${name}** — $${(p.totalGanado || 0).toLocaleString()} 🎰${(p.fichas || 0).toLocaleString()}`;
    }).join('\n');
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle('🏆 Ranking del Casino')
        .setDescription(list || '*Aún no hay jugadores*')
        .setFooter({ text: 'Basado en ganancias totales + fichas' }).setTimestamp()],
    });
  }

  // ─── VERIFICAR FICHAS ───────────────────────────────────────────────────
  const fichas = player.fichas || 0;
  const apuesta = interaction.options.getInteger('apuesta');
  if (fichas < apuesta) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ Fichas insuficientes')
        .setDescription(
          `Necesitas **${apuesta.toLocaleString()}** fichas.\nTienes: **${fichas.toLocaleString()}** fichas.\n\n` +
          `💰 Compra fichas con \`/casino comprar [cantidad]\`\n` +
          `💵 Efectivo disponible: ${formatMoney(player.cash)}`
        ).setTimestamp()],
      flags: 64,
    });
  }

  const cooldownKey = 'casino_global';
  const lastGame = player.getCooldown(cooldownKey);
  if (lastGame && Date.now() - lastGame.getTime() < 5000) {
    return interaction.reply({ embeds: [E.warn('Cooldown', 'Espera **5 segundos** entre juegos.')], flags: 64 });
  }
  player.setCooldown(cooldownKey, new Date());

  let embed, ganancias = 0;

  // ─── BLACKJACK ──────────────────────────────────────────────────────────
  if (sub === 'blackjack') {
    await interaction.deferReply();
    const p = ['♠','♥','♦','♣']; const v = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const pts = (m) => { let t=0,a=0; for(const c of m){if(c==='A'){a++;t+=11;}else if(['J','Q','K'].includes(c))t+=10;else t+=parseInt(c);} while(t>21&&a>0){t-=10;a--;} return t; };
    const c = () => `${v[Math.floor(Math.random()*v.length)]}${p[Math.floor(Math.random()*p.length)]}`;
    const mostrar = (m) => m.map(x => `\`${x}\``).join(' ');
    let jug = [c(),c()], deal = [c(),c()];

    const render = (oc=true) => new EmbedBuilder()
      .setColor(0x1a1a2e).setTitle('🃏 Blackjack')
      .addFields(
        { name: `🧑 Tu (${pts(jug)})`, value: mostrar(jug), inline: false },
        { name: `🏠 Dealer (${oc?'?':pts(deal)})`, value: oc?`\`${deal[0]}\` \`?\``:mostrar(deal), inline: false },
      ).setFooter({ text: `Apuesta: ${apuesta.toLocaleString()} fichas` }).setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bj_pedir').setLabel('📥 Pedir').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_plantar').setLabel('✋ Plantarse').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('bj_doblar').setLabel('🔁 Doblar').setStyle(ButtonStyle.Secondary),
    );

    let msg = await interaction.editReply({ embeds: [render()], components: [row] });
    let doblo = false;

    while (true) {
      try {
        const click = await msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30000 });
        await click.deferUpdate();
        if (click.customId === 'bj_pedir' && !dobló) { jug.push(c()); if (pts(jug) > 21) break; await msg.edit({ embeds: [render()], components: [row] }); }
        else if (click.customId === 'bj_doblar' && !dobló && fichas >= apuesta*2) { dobló = true; apuesta *= 2; jug.push(c()); if (pts(jug) <= 21) { while (pts(deal) < 17) deal.push(c()); } break; }
        else break;
      } catch { break; }
    }

    while (pts(deal) < 17 && pts(jug) <= 21) deal.push(c());
    const jv = pts(jug), dv = pts(deal);
    if (jv > 21 || (dv <= 21 && dv > jv)) ganancias = -apuesta;
    else if (jv === dv) ganancias = 0;
    else ganancias = apuesta;
    player.fichas = (player.fichas || 0) + ganancias;
    if (ganancias > 0) player.totalGanado = (player.totalGanado || 0) + ganancias;
    await player.save();
    const res = ganancias > 0 ? `✅ +${ganancias.toLocaleString()}` : ganancias === 0 ? '🔄 Empate' : `❌ ${ganancias.toLocaleString()}`;
    await msg.edit({ embeds: [new EmbedBuilder().setColor(ganancias>0?0x22c55e:ganancias===0?0x64748b:0xef4444)
      .setTitle(`🃏 Blackjack — ${res}`)
      .addFields(
        { name: `🧑 Tu (${jv})`, value: mostrar(jug), inline: false },
        { name: `🏠 Dealer (${dv})`, value: mostrar(deal), inline: false },
      ).setFooter({ text: `Fichas: ${(player.fichas||0).toLocaleString()}` }).setTimestamp()], components: [] });
    return;
  }

  // ─── SLOTS ──────────────────────────────────────────────────────────────
  if (sub === 'slots') {
    const s = ['🍒','🍋','🍊','🍇','🔔','💎','⭐','7️⃣','👑','💀'];
    const pesos = [20,18,15,12,10,7,5,3,2,1]; const tp = pesos.reduce((a,b)=>a+b,0);
    const r = () => { const r = Math.random()*tp; let a=0; for(let i=0;i<s.length;i++){a+=pesos[i];if(r<=a)return s[i];} return s[0]; };
    const r1=r(),r2=r(),r3=r();
    const eq = r1===r2&&r2===r3; const par = !eq&&(r1===r2||r2===r3||r1===r3);
    const mult = eq ? { '👑':100,'💀':75,'7️⃣':25,'💎':50,'⭐':15,'🔔':8 }[r1]||10 : par ? 2 : 0;
    ganancias = mult > 0 ? apuesta*mult : -apuesta;
    player.fichas = (player.fichas||0) + ganancias;
    if(ganancias>0) player.totalGanado = (player.totalGanado||0)+ganancias;
    await player.save();
    const jack = eq && r1 === '👑';
    embed = new EmbedBuilder()
      .setColor(mult>0?0x22c55e:0xef4444)
      .setTitle(jack?'👑💰💰 ¡JACKPOT REAL! 💰💰👑':mult>1?'🎰 ¡Ganaste!':'🎰 Tragaperras')
      .setDescription(`\`\`\`diff\n${r1}  ${r2}  ${r3}\n\`\`\``+`${eq?`✅ **${r1}** x${mult} = +${(apuesta*mult).toLocaleString()}`:par?`⚠️ Par x2 = +${(apuesta*2).toLocaleString()}`:`❌ -${apuesta.toLocaleString()}`}\n🎰 Fichas: ${(player.fichas||0).toLocaleString()}`)
      .setTimestamp();
  }

  // ─── RULETA ─────────────────────────────────────────────────────────────
  if (sub === 'ruleta') {
    const tipo = interaction.options.getString('tipo');
    const numEspecifico = tipo === 'numero' ? interaction.options.getInteger('numero') : null;
    const num = Math.floor(Math.random()*37);
    const color = num===0?'verde':num%2===0?'negro':'rojo';
    let ganaste = (tipo==='rojo'&&color==='rojo')||(tipo==='negro'&&color==='negro')||(tipo==='par'&&num>0&&num%2===0)||(tipo==='impar'&&num%2!==0)||(tipo==='numero'&&num===numEspecifico);
    const mult = tipo==='numero'?35:2;
    ganancias = ganaste ? apuesta*mult : -apuesta;
    player.fichas = (player.fichas||0)+ganancias;
    if(ganancias>0) player.totalGanado = (player.totalGanado||0)+ganancias;
    await player.save();
    const em = num===0?'🟢':color==='rojo'?'🔴':'⚫';
    embed = new EmbedBuilder().setColor(ganaste?0x22c55e:0xef4444)
      .setTitle('🎡 Ruleta')
      .setDescription(`${em} **${num}** ${color.toUpperCase()}\n\n${ganaste?`✅ **+${(apuesta*mult).toLocaleString()}** fichas (x${mult})`:`❌ **-${apuesta.toLocaleString()}** fichas`}\n🎰 Fichas: ${(player.fichas||0).toLocaleString()}`)
      .setTimestamp();
  }

  // ─── DADOS ──────────────────────────────────────────────────────────────
  if (sub === 'dados') {
    const numero = interaction.options.getInteger('numero');
    const d1 = Math.floor(Math.random()*6)+1, d2 = Math.floor(Math.random()*6)+1;
    const ganaste = d1===numero||d2===numero;
    ganancias = ganaste ? apuesta*5 : -apuesta;
    player.fichas = (player.fichas||0)+ganancias;
    if(ganancias>0) player.totalGanado = (player.totalGanado||0)+ganancias;
    await player.save();
    embed = new EmbedBuilder().setColor(ganaste?0x22c55e:0xef4444)
      .setTitle('🎲 Dados').setDescription(`🎲 ${d1} ${d2}\n🎯 Número: ${numero}\n${ganaste?`✅ x5 = +${(apuesta*5).toLocaleString()}`:`❌ -${apuesta.toLocaleString()}`}\n🎰 Fichas: ${(player.fichas||0).toLocaleString()}`)
      .setTimestamp();
  }

  // ─── MONEDA ─────────────────────────────────────────────────────────────
  if (sub === 'moneda') {
    const lado = interaction.options.getString('lado');
    const cara = Math.random()<0.5;
    const ganaste = (lado==='cara'&&cara)||(lado==='cruz'&&!cara);
    ganancias = ganaste ? apuesta : -apuesta;
    player.fichas = (player.fichas||0)+ganancias;
    if(ganancias>0) player.totalGanado = (player.totalGanado||0)+ganancias;
    await player.save();
    embed = new EmbedBuilder().setColor(ganaste?0x22c55e:0xef4444)
      .setTitle('🪙 '+(cara?'CARA':'CRUZ'))
      .setDescription(`${ganaste?`✅ +${apuesta.toLocaleString()}`:`❌ -${apuesta.toLocaleString()}`}\n🎰 Fichas: ${(player.fichas||0).toLocaleString()}`)
      .setTimestamp();
  }

  if (embed) return interaction.reply({ embeds: [embed] });
}

// ─── PREFIX COMMANDS ─────────────────────────────────────────────────────────
const prefixCommands = [
  { name: 'blackjack', aliases: ['bj'], description: '!blackjack [apuesta] — Jugar blackjack',
    async run(message, args) {
      const a = parseInt(args[0]); if(!a||a<10) return message.reply('Apuesta mínima 10 fichas.');
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      if((p.fichas||0)<a) return message.reply('❌ Fichas insuficientes. Usa `/casino comprar`.');
      const palos = ['♠','♥','♦','♣']; const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
      const pts = (m)=> {let t=0,ac=0; for(const c of m){if(c==='A'){ac++;t+=11;}else if(['J','Q','K'].includes(c))t+=10;else t+=parseInt(c);} while(t>21&&ac>0){t-=10;ac--;} return t;};
      const ca = ()=>`${vals[Math.floor(Math.random()*vals.length)]}${palos[Math.floor(Math.random()*palos.length)]}`;
      let j=[ca(),ca()], d=[ca(),ca()];
      while(pts(d)<17) d.push(ca());
      const jv=pts(j), dv=pts(d);
      let g = dv>21||jv>dv ? a : jv===dv ? 0 : -a;
      p.fichas = (p.fichas||0)+g; if(g>0) p.totalGanado=(p.totalGanado||0)+g; await p.save();
      message.reply(`🃏 **Blackjack** — ${g>0?'✅ Ganaste':g===0?'🔄 Empate':'❌ Perdiste'}\n🧑 ${j.join(' ')} (${jv})\n🏠 ${d.join(' ')} (${dv})\n${g>0?`+${g.toLocaleString()}`:g===0?'$0':`${g.toLocaleString()}`} fichas`);
    }
  },
  { name: 'slots', aliases: ['slot'], description: '!slots [apuesta] — Tragaperras',
    async run(message, args) {
      const a = parseInt(args[0]); if(!a||a<10) return message.reply('Apuesta mínima 10.');
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      if((p.fichas||0)<a) return message.reply('❌ Fichas insuficientes.');
      const s=['🍒','🍋','🍊','🍇','🔔','💎','⭐','7️⃣','👑','💀']; const ps=[20,18,15,12,10,7,5,3,2,1]; const tp=ps.reduce((a,b)=>a+b,0);
      const r=()=>{const r=Math.random()*tp;let a=0;for(let i=0;i<s.length;i++){a+=ps[i];if(r<=a)return s[i];}return s[0];};
      const r1=r(),r2=r(),r3=r(); const eq=r1===r2&&r2===r3; const par=!eq&&(r1===r2||r2===r3||r1===r3);
      const mult = eq?{'👑':100,'💀':75,'7️⃣':25,'💎':50,'⭐':15,'🔔':8}[r1]||10:par?2:0;
      const g = mult>0?a*mult:-a;
      p.fichas=(p.fichas||0)+g; if(g>0) p.totalGanado=(p.totalGanado||0)+g; await p.save();
      message.reply(`🎰 ${r1} ${r2} ${r3}\n${eq?`✅ ${mult}x = +${(a*mult).toLocaleString()}`:par?`⚠️ Par x2 = +${(a*2).toLocaleString()}`:`❌ -${a.toLocaleString()}`} fichas`);
    }
  },
  { name: 'dados', aliases: ['dice'], description: '!dados [apuesta] [num 1-6] — Dados',
    async run(message, args) {
      const a=parseInt(args[0]),n=parseInt(args[1]); if(!a||!n||n<1||n>6) return message.reply('!dados [apuesta] [1-6]');
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      if((p.fichas||0)<a) return message.reply('❌ Fichas insuficientes.');
      const d1=Math.floor(Math.random()*6)+1,d2=Math.floor(Math.random()*6)+1;
      const g=d1===n||d2===n?a*5:-a;
      p.fichas=(p.fichas||0)+g; if(g>0) p.totalGanado=(p.totalGanado||0)+g; await p.save();
      message.reply(`🎲 ${d1} ${d2}\n🎯 ${n}\n${g>0?`✅ x5 = +${(a*5).toLocaleString()}`:`❌ -${a.toLocaleString()}`} fichas`);
    }
  },
  { name: 'ruleta', aliases: ['roulette'], description: '!ruleta [rojo/negro/par/impar] [apuesta]',
    async run(message, args) {
      if(!args[0]||!args[1]) return message.reply('Uso: !ruleta [rojo/negro/par/impar] [apuesta]');
      const a=parseInt(args[1]); const t=args[0].toLowerCase();
      if(!a||a<10) return message.reply('Apuesta mínima 10.');
      if(!['rojo','negro','par','impar'].includes(t)) return message.reply('rojo/negro/par/impar');
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      if((p.fichas||0)<a) return message.reply('❌ Fichas insuficientes.');
      const num=Math.floor(Math.random()*37); const color=num===0?'verde':num%2===0?'negro':'rojo';
      const gana=(t==='rojo'&&color==='rojo')||(t==='negro'&&color==='negro')||(t==='par'&&num>0&&num%2===0)||(t==='impar'&&num%2!==0);
      const g=gana?a:-a; p.fichas=(p.fichas||0)+g; if(g>0) p.totalGanado=(p.totalGanado||0)+g; await p.save();
      message.reply(`🎡 ${num} ${color.toUpperCase()}\n${gana?`✅ +${a.toLocaleString()}`:`❌ -${a.toLocaleString()}`} fichas`);
    }
  },
  { name: 'moneda', aliases: ['coinflip','cf'], description: '!moneda [cara/cruz] [apuesta]',
    async run(message, args) {
      if(!args[0]||!args[1]) return message.reply('Uso: !moneda [cara/cruz] [apuesta]');
      const a=parseInt(args[1]); const l=args[0].toLowerCase();
      if(!a||a<10) return message.reply('Apuesta mínima 10.');
      if(!['cara','cruz'].includes(l)) return message.reply('cara o cruz');
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      if((p.fichas||0)<a) return message.reply('❌ Fichas insuficientes.');
      const cara=Math.random()<0.5; const g=(l==='cara'&&cara)||(l==='cruz'&&!cara)?a:-a;
      p.fichas=(p.fichas||0)+g; if(g>0) p.totalGanado=(p.totalGanado||0)+g; await p.save();
      message.reply(`🪙 ${cara?'CARA':'CRUZ'}\n${g>0?`✅ +${a.toLocaleString()}`:`❌ -${a.toLocaleString()}`} fichas`);
    }
  },
  { name: 'fichas', aliases: ['chips','casino'], description: '!fichas — Ver tus fichas de casino',
    async run(message) {
      const p = await getPlayer(message.author.id);
      if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      message.reply(`🎰 **${(p.fichas||0).toLocaleString()}** fichas\n💰 Efectivo: ${(p.cash||0).toLocaleString()}\n🏆 Total ganado: $${(p.totalGanado||0).toLocaleString()}\n📈 Racha daily: ${p.rachaCasino||0} días`);
    }
  },
  { name: 'dailymoney', aliases: ['daily'], description: '!dailymoney — Bono diario',
    async run(message) {
      const p = await getPlayer(message.author.id); if(!p?.personajeCreado) return message.reply('❌ Sin personaje.');
      const last = p.getCooldown('casino_daily');
      if (last && Date.now()-last.getTime()<86400000) { const r=86400000-(Date.now()-last.getTime()); return message.reply(`⏳ ${Math.floor(r/3600000)}h ${Math.floor((r%3600000)/60000)}m`); }
      let racha = p.rachaCasino||0; const ld = p.getCooldown('casino_daily_date');
      if(ld){const df=Math.floor((Date.now()-ld.getTime())/86400000); if(df===1)racha++;else if(df>1)racha=0;}else racha=0;
      racha++; p.rachaCasino=racha; p.setCooldown('casino_daily',new Date()); p.setCooldown('casino_daily_date',new Date());
      const total=500+Math.min(racha*100,2000); p.cash+=total; p.totalGanado=(p.totalGanado||0)+total; await p.save();
      message.reply(`🎁 Día ${racha}🔥: +$${total.toLocaleString()}`);
    }
  },
];

module.exports = { data, execute, prefixCommands };