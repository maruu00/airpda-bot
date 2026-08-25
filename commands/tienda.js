/**
 * TIENDA OFICIAL — Los Santos Marketplace
 * 80+ items · 8 categorías · SelectMenu interactivo
 * Slash: /tienda /comprar /vender /usar /vitales
 */
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');
const { getPlayer, getInventory, formatMoney } = require('../utils/helpers');
const E = require('../utils/embeds');
const config = require('../config');
const { ICONS, BANNERS, addImage } = require('../utils/images');

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════
const CATALOGO = {

  comida: {
    emoji: '🍔', label: 'Comida',
    descripcion: 'Restaura el hambre del personaje',
    items: [
      { id: 'bocadillo',    nombre: 'Bocadillo',          precio:   30, emoji: '🥪', tipo: 'comida',  efecto: { hambre: 25 },         desc: '+25 hambre' },
      { id: 'hamburguesa',  nombre: 'Hamburguesa',         precio:   50, emoji: '🍔', tipo: 'comida',  efecto: { hambre: 40 },         desc: '+40 hambre' },
      { id: 'hot_dog',      nombre: 'Hot Dog',             precio:   25, emoji: '🌭', tipo: 'comida',  efecto: { hambre: 22 },         desc: '+22 hambre' },
      { id: 'taco',         nombre: 'Taco',                precio:   35, emoji: '🌮', tipo: 'comida',  efecto: { hambre: 28 },         desc: '+28 hambre' },
      { id: 'ensalada',     nombre: 'Ensalada',            precio:   40, emoji: '🥗', tipo: 'comida',  efecto: { hambre: 30 },         desc: '+30 hambre' },
      { id: 'pizza',        nombre: 'Pizza',               precio:   80, emoji: '🍕', tipo: 'comida',  efecto: { hambre: 60 },         desc: '+60 hambre' },
      { id: 'pollo',        nombre: 'Pollo asado',         precio:   90, emoji: '🍗', tipo: 'comida',  efecto: { hambre: 65 },         desc: '+65 hambre' },
      { id: 'sushi',        nombre: 'Sushi premium',       precio:  120, emoji: '🍱', tipo: 'comida',  efecto: { hambre: 70 },         desc: '+70 hambre' },
      { id: 'donut',        nombre: 'Donut',               precio:   20, emoji: '🍩', tipo: 'comida',  efecto: { hambre: 18 },         desc: '+18 hambre' },
      { id: 'fruta',        nombre: 'Cesta de fruta',      precio:   45, emoji: '🍎', tipo: 'comida',  efecto: { hambre: 30, salud: 5 }, desc: '+30 hambre +5 salud' },
      { id: 'steak',        nombre: 'Steak de ternera',    precio:  150, emoji: '🥩', tipo: 'comida',  efecto: { hambre: 80 },         desc: '+80 hambre' },
      { id: 'pan',          nombre: 'Pan',                 precio:   10, emoji: '🍞', tipo: 'comida',  efecto: { hambre: 12 },         desc: '+12 hambre · Económico' },
    ],
  },

  bebidas: {
    emoji: '🥤', label: 'Bebidas',
    descripcion: 'Restaura la sed del personaje',
    items: [
      { id: 'agua',         nombre: 'Agua mineral',        precio:   10, emoji: '💧', tipo: 'bebida',  efecto: { sed: 30 },            desc: '+30 sed · Básica' },
      { id: 'leche',        nombre: 'Leche',               precio:   15, emoji: '🥛', tipo: 'bebida',  efecto: { sed: 25, salud: 3 }, desc: '+25 sed +3 salud' },
      { id: 'cafe',         nombre: 'Café',                precio:   20, emoji: '☕', tipo: 'bebida',  efecto: { sed: 20 },            desc: '+20 sed' },
      { id: 'zumo',         nombre: 'Zumo natural',        precio:   30, emoji: '🧃', tipo: 'bebida',  efecto: { sed: 38 },            desc: '+38 sed' },
      { id: 'refresco',     nombre: 'Refresco',            precio:   25, emoji: '🥤', tipo: 'bebida',  efecto: { sed: 40 },            desc: '+40 sed' },
      { id: 'cerveza',      nombre: 'Cerveza',             precio:   50, emoji: '🍺', tipo: 'bebida',  efecto: { sed: 35 },            desc: '+35 sed' },
      { id: 'vino',         nombre: 'Vino tinto',          precio:   80, emoji: '🍷', tipo: 'bebida',  efecto: { sed: 45 },            desc: '+45 sed · Gama alta' },
      { id: 'energetica',   nombre: 'Bebida energética',   precio:   60, emoji: '⚡', tipo: 'bebida',  efecto: { sed: 50 },            desc: '+50 sed · Extra energía' },
      { id: 'cocktail',     nombre: 'Cóctel premium',      precio:  120, emoji: '🍹', tipo: 'bebida',  efecto: { sed: 60 },            desc: '+60 sed · Top de gama' },
    ],
  },

  farmacia: {
    emoji: '💊', label: 'Farmacia',
    descripcion: 'Medicamentos y kits de primeros auxilios',
    items: [
      { id: 'vendas',       nombre: 'Vendas',              precio:   80, emoji: '🩹', tipo: 'medkit',  efecto: { salud: 15 },          desc: '+15 salud · Básico' },
      { id: 'vitaminas',    nombre: 'Vitaminas',           precio:   80, emoji: '💊', tipo: 'medicina', efecto: { salud: 10, hambre: 10, sed: 10 }, desc: '+10 salud/hambre/sed' },
      { id: 'botiquin',     nombre: 'Botiquín básico',     precio:  150, emoji: '🧰', tipo: 'medkit',  efecto: { salud: 25 },          desc: '+25 salud' },
      { id: 'analgésico',   nombre: 'Analgésico',          precio:  120, emoji: '🔵', tipo: 'medicina', efecto: { salud: 20 },          desc: '+20 salud · Reduce dolor RP' },
      { id: 'morfina',      nombre: 'Morfina',             precio:  250, emoji: '💉', tipo: 'medicina', efecto: { salud: 40 },          desc: '+40 salud · Uso médico RP' },
      { id: 'kit_medico',   nombre: 'Kit médico completo', precio:  400, emoji: '🏥', tipo: 'medkit',  efecto: { salud: 60 },          desc: '+60 salud' },
      { id: 'suero_iv',     nombre: 'Suero IV',            precio:  600, emoji: '🩺', tipo: 'medkit',  efecto: { salud: 80, sed: 40 },  desc: '+80 salud +40 sed · EMT' },
      { id: 'desfibrilador', nombre: 'Desfibrilador',      precio: 1500, emoji: '⚡', tipo: 'medkit',  efecto: { salud: 100, revivir: true }, desc: '+100 salud · Revive si muerto' },
    ],
  },

  equipo: {
    emoji: '🦺', label: 'Equipo & Protección',
    descripcion: 'Armaduras, chalecos y equipo táctico',
    items: [
      { id: 'guantes',      nombre: 'Guantes tácticos',    precio:  300, emoji: '🧤', tipo: 'equipo',  equipable: true,               desc: 'Equipo personal estándar' },
      { id: 'casco',        nombre: 'Casco táctico',       precio:  800, emoji: '⛑️', tipo: 'armadura', equipable: true, efecto: { proteccion: 10 }, desc: '-10% daño' },
      { id: 'chaleco_ligero', nombre: 'Chaleco ligero',    precio:  900, emoji: '🧥', tipo: 'armadura', equipable: true, efecto: { proteccion: 15 }, desc: '-15% daño recibido' },
      { id: 'chaleco',      nombre: 'Chaleco antibalas',   precio: 1500, emoji: '🦺', tipo: 'armadura', equipable: true, efecto: { proteccion: 30 }, desc: '-30% daño recibido' },
      { id: 'maletin',      nombre: 'Maletín ejecutivo',   precio:  500, emoji: '💼', tipo: 'contenedor', equipable: true, efecto: { slots: 5 }, desc: '+5 slots inventario' },
      { id: 'mochila',      nombre: 'Mochila táctica',     precio: 1000, emoji: '🎒', tipo: 'contenedor', equipable: true, efecto: { slots: 10 }, desc: '+10 slots inventario' },
      { id: 'linterna',     nombre: 'Linterna',            precio:  200, emoji: '🔦', tipo: 'herramienta', equipable: true,               desc: 'Visión nocturna RP' },
      { id: 'cuerda',       nombre: 'Cuerda',              precio:  150, emoji: '🪢', tipo: 'herramienta',                               desc: 'Útil para acciones RP' },
      { id: 'gas_lacrimo',  nombre: 'Granada de humo',     precio:  500, emoji: '💨', tipo: 'equipo',  equipable: true,               desc: 'Granada de humo RP' },
    ],
  },

  armamento: {
    emoji: '🔫', label: 'Armamento',
    descripcion: '⚠️ Requieren permiso de armas válido',
    items: [
      { id: 'spray_pimienta', nombre: 'Spray de pimienta', precio: 5000, emoji: '🫧', tipo: 'arma', equipable: true, desc: 'Defensa personal legal' },
      { id: 'navaja',       nombre: 'Navaja',              precio:  1000, emoji: '🔪', tipo: 'arma', equipable: true, desc: 'Arma cuerpo a cuerpo' },
      { id: 'bate',         nombre: 'Bate de béisbol',     precio:  600, emoji: '🏏', tipo: 'arma', equipable: true, desc: 'Arma contundente' },
      { id: 'pistola_fogueo', nombre: 'Pistola de fogueo', precio: 30000, emoji: '🔫', tipo: 'arma', equipable: true, desc: 'Solo RP' },
      { id: 'spray_defensa', nombre: 'Spray defensa',      precio: 8000, emoji: '🛡️', tipo: 'arma', equipable: true, desc: 'Aerosol de defensa' },
      { id: 'pistola',       nombre: 'Pistola (9mm)',       precio: 70000, emoji: '🔫', tipo: 'arma', equipable: true, desc: 'Arma corta estándar' },
      { id: 'pistola50',     nombre: 'Pistola .50',         precio: 110000, emoji: '🔫', tipo: 'arma', equipable: true, desc: 'Alto calibre' },
      { id: 'smg',           nombre: 'Subfusil SMG',        precio: 190000, emoji: '🪖', tipo: 'arma', equipable: true, desc: 'Automática' },
      { id: 'rifle',         nombre: 'Rifle de asalto',     precio: 350000, emoji: '🪖', tipo: 'arma', equipable: true, desc: 'Rifle automático' },
      { id: 'escopeta',      nombre: 'Escopeta',            precio: 170000, emoji: '🔫', tipo: 'arma', equipable: true, desc: 'Disparo múltiple' },
      { id: 'sniper',        nombre: 'Rifle de precisión',  precio: 500000, emoji: '🔫', tipo: 'arma', equipable: true, desc: 'Largo alcance' },
      { id: 'muni_9mm',      nombre: 'Munición 9mm',        precio: 1500, emoji: '🔴', tipo: 'municion', desc: 'Caja 50 balas' },
      { id: 'muni_45',       nombre: 'Munición .45',        precio: 2000, emoji: '🔴', tipo: 'municion', desc: 'Caja 50 balas' },
      { id: 'muni_rifle',    nombre: 'Munición rifle',      precio: 2500, emoji: '🔴', tipo: 'municion', desc: 'Caja 30 balas' },
      { id: 'muni_escopeta', nombre: 'Munición escopeta',   precio: 2200, emoji: '🔴', tipo: 'municion', desc: 'Caja 25 cartuchos' },
      { id: 'silenciador',   nombre: 'Silenciador',         precio: 18000, emoji: '🔇', tipo: 'arma_mod', desc: 'Reduce ruido' },
      { id: 'mira_holo',     nombre: 'Mira holográfica',    precio: 12000, emoji: '🎯', tipo: 'arma_mod', desc: 'Precisión +10%' },
    ],
  },

  radio: {
    emoji: '📡', label: 'Radio & Comunicaciones',
    descripcion: 'Equipos de radio, walkie-talkies y dispositivos de comunicación',
    items: [
      { id: 'movil_basico', nombre: 'Móvil prepago',        precio:  150, emoji: '📱', tipo: 'movil', equipable: true, desc: 'Teléfono básico de prepago' },
      { id: 'movil_medio',  nombre: 'Smartphone estándar',  precio:  800, emoji: '📳', tipo: 'movil', equipable: true, desc: 'Teléfono con apps básicas' },
      { id: 'movil_premium', nombre: 'Smartphone premium',  precio: 2500, emoji: '📲', tipo: 'movil', equipable: true, desc: 'Top de gama · Todas las apps' },
      { id: 'walkie',       nombre: 'Walkie-talkie civil',  precio:  400, emoji: '📻', tipo: 'radio', equipable: true, desc: 'Radio civil · Canal público' },
      { id: 'radio_pro',    nombre: 'Radio profesional',    precio: 1200, emoji: '📡', tipo: 'radio', equipable: true, desc: 'Largo alcance · Multi-canal' },
      { id: 'auricular',    nombre: 'Auricular discreto',   precio:  600, emoji: '🎧', tipo: 'radio', equipable: true, desc: 'Comunicación discreta · Earpiece' },
      { id: 'tablet',       nombre: 'Tablet',               precio: 1500, emoji: '📟', tipo: 'movil', equipable: true, desc: 'Tablet para trabajo RP' },
      { id: 'laptop',       nombre: 'Laptop',               precio: 3000, emoji: '💻', tipo: 'movil', equipable: true, desc: 'Portátil para hacking/trabajo RP' },
    ],
  },

  tramites: {
    emoji: '📋', label: 'Trámites Legales',
    descripcion: '🏛️ Documentación oficial · Ayuntamiento de Los Santos',
    items: [
      { id: 'dni',           nombre: 'Renovación de DNI',        precio:   200, emoji: '🪪', tipo: 'documento', desc: 'DNI renovado · Necesario para trámites' },
      { id: 'licencia_b',    nombre: 'Licencia de conducir (B)', precio:   800, emoji: '🚗', tipo: 'documento', desc: 'Clase B · Vehículos ligeros' },
      { id: 'licencia_a',    nombre: 'Licencia de motocicleta (A)', precio: 600, emoji: '🏍️', tipo: 'documento', desc: 'Clase A · Motocicletas' },
      { id: 'licencia_c',    nombre: 'Licencia de camión (C)',   precio:  1500, emoji: '🚛', tipo: 'documento', desc: 'Clase C · Vehículos pesados' },
      { id: 'permiso_armas', nombre: 'Permiso de armas',         precio:  2500, emoji: '🔫', tipo: 'documento', desc: 'Portar arma corta legal · 30 días' },
      { id: 'pasaporte',     nombre: 'Pasaporte',                precio:  1000, emoji: '📘', tipo: 'documento', desc: 'Pasaporte internacional RP' },
      { id: 'antecedentes',  nombre: 'Certificado antecedentes', precio:   350, emoji: '📄', tipo: 'documento', desc: 'Informe oficial de antecedentes' },
      { id: 'cert_medico',   nombre: 'Certificado médico',       precio:   400, emoji: '🏥', tipo: 'documento', desc: 'Certificado médico del LSFD' },
      { id: 'registro_emp',  nombre: 'Registro de empresa',      precio:  5000, emoji: '🏢', tipo: 'documento', desc: 'Registra tu empresa en el ayuntamiento' },
      { id: 'licencia_bar',  nombre: 'Licencia apertura local',  precio:  3500, emoji: '🍺', tipo: 'documento', desc: 'Apertura bar/local de hostelería' },
      { id: 'contrato_alq',  nombre: 'Contrato de alquiler',     precio:  1200, emoji: '🏠', tipo: 'documento', desc: 'Contrato de alquiler de vivienda RP' },
      { id: 'cert_penales',  nombre: 'Certificado de penales',   precio:   300, emoji: '⚖️', tipo: 'documento', desc: 'Certificado de penales · Uso legal' },
    ],
  },

  mecanica: {
    emoji: '🔧', label: 'Mecánica & Vehículos',
    descripcion: 'Herramientas, repuestos y mantenimiento de vehículos',
    items: [
      { id: 'gasolina',     nombre: 'Bidón de gasolina',    precio:  200, emoji: '⛽', tipo: 'combustible', desc: 'Recarga el depósito RP' },
      { id: 'neumatico',    nombre: 'Neumático de repuesto', precio: 500, emoji: '🔄', tipo: 'herramienta', desc: 'Repuesto para pinchazos' },
      { id: 'kit_rep',      nombre: 'Kit de reparación',    precio:  800, emoji: '🔧', tipo: 'herramienta', efecto: { reparar: 50 }, desc: '+50 estado vehículo' },
      { id: 'kit_rep_pro',  nombre: 'Kit mecánico PRO',     precio: 2000, emoji: '🛠️', tipo: 'herramienta', efecto: { reparar: 100 }, desc: 'Reparación completa' },
      { id: 'gato_hidr',    nombre: 'Gato hidráulico',      precio:  600, emoji: '⚙️', tipo: 'herramienta', desc: 'Necesario para cambiar ruedas RP' },
      { id: 'pintura',      nombre: 'Spray de pintura',     precio:  300, emoji: '🎨', tipo: 'herramienta', desc: 'Cambia el color del coche RP' },
      { id: 'inm_alarma',   nombre: 'Inmovilizador/alarma', precio: 1200, emoji: '🔒', tipo: 'herramienta', equipable: true, desc: 'Sistema antirrobo para vehículo RP' },
    ],
  },

  ilegal: {
    emoji: '🏴', label: 'Mercado Negro',
    descripcion: '⚠️ Artículos ilegales · Requieren nivel de banda',
    items: [
      { id: 'semilla_marihuana', nombre: 'Semillas de Marihuana',      precio: 1500,  emoji: '🌱', tipo: 'semilla', nivelBanda: 1, cultivo: 'marihuana', desc: 'Planta marihuana (30min)' },
      { id: 'semilla_lsd',       nombre: 'Semillas de LSD',            precio: 3500,  emoji: '🌱', tipo: 'semilla', nivelBanda: 1, cultivo: 'lsd',       desc: 'Planta LSD (45min)' },
      { id: 'semilla_cocaina',   nombre: 'Semillas de Cocaína',        precio: 5000, emoji: '🌱', tipo: 'semilla', nivelBanda: 2, cultivo: 'cocaina',   desc: 'Planta cocaína (60min)' },
      { id: 'semilla_extasis',   nombre: 'Semillas de Éxtasis',        precio: 7000, emoji: '🌱', tipo: 'semilla', nivelBanda: 2, cultivo: 'extasis',   desc: 'Planta éxtasis (90min)' },
      { id: 'semilla_meta',      nombre: 'Semillas de Metanfetamina',  precio: 12000, emoji: '🌱', tipo: 'semilla', nivelBanda: 3, cultivo: 'metanfetamina', desc: 'Planta metanfetamina (2h)' },
      { id: 'semilla_ketamina',  nombre: 'Semillas de Ketamina',       precio: 15000, emoji: '🌱', tipo: 'semilla', nivelBanda: 3, cultivo: 'ketamina',  desc: 'Planta ketamina (3h)' },
      { id: 'semilla_heroina',   nombre: 'Semillas de Heroína',        precio: 20000, emoji: '🌱', tipo: 'semilla', nivelBanda: 4, cultivo: 'heroina',   desc: 'Planta heroína (4h)' },
      { id: 'semilla_fentanilo', nombre: 'Semillas de Fentanilo',      precio: 35000, emoji: '🌱', tipo: 'semilla', nivelBanda: 5, cultivo: 'fentanilo', desc: 'Planta fentanilo (6h)' },
      { id: 'panel_luz',    nombre: 'Panel de luz UV',      precio: 30000, emoji: '💡', tipo: 'herramienta', nivelBanda: 2, desc: 'Acelera crecimiento de plantas' },
      { id: 'reactor',      nombre: 'Reactor químico',       precio: 40000, emoji: '⚗️', tipo: 'pieza_lab',   nivelBanda: 3, desc: 'Pieza de laboratorio' },
      { id: 'condensador',  nombre: 'Condensador',           precio: 35000, emoji: '🌀', tipo: 'pieza_lab',   nivelBanda: 3, desc: 'Pieza de laboratorio' },
      { id: 'tubos',        nombre: 'Tubos de ensayo',       precio: 18000, emoji: '🧪', tipo: 'pieza_lab',   nivelBanda: 3, desc: 'Pieza de laboratorio' },
      { id: 'quimicos',     nombre: 'Químicos precursores',  precio: 50000, emoji: '🧬', tipo: 'pieza_lab',   nivelBanda: 3, desc: 'Pieza de laboratorio' },
      { id: 'kit_silenciador', nombre: 'Kit de silenciador', precio: 25000, emoji: '🔇', tipo: 'arma_mod',    nivelBanda: 4, desc: 'Silenciador para armas cortas' },
      { id: 'pistola_ilegal', nombre: 'Pistola sin serie',   precio: 60000, emoji: '🔫', tipo: 'arma', equipable: true, nivelBanda: 4, desc: 'Ilegal · Sin registro' },
      { id: 'subfusil',     nombre: 'Subfusil artesanal',    precio: 140000, emoji: '🪖', tipo: 'arma', equipable: true, nivelBanda: 5, desc: 'Ilegal · Arma automática' },
    ],
  },
};

