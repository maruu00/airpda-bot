/**
 * ECONOMÍA — Billetera, banco con PIN, transferencias, cobrar salario
 * Slash: /billetera /banco /depositar /retirar /transferir /cobrar /pagar /blanquear /top
 */
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { getPlayer, formatCooldown, formatMoney, rand } = require('../utils/helpers');
const { hashPin, verifyPin } = require('../utils/pin');
const E = require('../utils/embeds');
const config = require('../config');
const TRABAJOS = require('../data/trabajos');
const { ICONS, BANNERS, addImage } = require('../utils/images');

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function requirePersonaje(interaction) {
  const player = await getPlayer(interaction.user.id, interaction.user.username);
  if (!player.personajeCreado) {
    await interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje con `/personaje crear`.')], flags: 64 });
    return null;
  }
  return player;
}



// ─── Slash commands ───────────────────────────────────────────────────────────
const data = [

  // /billetera
  new SlashCommandBuilder()
    .setName('billetera')
    .setDescription('Ver tu dinero (cash, banco, sucio)'),

  // // /banco — Gestión de cuenta bancaria
  // new SlashCommandBuilder()
  //   .setName('banco')
  //   .setDescription('Gestión de tu cuenta bancaria')
  //   .addSubcommand(s => s.setName('crear').setDescription('Crear cuenta corriente con PIN de seguridad'))
  //   .addSubcommand(s => s.setName('estado').setDescription('Ver el estado de tus cuentas bancarias'))
  //   .addSubcommand(s => s.setName('cambiar-pin').setDescription('Cambiar el PIN de tu cuenta'))
  //   .addSubcommand(s => s.setName('ahorros-crear').setDescription('Abrir una segunda cuenta de ahorros'))
  //   .addSubcommand(s => s
  //     .setName('ahorros-depositar')
  //     .setDescription('Mover dinero del banco a tu cuenta de ahorros')
  //     .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
  //     .addStringOption(o => o.setName('pin').setDescription('PIN de cuenta corriente').setRequired(true).setMinLength(4).setMaxLength(4)))
  //   .addSubcommand(s => s
  //     .setName('ahorros-retirar')
  //     .setDescription('Mover dinero de ahorros a tu cuenta corriente')
  //     .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
  //     .addStringOption(o => o.setName('pin').setDescription('PIN de cuenta de ahorros').setRequired(true).setMinLength(4).setMaxLength(4))),
  // ),

  // /depositar
  new SlashCommandBuilder()
    .setName('depositar')
    .setDescription('Depositar cash en el banco')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a depositar').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('pin').setDescription('PIN de tu cuenta').setRequired(false).setMinLength(4).setMaxLength(4)),

  // /retirar
  new SlashCommandBuilder()
    .setName('retirar')
    .setDescription('Retirar dinero del banco')
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a retirar').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('pin').setDescription('PIN de tu cuenta').setRequired(false).setMinLength(4).setMaxLength(4)),

  // /transferir
  new SlashCommandBuilder()
    .setName('transferir')
    .setDescription('Transferir dinero a otro jugador')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario destino').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('origen').setDescription('Desde dónde').setRequired(false)
      .addChoices({ name: 'Cash', value: 'cash' }, { name: 'Banco', value: 'banco' }))
    .addStringOption(o => o.setName('pin').setDescription('PIN de tu cuenta (requerido si usas banco)').setRequired(false).setMinLength(4).setMaxLength(4)),

  // /cobrar
  new SlashCommandBuilder()
    .setName('cobrar')
    .setDescription('Cobrar tu salario laboral (cooldown: 1h)'),

  // /pagar
  new SlashCommandBuilder()
    .setName('pagar')
    .setDescription('Pagar en efectivo a otro jugador')
    .addUserOption(o => o.setName('usuario').setDescription('A quién pagas').setRequired(true))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad').setRequired(true).setMinValue(1)),

  // /blanquear
  new SlashCommandBuilder()
    .setName('blanquear')
    .setDescription(`Blanquear dinero sucio (comisión: ${config.economia.impuestoBlanqueo * 100}%)`)
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad a blanquear').setRequired(true).setMinValue(1)),

  // /top
  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Ranking de jugadores más ricos')
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de ranking').setRequired(false)
      .addChoices(
        { name: 'Riqueza total', value: 'riqueza' },
        { name: 'Nivel', value: 'nivel' },
        { name: 'Criminal', value: 'criminal' },
      )),
];

