/**
 * IA PROPIA — Conocimiento infinito
 * 120+ intents mapeados a lenguaje natural español.
 * Cada intent puede disparar cualquier comando del bot.
 * Entrenada localmente, sin API, ilimitada.
 */
module.exports = [
  // === ECONOMÍA (8) ===
  { id: 'rellenar_comida_todos', keywords: ['rellena','rellenar','llena','recarga','comida','hambre','sed','bebida','energia','todos','all','full'], ejemplo: 'rellena la comida de todos' },
  { id: 'rellenar_comida_usuario', keywords: ['rellena','comida','hambre','sed','usuario'], ejemplo: 'rellena la comida de @Usuario' },
  { id: 'dar_dinero', keywords: ['dar','da','dona','dale','otorga','dinero','cash','banco','sucio','plata','euros'], ejemplo: 'dale 5000 a @Usuario' },
  { id: 'quitar_dinero', keywords: ['quita','quitar','remueve','resta','dinero'], ejemplo: 'quita 500 a @Usuario' },
  { id: 'ver_dinero', keywords: ['ver','muestra','cuanto','dinero','billetera','banco','saldo','patrimonio'], ejemplo: 'cuanto dinero tiene @Usuario' },
  { id: 'transferir', keywords: ['transfiere','transferir','envia','enviar','paga','transfer'], ejemplo: 'transfiere 1000 a @Usuario' },
  { id: 'depositar', keywords: ['deposita','depositar','ingresa','mete.*banco'], ejemplo: 'deposita 500 en el banco' },
  { id: 'retirar', keywords: ['retira','retirar','saca.*banco'], ejemplo: 'retira 500 del banco' },
  { id: 'blanquear', keywords: ['blanquea','blanquear','lavar','sucio','limpio'], ejemplo: 'blanquea 5000' },
  { id: 'cobrar', keywords: ['cobra','cobrar','salario','sueldo','paga.*trabajo'], ejemplo: 'cobra tu salario' },
  { id: 'top_dinero', keywords: ['top','ranking','ricos','mas.*rico'], ejemplo: 'top de mas ricos' },

  // === ROLES (10) ===
  { id: 'dar_rol', keywords: ['dame','asigna','pon','dar','añade','agrega','otorga','rol'], ejemplo: 'dame el rol de @Rol' },
  { id: 'quitar_rol', keywords: ['quita','remueve','saca','retira','rol'], ejemplo: 'quita el rol de @Rol a @Usuario' },
  { id: 'crear_rol', keywords: ['crea','crear','nuevo','rol'], ejemplo: 'crea el rol Admin color rojo' },
  { id: 'borrar_rol', keywords: ['borra','elimina','rol'], ejemplo: 'borra el rol @Rol' },
  { id: 'listar_roles', keywords: ['lista','roles','ver.*roles'], ejemplo: 'lista los roles' },
  { id: 'dar_rol_todos', keywords: ['dar','rol','todos','everyone'], ejemplo: 'dale el rol @X a todos' },

  // === MODERACIÓN (20) ===
  { id: 'silenciar', keywords: ['silencia','mutea','silenciar','mutear','timeout','aisla','callar','mute'], ejemplo: 'silencia a @Usuario 10m' },
  { id: 'desilenciar', keywords: ['desilencia','desmutea','unmute','quita.*silencio','desaisla'], ejemplo: 'desilencia a @Usuario' },
  { id: 'ban', keywords: ['banea','banear','ban','baneo','bloquea.*usuario'], ejemplo: 'banea a @Usuario' },
  { id: 'unban', keywords: ['desbanea','unban','quita.*ban','perdona'], ejemplo: 'desbanea a 123456' },
  { id: 'kick', keywords: ['expulsa','kick','echa','saca','patada'], ejemplo: 'expulsa a @Usuario' },
  { id: 'warn', keywords: ['warn','advierte','avisa','amonesta'], ejemplo: 'warn a @Usuario por toxicidad' },
  { id: 'warns', keywords: ['warns','avisos','infracciones'], ejemplo: 'ver warns de @Usuario' },
  { id: 'clear', keywords: ['borra','limpia','clear','elimina.*mensajes','purge'], ejemplo: 'borra 50 mensajes' },
  { id: 'slowmode', keywords: ['slowmode','lento','ralentiza','cooldown.*canal'], ejemplo: 'pon slowmode 10s' },
  { id: 'lock', keywords: ['bloquea','cierra','lock','candado','canal'], ejemplo: 'bloquea el canal' },
  { id: 'unlock', keywords: ['desbloquea','abre','unlock'], ejemplo: 'desbloquea el canal' },
  { id: 'timeout', keywords: ['timeout','aisla','castiga'], ejemplo: 'timeout a @Usuario 1h' },
  { id: 'nuke', keywords: ['nuke','resetea.*canal'], ejemplo: 'nuke canal' },

  // === MECÁNICO / FACTURAS (5) ===
  { id: 'factura_crear', keywords: ['factura','cobra','emite','repara','taller'], ejemplo: 'haz factura de 5000 a @Usuario por reparacion' },
  { id: 'factura_lista', keywords: ['factura','lista','facturas','pendientes','ver.*facturas'], ejemplo: 'muestra facturas de @Usuario' },
  { id: 'factura_pagar', keywords: ['paga','pagar','factura'], ejemplo: 'paga la factura FAC-0001' },
  { id: 'reparar', keywords: ['repara','reparar','arregla','coche'], ejemplo: 'repara el coche de @Usuario' },
  { id: 'taximetro', keywords: ['taximetro','taxi','viaje'], ejemplo: 'taximetro on' },

  // === POLICÍA / PDA (15) ===
  { id: 'multar', keywords: ['multa','multar','sanciona','infraccion'], ejemplo: 'multa a @Usuario 500 por exceso' },
  { id: 'multas_ver', keywords: ['multas','ver.*multas','lista.*multas'], ejemplo: 'ver multas de @Usuario' },
  { id: 'pagar_multa', keywords: ['pagar','multa'], ejemplo: 'paga la multa MLT-2024-0001' },
  { id: 'esposar', keywords: ['esposa','esposar','arresta','deten'], ejemplo: 'esposa a @Usuario' },
  { id: 'desesposar', keywords: ['desesposa','quita.*esposas','libera'], ejemplo: 'desesposa a @Usuario' },
  { id: 'cachear', keywords: ['cachea','cachear','registra','revisa'], ejemplo: 'cachea a @Usuario' },
  { id: 'escoltar', keywords: ['escolta','lleva','acompaña'], ejemplo: 'escolta a @Usuario' },
  { id: 'placa', keywords: ['placa','crea.*placa','ver.*placa'], ejemplo: 'crea placa para @Usuario' },
  { id: 'ver_id', keywords: ['ver.*id','dni','identifica'], ejemplo: 'ver id de @Usuario' },
  { id: 'licencia', keywords: ['licencia','permiso','ver.*licencia'], ejemplo: 'ver licencia de @Usuario' },
  { id: 'poli_dispo', keywords: ['poli','disponible','servicio','dispo'], ejemplo: 'ponte disponible como poli' },
  { id: 'auxilio', keywords: ['auxilio','ayuda','911','emergencia'], ejemplo: 'pide auxilio' },
  { id: 'quitar_sucio', keywords: ['quita','sucio','limpia.*dinero'], ejemplo: 'quita dinero sucio a @Usuario' },

  // === BANDAS (10) ===
  { id: 'banda_info', keywords: ['banda','info','ver.*banda','gang'], ejemplo: 'ver info de la banda Black Cat' },
  { id: 'banda_crear', keywords: ['crea','banda','crear.*banda','fundar'], ejemplo: 'crea la banda Los Reyes tag REYES' },
  { id: 'banda_invitar', keywords: ['invita','añade','banda','recluta'], ejemplo: 'invita a @Usuario a la banda' },
  { id: 'banda_expulsar', keywords: ['expulsa','echa','banda','saca'], ejemplo: 'expulsa a @Usuario de la banda' },
  { id: 'banda_banco', keywords: ['banda','banco','depositar.*banda','retirar.*banda'], ejemplo: 'deposita 1000 en banco de banda' },
  { id: 'banda_promover', keywords: ['promueve','asciende','banda'], ejemplo: 'promueve a @Usuario en la banda' },
  { id: 'banda_territorio', keywords: ['territorio','zona','control'], ejemplo: 'ver territorios de la banda' },
  { id: 'banda_guerra', keywords: ['guerra','declara','ataca.*banda'], ejemplo: 'declara guerra a Los Santos' },

  // === JUGADOR / PERSONAJE (10) ===
  { id: 'personaje_ver', keywords: ['personaje','ver.*personaje','perfil'], ejemplo: 'ver personaje de @Usuario' },
  { id: 'personaje_crear', keywords: ['crea','personaje','nuevo.*personaje'], ejemplo: 'crea personaje Juan Lopez' },
  { id: 'curar_todos', keywords: ['cura.*todos','cura.*todo.*mundo','sana.*todos','revive.*todos','revivir.*todos','curar.*todos','cura.*mundo','sanar.*todos'], ejemplo: 'cura a todo el mundo' },
  { id: 'curar_usuario', keywords: ['cura','curar','sana','sanar','revive','revivir','resucita','reanimar','cura.*usuario'], ejemplo: 'cura a @Usuario' },
  { id: 'revivir', keywords: ['revive','revivir','curar','resucita','reanimar','cura'], ejemplo: 'revive a @Usuario' },
  { id: 'hospital', keywords: ['hospital','lleva.*hospital','manda.*hospital'], ejemplo: 'manda a @Usuario al hospital' },
  { id: 'set_trabajo', keywords: ['trabajo','empleo','asigna.*trabajo','contrata'], ejemplo: 'ponle trabajo policia a @Usuario' },
  { id: 'inventario', keywords: ['inventario','mochila','ver.*inventario','items'], ejemplo: 'ver inventario de @Usuario' },
  { id: 'ropa', keywords: ['ropa','vestimenta','cambia.*ropa'], ejemplo: 'cambia ropa' },
  { id: 'movil', keywords: ['movil','telefono','celular'], ejemplo: 'abre el movil' },

  // === VEHÍCULOS (5) ===
  { id: 'vehiculo_dar', keywords: ['vehiculo','coche','auto','dar.*vehiculo'], ejemplo: 'dale coche a @Usuario' },
  { id: 'vehiculo_sacar', keywords: ['saca','vehiculo','coche','garaje'], ejemplo: 'saca tu coche' },
  { id: 'vehiculo_guardar', keywords: ['guarda','vehiculo','garaje'], ejemplo: 'guarda el coche' },

  // === DROGAS / TIENDA / TRABAJO (10) ===
  { id: 'drogas', keywords: ['droga','planta','cultiva','siembra','maria','coca'], ejemplo: 'planta marihuana' },
  { id: 'tienda_comprar', keywords: ['compra','tienda','compra.*item'], ejemplo: 'compra pan' },
  { id: 'tienda_vender', keywords: ['vende','vender','tienda'], ejemplo: 'vende droga' },
  { id: 'trabajo', keywords: ['trabajo','trabaja','empleo','currar'], ejemplo: 'trabaja como taxista' },
  { id: 'atracar', keywords: ['atraca','roba','atraco','robo','asalta'], ejemplo: 'atraca la tienda badulaque' },
  { id: 'secuestrar', keywords: ['secuestra','secuestrar','rapto'], ejemplo: 'secuestra a @Usuario' },
  { id: 'allanar', keywords: ['allana','allanar','casa','roba.*casa'], ejemplo: 'allana casa en vinewood' },

  // === UTILIDADES / SISTEMA (15) ===
  { id: 'anuncio', keywords: ['anuncia','anuncio','aviso','broadcast','dice.*todos'], ejemplo: 'anuncia hola a todos' },
  { id: 'encuesta', keywords: ['encuesta','votacion','pregunta','poll'], ejemplo: 'crea encuesta si o no' },
  { id: 'serverinfo', keywords: ['info','servidor','server','datos.*servidor'], ejemplo: 'info del servidor' },
  { id: 'userinfo', keywords: ['info','usuario','perfil','quien.*es'], ejemplo: 'info de @Usuario' },
  { id: 'roleinfo', keywords: ['info','rol','role'], ejemplo: 'info del rol @Admin' },
  { id: 'help', keywords: ['ayuda','help','comandos','que.*puedes','lista.*comandos'], ejemplo: 'que puedes hacer' },
  { id: 'status', keywords: ['status','estado','servidor','online'], ejemplo: 'status del servidor' },
  { id: 'admin_on', keywords: ['admin','on','activa.*admin'], ejemplo: 'ponte admin on' },
  { id: 'admin_off', keywords: ['admin','off','desactiva.*admin'], ejemplo: 'admin off' },
  { id: 'pda', keywords: ['pda','policia','dashboard'], ejemplo: 'abre la pda' },
  { id: 'operativo', keywords: ['operativo','operacion','despliegue'], ejemplo: 'inicia operativo' },

  // === FALLBACK GENÉRICO ===
  { id: 'generic', keywords: [], ejemplo: '' },
];
