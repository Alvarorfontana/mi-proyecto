// Generador de citas: busca la fuente de un texto y arma la referencia (con DOI o link).
// Fuentes gratuitas que se pueden consultar desde el navegador: OpenAlex, Crossref, Wikipedia
// y, si hay clave, Gemini con búsqueda en Google.

const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const palabras = (s) => quitarTildes(String(s || '').toLowerCase()).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3);

// Parecido entre dos textos (0 a 1): proporción de palabras del título que aparecen en el otro texto.
export function parecido(titulo, texto) {
  const a = new Set(palabras(titulo)), b = new Set(palabras(texto));
  if (!a.size) return 0;
  let n = 0; for (const w of a) if (b.has(w)) n++;
  return n / a.size;
}

function autoresDe(lista) {
  return (lista || []).map((x) => {
    const nombre = (x.given || x.nombre || '').trim(), apellido = (x.family || x.apellido || '').trim();
    if (apellido) return { nombre, apellido };
    const partes = String(x.display_name || x.name || '').trim().split(/\s+/);
    return { nombre: partes.slice(0, -1).join(' '), apellido: partes.slice(-1)[0] || '' };
  }).filter((x) => x.apellido);
}

export async function buscarOpenAlex(q, n = 6) {
  const r = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q.slice(0, 300))}&per-page=${n}`);
  if (!r.ok) throw new Error('OpenAlex respondió ' + r.status);
  const j = await r.json();
  return (j.results || []).map((w) => ({
    origen: 'OpenAlex', tipo: w.type === 'book' || w.type === 'book-chapter' ? 'libro' : 'articulo',
    titulo: w.display_name || w.title || '', anio: w.publication_year || '',
    autores: autoresDe((w.authorships || []).map((a) => a.author)),
    revista: w.primary_location?.source?.display_name || '',
    editorial: w.primary_location?.source?.host_organization_name || '',
    volumen: w.biblio?.volume || '', numero: w.biblio?.issue || '',
    paginas: w.biblio?.first_page ? `${w.biblio.first_page}${w.biblio.last_page ? '–' + w.biblio.last_page : ''}` : '',
    doi: (w.doi || '').replace('https://doi.org/', ''), url: w.primary_location?.landing_page_url || w.doi || '',
    citas: w.cited_by_count || 0,
  }));
}

export async function buscarCrossref(q, n = 6) {
  const r = await fetch(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q.slice(0, 300))}&rows=${n}&select=DOI,title,author,issued,container-title,publisher,volume,issue,page,type,URL`);
  if (!r.ok) throw new Error('Crossref respondió ' + r.status);
  const j = await r.json();
  return (j.message?.items || []).map((w) => ({
    origen: 'Crossref', tipo: /book/.test(w.type) ? 'libro' : 'articulo',
    titulo: (w.title || [''])[0], anio: w.issued?.['date-parts']?.[0]?.[0] || '',
    autores: autoresDe(w.author), revista: (w['container-title'] || [''])[0], editorial: w.publisher || '',
    volumen: w.volume || '', numero: w.issue || '', paginas: (w.page || '').replace('-', '–'),
    doi: w.DOI || '', url: w.URL || '',
  }));
}

export async function buscarWikipedia(q, n = 5, idioma = 'es') {
  const r = await fetch(`https://${idioma}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q.slice(0, 250))}&srlimit=${n}&format=json&origin=*`);
  if (!r.ok) throw new Error('Wikipedia respondió ' + r.status);
  const j = await r.json();
  return (j.query?.search || []).map((x) => ({
    origen: 'Wikipedia', tipo: 'web', titulo: x.title, sitio: 'Wikipedia',
    resumen: x.snippet.replace(/<[^>]+>/g, ''), url: `https://${idioma}.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, '_'))}`,
    anio: (x.timestamp || '').slice(0, 4), autores: [],
  }));
}

// Gemini con búsqueda en Google: pide la fuente original del dato y devuelve los enlaces que usó.
export async function buscarGemini(q, clave, modelo = 'gemini-2.5-flash') {
  const pedido = `Encontrá la fuente original y confiable (organismo oficial, estudio, libro, diario reconocido) de esta afirmación o cita. Respondé en castellano, en no más de tres renglones: quién lo dice, en qué documento y en qué año.\n\n«${q.slice(0, 2000)}»`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(clave)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: pedido }] }], tools: [{ google_search: {} }] }),
  });
  if (!r.ok) {
    let m = r.status; try { m = (await r.json()).error?.message || m; } catch {}
    throw new Error(r.status === 429 ? 'Gemini pide esperar (límite gratuito de búsquedas).' : 'Gemini respondió: ' + m);
  }
  const j = await r.json();
  const c = j.candidates?.[0];
  const texto = (c?.content?.parts || []).map((p) => p.text || '').join('').trim();
  const fuentes = (c?.groundingMetadata?.groundingChunks || []).map((g) => g.web).filter(Boolean);
  const vistos = new Set();
  return fuentes.filter((w) => !vistos.has(w.title) && vistos.add(w.title)).slice(0, 6).map((w, i) => ({
    origen: 'Google (Gemini)', tipo: 'web', titulo: w.title || w.uri, sitio: w.title || '', url: w.uri,
    resumen: i === 0 ? texto : '', autores: [], anio: '',
  }));
}