const CATS = Object.keys(CATALOGO);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function findItemGlobal(query) {
  query = query.toLowerCase().trim();
  for (const cat of Object.values(CATALOGO)) {
    const found = cat.items.find(i =>
      i.id === query ||
      i.nombre.toLowerCase() === query ||
      i.nombre.toLowerCase().includes(query),
    );
    if (found) return found;
  }
  return null;
}

function getItemFromInv(inv, query) {
  query = query.toLowerCase().trim();
  return inv.items.find(i =>
    i.id === query ||
    (i.nombre && i.nombre.toLowerCase() === query) ||
    (i.nombre && i.nombre.toLowerCase().includes(query)),
  ) || null;
}

function barraVital(val, max = 100, len = 10) {
  const v = Math.min(Math.max(val, 0), max);
  const llenos = Math.round((v / max) * len);
  const color = v > 60 ? '🟩' : v > 30 ? '🟨' : '🟥';
  return color.repeat(llenos) + '⬛'.repeat(len - llenos);
}

function catEmbed(catKey) {
  const cat = CATALOGO[catKey];
  const lines = cat.items.map(i =>
    `${i.emoji} **${i.nombre}** — ${formatMoney(i.precio)} · *${i.desc}*`,
  ).join('\n');

  const em = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`🏪 Los Santos Marketplace — ${cat.emoji} ${cat.label}`)
    .setDescription(lines.slice(0, 3900))
    .setFooter({ text: `📦 /comprar [item]  ·  💰 /vender [item]  ·  🎯 /usar [item]  ·  ❤️ /vitales` })
    .setTimestamp();
  addImage(em, 'tienda');
  return em;
}