// ─── Execute ──────────────────────────────────────────────────────────────────
async function execute(interaction, client) {
  const cmd = interaction.commandName;

  // Bloqueo por facturas pendientes — solo billetera y top permitidos
  const bloqueados = ['depositar','retirar','transferir','pagar','blanquear','cobrar'];
  if (bloqueados.includes(cmd)) {
    const { checkFacturaBlock } = require('../utils/facturaBlock');
    if (await checkFacturaBlock(interaction)) return;
  }
  // Para /banco, bloquear subcomandos que mueven dinero, pero permitir crear/estado/cambiar-pin
  if (cmd === 'banco') {
    const subBloqueados = ['ahorros-depositar','ahorros-retirar'];
    try {
      const sub = interaction.options.getSubcommand();
      if (subBloqueados.includes(sub)) {
        const { checkFacturaBlock } = require('../utils/facturaBlock');
        if (await checkFacturaBlock(interaction)) return;
      }
    } catch {}
  }

  // ── /billetera ──────────────────────────────────────────────────────────────
  if (cmd === 'billetera') {
    const player = await requirePersonaje(interaction);
    if (!player) return;
    const tieneCuenta = !!player.pinBanco;
    const em = E.billetera(player);
    if (!tieneCuenta) {
      em.addFields({ name: '🔒 Cuenta bancaria', value: '_Sin cuenta creada. Usa `/banco crear` para abrir tu cuenta con PIN._', inline: false });
    }
    return interaction.reply({ embeds: [em] });
  }

  // ── /banco ──────────────────────────────────────────────────────────────────
  if (cmd === 'banco') {
    const player = await requirePersonaje(interaction);
    if (!player) return;
    const sub = interaction.options.getSubcommand();

    // /banco crear
    if (sub === 'crear') {
      if (player.pinBanco) {
        return interaction.reply({
          embeds: [E.warn('Cuenta existente', 'Ya tienes una cuenta bancaria creada.\nUsa `/banco cambiar-pin` para cambiar el PIN.')],
          flags: 64,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('banco_crear_modal')
        .setTitle('🏦 Crear cuenta bancaria')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_nuevo')
              .setLabel('PIN de seguridad (4 dígitos numéricos)')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4)
              .setMaxLength(4)
              .setPlaceholder('Ej: 1234')
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_confirm')
              .setLabel('Confirmar PIN')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4)
              .setMaxLength(4)
              .setPlaceholder('Repite el PIN')
              .setRequired(true),
          ),
        );

      await interaction.showModal(modal);

      const modalResp = await interaction.awaitModalSubmit({ time: 60_000 }).catch(() => null);
      if (!modalResp) return;

      const pin1 = modalResp.fields.getTextInputValue('pin_nuevo');
      const pin2 = modalResp.fields.getTextInputValue('pin_confirm');

      if (!/^\d{4}$/.test(pin1)) {
        return modalResp.reply({ embeds: [E.err('PIN inválido', 'El PIN debe ser exactamente 4 dígitos numéricos.')], flags: 64 });
      }
      if (pin1 !== pin2) {
        return modalResp.reply({ embeds: [E.err('PINes no coinciden', 'Los dos PINes introducidos son diferentes.')], flags: 64 });
      }

      player.pinBanco = await hashPin(pin1);
      await player.save();

      const dni = E.getDNI(interaction.user.id);
      return modalResp.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('🏦 ¡Cuenta bancaria creada!')
          .setDescription('Tu cuenta en el **LS National Bank** ha sido creada con éxito.')
          .addFields(
            { name: '👤 Titular',       value: player.getFullName(),        inline: true },
            { name: '🪪 DNI',           value: `\`${dni}\``,                inline: true },
            { name: '🔒 PIN',           value: '✅ Configurado',             inline: true },
            { name: '💰 Saldo inicial', value: formatMoney(player.bank),    inline: true },
          )
          .setFooter({ text: '⚠️ Nunca compartas tu PIN · LS National Bank' })
          .setTimestamp()],
        flags: 64,
      });
    }

    // /banco estado
    if (sub === 'estado') {
      const tieneCuenta   = !!player.pinBanco;
      const tieneAhorros  = !!player.pinBancoAhorros;
      const dni = E.getDNI(interaction.user.id);
      const total = player.cash + player.bank + (player.bankAhorros || 0);

      const embed = new EmbedBuilder()
        .setColor(tieneCuenta ? config.colors.gold : config.colors.warning)
        .setTitle('🏦  LS National Bank — Estado de cuentas')
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Titular',            value: player.getFullName(),                     inline: true },
          { name: '🪪 DNI',                value: `\`${dni}\``,                             inline: true },
          { name: '​',                     value: '​',                                       inline: true },
          { name: '💵 Cash en mano',       value: formatMoney(player.cash),                 inline: true },
          { name: '🏦 Cuenta corriente',   value: tieneCuenta ? `${formatMoney(player.bank)} ✅` : '❌ Sin cuenta', inline: true },
          { name: '💰 Cuenta de ahorros',  value: tieneAhorros ? `${formatMoney(player.bankAhorros || 0)} ✅` : '❌ Sin cuenta', inline: true },
          { name: '💎 Patrimonio total',   value: `**${formatMoney(total)}**`,              inline: false },
        )
        .setFooter({ text: tieneCuenta ? 'LS National Bank  ·  Cuenta activa' : 'Usa /banco crear para abrir tu cuenta' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // /banco ahorros-crear
    if (sub === 'ahorros-crear') {
      if (!player.pinBanco) {
        return interaction.reply({ embeds: [E.err('Sin cuenta corriente', 'Primero crea tu cuenta corriente con `/banco crear`.')], flags: 64 });
      }
      if (player.pinBancoAhorros) {
        return interaction.reply({ embeds: [E.warn('Ya existe', `Ya tienes una cuenta de ahorros con **${formatMoney(player.bankAhorros)}**.`)], flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('banco_ahorros_modal')
        .setTitle('💰 Abrir cuenta de ahorros')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_ahorros')
              .setLabel('PIN para la cuenta de ahorros (4 dígitos)')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4).setMaxLength(4).setPlaceholder('Ej: 5678').setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_ahorros_confirm')
              .setLabel('Confirmar PIN de ahorros')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4).setMaxLength(4).setRequired(true),
          ),
        );

      await interaction.showModal(modal);
      const resp = await interaction.awaitModalSubmit({ time: 60_000 }).catch(() => null);
      if (!resp) return;

      const p1 = resp.fields.getTextInputValue('pin_ahorros');
      const p2 = resp.fields.getTextInputValue('pin_ahorros_confirm');
      if (!/^\d{4}$/.test(p1)) return resp.reply({ embeds: [E.err('PIN inválido', 'El PIN debe ser 4 dígitos numéricos.')], flags: 64 });
      if (p1 !== p2) return resp.reply({ embeds: [E.err('PINes no coinciden', 'Los PINes no coinciden.')], flags: 64 });

      player.pinBancoAhorros = await hashPin(p1);
      player.bankAhorros = player.bankAhorros || 0;
      await player.save();

      return resp.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('💰 Cuenta de ahorros creada')
          .setDescription('Tu **Cuenta de Ahorros** ha sido abierta en el LS National Bank.')
          .addFields(
            { name: '🏦 Cuenta corriente', value: formatMoney(player.bank),        inline: true },
            { name: '💰 Cuenta de ahorros', value: formatMoney(player.bankAhorros), inline: true },
            { name: '🔒 PIN ahorros',       value: '✅ Configurado',                 inline: true },
          )
          .setFooter({ text: 'Usa /banco ahorros-depositar y /banco ahorros-retirar para mover fondos' })
          .setTimestamp()],
        flags: 64,
      });
    }

    // /banco ahorros-depositar
    if (sub === 'ahorros-depositar') {
      if (!player.pinBanco) return interaction.reply({ embeds: [E.err('Sin cuenta', 'Crea primero tu cuenta corriente.')], flags: 64 });
      if (!player.pinBancoAhorros) return interaction.reply({ embeds: [E.err('Sin cuenta de ahorros', 'Crea tu cuenta de ahorros con `/banco ahorros-crear`.')], flags: 64 });

      const pin  = interaction.options.getString('pin');
      const cant = interaction.options.getInteger('cantidad');

      const { ok: pinOk } = await verifyPin(pin, player.pinBanco);
      if (!pinOk) return interaction.reply({ embeds: [E.err('PIN incorrecto', 'El PIN de tu cuenta corriente no es correcto.')], flags: 64 });
      if (cant > player.bank) return interaction.reply({ embeds: [E.err('Sin fondos', `Solo tienes ${formatMoney(player.bank)} en la cuenta corriente.`)], flags: 64 });

      player.bank -= cant;
      player.bankAhorros += cant;
      await player.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('💰 Fondos movidos a ahorros')
          .addFields(
            { name: '💸 Transferido',       value: `**${formatMoney(cant)}**`,        inline: true },
            { name: '🏦 Cuenta corriente',  value: formatMoney(player.bank),          inline: true },
            { name: '💰 Cuenta de ahorros', value: formatMoney(player.bankAhorros),   inline: true },
          ).setTimestamp()],
        flags: 64,
      });
    }

    // /banco ahorros-retirar
    if (sub === 'ahorros-retirar') {
      if (!player.pinBancoAhorros) return interaction.reply({ embeds: [E.err('Sin cuenta de ahorros', 'No tienes cuenta de ahorros.')], flags: 64 });

      const pin  = interaction.options.getString('pin');
      const cant = interaction.options.getInteger('cantidad');

      const { ok: pinOk2 } = await verifyPin(pin, player.pinBancoAhorros);
      if (!pinOk2) return interaction.reply({ embeds: [E.err('PIN incorrecto', 'El PIN de tu cuenta de ahorros no es correcto.')], flags: 64 });
      if (cant > player.bankAhorros) return interaction.reply({ embeds: [E.err('Sin fondos', `Solo tienes ${formatMoney(player.bankAhorros)} en ahorros.`)], flags: 64 });

      player.bankAhorros -= cant;
      player.bank += cant;
      await player.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('💰 Fondos movidos a cuenta corriente')
          .addFields(
            { name: '💸 Retirado de ahorros', value: `**${formatMoney(cant)}**`,       inline: true },
            { name: '🏦 Cuenta corriente',    value: formatMoney(player.bank),          inline: true },
            { name: '💰 Cuenta de ahorros',   value: formatMoney(player.bankAhorros),   inline: true },
          ).setTimestamp()],
        flags: 64,
      });
    }

    // /banco cambiar-pin
    if (sub === 'cambiar-pin') {
      if (!player.pinBanco) {
        return interaction.reply({ embeds: [E.err('Sin cuenta', 'Primero crea tu cuenta con `/banco crear`.')], flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('banco_cambiarpin_modal')
        .setTitle('🔒 Cambiar PIN bancario')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_actual')
              .setLabel('PIN actual')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4).setMaxLength(4).setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('pin_nuevo')
              .setLabel('Nuevo PIN (4 dígitos)')
              .setStyle(TextInputStyle.Short)
              .setMinLength(4).setMaxLength(4).setRequired(true),
          ),
        );

      await interaction.showModal(modal);
      const resp = await interaction.awaitModalSubmit({ time: 60_000 }).catch(() => null);
      if (!resp) return;

      const actual = resp.fields.getTextInputValue('pin_actual');
      const nuevo  = resp.fields.getTextInputValue('pin_nuevo');

      const { ok: pinOk3 } = await verifyPin(actual, player.pinBanco);
      if (!pinOk3) {
        return resp.reply({ embeds: [E.err('PIN incorrecto', 'El PIN actual introducido no es correcto.')], flags: 64 });
      }
      if (!/^\d{4}$/.test(nuevo)) {
        return resp.reply({ embeds: [E.err('PIN inválido', 'El nuevo PIN debe ser exactamente 4 dígitos numéricos.')], flags: 64 });
      }

      player.pinBanco = await hashPin(nuevo);
      await player.save();
      return resp.reply({ embeds: [E.ok('PIN actualizado', 'Tu PIN bancario ha sido cambiado con éxito.')], flags: 64 });
    }
  }

  // ── /depositar ──────────────────────────────────────────────────────────────
  if (cmd === 'depositar') {
    const player = await requirePersonaje(interaction);
    if (!player) return;

    if (player.pinBanco) {
      const pin = interaction.options.getString('pin');
      if (!pin) {
        return interaction.reply({ embeds: [E.err('PIN requerido', 'Tu cuenta tiene PIN. Pásalo con la opción `pin`.\nEj: `/depositar cantidad:500 pin:1234`')], flags: 64 });
      }
      const { ok: pinOk } = await verifyPin(pin, player.pinBanco);
      if (!pinOk) {
        return interaction.reply({ embeds: [E.err('PIN incorrecto', 'El PIN introducido no es correcto.')], flags: 64 });
      }
    }

    const cant = interaction.options.getInteger('cantidad');
    if (cant > player.cash) {
      return interaction.reply({ embeds: [E.err('Fondos insuficientes', `Solo tienes ${formatMoney(player.cash)} en efectivo.`)], flags: 64 });
    }
    player.cash -= cant;
    player.bank += cant;
    await player.save();
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🏦 Depósito realizado')
        .setThumbnail(ICONS.banco)
        .addFields(
          { name: '💳 Depositado',      value: `**${formatMoney(cant)}**`,   inline: true },
          { name: '🏦 Saldo bancario',  value: formatMoney(player.bank),     inline: true },
          { name: '💵 Cash restante',   value: formatMoney(player.cash),     inline: true },
        )
        .setFooter({ text: 'LS National Bank' })
        .setTimestamp()],
    });
  }

  // ── /retirar ────────────────────────────────────────────────────────────────
  if (cmd === 'retirar') {
    const player = await requirePersonaje(interaction);
    if (!player) return;

    if (player.pinBanco) {
      const pin = interaction.options.getString('pin');
      if (!pin) {
        return interaction.reply({ embeds: [E.err('PIN requerido', 'Tu cuenta tiene PIN. Pásalo con la opción `pin`.')], flags: 64 });
      }
      const { ok: pinOk5 } = await verifyPin(pin, player.pinBanco);
      if (!pinOk5) {
        return interaction.reply({ embeds: [E.err('PIN incorrecto', 'El PIN introducido no es correcto.')], flags: 64 });
      }
    }

    const cant = interaction.options.getInteger('cantidad');
    if (cant > player.bank) {
      return interaction.reply({ embeds: [E.err('Fondos insuficientes', `Solo tienes ${formatMoney(player.bank)} en el banco.`)], flags: 64 });
    }
    player.bank -= cant;
    player.cash += cant;
    await player.save();
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('💵 Retiro realizado')
        .setThumbnail(ICONS.dinero)
        .addFields(
          { name: '💵 Retirado',        value: `**${formatMoney(cant)}**`,   inline: true },
          { name: '💵 Cash en mano',    value: formatMoney(player.cash),     inline: true },
          { name: '🏦 Saldo bancario',  value: formatMoney(player.bank),     inline: true },
        )
        .setFooter({ text: 'LS National Bank' })
        .setTimestamp()],
    });
  }

  // ── /transferir ─────────────────────────────────────────────────────────────
  if (cmd === 'transferir') {
    const player = await requirePersonaje(interaction);
    if (!player) return;
    const target = interaction.options.getUser('usuario');
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [E.err('Error', 'No puedes transferirte dinero a ti mismo.')], flags: 64 });
    }
    const cant   = interaction.options.getInteger('cantidad');
    const origen = interaction.options.getString('origen') || 'banco';

    if (origen === 'banco' && player.pinBanco) {
      const pin = interaction.options.getString('pin');
      if (!pin) {
        return interaction.reply({ embeds: [E.err('PIN requerido', 'Para transferir desde el banco necesitas tu PIN.')], flags: 64 });
      }
      const { ok: pinOk6 } = await verifyPin(pin, player.pinBanco);
      if (!pinOk6) {
        return interaction.reply({ embeds: [E.err('PIN incorrecto', 'El PIN introducido no es correcto.')], flags: 64 });
      }
    }

    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) {
      return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese usuario no tiene personaje.')], flags: 64 });
    }

    if (origen === 'cash'  && cant > player.cash) return interaction.reply({ embeds: [E.err('Fondos insuficientes', `No tienes ${formatMoney(cant)} en cash.`)], flags: 64 });
    if (origen === 'banco' && cant > player.bank) return interaction.reply({ embeds: [E.err('Fondos insuficientes', `No tienes ${formatMoney(cant)} en el banco.`)], flags: 64 });

    if (origen === 'cash') { player.cash -= cant; targetPlayer.bank += cant; }
    else                   { player.bank -= cant; targetPlayer.bank += cant; }

    await player.save();
    await targetPlayer.save();

    try {
      const u = await client.users.fetch(target.id);
      await u.send({ embeds: [E.ok('Transferencia recibida', `**${player.getFullName()}** te ha enviado **${formatMoney(cant)}**.\nBanco: ${formatMoney(targetPlayer.bank)}`)] });
    } catch {}

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('💸 Transferencia enviada')
        .addFields(
          { name: '👤 Receptor',       value: targetPlayer.getFullName(),  inline: true },
          { name: '💸 Transferido',    value: `**${formatMoney(cant)}**`,  inline: true },
          { name: '🏦 Tu saldo',       value: formatMoney(player.bank),    inline: true },
        )
        .setTimestamp()],
    });
  }

  // ── /cobrar ─────────────────────────────────────────────────────────────────
  if (cmd === 'cobrar') {
    const player = await requirePersonaje(interaction);
    if (!player) return;

    const lastCobro   = player.getCooldown('cobrar');
    const remaining   = lastCobro ? lastCobro.getTime() + config.cooldowns.cobrar - Date.now() : 0;
    if (remaining > 0) {
      return interaction.reply({ embeds: [E.warn('Cooldown', `Podrás cobrar en **${formatCooldown(remaining)}**`)], flags: 64 });
    }

    const trabajo = TRABAJOS[player.trabajo?.toLowerCase()];
    const base    = trabajo ? rand(trabajo.salario[0], trabajo.salario[1]) : config.economia.salarioBase;
    const salario = Math.floor(base * (1 + player.nivel * 0.02));

    player.bank += salario;
    player.trabajosRealizados++;
    player.setCooldown('cobrar', new Date());
    player.addXP(rand(20, 50));
    await player.save();

    const emoji = trabajo?.emoji || '💼';
    const cobEmbed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle('💰 Salario cobrado')
      .setDescription(`${emoji} **${player.trabajo || 'Trabajo general'}** → **+${formatMoney(salario)}** depositado en el banco`)
      .addFields({ name: '🏦 Banco', value: formatMoney(player.bank), inline: true })
      .setTimestamp();
    addImage(cobEmbed, 'cobrar');
    return interaction.reply({ embeds: [cobEmbed] });
  }

  // ── /pagar ──────────────────────────────────────────────────────────────────
  if (cmd === 'pagar') {
    const player = await requirePersonaje(interaction);
    if (!player) return;
    const target = interaction.options.getUser('usuario');
    const cant   = interaction.options.getInteger('cantidad');
    if (cant > player.cash) {
      return interaction.reply({ embeds: [E.err('Fondos insuficientes', `Solo tienes ${formatMoney(player.cash)} en cash.`)], flags: 64 });
    }

    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) {
      return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese usuario no tiene personaje.')], flags: 64 });
    }

    player.cash      -= cant;
    targetPlayer.cash += cant;
    await player.save();
    await targetPlayer.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setDescription(`💵 **${player.getFullName()}** pagó **${formatMoney(cant)}** en efectivo a **${targetPlayer.getFullName()}**`)
        .setTimestamp()],
    });
  }

  // ── /blanquear ──────────────────────────────────────────────────────────────
  if (cmd === 'blanquear') {
    const player = await requirePersonaje(interaction);
    if (!player) return;
    const cant = interaction.options.getInteger('cantidad');
    if (cant > player.dineroSucio) {
      return interaction.reply({ embeds: [E.err('Fondos insuficientes', `Solo tienes ${formatMoney(player.dineroSucio)} en dinero sucio.`)], flags: 64 });
    }

    const comision = Math.floor(cant * config.economia.impuestoBlanqueo);
    const limpio   = cant - comision;

    player.dineroSucio -= cant;
    player.bank        += limpio;
    await player.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle('🧹 Blanqueo completado')
        .setThumbnail(ICONS.blanquear)
        .addFields(
          { name: '💊 Dinero sucio',   value: formatMoney(cant),     inline: true },
          { name: '💸 Comisión (35%)', value: formatMoney(comision), inline: true },
          { name: '✅ Dinero limpio',  value: formatMoney(limpio),    inline: true },
        )
        .setTimestamp()],
    });
  }

  // ── /top ────────────────────────────────────────────────────────────────────
  if (cmd === 'top') {
    const tipo = interaction.options.getString('tipo') || 'riqueza';
    const Player = require('../database/models/Player');
    let players, title, value;

    if (tipo === 'riqueza') {
      players = await Player.find({ personajeCreado: true }).sort({ bank: -1 }).limit(10);
      title   = '🏆 Top 10 más ricos';
      value   = p => `${formatMoney(p.bank + p.cash)}`;
    } else if (tipo === 'nivel') {
      players = await Player.find({ personajeCreado: true }).sort({ nivel: -1, xp: -1 }).limit(10);
      title   = '⭐ Top 10 nivel más alto';
      value   = p => `Nivel ${p.nivel} (${p.xp} XP)`;
    } else {
      players = await Player.find({ personajeCreado: true }).sort({ robosRealizados: -1 }).limit(10);
      title   = '🏴‍☠️ Top 10 criminales';
      value   = p => `${p.robosRealizados} robos · ${p.arrestos} arrestos`;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const desc = players.map((p, i) => `${medals[i] || `**${i + 1}.**`} **${p.getFullName()}** — ${value(p)}`).join('\n') || '*Sin datos aún*';
    const topEmbed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle(title)
      .setDescription(desc)
      .setTimestamp();
    addImage(topEmbed, 'top');
    return interaction.reply({ embeds: [topEmbed] });
  }
}