// ── formatos de referencia ──
const nombreApa = (a) => `${a.apellido}${a.nombre ? ', ' + a.nombre.split(/[\s-]+/).filter(Boolean).map((x) => x[0].toUpperCase() + '.').join(' ') : ''}`;
const nombreLargo = (a) => `${a.nombre ? a.nombre + ' ' : ''}${a.apellido}`;
function listaApa(as) {
  if (!as.length) return '';
  if (as.length === 1) return nombreApa(as[0]);
  if (as.length > 20) return as.slice(0, 19).map(nombreApa).join(', ') + ', … ' + nombreApa(as[as.length - 1]);
  return as.slice(0, -1).map(nombreApa).join(', ') + ' y ' + nombreApa(as[as.length - 1]);
}
function listaLarga(as) {
  if (!as.length) return '';
  if (as.length > 3) return nombreLargo(as[0]) + ' y otros';
  return as.length === 1 ? nombreLargo(as[0]) : as.slice(0, -1).map(nombreLargo).join(', ') + ' y ' + nombreLargo(as[as.length - 1]);
}
const enlace = (x) => (x.doi ? `https://doi.org/${x.doi}` : x.url || '');
const hoy = () => new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

export const ESTILOS_CITA = { apa: 'APA 7', chicago: 'Chicago (nota)', iso: 'ISO 690' };

export function formatear(x, estilo = 'apa') {
  const url = enlace(x);
  if (x.tipo === 'web') {
    if (estilo === 'chicago') return `«${x.titulo}», ${x.sitio || ''}${x.anio ? ', ' + x.anio : ''}, ${url} (consultado el ${hoy()}).`.replace(', ,', ',');
    return `${x.sitio && x.sitio !== x.titulo ? x.sitio + '. ' : ''}${x.anio ? `(${x.anio}). ` : ''}*${x.titulo}*. ${url} (consultado el ${hoy()}).`;
  }
  const libro = x.tipo === 'libro';
  if (estilo === 'chicago') {
    const aut = listaLarga(x.autores);
    if (libro) return `${aut ? aut + ', ' : ''}*${x.titulo}*${x.editorial || x.anio ? ` (${[x.editorial, x.anio].filter(Boolean).join(', ')})` : ''}${url ? ', ' + url : ''}.`;
    return `${aut ? aut + ', ' : ''}«${x.titulo}», *${x.revista}*${x.volumen ? ' ' + x.volumen : ''}${x.numero ? `, n.º ${x.numero}` : ''}${x.anio ? ` (${x.anio})` : ''}${x.paginas ? ': ' + x.paginas : ''}${url ? ', ' + url : ''}.`;
  }
  if (estilo === 'iso') {
    const aut = x.autores.map((a) => `${a.apellido.toUpperCase()}${a.nombre ? ', ' + a.nombre : ''}`).slice(0, 3).join('; ') + (x.autores.length > 3 ? ' et al.' : '');
    if (libro) return `${aut ? aut + '. ' : ''}*${x.titulo}*. ${[x.editorial, x.anio].filter(Boolean).join(', ')}.${url ? ' Disponible en: ' + url : ''}`;
    return `${aut ? aut + '. ' : ''}${x.titulo}. *${x.revista}*. ${x.anio}${x.volumen ? ', vol. ' + x.volumen : ''}${x.numero ? ', n.º ' + x.numero : ''}${x.paginas ? ', pp. ' + x.paginas : ''}.${url ? ' Disponible en: ' + url : ''}`;
  }
  const aut = listaApa(x.autores);
  if (libro) return `${aut ? aut + ' ' : ''}(${x.anio || 's. f.'}). *${x.titulo}*.${x.editorial ? ' ' + x.editorial + '.' : ''}${url ? ' ' + url : ''}`;
  return `${aut ? aut + ' ' : ''}(${x.anio || 's. f.'}). ${x.titulo}. *${x.revista}*${x.volumen ? `, *${x.volumen}*` : ''}${x.numero ? `(${x.numero})` : ''}${x.paginas ? ', ' + x.paginas : ''}.${url ? ' ' + url : ''}`;
}

// Notas del capítulo que no tienen ningún enlace (para completarlas).
export function notasSinEnlace(md) {
  return [...md.matchAll(/^\[\^([^\]]+)\]:\s*(.+)$/gm)]
    .filter((m) => !/https?:\/\/|doi\.org|\bdoi:/i.test(m[2]) && m[2].length > 25)
    .map((m) => ({ id: m[1], texto: m[2], indice: m.index, largo: m[0].length }));
}
