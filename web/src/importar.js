// Importación semiautomática: texto pegado (bloc de notas, Word, PDF copiado) → capítulos en Markdown.
// No hay límite de largo: todo se procesa en el navegador, por partes, sin mandar nada afuera.
// Detecta títulos, partes, notas al pie numeradas, bibliografía, epígrafes y listas.

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const RE_TIT_NOTAS = /^(notas?( al pie| del cap[ií]tulo| finales)?|referencias)\s*:?$/i;
const RE_TIT_BIBLIO = /^(bibliograf[ií]a( consultada| citada| general)?|referencias bibliogr[aá]ficas|fuentes( consultadas| y bibliograf[ií]a)?|obras citadas)\s*:?$/i;
const RE_PARTE = /^(parte|libro|secci[oó]n)\s+([ivxlcdm]+|\d+|primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima)\b[\s.:—–-]*(.*)$/i;
const RE_CAP = /^(cap[ií]tulo|cap\.)\s+([ivxlcdm]+|\d+|[a-záéíóúñ]+)\b[\s.:—–-]*(.*)$/i;
const RE_ESPECIAL = /^(pr[oó]logo|prefacio|introducci[oó]n|presentaci[oó]n|ep[ií]logo|conclusi[oó]n(es)?|palabras (finales|preliminares)|agradecimientos|nota del autor|a modo de cierre|cierre|ap[eé]ndice|anexo)\b/i;

export const OPCIONES_IMPORTAR = {
  cortar: true,      // cortar en capítulos por los títulos
  notas: true,       // convertir notas numeradas en notas al pie
  unir: 'auto',      // unir renglones cortados (texto copiado de PDF): 'auto' | true | false
  biblio: true,      // dar formato de bibliografía
  epigrafes: true,
};

function limpiar(t) {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/­/g, '')
    .replace(/[​﻿]/g, '')
    .replace(/\t+/g, ' ')
    .replace(/[ ]+$/gm, '')
    .replace(/^[ ]+/gm, (m) => (m.length >= 4 ? '' : ''))
    .replace(/[“”]/g, '"').replace(/"([^"\n]{1,400})"/g, '«$1»')
    .replace(/\.{3}/g, '…')
    .replace(/ {2,}/g, ' ');
}

