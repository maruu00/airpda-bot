/**
 * HELP — Menú de ayuda interactivo con navegación por categorías
 * Slash: /help
 * Prefix: !help !ayuda !comandos !cmds
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');

// ─── Catálogo de categorías y comandos ───────────────────────────────────────
const CATEGORIAS = [
  {
    id: 'roleplay',
    emoji: '🎭',
    label: 'Roleplay',
    descripcion: 'Acciones, narrativa y comunicación IC',
    color: 0x8b5cf6,
    comandos: [
      { cmd: '!me [acción]',         desc: 'Tu personaje realiza una acción en tercera persona' },
      { cmd: '!do [descripción]',     desc: 'Describir algo en la escena o entorno' },
      { cmd: '!entorno [desc]',        desc: 'Describir el entorno de la zona' },
      { cmd: '!ooc [mensaje]',         desc: 'Hablar fuera del personaje (OOC)' },
      { cmd: '!susurro [texto]',       desc: 'Susurrar algo (solo alguien cercano escucha)' },
      { cmd: '!grito [texto]',         desc: 'Gritar algo (todos lo escuchan)' },
      { cmd: '!pensar [texto]',        desc: 'Pensar en voz alta (monólogo interno)' },
      { cmd: '!radio [texto]',         desc: 'Hablar por radio' },
      { cmd: '!911 [texto]',           desc: 'Llamada de emergencia al 911' },
      { cmd: '!it [narración]',        desc: 'Narrar una acción del entorno' },
      { cmd: '!golpear [@usuario]',    desc: 'Golpear a alguien (acción RP)' },
      { cmd: '!intentar [acción]',     desc: 'Intentar hacer algo con resultado aleatorio' },
      { cmd: '!anon [mensaje]',        desc: 'Mensaje anónimo en el canal' },
      { cmd: '!dado [caras]',          desc: 'Tirar un dado (por defecto D6)' },
      { cmd: '!carta',                 desc: 'Sacar una carta aleatoria de la baraja' },
      { cmd: '/personaje',            desc: 'Gestionar tu personaje (crear, ver, editar)' },
    ],
  },
  {
    id: 'economia',
    emoji: '💰',
    label: 'Economía',
    descripcion: 'Banco, transferencias y dinero',
    color: 0xf59e0b,
    comandos: [
      { cmd: '/billetera',                     desc: 'Ver tu cash, banco y dinero sucio' },
      { cmd: '/banco',                        desc: 'Ver tu cuenta bancaria' },
      { cmd: '/depositar [cantidad]',          desc: 'Ingresar dinero en el banco' },
      { cmd: '/retirar [cantidad]',            desc: 'Sacar dinero del banco' },
      { cmd: '/transferir [@usuario] [cant]',  desc: 'Enviar dinero limpio/sucio/banco a otro jugador' },
      { cmd: '/cobrar',                        desc: 'Cobrar tu salario semanal' },
      { cmd: '/pagar [deuda]',                 desc: 'Pagar una deuda o factura' },
      { cmd: '/blanquear [cantidad]',          desc: 'Blanquear dinero sucio (35% comisión)' },
      { cmd: '/top',                           desc: 'Ranking de los más ricos del servidor' },
      { cmd: '/banco-estado',                 desc: '[STAFF] Ver banco del Estado (recauda 2% cada 7d)' },
      { cmd: '/sacar-dinero-estado [@u] [cant] [motivo]', desc: '[STAFF] Sacar del banco del Estado' },
      { cmd: '/ingresar-estado [cant] [motivo]', desc: '[STAFF] Ingresar al banco del Estado' },
      { cmd: '/recaudar-estado',              desc: '[STAFF] Forzar recaudación 2% ahora' },
      { cmd: '/dar-dinero [@u] [cant] [tipo]', desc: '(Admin) Dar dinero limpio o sucio' },
      { cmd: '/add-money [@u] [cant]',         desc: '(Admin) Añadir dinero a un jugador' },
    ],
  },
  {
    id: 'inventario',
    emoji: '🎒',
    label: 'Inventario',
    descripcion: 'Mochila, items y tienda',
    color: 0x8b5cf6,
    comandos: [
      { cmd: '/inventario',                  desc: 'Ver tu mochila e items equipados' },
      { cmd: '/tienda',                      desc: 'Catálogo de la tienda con precios' },
      { cmd: '/comprar [item] [cantidad]',   desc: 'Comprar un item de la tienda' },
      { cmd: '/vender [item] [cantidad]',    desc: 'Vender un item de tu inventario' },
      { cmd: '/equipar [item]',              desc: 'Equipar un item (arma, chaleco, etc.)' },
      { cmd: '/desequipar [item]',           desc: 'Desequipar un item' },
      { cmd: '/usar [item]',                 desc: 'Usar un item consumible' },
      { cmd: '/tirar [item] [cant]',         desc: 'Tirar un item al suelo' },
      { cmd: '/dar-item [@u] [item] [cant]', desc: 'Dar un item de tu mochila a otro jugador' },
      { cmd: '/dar [@u] [item]',             desc: 'Dar dinero o items a otro jugador' },
      { cmd: '!inv',                         desc: 'Ver tu inventario (en otro jugador solo admin)' },
    ],
  },
  {
    id: 'robos',
    emoji: '🏴‍☠️',
    label: 'Robos',
    descripcion: 'Atracos y actividades criminales',
    color: 0xef4444,
    comandos: [
      { cmd: '/robos',               desc: 'Ver lista de establecimientos disponibles con botín estimado' },
      { cmd: '/atracar [lugar]',     desc: 'Iniciar un atraco con minijuego interactivo de botones' },
      { cmd: '/allanar [casa]',      desc: 'Allanar una casa (requiere orden)' },
      { cmd: '/secuestrar [@u]',     desc: 'Secuestrar a un jugador (apuntarle a la cabeza)' },
      { cmd: '!robar [@usuario]',    desc: 'Robar dinero al personaje de otro jugador' },
      { cmd: '!hackear [objetivo]',  desc: 'Hackear cajero/empresa/gobierno' },
      { cmd: '!carterista',          desc: 'Intentar robar sin que se note' },
      { cmd: '',                     desc: '' },
      { cmd: '⚡ EXPRESS',           desc: 'Licorería · Peluquería · Tatuajes · Casa · Importación' },
      { cmd: '⚠️ MEDIANOS',         desc: 'Badulaque/LTD · Tienda Ropa · Desguace' },
      { cmd: '🔥 MAYORES',          desc: 'Electrónica · Pawnshop · Farmacia · Yate · Joyería' },
    ],
  },
  {
    id: 'policia',
    emoji: '👮',
    label: 'Policía / PDA',
    descripcion: 'Comandos del cuerpo policial',
    color: 0x003f7f,
    comandos: [
      { cmd: '/esposar [@u] [motivo]',        desc: 'Esposar a un ciudadano detenido' },
      { cmd: '/desesposar [@u]',              desc: 'Liberar las esposas a un detenido' },
      { cmd: '/multar [@u] [€] [motivo]',     desc: 'Poner una multa con ID único MLT-YYYY-NNNN' },
      { cmd: '/multas [@u]',                  desc: 'Ver multas pendientes propias o de otro' },
      { cmd: '/pagar-multa [ID]',             desc: 'Pagar una multa por su ID' },
      { cmd: '/quitar-sucio [@u] [cant] [motivo]', desc: 'Decomisar dinero sucio (solo último atraco)' },
      { cmd: '/cachear [@u]',                 desc: 'Registrar el inventario de un ciudadano' },
      { cmd: '/escoltar [@u]',                desc: 'Escoltar a un detenido esposado' },
      { cmd: '/crear-placa [@u] [dep] [rango]',desc: 'Crear/asignar placa oficial a un agente' },
      { cmd: '/ver-placa [@u]',               desc: 'Ver la placa oficial de un agente' },
      { cmd: '/ver-id [@u]',                  desc: 'Verificar la ID de un ciudadano' },
      { cmd: '/ver-licencia [@u]',            desc: 'Verificar licencia de conducir' },
      { cmd: '/ver-permiso [@u]',             desc: 'Verificar permiso de armas' },
      { cmd: '/poli-dispo [estado]',          desc: 'Actualizar tu disponibilidad policial' },
      { cmd: '/soli-dispo',                   desc: 'Consultar disponibilidad actual de agentes' },
      { cmd: '/operativo [crear/listar]',    desc: 'Gestionar operativos policiales' },
      { cmd: '/investigacion [crear/listar]',desc: 'Gestionar investigaciones' },
      { cmd: '/ticket [crear/listar]',       desc: 'Gestionar tickets de soporte' },
      { cmd: '/pda buscar [nombre]',          desc: 'Buscar ciudadano en la PDA web' },
      { cmd: '/pda sanciones [nombre]',       desc: 'Ver sanciones activas en la PDA' },
    ],
  },
  {
    id: 'medico',
    emoji: '🏥',
    label: 'Médico / EMT',
    descripcion: 'Sistema sanitario y emergencias',
    color: 0x22c55e,
    comandos: [
      { cmd: '/curar [@u] [hp]',   desc: 'Curar a un ciudadano (solo LSFD/Médicos)' },
      { cmd: '/revivir [@u]',      desc: 'Reanimar a un jugador muerto' },
      { cmd: '/hospital [@u]',     desc: 'Ingresar a alguien en el hospital' },
      { cmd: '/estado [@u]',       desc: 'Ver estado vital: salud, hambre, sed' },
      { cmd: '/vitales [@u]',      desc: 'Ver vitales de un jugador' },
      { cmd: '/informe-paciente',  desc: 'Crear informe médico de paciente' },
      { cmd: '/informe-personal',  desc: 'Crear informe personal' },
      { cmd: '/auxilio',           desc: 'Llamar urgentemente al LSFD desde cualquier lugar' },
      { cmd: '!911 médico',        desc: 'Solicitar ambulancia por texto' },
    ],
  },
  {
    id: 'vehiculos',
    emoji: '🚗',
    label: 'Vehículos',
    descripcion: 'Coches, garaje e interacciones',
    color: 0x06b6d4,
    comandos: [
      { cmd: '/vehiculo comprar',      desc: 'Ver catálogo de vehículos disponibles' },
      { cmd: '/vehiculo vender',       desc: 'Vender uno de tus vehículos' },
      { cmd: '/vehiculo lista',        desc: 'Ver todos tus vehículos registrados' },
      { cmd: '/sacar-coche [matríc]',  desc: 'Sacar un coche del garaje' },
      { cmd: '/guardar-coche [matríc]',desc: 'Guardar un coche en el garaje' },
      { cmd: '/coche [parte] [acción]',desc: 'Interacción rápida con el coche (puertas/capo/maletero/ventanillas)' },
      { cmd: '/puertas [abrir/cerrar]',desc: 'Abrir/cerrar puertas del coche (RP)' },
      { cmd: '/capo [abrir/cerrar]',   desc: 'Abrir/cerrar el capó (RP)' },
      { cmd: '/maletero [abrir/cerrar]',desc: 'Abrir/cerrar el maletero (RP)' },
      { cmd: '/ventanillas [a/c]',     desc: 'Abrir/cerrar ventanillas (RP)' },
      { cmd: '/taximetro-on',          desc: 'Activar el taxímetro — iniciar viaje' },
      { cmd: '/taximetro-off [@p]',    desc: 'Desactivar taxímetro y calcular tarifa' },
    ],
  },
  {
    id: 'ropa',
    emoji: '👕',
    label: 'Ropa / Acciones',
    descripcion: 'Vestimenta e interacciones físicas',
    color: 0xec4899,
    comandos: [
      { cmd: '/gorra [poner/quitar]',      desc: 'Ponerse o quitarse la gorra' },
      { cmd: '/mascara [poner/quitar]',    desc: 'Ponerse o quitarse la máscara' },
      { cmd: '/gafas [poner/quitar]',      desc: 'Ponerse o quitarse las gafas' },
      { cmd: '/camiseta [poner/quitar]',   desc: 'Ponerse o quitarse la camiseta' },
      { cmd: '/pantalones [poner/quitar]', desc: 'Ponerse o quitarse los pantalones' },
      { cmd: '/zapatos [poner/quitar]',    desc: 'Ponerse o quitarse los zapatos' },
      { cmd: '/guantes [poner/quitar]',    desc: 'Ponerse o quitarse los guantes' },
      { cmd: '/cinturon [poner/quitar]',   desc: 'Ponerse o quitarse el cinturón' },
      { cmd: '/caballito [@u]',            desc: 'Llevar a alguien a caballito' },
      { cmd: '/brazos [@u]',               desc: 'Llevar a alguien en brazos' },
      { cmd: '/arrastrar [@u]',            desc: 'Arrastrar a un inconsciente' },
    ],
  },
  {
    id: 'trabajo',
    emoji: '💼',
    label: 'Trabajos',
    descripcion: 'Empleos legales e ilegales',
    color: 0x10b981,
    comandos: [
      { cmd: '/trabajo',               desc: 'Ver tu trabajo actual y aplicar a uno nuevo' },
      { cmd: '/cobrar',                desc: 'Cobrar tu salario (cooldown 1h)' },
      { cmd: '/talar [cantidad]',      desc: 'Talar madera como leñador (cooldown 15min)' },
      { cmd: '/picar [cantidad]',      desc: 'Picar piedra como minero (cooldown 20min)' },
      { cmd: '/reparar [@u] [precio]', desc: '(Mecánico) Reparar el coche de un cliente' },
      { cmd: '/factura [@u] [import]', desc: '(Negocio) Emitir una factura a un cliente' },
      { cmd: '/pagar-factura [ID]',    desc: 'Pagar una factura recibida' },
      { cmd: '!pescar',                desc: 'Pescar en la costa (cooldown 15min)' },
      { cmd: '!minar',                 desc: 'Minar recursos (cooldown 30min)' },
      { cmd: '!trafico',               desc: 'Tráfico de mercancía ilegal (cooldown 1h)' },
    ],
  },
  {
    id: 'drogas',
    emoji: '🌿',
    label: 'Drogas',
    descripcion: 'Cultivo, laboratorio y tráfico de sustancias',
    color: 0x16a34a,
    comandos: [
      { cmd: '/drogas tipos',          desc: 'Ver 8 tipos de droga disponibles con requisitos' },
      { cmd: '/drogas plantar',        desc: 'Plantar droga (requiere nivel de banda)' },
      { cmd: '/drogas plantaciones',   desc: 'Ver tus plantaciones activas y estado de riego' },
      { cmd: '/drogas regar',          desc: 'Regar todas tus plantas' },
      { cmd: '/drogas cosechar',       desc: 'Cosechar plantas listas' },
      { cmd: '/drogas vender',         desc: 'Vender drogas del inventario' },
      { cmd: '/drogas estadisticas',   desc: 'Ver estadísticas de narcotráfico' },
      { cmd: '/drogas laboratorio',    desc: 'Montar/procesar/estado del laboratorio' },
      { cmd: '/tienda ilegal',         desc: 'Comprar paneles, piezas de lab, armas ilegales' },
      { cmd: '!plantar [tipo]',       desc: 'Plantar (marihuana/lsd/cocaína/éxtasis/meta/ketamina/heroína/fentanilo)' },
      { cmd: '!cosechar',             desc: 'Cosechar plantas listas' },
      { cmd: '!regar',                desc: 'Regar todas tus plantas' },
      { cmd: '!plantaciones',         desc: 'Ver tus plantaciones activas' },
      { cmd: '!laboratorio',          desc: 'Montar/procesar en laboratorio' },
      { cmd: '!venderdroga',          desc: 'Vender drogas del inventario' },
    ],
  },
  {
    id: 'bandas',
    emoji: '👥',
    label: 'Bandas',
    descripcion: 'Organización criminal y territorio',
    color: 0xa78bfa,
    comandos: [
      { cmd: '/banda crear [nombre]',     desc: 'Crear una nueva banda (requiere €5.000)' },
      { cmd: '/banda info [nombre]',      desc: 'Ver información de una banda' },
      { cmd: '/banda invitar [@u]',       desc: 'Invitar a alguien a tu banda' },
      { cmd: '/banda kick [@u]',          desc: 'Expulsar a alguien de tu banda' },
      { cmd: '/banda ascender [@u]',      desc: 'Subir de rango a un miembro' },
      { cmd: '/banda descender [@u]',     desc: 'Bajar de rango a un miembro' },
      { cmd: '/banda depositar [cant]',   desc: 'Depositar dinero en la caja de la banda' },
      { cmd: '/banda retirar [cant]',     desc: 'Retirar dinero de la caja de la banda' },
      { cmd: '/banda disolver',           desc: 'Disolver la banda (solo líder)' },
      { cmd: '!ranking bandas',           desc: 'Ver el ranking de bandas del servidor' },
      { cmd: '!dinero-org',               desc: 'Ver dinero/capital de tu org' },
      { cmd: '!almacen-org',              desc: 'Ver almacén de tu org (150 slots)' },
      { cmd: '!guardar-org [item] [cant]',desc: 'Guardar items de tu inv en el almacén de la org' },
      { cmd: '!sacar-org [item] [cant]',  desc: 'Sacar items del almacén a tu inventario' },
      { cmd: '!comprar-org [item] [cant]',desc: 'Comprar con dinero de la org → almacén (ej: !comprar-org pistola 2)' },
      { cmd: '!asignar-veh [placa] [@u]', desc: 'Asignar/quitar vehículo de la org a miembro' },
      { cmd: '!almacen-NOMBRE',           desc: '[ADMIN] Ver almacén de cualquier org por nombre' },
      { cmd: '!veh-org',                  desc: 'Ver vehículos de tu org' },
    ],
  },
  {
    id: 'casino',
    emoji: '🎰',
    label: 'Casino',
    descripcion: 'Juegos de azar y apuestas',
    color: 0xfbbf24,
    comandos: [
      { cmd: '/casino blackjack [apuesta]', desc: 'Jugar al Blackjack contra la casa' },
      { cmd: '/casino dados [apuesta]',     desc: 'Tirar los dados contra la casa' },
      { cmd: '/casino ruleta [apuesta]',    desc: 'Jugar a la ruleta (número/color/par-impar)' },
      { cmd: '/casino slots [apuesta]',     desc: 'Tirar la tragaperras' },
    ],
  },
  {
    id: 'comunicacion',
    emoji: '📱',
    label: 'Móvil / Comunicación',
    descripcion: 'Teléfono, llamadas y apps',
    color: 0x06b6d4,
    comandos: [
      { cmd: '/movil',                   desc: 'Abrir tu teléfono virtual con todas las apps' },
      { cmd: '/llamar [@usuario]',       desc: 'Hacer una llamada RP a otro jugador' },
      { cmd: '/auxilio',                 desc: 'Llamar de emergencia al LSFD' },
      { cmd: '!911 [descripción]',       desc: 'Llamar al 911 por texto' },
    ],
  },
  {
    id: 'sesion',
    emoji: '🎬',
    label: 'Sesiones / Staff',
    descripcion: 'Gestión de sesiones y votaciones',
    color: 0xf97316,
    comandos: [
      { cmd: '/abrir-sesion [tipo]',     desc: 'Abrir una sesión de RP oficial' },
      { cmd: '/cerrar-sesion [motivo]',  desc: 'Cerrar la sesión activa' },
      { cmd: '/abrir-votacion [preg]',   desc: 'Crear una votación con hasta 4 opciones y timer' },
      { cmd: '/anuncio [mensaje]',       desc: 'Publicar anuncio en texto plano (no embed)' },
      { cmd: '/aviso [@u] [razón]',      desc: 'Enviar aviso oficial a un usuario por DM' },
      { cmd: '/admin-on [motivo]',       desc: 'Activar modo admin IC (in-character)' },
      { cmd: '/admin-off',               desc: 'Desactivar modo admin IC' },
    ],
  },
  {
    id: 'invites',
    emoji: '📨',
    label: 'Invitaciones',
    descripcion: 'Sistema de invitaciones y rankings',
    color: 0x3b82f6,
    comandos: [
      { cmd: '/invites [@u]',     desc: 'Ver invites de un usuario (invitados, se fueron, válidos)' },
      { cmd: '/top-invites',      desc: 'Top 10 con más invites válidos' },
      { cmd: '/top-dinero',       desc: 'Top 10 con más dinero (cash+banco)' },
    ],
  },
  {
    id: 'admin',
    emoji: '🛠️',
    label: 'Administración',
    descripcion: 'Moderación, setup y control del servidor',
    color: 0xef4444,
    comandos: [
      { cmd: '/autorole add [users|bots] [@rol]',   desc: 'Añadir autorol para nuevos miembros/bots' },
      { cmd: '/autorole remove [users|bots] [@rol]',desc: 'Quitar autorol' },
      { cmd: '/autorole list',            desc: 'Listar autoroles' },
      { cmd: '/admin setup',              desc: 'Setup automático: crea canales, categorías y roles' },
      { cmd: '/admin dar [@u] [tipo]',    desc: 'Dar dinero, XP o items a un jugador' },
      { cmd: '/admin quitar [@u] [tipo]', desc: 'Quitar dinero a un jugador' },
      { cmd: '/admin config [clave]',     desc: 'Configurar canales/roles/opciones del bot' },
      { cmd: '/admin reset [@u]',         desc: '⚠️ Resetear personaje, dinero o inventario' },
      { cmd: '/admin arrestar [@u] [min]',desc: 'Encarcelar a un jugador X minutos' },
      { cmd: '/warn [@u] [razón]',        desc: 'Advertir a un usuario' },
      { cmd: '/quitar-warn [@u] [índice]',desc: 'Quitar un warn específico (1 = más antiguo)' },
      { cmd: '/ban [@u] [razón]',         desc: 'Banear a un usuario del servidor' },
      { cmd: '/kick [@u] [razón]',        desc: 'Expulsar temporalmente a un usuario' },
      { cmd: '/mute [@u] [tiempo]',       desc: 'Silenciar a un usuario' },
      { cmd: '/unmute [@u]',              desc: 'Quitar el silencio a un usuario' },
      { cmd: '/warns [@u]',               desc: 'Ver el historial de warns de un usuario' },
      { cmd: '/clearwarns [@u]',          desc: 'Limpiar todos los warns de un usuario' },
      { cmd: '/timeout [@u] [min] [razón]',desc: 'Timeout nativo de Discord' },
      { cmd: '/unban [id]',               desc: 'Desbanear por ID' },
      { cmd: '/slowmode [seg]',          desc: 'Modo lento del canal' },
      { cmd: '/lock [razón]',             desc: 'Bloquear canal' },
      { cmd: '/unlock',                   desc: 'Desbloquear canal' },
      { cmd: '/clear [cantidad]',         desc: 'Borrar X mensajes del canal' },
      { cmd: '/userinfo [@u]',            desc: 'Ver info de usuario' },
      { cmd: '/serverinfo',               desc: 'Ver info del servidor' },
      { cmd: '/roleinfo [@rol]',          desc: 'Ver info de un rol' },
      { cmd: '/status-on',                desc: 'Activar estado del servidor (embed con botones)' },
      { cmd: '/status-off',               desc: 'Cerrar estado del servidor' },
      { cmd: '/status-panel',             desc: 'Panel de estado detallado' },
      { cmd: '/consola [msg] [nivel]',    desc: '[ADMIN] Enviar a consola y canal de logs' },
      { cmd: '/consola-eval [codigo]',    desc: '[ADMIN] Ejecutar JS en consola (owner)' },
      { cmd: '!ver [@u]',                 desc: '(Admin) Ficha completa: economía, inventario, vehículos y estado' },
      { cmd: '!consola [nivel] [msg]',    desc: '[ADMIN] Enviar a consola' },
      { cmd: '!w [@u] [razón]',           desc: 'Alias de !warn' },
    ],
  },
];

// ─── Construir embed de portada ───────────────────────────────────────────────
function buildPortada(guild) {
  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('📖 Centro de Ayuda — AmericanRP')
    .setDescription(
      '> Selecciona una categoría en el menú de abajo para ver los comandos.\n\n' +
      CATEGORIAS.map(c => `${c.emoji} **${c.label}** — ${c.descripcion}`).join('\n'),
    )
    .setThumbnail(guild?.iconURL({ dynamic: true }) || null)
    .addFields(
      { name: '🔵 Slash commands', value: 'Usa `/` para ver todos los comandos disponibles', inline: true },
      { name: '🟢 Prefix commands', value: 'Prefix por defecto: `!`', inline: true },
      { name: '🌐 PDA Web', value: '[Abrir PDA](https://www.airpda.xyz)', inline: true },
    )
    .setFooter({ text: `AmericanRP · ${CATEGORIAS.length} categorías · 100+ comandos` })
    .setTimestamp();
}

// ─── Construir embed de categoría ────────────────────────────────────────────
function buildCategoria(cat) {
  const cmds = cat.comandos.filter(c => c.cmd);
  const mitad = Math.ceil(cmds.length / 2);
  const col1  = cmds.slice(0, mitad);
  const col2  = cmds.slice(mitad);

  const fmtCmd = ({ cmd, desc }) =>
    cmd ? `\`${cmd}\`\n╰ ${desc}` : '';

  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(`${cat.emoji} ${cat.label} — Comandos`)
    .setDescription(`> ${cat.descripcion}`)
    .addFields(
      {
        name: '​',
        value: col1.map(fmtCmd).filter(Boolean).join('\n\n') || '*Sin comandos*',
        inline: true,
      },
      {
        name: '​',
        value: col2.length
          ? col2.map(fmtCmd).filter(Boolean).join('\n\n')
          : '​',
        inline: true,
      },
    )
    .setFooter({ text: `AmericanRP · Categoría ${cat.label} · Usa ← para volver` })
    .setTimestamp();
}

// ─── Construir componentes ────────────────────────────────────────────────────
function buildSelectMenu(placeholderText = 'Selecciona una categoría...') {
  const opciones = CATEGORIAS.map(c =>
    new StringSelectMenuOptionBuilder()
      .setLabel(c.label)
      .setDescription(c.descripcion)
      .setValue(c.id)
      .setEmoji(c.emoji),
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help_categoria')
    .setPlaceholder(placeholderText)
    .addOptions(opciones);

  return new ActionRowBuilder().addComponents(menu);
}

function buildNavButtons(catIdx) {
  const prev = catIdx > 0 ? CATEGORIAS[catIdx - 1] : null;
  const next  = catIdx < CATEGORIAS.length - 1 ? CATEGORIAS[catIdx + 1] : null;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_home')
      .setLabel('🏠 Inicio')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel(prev ? `← ${prev.emoji} ${prev.label}` : '←')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!prev),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel(next ? `${next.emoji} ${next.label} →` : '→')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!next),
  );
}

// ─── Collector compartido ─────────────────────────────────────────────────────
function attachHelpCollector(msg, guild, userId, catInicial = -1) {
  let catActual = catInicial;

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === userId,
    time: 5 * 60 * 1000,
  });

  collector.on('collect', async i => {
    if (i.customId === 'help_categoria') {
      catActual = CATEGORIAS.findIndex(c => c.id === i.values[0]);
      const cat = CATEGORIAS[catActual];
      await i.update({ embeds: [buildCategoria(cat)], components: [buildSelectMenu(`${cat.emoji} ${cat.label}`), buildNavButtons(catActual)] });
    } else if (i.customId === 'help_home') {
      catActual = -1;
      await i.update({ embeds: [buildPortada(guild)], components: [buildSelectMenu()] });
    } else if (i.customId === 'help_prev' && catActual > 0) {
      catActual--;
      const cat = CATEGORIAS[catActual];
      await i.update({ embeds: [buildCategoria(cat)], components: [buildSelectMenu(`${cat.emoji} ${cat.label}`), buildNavButtons(catActual)] });
    } else if (i.customId === 'help_next' && catActual < CATEGORIAS.length - 1) {
      catActual++;
      const cat = CATEGORIAS[catActual];
      await i.update({ embeds: [buildCategoria(cat)], components: [buildSelectMenu(`${cat.emoji} ${cat.label}`), buildNavButtons(catActual)] });
    }
  });

  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

// ─── Slash command ────────────────────────────────────────────────────────────
const data = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Centro de ayuda interactivo con todos los comandos del bot')
    .addStringOption(o =>
      o.setName('categoria')
        .setDescription('Ir directamente a una categoría')
        .setRequired(false)
        .addChoices(
          ...CATEGORIAS.map(c => ({ name: `${c.emoji} ${c.label}`, value: c.id })),
        ),
    ),
];

async function execute(interaction) {
  const catArg = interaction.options.getString('categoria');
  const catIdx = catArg ? CATEGORIAS.findIndex(c => c.id === catArg) : -1;

  let embeds, components;
  if (catIdx !== -1) {
    const cat = CATEGORIAS[catIdx];
    embeds     = [buildCategoria(cat)];
    components = [buildSelectMenu(`${cat.emoji} ${cat.label}`), buildNavButtons(catIdx)];
  } else {
    embeds     = [buildPortada(interaction.guild)];
    components = [buildSelectMenu()];
  }

  await interaction.reply({ embeds, components, flags: 64 });
  const response = await interaction.fetchReply();
  attachHelpCollector(response, interaction.guild, interaction.user.id, catIdx);
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'help',
    aliases: ['ayuda', 'comandos', 'cmds', 'h'],
    description: '!help [categoría] — Centro de ayuda interactivo',
    async run(message) {
      const msg = await message.reply({ embeds: [buildPortada(message.guild)], components: [buildSelectMenu()] });
      attachHelpCollector(msg, message.guild, message.author.id);
    },
  },
];

module.exports = { data, execute, prefixCommands };