// ─── Prefix: !billetera, !banco, !cobrar ──────────────────────────────────────
const prefixCommands = [
  {
    name: 'billetera',
    aliases: ['dinero', 'banco', 'cash', 'wallet'],
    description: 'Ver tu dinero',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje. Usa `/personaje crear`.');
      return message.reply({ embeds: [E.billetera(player)] });
    },
  },
  {
    name: 'depositar',
    aliases: ['ingresar', 'depo'],
    description: 'Depositar cash en el banco',
    async run(message, args) {
      const { hasFacturasPendientes } = require('../utils/facturaBlock');
      if (await hasFacturasPendientes(message.author.id)) {
        return message.reply('🔴 **Bloqueado:** Tienes facturas pendientes. Usa `/factura-lista` y paga con `/pagar-factura [ID]`. Solo puedes ver tu dinero hasta saldar.');
      }
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje. Usa `/personaje crear`.');
      const cant = parseInt(args[0], 10);
      if (!Number.isInteger(cant) || cant < 1) return message.reply('❌ Uso: `!depositar <cantidad> [pin]`\nEj: `!depositar 500` o `!depositar 500 1234`');
      if (player.pinBanco) {
        const pin = (args[1] || '').trim();
        if (!pin) return message.reply('🔒 Tu cuenta tiene PIN. Pásalo así: `!depositar <cantidad> <pin>`');
        const { ok: pinOk } = await verifyPin(pin, player.pinBanco);
        if (!pinOk) return message.reply('❌ PIN incorrecto.');
      }
      if (cant > player.cash) return message.reply(`❌ Solo tienes ${formatMoney(player.cash)} en efectivo.`);
      player.cash -= cant;
      player.bank += cant;
      await player.save();
      return message.reply(`🏦 Depositaste **${formatMoney(cant)}** en el banco.\n🏦 Banco: **${formatMoney(player.bank)}** · 💵 Cash: ${formatMoney(player.cash)}`);
    },
  },
  {
    name: 'cobrar',
    aliases: ['salario', 'trabajo', 'sueldo'],
    cooldown: config.cooldowns.cobrar,
    description: 'Cobrar salario',
    async run(message) {
      const { hasFacturasPendientes } = require('../utils/facturaBlock');
      if (await hasFacturasPendientes(message.author.id)) {
        return message.reply('🔴 **Bloqueado:** Tienes facturas pendientes. Usa `/factura-lista` y paga con `/pagar-factura [ID]`.');
      }
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      const lastCobro = player.getCooldown('cobrar');
      const remaining = lastCobro ? lastCobro.getTime() + config.cooldowns.cobrar - Date.now() : 0;
      if (remaining > 0) return message.reply(`⏳ Podrás cobrar en **${formatCooldown(remaining)}**`);

      const trabajo = TRABAJOS[player.trabajo?.toLowerCase()];
      const base    = trabajo ? rand(trabajo.salario[0], trabajo.salario[1]) : config.economia.salarioBase;
      const salario = Math.floor(base * (1 + player.nivel * 0.02));
      player.bank += salario;
      player.trabajosRealizados++;
      player.setCooldown('cobrar', new Date());
      await player.save();
      return message.reply(`💰 Cobraste **${formatMoney(salario)}** por tu trabajo de **${player.trabajo || 'general'}**. Banco: ${formatMoney(player.bank)}`);
    },
  },
];

module.exports = { data, execute, prefixCommands };
