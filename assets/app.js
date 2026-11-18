/* ============================================================
   app.js · Web "Aliados ante el FEN 2026-2027" (EsSalud)
   La arquitectura (secciones, tipologías, niveles y lectura en vivo de Google Sheets)
   sigue la web de Aliados Estratégicos del MIDIS, que se reconoce como referencia.
   El pipeline del proyecto (documento interno) está en docs/pipeline.html.

   Bloques:
     W1 Configuración          W5 Mapa: dibujo, zoom, colores y EsSalud
     W2 Utilidades             W6 Panel lateral
     W3 Carga de datos         W7 Secciones (riesgos, escenarios, radar, demanda, aliados…)
     W4 Índices y cruces       W9 Eventos y arranque
   ============================================================ */
(function () {
'use strict';

/* ============================================================
   W1 · CONFIGURACIÓN
   ============================================================ */
// Hojas de Google que alimentan la web (compartidas como "cualquiera con el enlace: lector")
const HOJAS = {
  fen: '1YE-9gXDLxJOuHyfflAFxznstzzi1sihIF3RiLt6zp5c',      // FEN_2026_2027: Radar y Demanda
  aliados: '1NYboI4a8f3SYIUpmPrKBunqqmcSTwwL6GylItubkLIE'   // Identificacion_Aliados_Essalud
};
const PESTANA_HOJA = { Radar: 'fen', Demanda: 'fen', Aliados: 'aliados', Oferta: 'aliados', Tipologias: 'aliados' };
const REFRESCO_MS = 5 * 60 * 1000;   // relectura de las hojas cada 5 minutos

const PROB = { 'MEDIA': 1, 'ALTA': 2, 'MUY ALTA': 3 };                 // probabilidad → tono azul
const NIVEL = { 'BAJO': 1, 'MEDIO': 2, 'ALTO': 3, 'MUY ALTO': 4 };     // afectación → tono naranja
const NOM_PROB = ['', 'Media', 'Alta', 'Muy alta'];
const NOM_NIVEL = ['', 'Bajo', 'Medio', 'Alto', 'Muy alto'];
const NOM_NIVEL_ES = ['Sin categoría', 'Primer nivel (I)', 'Segundo nivel (II)', 'Tercer nivel (III)'];

// Íconos de los tipos de riesgo (trazos de 24×24; acompañan siempre al color)
const ICONO_RIESGO = {
  lluvias: '<path d="M7 15a4 4 0 0 1 .4-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  huaicos: '<path d="M3 20 10 8l4 6 2-3 5 9z"/><circle cx="17" cy="5.5" r="1.5"/><circle cx="20.5" cy="9" r="1"/>',
  sequia: '<circle cx="12" cy="9" r="3.5"/><path d="M12 2.5v1.2M5.5 9H4.3M19.7 9h-1.2M7.4 4.4l.8.8M16.6 4.4l-.8.8M3 20h18M8.5 20l1.5-2.5M14 20l-1-1.8 2-1"/>',
  calor: '<path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M12 9.5v7"/>',
  heladas: '<path d="M12 2v20M4 7l16 10M20 7 4 17M9 3.5l3 2 3-2M9 20.5l3-2 3 2"/>',
  mar: '<path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  dengue: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/>',
  otro: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>'
};
// Palabras clave para clasificar un fenómeno del radar si no coincide exactamente con la lista
const CLAVES_RIESGO = [['huaicos', /HUAICO|HUAYCO|DESLIZ|QUEBRADA|ROCA|LODO/], ['lluvias', /LLUVIA|INUND|DESBORD|PRECIPIT/],
  ['sequia', /SEQUIA|DEFICIT|VACIANTE|ESTIAJE/], ['heladas', /HELADA|FRIAJE|FRIO/], ['calor', /CALOR|INCENDIO|TEMPERATURA/],
  ['mar', /\bMAR\b|OLEAJE|MAREJADA|OLAS|PESCA/], ['dengue', /DENGUE|ENFERMEDAD|EPIDEM|LEPTOS|\bEDA|\bIRA|HEPATITIS|BROTE/]];

// Tipologías por defecto (se reemplazan por la pestaña Tipologias si existe).
// Donante, Voluntario, Logístico y Articulador: definiciones del MIDIS.
const TIPOS_BASE = [
  { k: 'Donante', c: '--don', o: 'MIDIS', d: 'Organización que proporciona gratuitamente bienes, recursos o servicios para atender las necesidades de la población afectada por emergencias.', e: 'Alimentos, agua, kits de higiene, frazadas, carpas, medicamentos y servicios especializados.' },
  { k: 'Voluntario', c: '--vol', o: 'MIDIS', d: 'Organización que moviliza personas para brindar apoyo voluntario mediante actividades físicas, técnicas o profesionales durante situaciones de emergencia.', e: 'Carga y descarga de bienes, distribución de ayuda, limpieza, remoción de escombros, atención psicológica y asistencia comunitaria.' },
  { k: 'Logístico', c: '--log', o: 'MIDIS', d: 'Organización que proporciona medios, infraestructura o servicios operativos para facilitar el traslado, almacenamiento y distribución de ayuda humanitaria.', e: 'Transporte terrestre, aéreo o marítimo, almacenes, vehículos, maquinaria pesada y distribución de suministros.' },
  { k: 'Articulador', c: '--art', o: 'MIDIS', d: 'Organización que facilita la coordinación y vinculación entre instituciones públicas, empresas y organizaciones de la sociedad civil para movilizar recursos y canalizar apoyo ante emergencias.', e: 'Convocatoria de donantes, coordinación de alianzas, identificación de recursos disponibles y vinculación entre quienes ofrecen apoyo y quienes lo requieren.' },
  { k: 'Financiero', c: '--fin', o: 'Propuesta EsSalud', d: 'Organización que aporta recursos financieros —donaciones dinerarias, fondos de emergencia o préstamos— para la respuesta o la recuperación.', e: 'Fondos de respuesta rápida, donaciones en efectivo, préstamos contingentes y financiamiento de la reconstrucción de establecimientos.' },
  { k: 'Técnico', c: '--tec', o: 'Propuesta EsSalud', d: 'Organización que aporta conocimiento especializado: expertos, asistencia técnica, capacitación o evaluación de daños en salud.', e: 'Equipos médicos de emergencia, epidemiólogos, evaluación de establecimientos de salud, protocolos y capacitación del personal.' }
];
const COLORES_EXTRA = ['--tec', '--fin', '--art', '--log', '--vol', '--don'];

// Niveles de emergencia del SINAGERD (tal como los presenta la web del MIDIS)
const NIVELES = [
  { n: 1, t: 'Afectación local', u: 'Distrital', a: 'Gobierno Local Distrital', c: '--lv1' },
  { n: 2, t: 'Afectación provincial', u: 'Provincial', a: 'Gobierno Local Provincial', c: '--lv2' },
  { n: 3, t: 'Afectación regional', u: 'Departamental', a: 'Gobierno Regional (GORE)', c: '--lv3' },
  { n: 4, t: 'Alta magnitud', u: 'Supera la capacidad regional', a: 'Gobierno Nacional (conduce INDECI)', c: '--lv4' },
  { n: 5, t: 'Catástrofe nacional', u: 'Nacional', a: 'Gobierno Nacional / Apoyo Internacional', c: '--lv5' }
];
const NOMBRE_DEP = { AMAZONAS: 'Amazonas', ANCASH: 'Áncash', APURIMAC: 'Apurímac', AREQUIPA: 'Arequipa', AYACUCHO: 'Ayacucho',
  CAJAMARCA: 'Cajamarca', CALLAO: 'Callao', CUSCO: 'Cusco', HUANCAVELICA: 'Huancavelica', HUANUCO: 'Huánuco', ICA: 'Ica',
  JUNIN: 'Junín', 'LA LIBERTAD': 'La Libertad', LAMBAYEQUE: 'Lambayeque', LIMA: 'Lima', LORETO: 'Loreto',
  'MADRE DE DIOS': 'Madre de Dios', MOQUEGUA: 'Moquegua', PASCO: 'Pasco', PIURA: 'Piura', PUNO: 'Puno',
  'SAN MARTIN': 'San Martín', TACNA: 'Tacna', TUMBES: 'Tumbes', UCAYALI: 'Ucayali' };

/* ============================================================
   W2 · UTILIDADES
   ============================================================ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
// norm(): mayúsculas sin tildes, para comparar textos ('Logístico' = 'LOGISTICO')
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const normSig = s => norm(s).replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();   // además sin signos
const PEQ = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'en']);
// titulo(): 'SAN JUAN DE LURIGANCHO' → 'San Juan de Lurigancho'
const titulo = s => String(s || '').toLowerCase().split(' ').map((w, i) => (i && PEQ.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const nombreDep = n => NOMBRE_DEP[n] || titulo(n);
const num = v => { const x = parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '')); return isFinite(x) ? x : null; };
const fmt = v => v == null ? '' : v.toLocaleString('es-PE');

// parseCSV(): convierte el texto CSV en una lista de filas (respeta comillas y saltos de línea)
function parseCSV(t) {
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
    else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fila.push(campo); campo = ''; filas.push(fila); fila = []; }
    else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
// aObjetos(): usa la primera fila como nombres de columna y descarta filas vacías
//   Antes: [['id','lugar'],['N-1','PIURA (20)']] | Después: [{id:'N-1', lugar:'PIURA (20)'}]
function aObjetos(filas) {
  if (!filas.length) return [];
  const cab = filas[0].map(h => h.trim().toLowerCase());
  return filas.slice(1).filter(f => f.some(v => String(v).trim())).map(f => {
    const o = {}; cab.forEach((h, i) => { if (h) o[h] = String(f[i] ?? '').trim(); }); return o;
  });
}
// codigoDe(): lee el código UBIGEO al final de la etiqueta del desplegable
//   'PIURA › SULLANA › BELLAVISTA (200602)' → '200602'
function codigoDe(lugar) {
  const m = String(lugar || '').match(/\((\d{2}|\d{4}|\d{6})\)\s*$/) || String(lugar || '').trim().match(/^(\d{2}|\d{4}|\d{6})$/);
  return m ? m[1] : '';
}
// fechaISO(): acepta 2026-12-05 o 5/12/2026 y devuelve 2026-12-05 (para ordenar)
function fechaISO(v) {
  const s = String(v || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
const fechaTxt = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const cubre = (cod, u) => !!cod && (cod === '00' || u.startsWith(cod));   // ¿el código cubre al distrito u?
const icono = (k, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 24 24" aria-hidden="true">${ICONO_RIESGO[k] || ICONO_RIESGO.otro}</svg>`;

/* ============================================================
   W3 · CARGA DE DATOS
   Insumo: datos/*.json (fijos) + pestañas de Google Sheets (en vivo) o datos/copia/*.csv
   Resultado: listas radar, demanda, aliados, oferta, tipologías
   ============================================================ */
let MAPA = null, HIST = null, ESS = null, RIESGOS = [];
let radar = [], demanda = [], aliados = [], oferta = [], tipos = TIPOS_BASE.slice();
let modo = 'copia', cargadoEn = null, avisoHojas = '';
const avisos = [];

async function cargarPestana(nombre) {
  const id = HOJAS[PESTANA_HOJA[nombre]];
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(nombre)}`, { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    if (/^\s*</.test(t)) throw new Error('la hoja no es pública');
    return { filas: aObjetos(parseCSV(t)), vivo: true };
  } catch (e) {
    console.warn('[aliados] hoja', nombre, e && e.message);
    try {
      const r = await fetch('datos/copia/' + nombre.toLowerCase() + '.csv', { cache: 'no-store' });
      return { filas: r.ok ? aObjetos(parseCSV(await r.text())) : [], vivo: false };
    } catch (e2) { return { filas: [], vivo: false }; }
  }
}
// riesgoDe(): clasifica un fenómeno del radar en uno de los 7 tipos de riesgo del FEN
function riesgoDe(fen) {
  const s = normSig(fen); if (!s) return 'otro';
  for (const r of RIESGOS) if (r.fenomenos_radar.some(f => normSig(f) === s)) return r.clave;
  for (const [k, re] of CLAVES_RIESGO) if (re.test(s)) return k;
  return 'otro';
}

async function cargarHojas() {
  const nombres = ['Radar', 'Demanda', 'Aliados', 'Oferta', 'Tipologias'];
  const res = await Promise.all(nombres.map(cargarPestana));
  const R = {}; nombres.forEach((n, i) => R[n] = res[i]);
  const vivas = res.filter(r => r.vivo).length;
  modo = vivas === nombres.length ? 'vivo' : (vivas ? 'parcial' : 'copia');
  avisoHojas = modo === 'vivo' ? '' : 'No se pudo leer en vivo alguna hoja: se muestra la copia guardada en el repositorio.';
  cargadoEn = new Date();
  avisos.length = 0;

  // --- Radar: una fila por noticia y lugar ---
  radar = R.Radar.filas.map(r => ({
    id: r.id_noticia, fecha: fechaISO(r.fecha_noticia), lugar: r.lugar, cod: codigoDe(r.lugar),
    fen: r.fenomeno, riesgo: riesgoDe(r.fenomeno), nivel: NIVEL[norm(r.nivel_afectacion)] || 0, salud: r.afectacion_salud, resumen: r.resumen,
    personas: num(r.personas_afectadas), fallecidos: num(r.fallecidos), viviendas: num(r.viviendas_afectadas), eess: num(r.eess_afectados),
    essalud: r.establecimiento_essalud, medio: r.medio, tipo_fuente: r.tipo_fuente, enlace: r.enlace, verificado: r.verificado
  })).filter(r => r.lugar || r.resumen);
  // --- Demanda de cooperación ---
  demanda = R.Demanda.filas.map(r => ({
    id: r.id_demanda, fecha: fechaISO(r.fecha_identificacion), lugar: r.lugar, cod: codigoDe(r.lugar), red: r.red_asistencial,
    eess: r.establecimiento, cat: r.categoria, desc: r.descripcion, cantidad: num(r.cantidad), unidad: r.unidad,
    monto: num(r.monto_estimado), moneda: r.moneda, prioridad: r.prioridad, tipo: r.tipologia_requerida, estado: r.estado,
    asignado: r.aliado_asignado, origen: r.origen
  })).filter(r => r.lugar || r.desc);
  // --- Oferta: una fila por apoyo y lugar ---
  oferta = R.Oferta.filas.map(r => ({
    id: r.id_oferta, aliado: r.aliado, tipo: r.tipologia, cat: r.categoria, desc: r.descripcion, lugar: r.cobertura, cod: codigoDe(r.cobertura),
    modalidad: r.modalidad, cantidad: num(r.cantidad), unidad: r.unidad, monto: num(r.monto_estimado), moneda: r.moneda,
    desde: fechaISO(r.disponible_desde), hasta: fechaISO(r.disponible_hasta), estado: r.estado_oferta
  })).filter(r => r.aliado);
  // --- Tipologías: de la hoja, o las de base ---
  const tHoja = R.Tipologias.filas.filter(r => r.tipologia);
  if (tHoja.length) {
    let extra = 0;
    tipos = tHoja.map(r => {
      const base = TIPOS_BASE.find(t => norm(t.k) === norm(r.tipologia));
      return { k: r.tipologia, d: r.definicion || (base && base.d) || '', e: r.ejemplos || (base && base.e) || '', o: r.origen || (base && base.o) || '', c: base ? base.c : COLORES_EXTRA[extra++ % COLORES_EXTRA.length] };
    });
  } else tipos = TIPOS_BASE.slice();
  // --- Aliados (se suman los que solo aparecen en Oferta) ---
  const vistos = new Map();
  R.Aliados.filas.filter(r => r.nombre).forEach(r => vistos.set(norm(r.nombre), {
    id: r.id_aliado, nombre: r.nombre, siglas: r.siglas, actor: r.tipo_actor, pais: r.pais_origen,
    tipos: String(r.tipologias || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(canonTipo),
    web: r.sitio_web, estado: r.estado_relacion, nivelEm: r.nivel_emergencia, logo: r.logo_url
  }));
  oferta.forEach(o => {
    if (!vistos.has(norm(o.aliado))) { vistos.set(norm(o.aliado), { nombre: o.aliado, tipos: [] }); avisos.push(`«${o.aliado}» tiene oferta pero no está en la pestaña Aliados.`); }
  });
  aliados = [...vistos.values()];
  aliados.forEach(a => {
    a.ofertas = oferta.filter(o => norm(o.aliado) === norm(a.nombre));
    a.ofertas.forEach(o => { if (o.tipo) { const t = canonTipo(o.tipo); if (!a.tipos.includes(t)) a.tipos.push(t); } });
    a.codigos = [...new Set(a.ofertas.map(o => o.cod).filter(Boolean))];
    a.deps = new Set();
    a.codigos.forEach(c => { if (c === '00') MAPA.dep.forEach(d => a.deps.add(d.c)); else a.deps.add(c.slice(0, 2)); });
  });
  aliados.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));

  // --- Lugares no reconocidos ---
  const malos = [...radar, ...demanda, ...oferta].filter(r => r.lugar && !lugarValido(r.cod)).length;
  if (malos) avisos.push(`${malos} fila(s) tienen un lugar que no está en la lista y no aparecen en el mapa. Elige el lugar del desplegable.`);
}
const canonTipo = t => { const x = tipos.find(y => norm(y.k) === norm(t)) || TIPOS_BASE.find(y => norm(y.k) === norm(t)); return x ? x.k : t; };

/* ============================================================
   W4 · ÍNDICES Y CRUCES
   ============================================================ */
const disPorU = {}, depPorC = {}, provNombre = {}, ESC = {}, esPorU = {};
let histU = {}, actU = {};
const lugarPorEtiqueta = {};
const riesgoPorClave = k => RIESGOS.find(r => r.clave === k) || { clave: 'otro', nombre: 'Otro fenómeno' };

function indexarMapa() {
  MAPA.dep.forEach(d => { depPorC[d.c] = d; d.nombre = nombreDep(d.n); d.total = 0; });
  MAPA.dis.forEach(d => {
    disPorU[d.u] = d; d.c = d.u.slice(0, 2); provNombre[d.u.slice(0, 4)] = d.pr; depPorC[d.c].total++;
    lugarPorEtiqueta[`${titulo(d.n)}, ${titulo(d.pr)} (${depPorC[d.c].nombre})`] = { tipo: 'dis', u: d.u };
  });
  MAPA.dep.forEach(d => { lugarPorEtiqueta[`${d.nombre} (departamento)`] = { tipo: 'dep', c: d.c }; });
  $('lista-lugares').innerHTML = Object.keys(lugarPorEtiqueta).sort((a, b) => a.localeCompare(b, 'es')).map(e => `<option value="${esc(e)}">`).join('');
}
const lugarValido = c => !!c && (c === '00' || (c.length === 2 && depPorC[c]) || (c.length === 4 && provNombre[c]) || (c.length === 6 && disPorU[c]));
function nombreLugar(c) {
  if (!c) return '';
  if (c === '00') return 'Todo el país';
  const dep = depPorC[c.slice(0, 2)]; const dn = dep ? dep.nombre : c;
  if (c.length === 2) return dn;
  if (c.length === 4) return `Provincia ${titulo(provNombre[c] || c)} (${dn})`;
  const d = disPorU[c]; return d ? `${titulo(d.n)}, ${titulo(d.pr)} (${dn})` : c;
}
// Capa FEN histórico: escenarios de cada distrito
function indexarHistorico() {
  histU = {};
  RIESGOS = HIST.riesgos || [];
  HIST.escenarios.forEach(e => {
    e.p = PROB[norm(e.probabilidad)] || 1; e.nombSet = new Set(e.nombrados || []); e.riesgos = e.riesgos || [];
    ESC[e.id] = e;
    e.ubigeos.forEach(u => { (histU[u] = histU[u] || { esc: [] }).esc.push(e.id); });
  });
}
// Capa FEN 2026-27: por distrito, nivel máximo (en general y por tipo de riesgo) y número de reportes
function indexarActual() {
  actU = {};
  radar.forEach(r => {
    if (!lugarValido(r.cod)) return;
    const lista = r.cod.length === 6 ? [r.cod] : MAPA.dis.filter(d => cubre(r.cod, d.u)).map(d => d.u);
    lista.forEach(u => {
      const a = actU[u] || (actU[u] = { n: 0, k: 0, porR: {} });
      const nv = r.nivel || 1;
      a.n = Math.max(a.n, nv); a.k++; a.porR[r.riesgo] = Math.max(a.porR[r.riesgo] || 0, nv);
    });
  });
}
// Establecimientos de EsSalud por distrito declarado (UBIGEO)
function indexarEsSalud() {
  ESS.establecimientos.forEach((e, i) => { e.i = i; (esPorU[e.u] = esPorU[e.u] || []).push(e); });
}
// Valor de cada capa en un distrito, según los filtros activos (0 = nada)
function valorHist(u, riesgo) {
  const h = histU[u]; if (!h || (!st.hist && !st.esc)) return 0;
  const rk = riesgo === undefined ? st.riesgo : riesgo;
  let p = 0;
  for (const id of h.esc) {
    const e = ESC[id];
    if (st.esc && e.id !== st.esc) continue;
    if (st.soloNomb && !e.nombSet.has(u)) continue;
    if (rk && !e.riesgos.includes(rk)) continue;
    p = Math.max(p, e.p);
  }
  return p;
}
function valorAct(u, riesgo) {
  const a = actU[u]; if (!a || !st.act || st.esc) return 0;
  const rk = riesgo === undefined ? st.riesgo : riesgo;
  return rk ? (a.porR[rk] || 0) : a.n;
}
const enRiesgo = (u, riesgo) => !!(valorHist(u, riesgo) || valorAct(u, riesgo));
// Tipos de riesgo presentes en un distrito (sin filtrar por tipo)
function riesgosDe(u) {
  const s = new Set();
  (histU[u] ? histU[u].esc : []).forEach(id => { const e = ESC[id]; if (!st.soloNomb || e.nombSet.has(u)) e.riesgos.forEach(r => s.add(r)); });
  if (actU[u]) Object.keys(actU[u].porR).forEach(r => s.add(r));
  return RIESGOS.map(r => r.clave).filter(k => s.has(k)).concat(s.has('otro') ? ['otro'] : []);
}
// Aliados visibles según tipología, búsqueda y foco
function aliadosVisibles() {
  const q = norm(st.q);
  return aliados.filter(a =>
    (!st.tipos.size || a.tipos.some(t => st.tipos.has(norm(t)))) &&
    (!st.aliado || a.nombre === st.aliado) &&
    (!q || norm([a.nombre, a.siglas, a.pais, a.actor, ...a.ofertas.map(o => o.desc + ' ' + o.cat)].join(' ')).includes(q)));
}
const aliadosEn = (u, lista) => (lista || aliadosVisibles()).filter(a => a.codigos.some(c => cubre(c, u) || (u.length < 6 && c.startsWith(u))));
// Cruce demanda ↔ oferta: misma categoría y lugar compatible
function posiblesOfertas(dm) {
  return oferta.filter(o => o.cat && norm(o.cat) === norm(dm.cat) && o.cod && dm.cod &&
    (o.cod === '00' || dm.cod.startsWith(o.cod) || o.cod.startsWith(dm.cod)));
}

/* ============================================================
   W5 · MAPA: DIBUJO, ZOOM, COLORES Y ESTABLECIMIENTOS
   ============================================================ */
const st = { hist: true, act: true, es: true, soloNomb: false, riesgo: null, tipos: new Set(), q: '', dep: null, dis: null, aliado: null, esc: null };
let vb = null, vbPeru = null, pathsDis = [], puntosEs = [], svg = null, animacion = 0;

function construirMapa() {
  svg = $('map');
  vbPeru = MAPA.vb.slice(); vb = vbPeru.slice();
  // proporción fija del recuadro: así su tamaño no cambia al acercarse o alejarse
  svg.style.aspectRatio = `${vbPeru[2]} / ${vbPeru[3]}`;
  let h = `<defs><pattern id="rayas" patternUnits="userSpaceOnUse" width="80" height="80" patternTransform="rotate(45)">
      <rect width="40" height="80" style="fill:var(--hist)"/><rect x="40" width="40" height="80" style="fill:var(--act)"/></pattern></defs>`;
  h += '<g id="g-dis">' + MAPA.dis.map(d => `<path class="d" d="${d.p}" data-u="${d.u}"></path>`).join('') + '</g>';
  h += '<g id="g-dep">' + MAPA.dep.map(d => `<path class="dep" d="${d.p}" data-c="${d.c}"></path>`).join('') + '</g>';
  h += '<g id="g-es">' + ESS.establecimientos.filter(e => e.x != null).map(e => `<circle class="es" cx="${e.x}" cy="${e.y}" r="0" data-i="${e.i}"></circle>`).join('') + '</g>';
  h += '<g id="g-bub">' + MAPA.dep.map(d => `<g class="bub" data-c="${d.c}" transform="translate(${d.lc[0]} ${d.lc[1]})"><circle r="0"></circle><text></text></g>`).join('') + '</g>';
  h += '<g id="g-lab">' + MAPA.dep.map(d => `<text class="dn" data-c="${d.c}" x="${d.lc[0]}" y="${d.lc[1]}">${esc(d.nombre)}</text>`).join('') + '</g>';
  svg.innerHTML = h;
  pathsDis = [...svg.querySelectorAll('path.d')];
  puntosEs = [...svg.querySelectorAll('circle.es')];
  aplicarVB();
}
// Ajusta el encuadre (viewBox) y el tamaño de textos, círculos, puntos y rayas a la escala actual
function aplicarVB() {
  svg.setAttribute('viewBox', vb.map(v => Math.round(v)).join(' '));
  const k = vb[2] / Math.max(1, svg.clientWidth || 600);   // unidades del dibujo por píxel
  svg.querySelectorAll('.dn').forEach(t => {
    const d = depPorC[t.dataset.c];
    t.setAttribute('font-size', 12 * k); t.setAttribute('stroke-width', 3 * k); t.setAttribute('y', d.lc[1] + 30 * k);
  });
  svg.querySelectorAll('.bub').forEach(g => {
    g.querySelector('circle').setAttribute('r', g.dataset.n > 0 ? 13 * k : 0);
    g.querySelector('circle').setAttribute('stroke-width', 2 * k);
    g.querySelector('text').setAttribute('font-size', 13 * k);
  });
  const radio = [2.4, 2.4, 3.6, 5.2];   // tamaño del punto según nivel de atención (px)
  puntosEs.forEach(c => { const e = ESS.establecimientos[c.dataset.i]; c.setAttribute('r', st.es ? radio[e.nv] * k : 0); c.setAttribute('stroke-width', 1.2 * k); });
  const p = svg.querySelector('#rayas'); if (p) { const w = 9 * k; p.setAttribute('width', w); p.setAttribute('height', w); p.querySelectorAll('rect').forEach((r, i) => { r.setAttribute('width', w / 2); r.setAttribute('height', w); r.setAttribute('x', i ? w / 2 : 0); }); }
}
// Lleva el encuadre a una caja [x, y, ancho, alto] con una pequeña animación
function irA(caja, margen) {
  const ar = (svg.clientHeight || 1) / Math.max(1, svg.clientWidth || 1);
  let [x, y, w, h] = caja; const m = margen ?? 0.08;
  x -= w * m; y -= h * m; w *= 1 + 2 * m; h *= 1 + 2 * m;
  if (h / w > ar) { const nw = h / ar; x -= (nw - w) / 2; w = nw; } else { const nh = w * ar; y -= (nh - h) / 2; h = nh; }
  const ini = vb.slice(), fin = [x, y, w, h], t0 = performance.now(), dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380;
  const id = ++animacion;
  (function paso(t) {
    if (id !== animacion) return;
    const f = dur ? Math.min(1, Math.max(0, (t - t0) / dur)) : 1, e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    vb = ini.map((v, i) => v + (fin[i] - v) * e); aplicarVB(); if (f < 1) requestAnimationFrame(paso);
  })(t0);
  // respaldo: si el navegador no anima (pestaña en segundo plano), se aplica el encuadre final
  setTimeout(() => { if (id === animacion) { vb = fin; aplicarVB(); } }, dur + 80);
}
const verPeru = () => irA(vbPeru, 0.01);
function zoom(factor) { const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = vb[2] / factor, h = vb[3] / factor; irA([cx - w / 2, cy - h / 2, w, h], 0); }

// pintar(): colorea cada distrito según las capas y el tipo de riesgo elegidos
function pintar() {
  for (const p of pathsDis) {
    const u = p.dataset.u, h = valorHist(u), a = valorAct(u);
    if (st.riesgo) p.style.fill = (h || a) ? `var(--r-${st.riesgo})` : 'var(--land)';          // un riesgo: su color
    else p.style.fill = h && a ? 'url(#rayas)' : h ? `var(--h${h})` : a ? `var(--a${a})` : 'var(--land)';   // todos: por fuente
    p.classList.toggle('sel', st.dis === u);
    p.style.opacity = st.dep && u.slice(0, 2) !== st.dep ? .55 : 1;
  }
  puntosEs.forEach(c => { const e = ESS.establecimientos[c.dataset.i]; c.classList.toggle('expuesto', enRiesgo(e.u)); });
  const vis = aliadosVisibles();
  svg.querySelectorAll('.dep').forEach(d => {
    d.classList.toggle('sel', st.dep === d.dataset.c);
    d.classList.toggle('cubre', !!st.aliado && vis.some(a => a.deps.has(d.dataset.c)));
  });
  svg.querySelectorAll('.bub').forEach(g => {
    const n = vis.filter(a => a.deps.has(g.dataset.c)).length;
    g.dataset.n = n; g.querySelector('text').textContent = n || '';
  });
  aplicarVB();
  // Leyenda: solo lo que está visible
  const ley = [];
  if (st.riesgo) {
    const r = riesgoPorClave(st.riesgo);
    ley.push(`<span class="grp"><i style="background:var(--r-${r.clave})"></i>${icono(r.clave, 'ic-ley')}<b>${esc(r.nombre)}</b> (${[st.hist && 'matriz', st.act && 'radar 2026-27'].filter(Boolean).join(' y ') || 'sin capas activas'})</span>`);
  } else {
    if (st.hist || st.esc) ley.push(`<span class="grp"><b>FEN histórico</b> (probabilidad):${[1, 2, 3].map(i => `<i style="background:var(--h${i})"></i>${NOM_PROB[i]}`).join(' ')}</span>`);
    if (st.act && !st.esc) ley.push(`<span class="grp"><b>FEN 2026-27</b> (afectación):${[1, 2, 3, 4].map(i => `<i style="background:var(--a${i})"></i>${NOM_NIVEL[i]}`).join(' ')}</span>`);
    if (st.hist && st.act && !st.esc) ley.push(`<span class="grp"><i class="rayas"></i>Ambas capas</span>`);
  }
  ley.push(`<span class="grp"><i style="background:var(--land)"></i>Sin datos</span>`);
  if (st.es) ley.push(`<span class="grp"><svg width="34" height="14" aria-hidden="true"><circle cx="6" cy="7" r="4.5" class="es expuesto" stroke-width="1.2"/><circle cx="22" cy="7" r="4.5" class="es" stroke-width="1.2"/></svg>EsSalud: en zona con riesgo / fuera (tamaño = nivel de atención)</span>`);
  ley.push(`<span class="grp"><svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="var(--surface)" stroke="var(--navy-2)" stroke-width="2"/></svg>Aliados que pueden apoyar</span>`);
  $('leyenda').innerHTML = ley.join('');
}
function seleccionarDep(c) {
  st.dep = c; st.dis = null; render();
  if (c) irA(depPorC[c].bb); else verPeru();
}
function seleccionarDis(u) {
  const c = u.slice(0, 2);
  if (st.dep !== c) { st.dep = c; irA(depPorC[c].bb); }
  st.dis = (st.dis === u ? null : u); render();
}

/* ============================================================
   W6 · PANEL LATERAL
   ============================================================ */
function etiquetaProb(p) { return `<span class="prob" style="--c:var(--h${p})"><i></i>${NOM_PROB[p]}</span>`; }
function etiquetaNivel(n) { return n ? `<span class="nv" style="--c:var(--a${n})"><i></i>${NOM_NIVEL[n]}</span>` : '<span class="muted">sin nivel</span>'; }
function etiquetaTipo(t) { const x = tipos.find(y => norm(y.k) === norm(t)); return `<span class="tag" style="--c:var(${x ? x.c : '--muted'})"><i></i>${esc(t)}</span>`; }
function etiquetaRiesgo(k) { const r = riesgoPorClave(k); return `<span class="tag riesgo" style="--c:var(--r-${r.clave})">${icono(r.clave)}${esc(r.nombre)}</span>`; }
function avatar(a) {
  const ini = (a.siglas || a.nombre.replace(/\(.*?\)/g, '').split(/\s+/).filter(w => w && !PEQ.has(w.toLowerCase())).slice(0, 2).map(w => w[0]).join('')).slice(0, 4).toUpperCase();
  return `<span class="av" aria-hidden="true">${esc(ini)}${a.logo ? `<img src="${esc(a.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}
function bloque(titulo, color, cuerpo) { return `<div class="blk-p"><h3>${color ? `<i style="--c:var(${color})"></i>` : ''}${titulo}</h3>${cuerpo}</div>`; }
const vacio = t => `<div class="empty">${t}</div>`;

function itemsHistorico(lista, u) {
  return lista.length ? lista.map(e => `<div class="item"><div class="meta">Escenario ${e.id} · ${etiquetaProb(e.p)} · ${esc(e.periodo)}</div>
    <p>${esc(e.fenomeno)}</p><div class="tags">${e.riesgos.map(etiquetaRiesgo).join('')}</div>${u ? `<div class="meta">${e.nombSet.has(u) ? 'Distrito nombrado en la matriz' : 'Incluido porque la matriz nombra su provincia o departamento completo'}</div>` : ''}
    <button class="lnk" data-esc="${e.id}">Ver escenario en el mapa</button></div>`).join('') : vacio('Sin escenarios de la matriz en esta zona.');
}
function itemsRadar(lista) {
  return lista.length ? lista.slice(0, 8).map(r => `<div class="item"><div class="meta">${fechaTxt(r.fecha)} · ${esc(nombreLugar(r.cod) || r.lugar)}</div>
    <p><b>${esc(r.fen)}</b> · ${etiquetaNivel(r.nivel)}</p><div class="tags">${etiquetaRiesgo(r.riesgo)}</div>${r.resumen ? `<p>${esc(r.resumen)}</p>` : ''}
    ${r.enlace ? `<a href="${esc(r.enlace)}" target="_blank" rel="noopener">${esc(r.medio || 'Ver noticia')}</a>` : `<span class="meta">${esc(r.medio)}</span>`}</div>`).join('')
    + (lista.length > 8 ? `<p class="muted">y ${lista.length - 8} más en la sección Radar.</p>` : '') : vacio('Aún no hay noticias registradas para esta zona.');
}
function itemsDemanda(lista) {
  return lista.length ? lista.map(d => { const pos = posiblesOfertas(d); return `<div class="item"><div class="meta">${esc(d.cat)} · prioridad ${esc((d.prioridad || '–').toLowerCase())} · ${esc(d.estado || 'sin estado')}</div>
    <p>${esc(d.desc)}</p><div class="meta">${esc(nombreLugar(d.cod) || d.lugar)}${d.eess ? ' · ' + esc(d.eess) : ''}</div>
    <div class="meta">${pos.length ? 'Posibles aliados: ' + [...new Set(pos.map(o => o.aliado))].map(esc).join(', ') : 'Sin oferta que coincida aún'}</div></div>`; }).join('') : vacio('Sin necesidades registradas para esta zona.');
}
function itemsAliados(lista, u) {
  return lista.length ? lista.map(a => { const of = a.ofertas.filter(o => cubre(o.cod, u) || o.cod.startsWith(u)); return `<div class="item">
    <p><button class="lnk" data-aliado="${esc(a.nombre)}">${esc(a.nombre)}</button></p><div class="tags">${a.tipos.map(etiquetaTipo).join('')}</div>
    ${of.slice(0, 3).map(o => `<div class="meta">${esc(o.cat)}: ${esc(o.desc)}</div>`).join('')}</div>`; }).join('') : vacio('Aún no hay aliados con oferta en esta zona.');
}
function itemsEsSalud(lista) {
  if (!lista.length) return vacio('Sin establecimientos de EsSalud activos en esta zona.');
  const orden = lista.slice().sort((a, b) => b.nv - a.nv || a.n.localeCompare(b.n, 'es'));
  return orden.slice(0, 12).map(e => `<div class="item es-item"><span class="punto ${enRiesgo(e.u) ? 'expuesto' : ''}" aria-hidden="true"></span><div>
    <p><b>${esc(titulo(e.n))}</b></p><div class="meta">${esc(e.ca && e.ca !== '0' ? 'Categoría ' + e.ca : 'Sin categoría')} · ${esc(titulo(e.cl || ''))}${e.u ? ' · ' + esc(nombreLugar(e.u)) : ''}</div>
    <div class="meta">${enRiesgo(e.u) ? 'En distrito con riesgo FEN: ' + riesgosDe(e.u).map(k => esc(riesgoPorClave(k).nombre.toLowerCase())).join(', ') : 'Sin riesgo FEN registrado en su distrito'}${e.x == null ? ' · sin coordenadas en el RENIPRESS' : ''}</div></div></div>`).join('')
    + (orden.length > 12 ? `<p class="muted">y ${orden.length - 12} más.</p>` : '');
}

function renderPanel() {
  const p = $('panel'); const vis = aliadosVisibles();
  if (st.dis) {   // --- Distrito ---
    const d = disPorU[st.dis], dep = depPorC[d.c];
    const escs = (histU[st.dis] ? histU[st.dis].esc : []).map(id => ESC[id]);
    const rad = radar.filter(r => cubre(r.cod, st.dis)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const dem = demanda.filter(x => cubre(x.cod, st.dis) && x.cod !== '00');
    const rs = riesgosDe(st.dis);
    p.innerHTML = `<div class="ph"><div><h2>${esc(titulo(d.n))}</h2><div class="muted">Provincia ${esc(titulo(d.pr))} · ${esc(dep.nombre)} · UBIGEO ${d.u}</div></div>
      <button class="btn" data-volver="dep">← ${esc(dep.nombre)}</button></div>
      ${rs.length ? `<div class="tags" style="margin-bottom:6px">${rs.map(etiquetaRiesgo).join('')}</div>` : ''}` +
      bloque('FEN histórico', '--hist', itemsHistorico(escs, st.dis)) + bloque('Radar FEN 2026-27', '--act', itemsRadar(rad)) +
      bloque('Establecimientos de EsSalud', '', itemsEsSalud(esPorU[st.dis] || [])) +
      bloque('Demanda de cooperación', '', itemsDemanda(dem)) + bloque('Aliados que pueden apoyar aquí', '', itemsAliados(aliadosEn(st.dis, vis), st.dis));
    return;
  }
  if (st.dep) {   // --- Departamento ---
    const dep = depPorC[st.dep], us = MAPA.dis.filter(d => d.c === st.dep).map(d => d.u);
    const nh = us.filter(u => valorHist(u)).length, na = us.filter(u => valorAct(u)).length;
    const escs = HIST.escenarios.filter(e => e.ubigeos.some(u => u.startsWith(st.dep)) && (!st.riesgo || e.riesgos.includes(st.riesgo)));
    const rad = radar.filter(r => r.cod && (r.cod === '00' || r.cod.startsWith(st.dep)) && (!st.riesgo || r.riesgo === st.riesgo)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const dem = demanda.filter(x => x.cod && x.cod.startsWith(st.dep));
    const ali = vis.filter(a => a.deps.has(st.dep));
    const es = ESS.establecimientos.filter(e => e.u.startsWith(st.dep)), esx = es.filter(e => enRiesgo(e.u));
    p.innerHTML = `<div class="ph"><div><h2>${esc(dep.nombre)}</h2><div class="muted">${dep.total} distritos · toca uno para ver su detalle</div></div><button class="btn" data-volver="peru">Ver todo el Perú</button></div>
      <div class="kpis"><div><b>${nh}</b><span>distritos FEN histórico</span></div><div><b>${na}</b><span>distritos con reportes</span></div><div><b>${esx.length}<small>/${es.length}</small></b><span>EsSalud en zona de riesgo</span></div><div><b>${ali.length}</b><span>aliados</span></div></div>` +
      bloque('FEN histórico', '--hist', itemsHistorico(escs)) + bloque('Radar FEN 2026-27', '--act', itemsRadar(rad)) +
      bloque('Establecimientos de EsSalud', '', itemsEsSalud(es)) +
      bloque('Demanda de cooperación', '', itemsDemanda(dem)) + bloque('Aliados con oferta aquí', '', itemsAliados(ali, st.dep));
    return;
  }
  // --- Todo el Perú: ranking de departamentos ---
  const filas = MAPA.dep.map(d => {
    const us = MAPA.dis.filter(x => x.c === d.c).map(x => x.u);
    return { d, h: us.filter(u => valorHist(u)).length, a: us.filter(u => valorAct(u)).length,
      es: ESS.establecimientos.filter(e => e.u.startsWith(d.c) && enRiesgo(e.u)).length, al: vis.filter(a => a.deps.has(d.c)).length };
  }).sort((x, y) => y.h - x.h || y.a - x.a || x.d.nombre.localeCompare(y.d.nombre, 'es'));
  const max = Math.max(1, ...filas.map(f => f.h));
  let cab = '';
  if (st.esc) { const e = ESC[st.esc]; cab = `<div class="item" style="margin-bottom:14px"><div class="meta">Escenario ${e.id} · ${etiquetaProb(e.p)}</div><p><b>${esc(e.fenomeno)}</b></p><div class="tags">${e.riesgos.map(etiquetaRiesgo).join('')}</div><div class="meta">${esc(e.departamento)} · ${esc(e.periodo)}</div></div>`; }
  if (st.aliado) { const a = aliados.find(x => x.nombre === st.aliado); if (a) cab = `<div class="item" style="margin-bottom:14px"><p><b>${esc(a.nombre)}</b></p><div class="tags">${a.tipos.map(etiquetaTipo).join('')}</div>${a.ofertas.map(o => `<div class="meta">${esc(o.cat)} · ${esc(nombreLugar(o.cod))}: ${esc(o.desc)}</div>`).join('')}</div>`; }
  if (st.riesgo && !cab) { const r = riesgoPorClave(st.riesgo); cab = `<div class="item" style="margin-bottom:14px">${etiquetaRiesgo(r.clave)}<p>${esc(r.descripcion || '')}</p><div class="meta">Periodo crítico: ${esc(r.periodo_critico || '')}</div></div>`; }
  p.innerHTML = cab + `<div class="ph"><div><h2>Departamentos</h2><div class="muted">Distritos marcados en cada capa, establecimientos de EsSalud en zona de riesgo y aliados. Toca uno para acercarte.</div></div></div>
    <ul class="rank"><li><button class="hd" tabindex="-1" aria-hidden="true"><span>Departamento</span><span></span><span class="n" title="Distritos FEN histórico">Hist.</span><span class="n" title="Distritos con reportes 2026-27">26-27</span><span class="n" title="Establecimientos de EsSalud en distritos con riesgo">EsS.</span><span class="n" title="Aliados">Ali.</span></button></li>
    ${filas.map(f => `<li><button data-dep="${f.d.c}"><span class="${f.h || f.a ? '' : 'zero'}">${esc(f.d.nombre)}</span><span class="bar2"><i style="width:${f.h ? Math.max(4, 100 * f.h / max) : 0}%;background:${st.riesgo ? `var(--r-${st.riesgo})` : 'var(--hist)'}"></i></span><span class="n ${f.h ? '' : 'zero'}">${f.h}</span><span class="n ${f.a ? '' : 'zero'}">${f.a}</span><span class="n ${f.es ? '' : 'zero'}">${f.es}</span><span class="n ${f.al ? '' : 'zero'}">${f.al}</span></button></li>`).join('')}</ul>`;
}

/* ============================================================
   W7 · SECCIONES
   ============================================================ */
// --- Riesgos asociados al FEN: un mini mapa por tipo de riesgo (todos juntos y diferenciados) ---
let trazos2D = null;
function dibujarMiniMapa(canvas, clave) {
  const css = getComputedStyle(document.documentElement);
  const colTierra = css.getPropertyValue('--land').trim(), colBorde = css.getPropertyValue('--border-dep').trim(), colRiesgo = css.getPropertyValue('--r-' + clave).trim();
  if (!trazos2D) trazos2D = { dis: Object.fromEntries(MAPA.dis.map(d => [d.u, new Path2D(d.p)])), dep: MAPA.dep.map(d => new Path2D(d.p)) };
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 120, h = canvas.clientHeight || 170;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d'), [x0, y0, W, H] = vbPeru, s = Math.min(w / W, h / H) * dpr;
  ctx.setTransform(s, 0, 0, s, (w * dpr - W * s) / 2 - x0 * s, (h * dpr - H * s) / 2 - y0 * s);
  ctx.fillStyle = colTierra; trazos2D.dep.forEach(p => ctx.fill(p));
  ctx.fillStyle = colRiesgo;
  MAPA.dis.forEach(d => { if (enRiesgo(d.u, clave)) ctx.fill(trazos2D.dis[d.u]); });
  ctx.strokeStyle = colBorde; ctx.lineWidth = 0.6 / s * dpr; trazos2D.dep.forEach(p => ctx.stroke(p));
}
function renderRiesgos() {
  $('tarjetas-riesgo').innerHTML = RIESGOS.map(r => {
    const nd = MAPA.dis.filter(d => enRiesgo(d.u, r.clave)).length;
    const ne = HIST.escenarios.filter(e => e.riesgos.includes(r.clave)).length;
    const nr = radar.filter(x => x.riesgo === r.clave).length;
    const nes = ESS.establecimientos.filter(e => enRiesgo(e.u, r.clave)).length;
    return `<article class="rcard${st.riesgo === r.clave ? ' activo' : ''}" style="--c:var(--r-${r.clave})">
      <canvas class="mini" data-r="${r.clave}" aria-label="Mapa de distritos con ${esc(r.nombre.toLowerCase())}" role="img"></canvas>
      <div class="rtxt"><h3><span class="rico">${icono(r.clave)}</span>${esc(r.nombre)}</h3>
        <div class="rnum"><span><b>${nd}</b> distritos</span><span><b>${ne}</b> escenarios</span><span><b>${nr}</b> reportes 2026-27</span><span><b>${nes}</b> EsSalud</span></div>
        <p>${esc(r.descripcion)}</p>
        <p class="muted"><b>Con El Niño:</b> ${esc(r.relacion_fen)}</p>
        <p class="muted"><b>Periodo crítico:</b> ${esc(r.periodo_critico)}</p>
        <button class="lnk" data-riesgo="${r.clave}">${st.riesgo === r.clave ? 'Ver todos los riesgos en el mapa' : 'Ver solo este riesgo en el mapa'}</button></div></article>`;
  }).join('');
  document.querySelectorAll('canvas.mini').forEach(c => dibujarMiniMapa(c, c.dataset.r));
}
function renderEscenarios() {
  const q = norm(st.q);
  const lista = HIST.escenarios.filter(e => (!q || norm([e.departamento, e.lugares, e.fenomeno, e.macrozona].join(' ')).includes(q)) && (!st.riesgo || e.riesgos.includes(st.riesgo)));
  $('n-esc').textContent = HIST.escenarios.length;
  $('escenarios').innerHTML = lista.map(e => {
    const efectos = e.efectos.split(/\n/).map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean);
    return `<article class="esc" style="--c:var(--h${e.p})">
      <div class="meta">Escenario ${e.id} · ${esc(e.macrozona)} · ${esc(e.departamento)}</div>
      <h3>${esc(e.fenomeno)}</h3>
      <div class="tags">${e.riesgos.map(etiquetaRiesgo).join('')}</div>
      <div>${etiquetaProb(e.p)} <span class="meta">· Riesgo: ${esc(e.periodo)} · Pico: ${esc(e.pico)}</span></div>
      <div class="meta">En el mapa: ${e.ubigeos.length} distritos (${(e.nombrados || []).length} nombrados en la matriz)${e.sin_mapa.length ? ' · parte sin cartografiar' : ''}</div>
      <details><summary>Más detalle</summary>
        <p><b>Lugares según la matriz:</b> ${esc(e.lugares)}</p>
        <p><b>Daño potencial:</b> ${esc(e.dano)}</p>
        <p><b>Efectos en cadena:</b></p><ul>${efectos.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p><b>Riesgo de pérdida de vidas:</b> ${esc(e.riesgo_vidas)}</p>
        <p><b>Población expuesta:</b> ${esc(e.poblacion)}</p>
        <p><b>Precedente:</b> ${esc(e.precedente)}</p>
        <p><b>Fuente:</b> ${esc(e.fuente)}</p>
        ${e.notas.length || e.sin_mapa.length ? `<p><b>Cómo se ubicó en el mapa:</b></p><ul>${[...e.notas, ...e.sin_mapa].map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </details>
      <div class="acc"><button class="lnk" data-esc="${e.id}">Ver en el mapa</button></div></article>`;
  }).join('') || vacio('Ningún escenario coincide con los filtros.');
}
function renderRadar() {
  const q = norm(st.q);
  const lista = radar.filter(r => (!q || norm([r.lugar, r.fen, r.resumen, r.medio, r.salud].join(' ')).includes(q)) && (!st.riesgo || r.riesgo === st.riesgo)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  $('tabla-radar').innerHTML = lista.length ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Lugar</th><th>Riesgo</th><th>Fenómeno</th><th>Afectación</th><th>Salud</th><th>Resumen</th><th>Fuente</th></tr></thead><tbody>
    ${lista.map(r => `<tr><td>${fechaTxt(r.fecha)}</td><td>${r.cod ? `<button class="lnk" data-lugar="${r.cod}">${esc(nombreLugar(r.cod))}</button>` : esc(r.lugar)}</td><td>${etiquetaRiesgo(r.riesgo)}</td><td>${esc(r.fen)}</td><td>${etiquetaNivel(r.nivel)}</td>
      <td>${esc(r.salud)}${r.essalud ? `<div class="muted">${esc(r.essalud)}</div>` : ''}</td><td>${esc(r.resumen)}</td>
      <td>${r.enlace ? `<a href="${esc(r.enlace)}" target="_blank" rel="noopener">${esc(r.medio || 'enlace')}</a>` : esc(r.medio)}${/^s/i.test(r.verificado) ? ' <span class="muted">· verificado</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>` : vacio(radar.length ? 'Ninguna noticia coincide con los filtros.' : `Aún no hay noticias registradas. Registra la primera en la hoja <a href="https://docs.google.com/spreadsheets/d/${HOJAS.fen}/edit" target="_blank" rel="noopener">FEN_2026_2027 › Radar</a>.`);
}
function renderDemanda() {
  const q = norm(st.q);
  const lista = demanda.filter(d => !q || norm([d.lugar, d.cat, d.desc, d.eess, d.red].join(' ')).includes(q));
  if (!lista.length) { $('lista-demanda').innerHTML = vacio(`Aún no hay necesidades registradas. Regístralas en la hoja <a href="https://docs.google.com/spreadsheets/d/${HOJAS.fen}/edit" target="_blank" rel="noopener">FEN_2026_2027 › Demanda</a>.`); return; }
  const grupos = {};
  lista.forEach(d => { const g = !d.cod ? 'Sin lugar reconocido' : d.cod === '00' ? 'Nacional' : (depPorC[d.cod.slice(0, 2)] || {}).nombre || d.cod; (grupos[g] = grupos[g] || []).push(d); });
  $('lista-demanda').innerHTML = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es')).map(g => `<div class="dem-dep"><h3>${esc(g)} <span class="muted" style="font-size:14px;font-weight:500">· ${grupos[g].length}</span></h3>
    ${grupos[g].map(d => { const pos = posiblesOfertas(d); return `<div class="dem"><div>
      <div class="meta">${esc(d.cat)} · prioridad ${esc((d.prioridad || '–').toLowerCase())} · ${esc(d.estado || 'sin estado')}${d.tipo ? ' · ' + etiquetaTipo(d.tipo) : ''}</div>
      <h4>${esc(d.desc)}</h4>
      <div class="meta">${d.cod ? `<button class="lnk" data-lugar="${d.cod}">${esc(nombreLugar(d.cod))}</button>` : esc(d.lugar)}${d.red ? ' · ' + esc(d.red) : ''}${d.eess ? ' · ' + esc(d.eess) : ''}</div>
      <div class="meta">${d.cantidad != null ? fmt(d.cantidad) + ' ' + esc(d.unidad) : ''}${d.monto != null ? ' · ' + esc(d.moneda) + ' ' + fmt(d.monto) : ''}</div></div>
      <div class="match"><b>Posibles aliados</b>${d.asignado ? `<div>Asignado: <strong>${esc(d.asignado)}</strong></div>` : ''}
      ${pos.length ? pos.map(o => `<div><button class="lnk" data-aliado="${esc(o.aliado)}">${esc(o.aliado)}</button> <span class="muted">· ${esc(o.modalidad || o.tipo)} · ${esc(nombreLugar(o.cod))}${o.estado ? ' · ' + esc(o.estado) : ''}</span></div>`).join('') : '<span class="muted">Sin oferta que coincida en categoría y lugar.</span>'}</div></div>`; }).join('')}</div>`).join('');
}
function renderDirectorio() {
  const L = aliadosVisibles();
  $('dir-n').textContent = L.length;
  $('dir').innerHTML = L.length ? L.map(a => {
    const deps = [...a.deps].map(c => depPorC[c].nombre).sort((x, y) => x.localeCompare(y, 'es'));
    const cob = a.codigos.includes('00') ? 'Todo el país' : deps.length > 5 ? deps.slice(0, 5).join(', ') + ` y ${deps.length - 5} más` : deps.join(', ') || 'Sin cobertura registrada';
    return `<button class="dcard" data-aliado="${esc(a.nombre)}">${avatar(a)}<div><h3>${esc(a.nombre)}</h3>
      <div class="meta muted">${[a.actor, a.pais, a.estado].filter(Boolean).map(esc).join(' · ')}</div><div class="tags">${a.tipos.map(etiquetaTipo).join('')}</div>
      <div class="cov"><b>${a.ofertas.length} ${a.ofertas.length === 1 ? 'oferta' : 'ofertas'}</b>${a.ofertas.length ? ': ' + esc([...new Set(a.ofertas.map(o => o.cat))].join(', ')) : ''}<br>${esc(cob)}</div></div></button>`;
  }).join('') : vacio(aliados.length ? 'Ningún aliado coincide con los filtros.' : `Aún no hay aliados registrados. Regístralos en la hoja <a href="https://docs.google.com/spreadsheets/d/${HOJAS.aliados}/edit" target="_blank" rel="noopener">Identificacion_Aliados_Essalud</a>.`);
}
function renderNiveles() {
  $('lv').innerHTML = NIVELES.map(l => `<article class="lvc" style="--c:var(${l.c})"><span class="nm">Nivel</span><span class="num">${l.n}</span><h3>${l.t}</h3><div class="muted">${l.u}</div><div class="au"><b>Conduce</b>${l.a}</div></article>`).join('');
  const L = aliados.filter(a => /[45]/.test(a.nivelEm || ''));
  $('act45').innerHTML = L.length ? L.map(a => `<button class="pill" data-aliado="${esc(a.nombre)}">${esc(a.nombre)}</button>`).join('') : '<span class="muted">Aún sin aliados con nivel de activación registrado.</span>';
}
function renderTipologias() {
  $('gl').innerHTML = tipos.map(t => {
    const n = aliados.filter(a => a.tipos.some(x => norm(x) === norm(t.k))).length;
    return `<article class="gcard" style="--c:var(${t.c})"><h3>${esc(t.k)}<small>${n} ${n === 1 ? 'aliado' : 'aliados'}</small></h3><p>${esc(t.d)}</p>
      <div class="eg"><b>Ejemplos de apoyo</b>${esc(t.e)}</div><div class="origen">Definición: ${esc(t.o || '—')}</div>
      <button class="lnk" data-gt="${esc(t.k)}">Ver en el mapa</button></article>`;
  }).join('');
}
function renderFiltros() {
  const nh = MAPA.dis.filter(d => valorHist(d.u, null)).length, na = MAPA.dis.filter(d => valorAct(d.u, null)).length;
  const nes = ESS.establecimientos.filter(e => enRiesgo(e.u)).length;
  $('capas').innerHTML = `<span class="lbl">Capas</span>
    <button class="chip capa" style="--c:var(--hist)" aria-pressed="${st.hist}" data-capa="hist"><i></i>FEN histórico<em>${MAPA.dis.filter(d => histU[d.u] && (!st.soloNomb || histU[d.u].esc.some(id => ESC[id].nombSet.has(d.u)))).length}</em></button>
    <button class="chip capa" style="--c:var(--act)" aria-pressed="${st.act}" data-capa="act"><i></i>FEN 2026-27<em>${Object.keys(actU).length}</em></button>
    <button class="chip capa es-chip" aria-pressed="${st.es}" data-capa="es"><i></i>EsSalud<em>${ESS.establecimientos.filter(e => e.x != null).length}</em></button>`;
  $('riesgos-chips').innerHTML = `<span class="lbl">Tipo de riesgo</span><button class="chip" style="--c:var(--ink)" aria-pressed="${!st.riesgo}" data-riesgo="">Todos</button>` +
    RIESGOS.map(r => `<button class="chip rchip" style="--c:var(--r-${r.clave})" aria-pressed="${st.riesgo === r.clave}" data-riesgo="${r.clave}" title="${esc(r.nombre)}">${icono(r.clave)}${esc(r.nombre.split(/ e | y /)[0])}<em>${MAPA.dis.filter(d => enRiesgo(d.u, r.clave)).length}</em></button>`).join('');
  $('chips').innerHTML = `<span class="lbl">Tipología de aliado</span>` + tipos.map(t => `<button class="chip" style="--c:var(${t.c})" aria-pressed="${st.tipos.has(norm(t.k))}" data-t="${esc(t.k)}"><i></i>${esc(t.k)}<em>${aliados.filter(a => a.tipos.some(x => norm(x) === norm(t.k))).length}</em></button>`).join('') +
    ((st.tipos.size || st.q || st.aliado || st.esc || st.soloNomb || st.riesgo || !st.hist || !st.act || !st.es) ? `<button class="chip clear" data-limpiar="1">Quitar filtros</button>` : '');
  $('solo-nombrados').checked = st.soloNomb;
  $('k-hist').textContent = fmt(nh); $('k-act').textContent = fmt(na); $('k-es').textContent = fmt(nes); $('k-es-tot').textContent = fmt(ESS.total_activos);
  $('k-dem').textContent = fmt(demanda.length); $('k-ali').textContent = fmt(aliados.length);
  const fb = $('focusbar');
  if (st.aliado) { fb.hidden = false; fb.innerHTML = `<span>Mostrando dónde puede apoyar <b>${esc(st.aliado)}</b> (departamentos con borde azul)</span><button data-sinfoco="1">Ver todos los aliados</button>`; }
  else if (st.esc) { const e = ESC[st.esc]; fb.hidden = false; fb.innerHTML = `<span>Mostrando el escenario ${e.id}: <b>${esc(e.fenomeno.slice(0, 90))}${e.fenomeno.length > 90 ? '…' : ''}</b></span><button data-sinfoco="1">Ver todos los escenarios</button>`; }
  else fb.hidden = true;
  $('titulo-mapa').textContent = st.dis ? titulo(disPorU[st.dis].n) : st.dep ? depPorC[st.dep].nombre : (st.riesgo ? riesgoPorClave(st.riesgo).nombre : 'Perú por distritos');
  $('sub-mapa').textContent = st.dep ? 'Toca un distrito para ver su detalle. Arrastra para moverte.' : 'Toca un departamento para acercarte. El círculo indica cuántos aliados pueden apoyar ahí.';
}
function renderEstado() {
  const s = $('estado');
  s.innerHTML = modo === 'vivo'
    ? `<span class="dot live"></span><span>En vivo desde Google Sheets · actualizado a las ${cargadoEn.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>`
    : `<span class="dot"></span><span>${esc(avisoHojas)}</span>`;
  $('pie-datos').textContent = `Radar, demanda, aliados y oferta: hojas de Google de EsSalud${modo === 'vivo' ? ', leídas en vivo' : ' (copia guardada)'}.`;
  $('pie-avisos').innerHTML = avisos.map(a => `<span style="display:block;color:#FFB4A0">${esc(a)}</span>`).join('');
}
function render() {
  pintar(); renderPanel(); renderFiltros(); renderRiesgos(); renderEscenarios(); renderRadar(); renderDemanda(); renderDirectorio(); renderNiveles(); renderTipologias(); renderEstado();
}

/* ============================================================
   W9 · EVENTOS Y ARRANQUE
   ============================================================ */
function irAlMapa() { $('mapa').scrollIntoView({ block: 'start' }); }
function enlazarEventos() {
  const tip = $('tip'), wrap = svg.parentElement;
  let arr = null, movido = false;
  svg.addEventListener('pointerdown', e => { arr = { x: e.clientX, y: e.clientY, vb: vb.slice() }; movido = false; });
  window.addEventListener('pointermove', e => {
    if (!arr) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (!movido && Math.hypot(dx, dy) < 5) return;
    movido = true; svg.classList.add('arrastre');
    const k = vb[2] / svg.clientWidth; vb = [arr.vb[0] - dx * k, arr.vb[1] - dy * k, vb[2], vb[3]]; aplicarVB();
  });
  window.addEventListener('pointerup', () => { arr = null; svg.classList.remove('arrastre'); });
  svg.addEventListener('click', e => {
    if (movido) { movido = false; return; }
    const c = e.target.closest('circle.es');
    const u = c ? ESS.establecimientos[c.dataset.i].u : (e.target.closest('path.d') || {}).dataset?.u;
    if (!u || !disPorU[u]) return;
    if (!c && (!st.dep || st.dep !== u.slice(0, 2))) seleccionarDep(u.slice(0, 2)); else seleccionarDis(u);
  });
  svg.addEventListener('mousemove', e => {
    if (arr) { tip.hidden = true; return; }
    const c = e.target.closest('circle.es'), p = e.target.closest('path.d'), b = wrap.getBoundingClientRect();
    if (c) {
      const es = ESS.establecimientos[c.dataset.i];
      tip.innerHTML = `<b>${esc(titulo(es.n))}</b>EsSalud · ${esc(es.ca && es.ca !== '0' ? 'categoría ' + es.ca : 'sin categoría')}<br>${esc(nombreLugar(es.u))}` +
        (enRiesgo(es.u) ? `<br>Riesgo FEN: ${riesgosDe(es.u).map(k => esc(riesgoPorClave(k).nombre.toLowerCase())).join(', ')}` : '<br>Sin riesgo FEN registrado');
    } else if (p) {
      const u = p.dataset.u, d = disPorU[u], h = histU[u], a = actU[u], rs = riesgosDe(u), nes = (esPorU[u] || []).length;
      tip.innerHTML = `<b>${esc(titulo(d.n))}</b>${esc(titulo(d.pr))} · ${esc(depPorC[d.c].nombre)}` +
        (h ? `<br>FEN histórico: escenario ${h.esc.join(', ')}` : '') +
        (a ? `<br>FEN 2026-27: ${a.k} reporte(s), máx. ${NOM_NIVEL[a.n] || '–'}` : '') +
        (rs.length ? `<br>Riesgos: ${rs.map(k => esc(riesgoPorClave(k).nombre.toLowerCase())).join(', ')}` : '') +
        (nes ? `<br>${nes} establecimiento(s) de EsSalud` : '');
    } else { tip.hidden = true; return; }
    tip.style.left = (e.clientX - b.left) + 'px'; tip.style.top = (e.clientY - b.top) + 'px'; tip.hidden = false;
  });
  svg.addEventListener('mouseleave', () => tip.hidden = true);
  $('z-mas').onclick = () => zoom(1.7); $('z-menos').onclick = () => zoom(1 / 1.7);
  $('z-peru').onclick = () => { st.dep = null; st.dis = null; render(); verPeru(); };

  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const ds = t.dataset;
    if (ds.capa) { st[ds.capa] = !st[ds.capa]; render(); }
    else if (ds.riesgo !== undefined) { st.riesgo = (!ds.riesgo || st.riesgo === ds.riesgo) ? null : ds.riesgo; st.esc = null; render(); if (t.closest('.rcard')) irAlMapa(); }
    else if (ds.t) { const k = norm(ds.t); st.tipos.has(k) ? st.tipos.delete(k) : st.tipos.add(k); render(); }
    else if (ds.gt) { st.tipos = new Set([norm(ds.gt)]); st.aliado = null; render(); irAlMapa(); }
    else if (ds.limpiar) { st.tipos.clear(); st.q = ''; st.aliado = null; st.esc = null; st.riesgo = null; st.soloNomb = false; st.hist = st.act = st.es = true; $('q').value = ''; render(); }
    else if (ds.sinfoco) { st.aliado = null; st.esc = null; render(); }
    else if (ds.volver === 'peru') { seleccionarDep(null); }
    else if (ds.volver === 'dep') { st.dis = null; render(); irA(depPorC[st.dep].bb); }
    else if (ds.dep) { seleccionarDep(ds.dep); }
    else if (ds.esc) { st.esc = +ds.esc; st.riesgo = null; st.aliado = null; st.dep = null; st.dis = null; render(); verPeru(); irAlMapa(); }
    else if (ds.aliado) { st.aliado = ds.aliado; st.esc = null; st.dep = null; st.dis = null; render(); verPeru(); irAlMapa(); }
    else if (ds.lugar) { const c = ds.lugar; if (c.length === 6) seleccionarDis(c); else if (c !== '00') seleccionarDep(c.slice(0, 2)); irAlMapa(); }
  });
  $('q').addEventListener('input', e => {
    const v = e.target.value, l = lugarPorEtiqueta[v];
    if (l) { e.target.value = ''; st.q = ''; if (l.tipo === 'dis') seleccionarDis(l.u); else seleccionarDep(l.c); return; }
    st.q = v; renderPanel(); renderFiltros(); renderEscenarios(); renderRadar(); renderDemanda(); renderDirectorio(); pintar();
  });
  $('solo-nombrados').addEventListener('change', e => { st.soloNomb = e.target.checked; render(); });
  ['enlace-radar', 'enlace-demanda', 'enlace-hoja-fen'].forEach(id => $(id).href = `https://docs.google.com/spreadsheets/d/${HOJAS.fen}/edit`);
  ['enlace-aliados', 'enlace-hoja-aliados'].forEach(id => $(id).href = `https://docs.google.com/spreadsheets/d/${HOJAS.aliados}/edit`);
  let to = null;
  window.addEventListener('resize', () => { clearTimeout(to); to = setTimeout(() => { aplicarVB(); renderRiesgos(); }, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderRiesgos());
}

window.addEventListener('error', e => { const s = $('estado'); if (s) s.textContent = 'Error en la web: ' + e.message + ' (línea ' + e.lineno + ')'; });
window.addEventListener('DOMContentLoaded', async () => {
  try {
    [MAPA, HIST, ESS] = await Promise.all(['datos/mapa.json', 'datos/fen_historico.json', 'datos/essalud_establecimientos.json'].map(f => fetch(f).then(r => r.json())));
    indexarMapa(); indexarHistorico(); indexarEsSalud(); construirMapa(); enlazarEventos();
    await cargarHojas(); indexarActual(); render(); verPeru();
    setInterval(async () => { try { await cargarHojas(); indexarActual(); render(); } catch (e) { console.warn(e); } }, REFRESCO_MS);
  } catch (e) {
    $('estado').textContent = 'No se pudieron cargar los datos del mapa: ' + (e && e.message ? e.message : e) + '. Abre la web desde un servidor (GitHub Pages), no como archivo local.';
    console.error(e);
  }
});
})();