// ¿El texto viene con renglones cortados a mano (copiado de PDF)?
function pareceCortado(lineas) {
  const llenas = lineas.filter((l) => l.trim().length > 0);
  if (llenas.length < 12) return false;
  const largos = llenas.map((l) => l.length);
  const prom = largos.reduce((a, b) => a + b, 0) / largos.length;
  const sinPunto = llenas.filter((l) => l.length > 40 && !/[.!?:»"…)]$/.test(l.trim())).length;
  return prom < 110 && sinPunto / llenas.length > 0.35;
}

// Arma párrafos: cada bloque separado por línea en blanco es un párrafo;
// si el texto viene cortado, une renglones dentro del bloque (y arregla «migra-\nción»).
function parrafos(t, unir) {
  let lineas = t.split('\n');
  const cortado = unir === 'auto' ? pareceCortado(lineas) : unir;
  const hayBlancos = lineas.some((l) => !l.trim());
  const out = [];
  let buf = [];
  const cerrar = () => { if (buf.length) { out.push(buf.join(' ').replace(/ {2,}/g, ' ').trim()); buf = []; } };
  for (const l of lineas) {
    const s = l.trim();
    if (!s) { cerrar(); continue; }
    if (!cortado && !hayBlancos) { cerrar(); out.push(s); continue; }
    if (!cortado) { cerrar(); out.push(s); continue; }
    // texto cortado: un renglón corto que termina en punto cierra el párrafo; un título suelto también
    if (buf.length && /-$/.test(buf[buf.length - 1]) && /^[a-záéíóúñü]/.test(s)) buf[buf.length - 1] = buf[buf.length - 1].slice(0, -1) + s;
    else if (buf.length && esTituloSuelto(s)) { cerrar(); out.push(s); continue; }
    else buf.push(s);
    if (/[.!?»"…:]$/.test(s) && s.length < 55) cerrar();
  }
  cerrar();
  return out.filter(Boolean);
}

function esTituloSuelto(s) {
  return RE_PARTE.test(s) || RE_CAP.test(s) || RE_TIT_NOTAS.test(s) || RE_TIT_BIBLIO.test(s) || (RE_ESPECIAL.test(s) && s.length < 60 && !/[.]$/.test(s));
}

// Clasifica cada párrafo: parte, capítulo, sección, nota, cuerpo…
function tipoParrafo(p, i, ps) {
  if (/^#{1,3}\s/.test(p)) return { tipo: p.startsWith('###') ? 'sub' : p.startsWith('##') ? 'seccion' : 'capitulo', texto: p.replace(/^#+\s*/, '') };
  if (RE_PARTE.test(p) && p.length < 120) return { tipo: 'parte', texto: p };
  if (RE_CAP.test(p) && p.length < 140) return { tipo: 'capitulo', texto: p };
  if (RE_TIT_NOTAS.test(p)) return { tipo: 'tit-notas', texto: p };
  if (RE_TIT_BIBLIO.test(p)) return { tipo: 'tit-biblio', texto: p };
  if (RE_ESPECIAL.test(p) && p.length < 70 && !/[.;,]$/.test(p)) return { tipo: 'capitulo', texto: p };
  // «Título — bajada» suelto, sin punto final: título de capítulo
  if (p.length < 140 && / — /.test(p) && !/[.;,:…]$/.test(p) && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(p) && p.split(/\s+/).length <= 22) return { tipo: 'capitulo', texto: p };
  const corto = p.length <= 90 && !/[.;,:…]$/.test(p) && !/^[-•*–]\s/.test(p) && !/^\d+[.)]?\s/.test(p) && !/^[«"(]/.test(p);
  const mayus = p === p.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(p);
  const sig = ps[i + 1] || '';
  if (corto && /^[A-ZÁÉÍÓÚÑ¿¡0-9]/.test(p) && sig.length > 120 && p.split(/\s+/).length <= 14) return { tipo: mayus ? 'capitulo' : 'seccion', texto: p };
  return { tipo: 'cuerpo', texto: p };
}

const capitalizar = (s) => (s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(s) ? s.toLowerCase().replace(/^(\p{L})/u, (c) => c.toUpperCase()) : s);
function tituloCapitulo(t) {
  t = t.replace(/\*\*|__/g, '').replace(/^\*|\*$/g, '').trim();
  const m = t.match(RE_CAP);
  if (m && m[3]) return capitalizar(m[3].trim());
  return capitalizar(t.trim());
}
function tituloParte(t) {
  const m = t.match(RE_PARTE);
  return m && m[3] ? capitalizar(m[3].trim()) : t.trim().replace(/^(\p{L})(\p{L}*)/u, (x, a, b) => a.toUpperCase() + b.toLowerCase());
}

// Notas: «1. Texto», «1 Texto», «[1] Texto», «¹ Texto»
const RE_DEF_NOTA = /^(?:\[(\d{1,3})\]|\((\d{1,3})\)|(\d{1,3})[.):]?|([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3}))\s+(\S.*)$/;
function numeroDef(p) {
  const m = p.match(RE_DEF_NOTA); if (!m) return null;
  const n = m[1] || m[2] || m[3] || (m[4] && [...m[4]].map((c) => SUP[c]).join(''));
  return { n: +n, texto: m[5] };
}

// Busca las llamadas a nota en el cuerpo, en orden: 1, 2, 3…
function marcarLlamadas(cuerpo, numeros) {
  let txt = cuerpo.join('\n\n');
  // superíndices unicode → número con marca
  txt = txt.replace(/([^\s\d⁰¹²³⁴⁵⁶⁷⁸⁹])([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3})/g, (m, a, b) => `${a}\u0001${[...b].map((c) => SUP[c]).join('')}\u0002`);
  let pos = 0; const hallados = new Set();
  for (const n of numeros) {
    const pats = [
      new RegExp(`\\u0001${n}\\u0002`, 'g'),
      new RegExp(`\\[${n}\\](?!:)`, 'g'),
      new RegExp(`(?<=[\\p{L}.,;:!?»"”’)\\]…])${n}(?=[\\s.,;:)»]|$)`, 'gu'),
      new RegExp(`(?<=[\\p{L}.,;:!?»"”’)…])\\(${n}\\)`, 'gu'),
    ];
    let mejor = null;
    for (const re of pats) {
      re.lastIndex = pos;
      const m = re.exec(txt);
      if (m && (!mejor || m.index < mejor.index)) mejor = { index: m.index, largo: m[0].length };
    }
    if (mejor) {
      txt = txt.slice(0, mejor.index) + `[^${n}]` + txt.slice(mejor.index + mejor.largo);
      pos = mejor.index + `[^${n}]`.length;
      hallados.add(n);
    }
  }
  txt = txt.replace(/\u0001(\d+)\u0002/g, '$1');
  return { texto: txt.split('\n\n'), hallados };
}

// Epígrafe: 1 a 4 párrafos cortos al comienzo, el último con «— Autor».
function separarEpigrafe(cuerpo) {
  for (let k = 1; k <= Math.min(4, cuerpo.length - 1); k++) {
    const ult = cuerpo[k - 1];
    if (/^[—–-]\s*\S/.test(ult) && cuerpo.slice(0, k).every((p) => p.length < 400)) {
      const lineas = cuerpo.slice(0, k).map((p, i) => (i === k - 1 ? p.replace(/^[—–-]\s*/, '') : p));
      return { epigrafe: lineas, resto: cuerpo.slice(k) };
    }
  }
  return { epigrafe: null, resto: cuerpo };
}

function armarCapitulo(c, op) {
  let cuerpo = c.cuerpo;
  const informe = { notas: 0, notasSinLlamada: [], biblio: 0, epigrafe: false };
  // notas: o bien en una sección «Notas», o bien un bloque final de párrafos numerados
  let defs = c.notas.map(numeroDef).filter(Boolean);
  if (op.notas && !defs.length) {
    let k = cuerpo.length;
    while (k > 0 && numeroDef(cuerpo[k - 1])) k--;
    const cola = cuerpo.slice(k).map(numeroDef);
    if (cola.length >= 2 && cola.every((d, i) => d.n === cola[0].n + i)) { defs = cola; cuerpo = cuerpo.slice(0, k); }
  }
  if (op.notas && defs.length) {
    // una nota puede seguir en el párrafo siguiente sin número: se pega a la anterior
    const r = marcarLlamadas(cuerpo, defs.map((d) => d.n));
    cuerpo = r.texto;
    informe.notas = r.hallados.size;
    informe.notasSinLlamada = defs.filter((d) => !r.hallados.has(d.n)).map((d) => d.n);
  }
  let epi = null;
  if (op.epigrafes) { const e = separarEpigrafe(cuerpo); epi = e.epigrafe; cuerpo = e.resto; informe.epigrafe = !!epi; }
  const md = [`# ${c.titulo}`, ''];
  if (epi) md.push('::: epigrafe', epi.join('\\\n'), ':::', '');
  for (const p of cuerpo) {
    if (p.startsWith('\u0003')) { md.push(p.slice(1), ''); continue; }
    if (/^[•*–-]\s+/.test(p)) md.push(p.replace(/^[•*–-]\s+/, '- '));
    else md.push(p, '');
  }
  if (c.biblio.length) {
    informe.biblio = c.biblio.length;
    md.push('## Bibliografía', '', op.biblio ? '::: bibliografia' : '');
    for (const b of c.biblio) md.push(b, '');
    if (op.biblio) md.push(':::', '');
  }
  if (op.notas && defs.length) {
    md.push('');
    for (const d of defs) if (!informe.notasSinLlamada.includes(d.n)) md.push(`[^${d.n}]: ${d.texto}`, '');
    // las notas sin llamada se dejan al final como texto, para no perderlas
    if (informe.notasSinLlamada.length) {
      md.push('<!-- Notas que no encontré en el texto: ubicá la llamada [^n] a mano -->');
      for (const d of defs) if (informe.notasSinLlamada.includes(d.n)) md.push(`[^${d.n}]: ${d.texto}`, '');
    }
  }
  return { ...c, md: md.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', informe };
}

// Punto de entrada: devuelve [{tipo:'parte'|'capitulo', titulo, md?, palabras, informe}]
export function importarTexto(texto, opciones = {}) {
  const op = { ...OPCIONES_IMPORTAR, ...opciones };
  const ps = parrafos(limpiar(op.sinIndice === false ? texto : quitarIndice(texto).texto), op.unir);
  const items = [];
  let actual = null;
  let zona = 'cuerpo'; // cuerpo | notas | biblio
  const nuevo = (titulo) => { actual = { tipo: 'capitulo', titulo, cuerpo: [], notas: [], biblio: [] }; items.push(actual); zona = 'cuerpo'; };
  ps.forEach((p, i) => {
    let t = tipoParrafo(p, i, ps);
    // el primer renglón corto y sin punto final es el título del capítulo
    if (i === 0 && op.cortar && t.tipo !== 'parte' && p.length < 160 && !/[.;,:]$/.test(p)) t = { tipo: 'capitulo', texto: p };
    if (op.cortar && t.tipo === 'parte') {
      // «PARTE I» solo, con el nombre de la parte en el párrafo siguiente
      const m = t.texto.match(RE_PARTE);
      if (m && !m[3] && ps[i + 1] && ps[i + 1].length < 80 && !RE_CAP.test(ps[i + 1]) && !/[.;]$/.test(ps[i + 1])) { items.push({ tipo: 'parte', titulo: capitalizar(ps[i + 1]) }); ps[i + 1] = '\u0005'; actual = null; return; }
      items.push({ tipo: 'parte', titulo: tituloParte(t.texto) }); actual = null; return;
    }
    if (p === '\u0005') return;
    if (op.cortar && t.tipo === 'capitulo') {
      // «Capítulo 3» solo, con el título en el párrafo siguiente
      if (RE_CAP.test(t.texto) && !t.texto.match(RE_CAP)[3] && ps[i + 1] && ps[i + 1].length < 120) { ps[i + 1] = '\u0004' + ps[i + 1]; nuevo(''); return; }
      nuevo(tituloCapitulo(t.texto)); return;
    }
    if (p.startsWith('\u0004')) { if (actual && !actual.titulo) { actual.titulo = capitalizar(p.slice(1)); return; } p = p.slice(1); }
    if (!actual) nuevo(op.cortar ? 'Sin título' : 'Texto importado');
    if (t.tipo === 'tit-notas') { zona = 'notas'; return; }
    if (t.tipo === 'tit-biblio') { zona = 'biblio'; return; }
    if (zona === 'notas') {
      if (numeroDef(p)) actual.notas.push(p);
      else if (actual.notas.length && p.length > 0 && !/^[A-ZÁÉÍÓÚÑ].{0,60}$/.test(p)) actual.notas[actual.notas.length - 1] += ' ' + p;
      else { zona = 'cuerpo'; actual.cuerpo.push(p); }
      return;
    }
    if (zona === 'biblio') {
      // una línea corta, sin cifras ni punto final, ya no es bibliografía: es un título nuevo
      if (op.cortar && p.length < 120 && !/\d/.test(p) && !/[.;,:]$/.test(p) && /^[A-ZÁÉÍÓÚÑ¿¡]/.test(p)) { nuevo(tituloCapitulo(p)); return; }
      actual.biblio.push(p); return;
    }
    if (t.tipo === 'seccion') { actual.cuerpo.push('\u0003## ' + capitalizar(t.texto)); return; }
    if (t.tipo === 'sub') { actual.cuerpo.push('\u0003### ' + t.texto); return; }
    actual.cuerpo.push(p);
  });
  return items.map((c) => {
    if (c.tipo === 'parte') return c;
    if (!c.titulo) c.titulo = 'Sin título';
    const r = armarCapitulo(c, op);
    r.palabras = r.md.split(/\s+/).filter(Boolean).length;
    delete r.cuerpo; delete r.notas; delete r.biblio;
    return r;
  });
}

// ── Tabla de contenido del Word/PDF (títulos con el número de página al final) ──
const RE_TIT_INDICE = /^(í|i)ndice( general| de (tablas|figuras|gr[aá]ficos|cuadros|ilustraciones|mapas|abreviaturas|siglas))?$|^contenidos?$|^tabla de contenidos?$|^sumario$|^lista de (tablas|figuras|gr[aá]ficos|cuadros|abreviaturas)$/i;
const sinMarcas = (p) => p.replace(/^#{1,6}\s+/, '').replace(/\*\*|__|\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
export function esLineaIndice(p) {
  const s = sinMarcas(p);
  if (/^\d{1,3}$/.test(s)) return true; // número de página suelto
  return s.length < 260 && /\S[\s.…·_\t-]*\s\.{0,}\s*\d{1,3}$/.test(s) && !/\s(de|en|del|año|años|ley|n\.?º|nº|art\.?)\s+\d{1,3}$/i.test(s);
}
// Saca del texto pegado o subido los tramos que son el índice del documento original.
export function quitarIndice(texto) {
  const ps = texto.split(/\n\s*\n/);
  const fuera = new Set();
  for (let i = 0; i < ps.length; i++) {
    if (!esLineaIndice(ps[i])) continue;
    let j = i, hits = 0, huecos = 0;
    while (j < ps.length && (esLineaIndice(ps[j]) || (huecos < 1 && ps[j + 1] && esLineaIndice(ps[j + 1])))) {
      if (esLineaIndice(ps[j])) { hits++; huecos = 0; } else huecos++;
      j++;
    }
    if (hits >= 5) {
      for (let k = i; k < j; k++) fuera.add(k);
      // el título «Índice» o «Contenido» que lo encabeza
      for (let k = i - 1; k >= Math.max(0, i - 2); k--) if (RE_TIT_INDICE.test(sinMarcas(ps[k]))) fuera.add(k);
    }
    i = j;
  }
  return { texto: ps.filter((_, k) => !fuera.has(k)).join('\n\n'), quitados: fuera.size };
}
// ¿Este capítulo ya creado es en realidad parte del índice del documento original?
export function capituloEsIndice(md) {
  const ps = md.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!ps.length) return false;
  const titulo = sinMarcas(ps[0]);
  const cuerpo = ps.slice(1);
  const hits = cuerpo.filter(esLineaIndice).length;
  if (RE_TIT_INDICE.test(titulo)) return !cuerpo.length || hits / cuerpo.length >= 0.5;
  return esLineaIndice(ps[0]) && (cuerpo.length === 0 || hits / cuerpo.length >= 0.6);
}

// Partes sin número de capítulo: van antes (preliminares) o después (finales) del cuerpo del libro.
const RE_PRELIM = /^(resumen|abstract|resumo|r[ée]sum[ée]|agradecimientos?|dedicatoria|ep[ií]grafe|pr[oó]logo|prefacio|presentaci[oó]n|introducci[oó]n|palabras preliminares|nota del autor|nota preliminar|siglas|abreviaturas|lista de (siglas|abreviaturas))\b/i;
const RE_FINAL = /^(glosario|referencias( bibliogr[aá]ficas)?|bibliograf[ií]a|fuentes|obras citadas|anexos?|ap[eé]ndices?|ep[ií]logo|palabras finales|índice (onom[aá]stico|anal[ií]tico|tem[aá]tico)|sobre (el|la) autor(a)?|colof[oó]n)\b/i;
export function tipoSugerido(titulo, yaHayCapitulos) {
  const t = String(titulo || '').replace(/^#+\s*/, '').replace(/\*\*|__/g, '').trim();
  if (RE_FINAL.test(t)) return 'final';
  if (RE_PRELIM.test(t)) return yaHayCapitulos ? 'final' : 'preliminar';
  return 'capitulo';
}