function buildSelectMenu(seleccionado = null) {
  const opts = CATS.map(k =>
    new StringSelectMenuOptionBuilder()
      .setLabel(CATALOGO[k].label)
      .setValue(k)
      .setDescription(CATALOGO[k].descripcion.slice(0, 100))
      .setEmoji(CATALOGO[k].emoji)
      .setDefault(k === seleccionado),
  );
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('tienda_cat')
      .setPlaceholder('🛒 Selecciona una categoría...')
      .addOptions(opts),
  );
}

// ─── Slash commands ───────────────────────────────────────────────────────────
const data = [
  new SlashCommandBuilder()
    .setName('tienda')
    .setDescription('🏪 Abre el Los Santos Marketplace')
    .addStringOption(o => o
      .setName('categoria')
      .setDescription('Ir directamente a una categoría')
      .setRequired(false)
      .addChoices(...CATS.map(k => ({ name: `${CATALOGO[k].emoji} ${CATALOGO[k].label}`, value: k })))),

  new SlashCommandBuilder()
    .setName('comprar')
    .setDescription('💳 Comprar un item de la tienda')
    .addStringOption(o => o.setName('item').setDescription('Nombre del item').setRequired(true).setMaxLength(64))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (def: 1)').setRequired(false).setMinValue(1).setMaxValue(50)),

  new SlashCommandBuilder()
    .setName('vender')
    .setDescription('💰 Vender un item de tu inventario')
    .addStringOption(o => o.setName('item').setDescription('Nombre del item').setRequired(true).setMaxLength(64))
    .addIntegerOption(o => o.setName('cantidad').setDescription('Cantidad (def: 1)').setRequired(false).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('vitales')
    .setDescription('❤️ Ver tus estadísticas vitales (salud, hambre, sed)'),
];

// ─── Execute ──────────────────────────────────────────────────────────────────
async function execute(interaction, client) {
  const cmd = interaction.commandName;

  // ── /tienda ─────────────────────────────────────────────────────────────────
  if (cmd === 'tienda') {
    const catFija = interaction.options.getString('categoria');
    const catInicial = catFija || 'comida';

    const msg = await interaction.reply({
      embeds: [catEmbed(catInicial)],
      components: [buildSelectMenu(catInicial)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id && i.customId === 'tienda_cat',
      time: 120_000,
    });

    collector.on('collect', async i => {
      await i.update({ embeds: [catEmbed(i.values[0])], components: [buildSelectMenu(i.values[0])] });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });

    return;
  }

  // ── /comprar ─────────────────────────────────────────────────────────────────
  if (cmd === 'comprar') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje con `/personaje crear`.')], ephemeral: true });

    const nombreInput = interaction.options.getString('item');
    const cantidad    = interaction.options.getInteger('cantidad') || 1;
    const item = findItemGlobal(nombreInput);

    if (!item) {
      return interaction.reply({
        embeds: [E.err('Item no encontrado', `No existe **"${nombreInput}"** en la tienda.\nUsa \`/tienda\` para ver el catálogo completo.`)],
        ephemeral: true,
      });
    }

    // Verificar nivel de banda para items ilegales
    if (item.nivelBanda) {
      const Gang = require('../database/models/Gang');
      const ganga = player.gangId ? await Gang.findById(player.gangId).catch(() => null) : null;
      const nivelBanda = ganga?.nivel || 0;
      if (nivelBanda < item.nivelBanda) {
        return interaction.reply({
          embeds: [E.err('Nivel de banda insuficiente', `**${item.nombre}** requiere nivel de banda **${item.nivelBanda}**. Tu banda tiene nivel **${nivelBanda}**.`)],
          ephemeral: true,
        });
      }
    }

    const total = item.precio * cantidad;
    if (player.cash < total) {
      return interaction.reply({
        embeds: [E.err('Fondos insuficientes', `Necesitas **${formatMoney(total)}** en efectivo.\nTienes: ${formatMoney(player.cash)}`)],
        ephemeral: true,
      });
    }

    const inv = await getInventory(interaction.user.id);

    // Comprobar slots disponibles
    const tieneYa = inv.items.find(i => i.id === item.id);
    if (!tieneYa && inv.items.length >= inv.capacidadMax) {
      return interaction.reply({
        embeds: [E.err('Inventario lleno', `Tu inventario está lleno (${inv.capacidadMax} slots usados).`)],
        ephemeral: true,
      });
    }

    // Compra especial: radio policial gratis solo para policías
    if (item.id === 'radio_policial') {
      const gc = await require('../database/models/GuildConfig').findOne({ guildId: interaction.guildId });
      const rolesPolicia = [config.roles.policia, config.roles.sheriff, gc?.roles?.policia].filter(Boolean);
      const esAgente = interaction.member.permissions.has('Administrator') ||
        rolesPolicia.some(r => interaction.member.roles.cache.has(r));
      if (!esAgente) {
        return interaction.reply({ embeds: [E.err('Sin autorización', 'La radio policial solo está disponible para agentes autorizados.')], ephemeral: true });
      }
    }

    // Si es licencia/documento con validez 30 días, crear Licencia en PDA con caducidad y guardar vencimiento en inventario
    const licenciaTipos = { 'licencia_b': 'coche', 'licencia_a': 'moto', 'licencia_c': 'camion', 'permiso_armas': 'armas', 'licencia_bar': 'bar' };
    let licenciaTipo = licenciaTipos[item.id] || null;
    let vencimiento = null;
    if (licenciaTipo) {
      vencimiento = new Date(); vencimiento.setDate(vencimiento.getDate() + 30);
      const idx = inv.items.findIndex(i => i.id === item.id);
      if (idx !== -1) inv.items[idx].metadata = { ...(inv.items[idx].metadata || {}), fechaVencimiento: vencimiento.toISOString(), tipoLicencia: licenciaTipo };
      // Crear/actualizar Licencia en colección airp_pda.licencias para PDA
      try {
        const mongoose = require('mongoose');
        const Licencia = mongoose.models.Licencia || mongoose.model('Licencia', new mongoose.Schema({ propietarioId: String, propietarioNombre: String, tipo: String, numeroLicencia: String, estado: String, fechaExpedicion: Date, fechaVencimiento: Date, diasValidez: Number, registradoPor: String, fecha: Date }, { collection: 'licencias', strict: false }));
        const idx2 = inv.items.findIndex(i => i.id === item.id);
        const licNum = `LIC-${licenciaTipo.toUpperCase().slice(0,3)}-${Date.now().toString(36).toUpperCase()}`;
        // Evitar duplicar si ya tiene licencia vigente del mismo tipo
        const existente = await Licencia.findOne({ propietarioId: interaction.user.id, tipo: licenciaTipo, estado: 'vigente' }).catch(() => null);
        if (!existente) {
          await Licencia.create({
            propietarioId: interaction.user.id,
            propietarioNombre: `${player.nombre} ${player.apellido}`.trim() || interaction.user.username,
            tipo: licenciaTipo,
            numeroLicencia: licNum,
            estado: 'vigente',
            fechaExpedicion: new Date(),
            fechaVencimiento: vencimiento,
            diasValidez: 30,
            registradoPor: 'BOT-Tienda',
            fecha: new Date(),
          });
        } else {
          // Renovar existente
          existente.fechaExpedicion = new Date();
          existente.fechaVencimiento = vencimiento;
          existente.estado = 'vigente';
          await existente.save();
        }
      } catch (e) { console.error('Licencia sync error:', e.message); }
    }

    inv.addItem({ id: item.id, nombre: item.nombre, emoji: item.emoji, tipo: item.tipo, precio: item.precio, descripcion: item.desc, efecto: item.efecto || {}, equipable: item.equipable || false, equipado: false, metadata: licenciaTipo ? { tipoLicencia: licenciaTipo, fechaVencimiento: vencimiento ? vencimiento.toISOString() : null } : {} }, cantidad);
    player.cash -= total;

    await inv.save();
    await player.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('✅ Compra realizada')
        .setDescription(`${item.emoji} Compraste **${cantidad}x ${item.nombre}**`)
        .addFields(
          { name: '💰 Pagado',       value: formatMoney(total),                   inline: true },
          { name: '💵 Cash restante', value: formatMoney(player.cash),            inline: true },
          { name: '🎒 Inventario',   value: `${inv.countItems()}/${inv.capacidadMax} slots`, inline: true },
          { name: '📦 Item',         value: item.desc,                            inline: false },
        )
        .setFooter({ text: item.tipo === 'comida' || item.tipo === 'bebida' || item.tipo === 'medkit' ? 'Usa el item con /usar ' + item.nombre : 'Item guardado en tu inventario' })
        .setTimestamp()],
    });
  }

  // ── /vender ──────────────────────────────────────────────────────────────────
  if (cmd === 'vender') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje.')], ephemeral: true });

    const nombreInput = interaction.options.getString('item');
    const cantidad    = interaction.options.getInteger('cantidad') || 1;
    const inv = await getInventory(interaction.user.id);
    const invItem = getItemFromInv(inv, nombreInput);

    if (!invItem) {
      return interaction.reply({
        embeds: [E.err('Item no encontrado', `No tienes **"${nombreInput}"** en el inventario.\nUsa \`/inventario\` para ver tus items.`)],
        ephemeral: true,
      });
    }
    if (cantidad > invItem.cantidad) {
      return interaction.reply({
        embeds: [E.err('Cantidad insuficiente', `Solo tienes **${invItem.cantidad}x** ${invItem.nombre}.`)],
        ephemeral: true,
      });
    }

    // Documentos no se pueden vender
    if (invItem.tipo === 'documento') {
      return interaction.reply({
        embeds: [E.warn('No vendible', 'Los documentos oficiales no se pueden vender.')],
        ephemeral: true,
      });
    }

    const precioBase = findItemGlobal(invItem.nombre)?.precio || invItem.valor || invItem.precio || 50;
    const precioVenta = Math.floor(precioBase * 0.5);
    const total = precioVenta * cantidad;

    inv.removeItem(invItem.id, cantidad);
    player.cash += total;
    await inv.save();
    await player.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.gold)
        .setTitle('💰 Venta realizada')
        .setDescription(`${invItem.emoji || '📦'} Vendiste **${cantidad}x ${invItem.nombre}** por **${formatMoney(total)}**\n*Precio de venta: 50% del original*`)
        .addFields({ name: '💵 Cash actual', value: formatMoney(player.cash), inline: true })
        .setTimestamp()],
    });
  }

  // ── /usar ────────────────────────────────────────────────────────────────────
  if (cmd === 'usar') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje.')], ephemeral: true });
    if (player.muerto) return interaction.reply({ embeds: [E.err('Muerto', 'No puedes usar items estando muerto. Llama al 911 o usa un desfibrilador.')], ephemeral: true });

    const nombreInput = interaction.options.getString('item');
    const inv = await getInventory(interaction.user.id);
    const invItem = getItemFromInv(inv, nombreInput);

    if (!invItem) {
      return interaction.reply({
        embeds: [E.err('Item no encontrado', `No tienes **"${nombreInput}"** en el inventario.`)],
        ephemeral: true,
      });
    }

    const efecto = invItem.efecto || {};
    const cambios = [];

    // Fallback para items básicos sin efecto definido
    if (!efecto.salud && !efecto.hambre && !efecto.sed) {
      const nombreLower = invItem.nombre?.toLowerCase() || '';
      if (nombreLower.includes('comida') || nombreLower.includes('hamburguesa') || invItem.id === 'comida') efecto.hambre = 30;
      if (nombreLower.includes('agua') || nombreLower.includes('refresco') || invItem.id === 'agua') efecto.sed = 30;
    }

    if (efecto.salud || efecto.hambre || efecto.sed) {
      if (invItem.efecto?.salud)  { player.salud  = Math.min(100, player.salud  + invItem.efecto.salud);  cambios.push(`+${invItem.efecto.salud} salud`); }
      if (invItem.efecto?.hambre) { player.hambre = Math.min(100, player.hambre + invItem.efecto.hambre); cambios.push(`+${invItem.efecto.hambre} hambre`); }
      if (invItem.efecto?.sed)    { player.sed    = Math.min(100, player.sed    + invItem.efecto.sed);    cambios.push(`+${invItem.efecto.sed} sed`); }
      if (cambios.length) {
        inv.removeItem(invItem.id, 1);
        await inv.save(); await player.save();
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`${invItem.emoji} ${invItem.nombre} usado`).setDescription(cambios.join(', ')).setTimestamp()],
        });
      }
    }

    // Equipar
    if (invItem.equipable) {
      const mismoTipo = inv.items.find(i => i.tipo === invItem.tipo && i.equipado && i.id !== invItem.id);
      if (mismoTipo) mismoTipo.equipado = false;
      invItem.equipado = true;
      await inv.save();
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.success).setTitle(`${invItem.emoji} Equipado`).setDescription(`**${invItem.nombre}** equipado.`).setTimestamp()] });
    }

    // Documentos
    if (invItem.tipo === 'documento') {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.info).setTitle(`📄 ${invItem.nombre}`).setDescription(invItem.desc || 'Documento válido.').setTimestamp()] });
    }

    // Semillas
    if (invItem.tipo === 'semilla' || invItem.id?.startsWith('semilla_')) {
      const tipoDroga = invItem.cultivo || invItem.id?.replace('semilla_', '');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.info).setTitle('🌱 Semilla').setDescription(`**${invItem.nombre}**: Plántala con \`/drogas plantar tipo:${tipoDroga}\``).setTimestamp()] });
    }

    return interaction.reply({ embeds: [E.warn('No usable', `**${invItem.nombre}** no se puede usar de esta forma.`)], ephemeral: true });

    if (efecto.salud)   { player.salud  = Math.min(100, player.salud  + efecto.salud);  cambios.push(`❤️ Salud: +${efecto.salud}`);  }
    if (efecto.hambre)  { player.hambre = Math.min(100, player.hambre + efecto.hambre); cambios.push(`🍔 Hambre: +${efecto.hambre}`); }
    if (efecto.sed)     { player.sed    = Math.min(100, player.sed    + efecto.sed);    cambios.push(`💧 Sed: +${efecto.sed}`);     }
    if (efecto.revivir && player.muerto) {
      player.muerto = false;
      player.enHospital = false;
      player.tiempoHospital = null;
      cambios.push('🔴→🟢 ¡REVIVIDO!');
    }

    if (!cambios.length) {
      return interaction.reply({ embeds: [E.warn('Sin efecto', 'Este item no tiene efectos aplicables ahora mismo.')], ephemeral: true });
    }

    inv.removeItem(invItem.id, 1);
    await inv.save();
    await player.save();

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(
          invItem.tipo === 'medkit' || invItem.tipo === 'medicina' ? config.colors.success :
          invItem.tipo === 'comida' ? config.colors.gold : config.colors.info,
        )
        .setTitle(`${invItem.emoji || '✅'} Usaste: ${invItem.nombre}`)
        .setDescription(cambios.map(c => `> ${c}`).join('\n'))
        .addFields(
          { name: '❤️ Salud',  value: `${barraVital(antes.salud)} → ${barraVital(player.salud)} **${Math.floor(player.salud)}%**`, inline: false },
          { name: '🍔 Hambre', value: `${barraVital(antes.hambre)} → ${barraVital(player.hambre)} **${Math.floor(player.hambre)}%**`, inline: false },
          { name: '💧 Sed',    value: `${barraVital(antes.sed)} → ${barraVital(player.sed)} **${Math.floor(player.sed)}%**`, inline: false },
        )
        .setFooter({ text: `Inventario: ${inv.countItems()}/${inv.capacidadMax} slots restantes` })
        .setTimestamp()],
    });
  }

  // ── /vitales ─────────────────────────────────────────────────────────────────
  if (cmd === 'vitales') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', 'Crea tu personaje.')], ephemeral: true });

    const salud  = Math.floor(player.salud);
    const hambre = Math.floor(player.hambre);
    const sed    = Math.floor(player.sed);

    // Recomendaciones automáticas
    const consejos = [];
    if (hambre < 30)  consejos.push(`🍔 Hambre baja — Compra comida en \`/tienda\` (categoría Comida)`);
    if (sed < 30)     consejos.push(`💧 Sed baja — Compra bebidas en \`/tienda\` (categoría Bebidas)`);
    if (salud < 50)   consejos.push(`❤️ Salud baja — Usa \`/usar Botiquín básico\` o ve al hospital`);
    if (player.muerto) consejos.push(`💀 Estás muerto — Usa un \`Desfibrilador\` o llama al 911`);

    const estadoGeneral = player.muerto ? '💀 **MUERTO**'
      : salud < 20 || hambre < 10 || sed < 10 ? '🔴 **CRÍTICO**'
      : salud < 50 || hambre < 30 || sed < 30 ? '🟡 **REGULAR**'
      : '🟢 **ÓPTIMO**';

    const embed = new EmbedBuilder()
      .setColor(player.muerto ? config.colors.danger : salud < 30 ? config.colors.warning : config.colors.success)
      .setTitle(`❤️ Estadísticas vitales — ${player.getFullName()}`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '📊 Estado general', value: estadoGeneral, inline: false },
        { name: '❤️ Salud',  value: `${barraVital(salud)}  **${salud}%**`,  inline: false },
        { name: '🍔 Hambre', value: `${barraVital(hambre)} **${hambre}%**`, inline: false },
        { name: '💧 Sed',    value: `${barraVital(sed)}    **${sed}%**`,    inline: false },
      )
      .setTimestamp();

    if (consejos.length) embed.addFields({ name: '💡 Recomendaciones', value: consejos.join('\n'), inline: false });
    if (player.enHospital && player.tiempoHospital) {
      const resta = player.tiempoHospital.getTime() - Date.now();
      if (resta > 0) embed.addFields({ name: '🏥 En el hospital', value: `Sales en ${Math.ceil(resta / 60000)} min`, inline: true });
    }

    embed.setFooter({ text: 'Usa /usar [item] para consumir items · /tienda para comprar' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── /dar-item ─────────────────────────────────────────────────────────────────
  if (cmd === 'dar-item') {
    const player = await getPlayer(interaction.user.id, interaction.user.username);
    if (!player.personajeCreado) return interaction.reply({ embeds: [E.warn('Sin personaje', '')], ephemeral: true });

    const target      = interaction.options.getUser('usuario');
    const nombreInput = interaction.options.getString('item');
    const cantidad    = interaction.options.getInteger('cantidad') || 1;

    if (target.id === interaction.user.id) return interaction.reply({ embeds: [E.err('Error', 'No puedes darte items a ti mismo.')], ephemeral: true });

    const invOrigen = await getInventory(interaction.user.id);
    const invItem   = getItemFromInv(invOrigen, nombreInput);

    if (!invItem) return interaction.reply({ embeds: [E.err('No encontrado', `No tienes "${nombreInput}" en el inventario.`)], ephemeral: true });
    if (invItem.cantidad < cantidad) return interaction.reply({ embeds: [E.err('Insuficiente', `Solo tienes ${invItem.cantidad}x ${invItem.nombre}.`)], ephemeral: true });

    const targetPlayer = await getPlayer(target.id, target.username);
    if (!targetPlayer.personajeCreado) return interaction.reply({ embeds: [E.err('Sin personaje', 'Ese jugador no tiene personaje.')], ephemeral: true });

    const invDestino = await getInventory(target.id);
    if (invDestino.items.length >= invDestino.capacidadMax) {
      return interaction.reply({ embeds: [E.err('Inventario lleno', 'El inventario del destinatario está lleno.')], ephemeral: true });
    }

    invOrigen.removeItem(invItem.id, cantidad);
    invDestino.addItem({ id: invItem.id, nombre: invItem.nombre, emoji: invItem.emoji, tipo: invItem.tipo, precio: invItem.precio, descripcion: invItem.descripcion, efecto: invItem.efecto || {}, equipable: invItem.equipable || false, equipado: false, metadata: {} }, cantidad);

    await invOrigen.save();
    await invDestino.save();

    try {
      await client.users.fetch(target.id).then(u => u.send(
        `🎁 **${player.getFullName()}** te ha dado **${cantidad}x ${invItem.emoji} ${invItem.nombre}**`,
      ));
    } catch {}

    return interaction.reply({
      embeds: [E.ok('Item enviado', `${invItem.emoji} Diste **${cantidad}x ${invItem.nombre}** a **${targetPlayer.getFullName()}**`)],
    });
  }
}

// ─── Prefix commands ──────────────────────────────────────────────────────────
const prefixCommands = [
  {
    name: 'tienda',
    aliases: ['shop', 'store', 'market', 'mercado'],
    description: '!tienda [categoria]',
    async run(message, args) {
      const catKey = args[0]?.toLowerCase();
      const catInicial = (catKey && CATALOGO[catKey]) ? catKey : 'comida';

      const msg = await message.reply({
        embeds: [catEmbed(catInicial)],
        components: [buildSelectMenu(catInicial)],
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === message.author.id && i.customId === 'tienda_cat',
        time: 120_000,
      });

      collector.on('collect', async i => {
        await i.update({ embeds: [catEmbed(i.values[0])], components: [buildSelectMenu(i.values[0])] });
      });

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });
    },
  },
  {
    name: 'comprar',
    aliases: ['buy', 'c'],
    description: '!comprar [item] [cantidad]',
    async run(message, args) {
      if (!args.length) return message.reply('❌ Uso: `!comprar [nombre del item] [cantidad]`');
      const cantidad = parseInt(args[args.length - 1]) || 1;
      const nombre   = isNaN(parseInt(args[args.length - 1])) ? args.join(' ') : args.slice(0, -1).join(' ');
      const item     = findItemGlobal(nombre);
      if (!item) return message.reply(`❌ Item "${nombre}" no encontrado. Usa \`!tienda\` para ver el catálogo.`);

      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      const total = item.precio * cantidad;
      if (player.cash < total) return message.reply(`❌ Necesitas ${formatMoney(total)}. Tienes: ${formatMoney(player.cash)}`);

      const inv = await getInventory(message.author.id);
      const licenciaTipos2 = { 'licencia_b': 'coche', 'licencia_a': 'moto', 'licencia_c': 'camion', 'permiso_armas': 'armas', 'licencia_bar': 'bar' };
      let tipo2 = licenciaTipos2[item.id] || null;
      let venc2 = null;
      if (tipo2) {
        venc2 = new Date(); venc2.setDate(venc2.getDate() + 30);
        try {
          const mongoose2 = require('mongoose');
          const Licencia2 = mongoose2.models.Licencia || mongoose2.model('Licencia', new mongoose.Schema({ propietarioId: String, propietarioNombre: String, tipo: String, numeroLicencia: String, estado: String, fechaExpedicion: Date, fechaVencimiento: Date, diasValidez: Number, registradoPor: String, fecha: Date }, { collection: 'licencias', strict: false }));
          const licNum2 = `LIC-${tipo2.toUpperCase().slice(0,3)}-${Date.now().toString(36).toUpperCase()}`;
          const exist2 = await Licencia2.findOne({ propietarioId: message.author.id, tipo: tipo2, estado: 'vigente' }).catch(() => null);
          if (!exist2) {
            await Licencia2.create({ propietarioId: message.author.id, propietarioNombre: `${player.nombre} ${player.apellido}`.trim() || message.author.username, tipo: tipo2, numeroLicencia: licNum2, estado: 'vigente', fechaExpedicion: new Date(), fechaVencimiento: venc2, diasValidez: 30, registradoPor: 'BOT-Tienda', fecha: new Date() });
          } else { exist2.fechaVencimiento = venc2; exist2.fechaExpedicion = new Date(); exist2.estado = 'vigente'; await exist2.save(); }
        } catch (e) { console.error('Licencia sync prefix error:', e.message); }
      }
      inv.addItem({ id: item.id, nombre: item.nombre, emoji: item.emoji, tipo: item.tipo, precio: item.precio, descripcion: item.desc, efecto: item.efecto || {}, equipable: item.equipable || false, equipado: false, metadata: tipo2 ? { tipoLicencia: tipo2, fechaVencimiento: venc2 ? venc2.toISOString() : null } : {} }, cantidad);
      player.cash -= total;
      await inv.save();
      await player.save();
      return message.reply(`${item.emoji} Compraste **${cantidad}x ${item.nombre}** por **${formatMoney(total)}**. Cash: ${formatMoney(player.cash)}${tipo2 ? ` · Licencia válida 30 días hasta ${venc2.toLocaleDateString('es-ES')}` : ''}`);
    },
  },
  {
    name: 'usar',
    aliases: ['use', 'comer', 'beber'],
    description: '!usar [item] — Usar item del inventario',
    async run(message, args) {
      if (!args.length) return message.reply('❌ Uso: `!usar [nombre del item]`');
      const nombre = args.join(' ');
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      const inv = await getInventory(message.author.id);
      const invItem = getItemFromInv(inv, nombre);
      if (!invItem) return message.reply(`❌ No tienes "${nombre}" en el inventario.`);

      const efecto = invItem.efecto || {};
      const cambios = [];

      // Fallback para items básicos sin efecto definido
      if (!efecto.salud && !efecto.hambre && !efecto.sed) {
        const nombreLower = invItem.nombre?.toLowerCase() || '';
        if (nombreLower.includes('comida') || nombreLower.includes('hamburguesa') || nombreLower.includes('pizza') || invItem.id === 'comida') {
          efecto.hambre = 30;
        } else if (nombreLower.includes('agua') || nombreLower.includes('refresco') || nombreLower.includes('bebida') || invItem.id === 'agua') {
          efecto.sed = 30;
        }
      }

      if (efecto.salud)  { player.salud  = Math.min(100, player.salud  + efecto.salud);  cambios.push(`+${efecto.salud} salud`); }
      if (efecto.hambre) { player.hambre = Math.min(100, player.hambre + efecto.hambre); cambios.push(`+${efecto.hambre} hambre`); }
      if (efecto.sed)    { player.sed    = Math.min(100, player.sed    + efecto.sed);    cambios.push(`+${efecto.sed} sed`); }
      if (!cambios.length) {
        // Equipar items equipables
        if (invItem.equipable) {
          // Desequipar item del mismo tipo si ya hay uno equipado
          const mismoTipo = inv.items.find(i => i.tipo === invItem.tipo && i.equipado && i.id !== invItem.id);
          if (mismoTipo) mismoTipo.equipado = false;
          invItem.equipado = true;
          await inv.save();
          return message.reply(`${invItem.emoji} **${invItem.nombre}** equipado.`);
        }
        // Items de tipo documento
        if (invItem.tipo === 'documento') {
          return message.reply(`📄 **${invItem.nombre}** — ${invItem.desc || 'Documento válido.'}`);
        }
        // Items de tipo semilla
        if (invItem.tipo === 'semilla' || invItem.id?.startsWith('semilla_')) {
          const tipoDroga = invItem.cultivo || invItem.id?.replace('semilla_', '');
          const DROGAS = require('../data/drogas');
          if (tipoDroga && DROGAS[tipoDroga]) {
            // Informar al usuario cómo plantar
            return message.reply(`🌱 **${invItem.nombre}**: Plántala con \`/drogas plantar tipo:${tipoDroga}\` o \`!plantar ${tipoDroga}\``);
          }
          return message.reply(`🌱 **${invItem.nombre}**: Úsala con \`/drogas plantar\`.`);
        }
        return message.reply('❌ Este item no se puede usar directamente.');
      }

      inv.removeItem(invItem.id, 1);
      await inv.save();
      await player.save();
      return message.reply(`${invItem.emoji} Usaste **${invItem.nombre}**: ${cambios.join(', ')} · Salud: ${Math.floor(player.salud)}% | Hambre: ${Math.floor(player.hambre)}% | Sed: ${Math.floor(player.sed)}%`);
    },
  },
  {
    name: 'vitales',
    aliases: ['vida', 'stats', 'salud', 'hambre'],
    description: '!vitales — Ver estadísticas vitales',
    async run(message) {
      const player = await getPlayer(message.author.id, message.author.username);
      if (!player.personajeCreado) return message.reply('Sin personaje.');
      const s = Math.floor(player.salud), h = Math.floor(player.hambre), se = Math.floor(player.sed);
      const embed = new EmbedBuilder().setColor(config.colors.success)
        .setTitle(`❤️ Vitales de ${player.getFullName()}`)
        .addFields(
          { name: '❤️ Salud',  value: `${barraVital(s)} ${s}%`,  inline: false },
          { name: '🍔 Hambre', value: `${barraVital(h)} ${h}%`,  inline: false },
          { name: '💧 Sed',    value: `${barraVital(se)} ${se}%`, inline: false },
        ).setTimestamp();
      return message.reply({ embeds: [embed] });
    },
  },
];

module.exports = { data, execute, prefixCommands, CATALOGO, findItemGlobal };
