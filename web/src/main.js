import './estilo.css';
import { parse as tomlParse } from 'smol-toml';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

import { GitHub } from './github.js';
import { convertir, primerTitulo } from './md2typ.js';
import { principal, nombreTyp, lomoMm, contarPaginasPdf } from './armado.js';
import { tomlSet, tomlContenido } from './toml.js';
import { campoMarcas, fijarMarcas, quitarMarca, listarMarcas, revisarLanguageTool, PEDIDO_REVISION, marcasDesdeIA, ortografiaNavegador } from './revision.js';
import { iniciarMotor, cargarTextos, cargarBinarios, yaCargado, compilar, aSvg } from './motor.js';
import { MODELOS, MODELOS_GEMINI, PROVEEDORES, ACCIONES, preguntar, modelosGemini } from './ia.js';

/* ═════════ utilidades ═════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const numero = (n) => Number(n).toLocaleString('es-AR');
let tToast;
function toast(t) { const e = $('.toast'); e.textContent = t; e.classList.add('ver'); clearTimeout(tToast); tToast = setTimeout(() => e.classList.remove('ver'), 2800); }
async function enLotes(items, n, fn) { const res = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); } })); return res; }

const I = {
  arriba: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
  abajo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
  quitar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  mas: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 3v10M3 8h10"/></svg>',
  subir: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 11V2M4.5 5.5L8 2l3.5 3.5M2.5 10v3.5h11V10"/></svg>',
  bajar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 10v3.5h11V10"/></svg>',
  ajustes: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
  buscar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>',
  registro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 1v22M1 12h22"/></svg>',
};

/* ═════════ estado ═════════ */
const S = {
  conf: leer('taller.conf', { owner: 'Alvarorfontana', repo: 'mi-proyecto', rama: 'main' }),
  gh: null, usuario: null, arbol: [], libros: [], slug: null,
  cfgTexto: '', cfg: null, presets: null, estilosTyp: '', tapaTyp: '', indiceToml: '',
  textos: new Map(), originales: new Map(),
  actual: null, vista: 'paginas', editor: null, catalogo: [],
  seqPrevia: 0, tPrevia: null,
};
const base = () => `/libros/${S.slug}/`;
const rutaLibro = (p) => `libros/${S.slug}/${p}`;

/* ═════════ arranque ═════════ */
document.body.append(h('<div class="toast" role="status" aria-live="polite"></div>'));
if (S.conf.token) conectar().catch((e) => pantallaIngreso(e.message)); else pantallaIngreso();

function pantallaIngreso(error) {
  const app = $('#app');
  const paginas = Array.from({ length: 8 }, (_, i) => [8, 1, 4, 5, 7, 2, 3, 6][i]);
  app.innerHTML = `
  <div class="ingreso">
    <section class="lado">
      <div>
        <div class="logo" style="margin-bottom:56px">${I.registro}Taller editorial</div>
        <h1>Del manuscrito al pliego.</h1>
        <p class="bajada">Escribís y corregís en el navegador, ves cada página como va a salir de imprenta y armás el PDF, la tapa con su lomo y el EPUB. Todo queda guardado en tu repositorio de GitHub.</p>
        <div class="pliego" aria-hidden="true">${paginas.map((n, i) => `<i data-n="${n}" class="${[1, 2, 5, 6].includes(i) ? 'lleno' : ''}"></i>`).join('')}</div>
        <div class="pliego-pie">Un pliego de 8 páginas, impuesto para imprenta.</div>
      </div>
      <div class="cmyk" style="width:120px"><i></i><i></i><i></i><i></i></div>
    </section>
    <section class="form-lado">
      <div><h2>Entrar al taller</h2><p style="margin-top:6px">Se hace una sola vez en cada navegador: después entra solo.</p></div>
      ${error ? `<div class="aviso mal">${esc(error)}</div>` : ''}
      <a class="btn" style="height:40px;justify-content:center" href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Taller%20editorial" target="_blank" rel="noopener">1. Crear la clave en GitHub</a>
      <p style="font-size:13px">Se abre GitHub con todo ya marcado. Elegí <b>No expiration</b> en «Expiration», bajá hasta el final, tocá <b>Generate token</b> y copiá la clave que empieza con <code>ghp_</code>.</p>
      <label class="campo"><span>2. Pegá la clave acá</span>
        <input class="entrada" id="i-token" type="password" autocomplete="off" placeholder="ghp_…"></label>
      <button class="btn prim" id="b-entrar" style="height:42px;justify-content:center">3. Entrar al taller</button>
      <details style="font-size:12.5px;color:var(--tinta-suave)"><summary style="cursor:pointer">Otro repositorio</summary>
        <div class="grilla" style="margin-top:10px">
          <label class="campo"><span>Cuenta</span><input class="entrada" id="i-owner" value="${esc(S.conf.owner)}"></label>
          <label class="campo"><span>Repositorio</span><input class="entrada" id="i-repo" value="${esc(S.conf.repo)}"></label>
        </div></details>
    </section>
  </div>`;
  $('#b-entrar').onclick = async () => {
    S.conf.token = $('#i-token').value.trim(); S.conf.owner = $('#i-owner').value.trim(); S.conf.repo = $('#i-repo').value.trim();
    if (!S.conf.token) return toast('Pegá la clave de GitHub para seguir.');
    const b = $('#b-entrar'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Conectando…';
    try { await conectar(); escribir('taller.conf', S.conf); } catch (e) { pantallaIngreso(e.message); }
  };
}

function cargando(msg) {
  let c = $('.carga');
  if (!msg) { c?.remove(); return; }
  if (!c) { c = h(`<div class="carga"><div class="caja"><div class="marca-reg" style="color:var(--tinta)">${I.registro}</div><div class="msg"></div></div></div>`); document.body.append(c); }
  $('.msg', c).textContent = msg;
}

async function conectar() {
  cargando('Conectando con GitHub…');
  try {
    S.gh = new GitHub(S.conf);
    S.usuario = await S.gh.usuario();
    const info = await S.gh.infoRepo();
    S.gh.rama = S.conf.rama = info.default_branch || 'main';
    cargando('Leyendo el repositorio…');
    S.arbol = await S.gh.arbol();
    S.libros = S.arbol.map((e) => e.path.match(/^libros\/([^/]+)\/libro\.toml$/)?.[1]).filter(Boolean);
    if (!S.libros.length) throw new Error('El repositorio no tiene libros (falta libros/<nombre>/libro.toml).');
    escribir('taller.conf', S.conf);
    cargando('Preparando el motor de composición…');
    const [cat] = await Promise.all([iniciarMotor(), (async () => {
      S.estilosTyp = await S.gh.texto('plantilla/estilos.typ');
      S.tapaTyp = await S.gh.texto('plantilla/tapa.typ');
      S.presetsTexto = await S.gh.texto('plantilla/presets.toml');
      S.presets = tomlParse(S.presetsTexto);
    })()]);
    S.catalogo = cat;
    registrarFuentes(cat);
    await cargarTextos({ '/plantilla/estilos.typ': S.estilosTyp, '/plantilla/tapa.typ': S.tapaTyp, '/plantilla/presets.toml': S.presetsTexto });
    armarApp();
    const pref = leer('taller.libro', null);
    await abrirLibro(S.libros.includes(pref) ? pref : S.libros[0]);
  } finally { cargando(null); }
}

function registrarFuentes(cat) {
  const css = cat.map((c) => `@font-face{font-family:"${c.familia}";src:url("/fuentes/${c.archivo}");font-weight:${c.peso};font-style:${c.italica ? 'italic' : 'normal'};font-display:swap}`).join('\n');
  document.head.append(h(`<style>${css}</style>`));
}
const familias = () => [...new Set(S.catalogo.map((c) => c.familia))].sort();

/* ═════════ estructura de la app ═════════ */
function armarApp() {
  $('#app').innerHTML = `
  <div class="app">
    <header class="barra">
      <div class="fila">
        <div class="logo">${I.registro}Taller</div>
        <select class="selector-libro" id="sel-libro" aria-label="Libro"></select>
        <nav class="pestanas" role="tablist">
          <button role="tab" data-v="texto" aria-selected="true">Texto</button>
          <button role="tab" data-v="estilos" aria-selected="false">Estilos</button>
          <button role="tab" data-v="tapa" aria-selected="false">Tapa</button>
          <button role="tab" data-v="produccion" aria-selected="false">Producción</button>
        </nav>
        <div class="der">
          <span class="estado" id="estado"><span class="punto"></span><span>Guardado</span></span>
          <button class="btn prim chico" id="b-guardar" title="Guardar en GitHub (Ctrl+S)">${I.subir}Guardar</button>
          <button class="btn fant chico" id="b-ajustes" title="Ajustes" aria-label="Ajustes">${I.ajustes}</button>
          <div class="avatar" title="${esc(S.usuario.login)}" style="background-image:url('${esc(S.usuario.avatar_url)}')"></div>
        </div>
      </div>
      <div class="cmyk"><i></i><i></i><i></i><i></i></div>
    </header>
    <main>
      <section class="vista activa" id="v-texto">
        <aside class="indice">
          <div class="cab"><h2>Índice</h2><span id="cuenta"></span></div>
          <div class="lista" id="lista"></div>
          <div class="pie">
            <button class="btn chico" id="b-nuevo">${I.mas}Capítulo</button>
            <button class="btn chico" id="b-parte">${I.mas}Parte</button>
            <button class="btn chico fant" id="b-otros">Otros textos</button>
          </div>
          <div class="resumen" id="resumen"></div>
        </aside>
        <section class="editor">
          <div class="cab"><h1 id="e-titulo">—</h1><div class="sub"><span id="e-archivo"></span><span id="e-palabras"></span></div></div>
          <div class="herr" id="herr">
            <button data-ins="cursiva" title="Cursiva (Ctrl+I)"><i>Cursiva</i></button>
            <button data-ins="negrita" title="Negrita (Ctrl+B)"><b>Negrita</b></button>
            <span class="sep"></span>
            <button data-ins="seccion">Sección</button>
            <button data-ins="subseccion">Subsección</button>
            <button data-ins="nota">Nota al pie</button>
            <span class="sep"></span>
            <button data-ins="cita">Cita</button>
            <button data-ins="epigrafe">Epígrafe</button>
            <button data-ins="recuadro">Recuadro</button>
            <button data-ins="leyenda">Leyenda</button>
            <span class="sep"></span>
            <button data-ins="foto">Foto</button>
            <button data-ins="mapa">Mapa</button>
            <button data-ins="tabla">Tabla</button>
            <span class="sep"></span>
            <button data-ins="buscar" title="Buscar y reemplazar (Ctrl+F)">Buscar</button>
          </div>
          <div class="cm-host" id="cm"></div>
        </section>
        <section class="lado-der">
          <div class="cab">
            <div class="segmento" role="group">
              <button data-lado="paginas" aria-pressed="true">Páginas</button>
              <button data-lado="revision" aria-pressed="false">Revisión</button>
              <button data-lado="asistente" aria-pressed="false">Asistente</button>
            </div>
            <span class="info" id="p-info"></span>
            <div class="der" id="p-der">
              <label class="check" style="font-size:12.5px"><input type="checkbox" id="c-auto" checked>Al escribir</label>
              <input type="range" id="zoom" min="40" max="160" value="${leer('taller.zoom', 100)}" aria-label="Tamaño de las páginas">
            </div>
          </div>
          <div class="mesa" id="mesa"><div class="vacio"><h3>Las páginas aparecen acá</h3>Elegí un capítulo del índice.</div></div>
          <div class="asistente" id="revision" hidden></div>
          <div class="asistente" id="asistente" hidden></div>
        </section>
      </section>
      <section class="vista" id="v-estilos"></section>
      <section class="vista" id="v-tapa"></section>
      <section class="vista" id="v-produccion"></section>
    </main>
  </div>`;

  $('#sel-libro').innerHTML = S.libros.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  $('#sel-libro').onchange = (e) => abrirLibro(e.target.value);
  $$('.pestanas button').forEach((b) => (b.onclick = () => verPestana(b.dataset.v)));
  $('#b-guardar').onclick = guardarTodo;
  $('#b-ajustes').onclick = dialogoAjustes;
  $('#b-nuevo').onclick = nuevoCapitulo;
  $('#b-parte').onclick = nuevaParte;
  $('#b-otros').onclick = otrosTextos;
  $$('#herr [data-ins]').forEach((b) => (b.onclick = () => insertar(b.dataset.ins)));
  $$('[data-lado]').forEach((b) => (b.onclick = () => verLado(b.dataset.lado)));
  $('#zoom').oninput = () => { escribir('taller.zoom', +$('#zoom').value); aplicarZoom(); };
  crearEditor();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); guardarTodo(); }
  });
  window.addEventListener('beforeunload', (e) => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } });
}

function verPestana(v) {
  $$('.pestanas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  $$('.vista').forEach((s) => s.classList.toggle('activa', s.id === 'v-' + v));
  if (v === 'estilos') pintarEstilos();
  if (v === 'tapa') pintarTapa();
  if (v === 'produccion') pintarProduccion();
}
function verLado(l) {
  S.vista = l;
  $$('[data-lado]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lado === l)));
  $('#mesa').hidden = l !== 'paginas';
  $('#asistente').hidden = l !== 'asistente';
  $('#revision').hidden = l !== 'revision';
  $('#p-der').style.visibility = l === 'paginas' ? 'visible' : 'hidden';
  $('#p-info').style.visibility = l === 'paginas' ? 'visible' : 'hidden';
  if (l === 'asistente') pintarAsistente();
  if (l === 'revision') pintarRevision();
}

/* ═════════ libro ═════════ */
async function abrirLibro(slug) {
  if (S.slug && hayCambios() && !confirm('Hay cambios sin guardar. ¿Cambiar de libro igual?')) { $('#sel-libro').value = S.slug; return; }
  cargando('Abriendo el libro…');
  try {
    S.slug = slug; escribir('taller.libro', slug); $('#sel-libro').value = slug;
    S.textos.clear(); S.originales.clear(); S.actual = null;
    S.cfgTexto = await S.gh.texto(rutaLibro('libro.toml'));
    S.originales.set('libro.toml', S.cfgTexto);
    S.cfg = tomlParse(S.cfgTexto);
    const tieneIndice = S.arbol.some((e) => e.path === rutaLibro('indice.toml'));
    S.indiceToml = tieneIndice ? await S.gh.texto(rutaLibro('indice.toml')) : '# sin términos\n';
    // títulos de todos los capítulos (también sirven para avisos y para armar)
    const archivos = new Set((S.cfg.contenido || []).filter((c) => c.archivo).map((c) => c.archivo));
    const t = S.cfg.tapa || {};
    for (const k of ['contratapa', 'solapa_delantera', 'solapa_trasera']) if (t[k]) archivos.add(t[k]);
    if (S.cfg.preliminares?.dedicatoria) archivos.add(S.cfg.preliminares.dedicatoria);
    const lista = [...archivos].filter((a) => S.arbol.some((e) => e.path === rutaLibro(a)));
    let hechos = 0;
    await enLotes(lista, 6, async (a) => {
      const txt = await S.gh.texto(rutaLibro(a));
      S.textos.set(a, txt); S.originales.set(a, txt);
      cargando(`Abriendo el libro… ${++hechos} de ${lista.length} textos`);
    });
    await enviarConfig();
    pintarLista();
    const primero = (S.cfg.contenido || []).find((c) => c.tipo === 'capitulo') || (S.cfg.contenido || []).find((c) => c.archivo);
    if (primero) abrirTexto(primero.archivo);
    verPestana($('.pestanas [aria-selected=true]').dataset.v);
  } finally { cargando(null); }
}

async function enviarConfig() {
  await cargarTextos({
    [base() + 'libro.toml']: S.cfgTexto,
    [base() + 'indice.toml']: S.indiceToml,
  });
}

function hayCambios() {
  if (!S.cfg) return false;
  for (const [k, v] of S.textos) if (S.originales.get(k) !== v) return true;
  return S.cfgTexto !== S.originales.get('libro.toml');
}
function marcarEstado() {
  const e = $('#estado'); if (!e) return;
  const sucio = hayCambios();
  e.classList.toggle('sucio', sucio);
  $('span:last-child', e).textContent = sucio ? 'Cambios sin guardar' : 'Guardado en GitHub';
  $$('#lista .it').forEach((it) => it.classList.toggle('cambiado', S.textos.get(it.dataset.a) !== S.originales.get(it.dataset.a)));
}

/* ═════════ índice lateral ═════════ */
function datosCapitulos() {
  let n = 0;
  return (S.cfg.contenido || []).map((c, i) => {
    if (c.tipo === 'parte') return { ...c, i };
    if (c.tipo === 'capitulo') n++;
    const txt = S.textos.get(c.archivo) || '';
    return { ...c, i, num: c.tipo === 'capitulo' ? n : null, titulo: primerTitulo(txt) || c.archivo, palabras: txt ? txt.split(/\s+/).length : 0, existe: S.textos.has(c.archivo) };
  });
}
function pintarLista() {
  const d = datosCapitulos();
  let parte = 0;
  const acc = (i) => `<span class="acc"><button data-mov="${i}:-1" title="Subir" aria-label="Subir">${I.arriba}</button><button data-mov="${i}:1" title="Bajar" aria-label="Bajar">${I.abajo}</button><button data-quitar="${i}" title="Quitar del libro" aria-label="Quitar del libro">${I.quitar}</button></span>`;
  $('#lista').innerHTML = d.map((c) => {
    if (c.tipo === 'parte') { parte++; return `<div class="parte"><span>Parte ${parte}</span><b>${esc(c.titulo)}</b>${acc(c.i)}</div>`; }
    const marca = c.num ?? (c.tipo === 'interludio' ? '◆' : '');
    const tit = c.titulo.split(' — ')[0];
    return `<div class="it ${c.archivo === S.actual ? 'sel' : ''}" data-a="${esc(c.archivo)}" title="${esc(c.titulo)}">
      <span class="n">${marca}</span><span class="t">${esc(tit)}</span><span class="p">${c.palabras < 1000 ? c.palabras : (c.palabras / 1000).toFixed(1) + ' mil'}</span>${acc(c.i)}</div>`;
  }).join('');
  const tot = d.reduce((a, c) => a + (c.palabras || 0), 0);
  const caps = d.filter((c) => c.tipo === 'capitulo').length;
  const ult = leer('taller.paginas.' + S.slug, null);
  $('#cuenta').textContent = `${caps} capítulos`;
  $('#resumen').innerHTML = `<b>${numero(tot)}</b> palabras${ult ? ` · <b>${ult.paginas}</b> páginas en el último armado` : ''}`;
  $$('#lista .it').forEach((e) => (e.onclick = (ev) => { if (!ev.target.closest('.acc')) abrirTexto(e.dataset.a); }));
  $$('[data-mov]').forEach((b) => (b.onclick = () => { const [i, dd] = b.dataset.mov.split(':').map(Number); mover(i, dd); }));
  $$('[data-quitar]').forEach((b) => (b.onclick = () => quitar(+b.dataset.quitar)));
  marcarEstado();
}
function cambiarContenido(lista) {
  S.cfg.contenido = lista;
  S.cfgTexto = tomlContenido(S.cfgTexto, lista);
  S.cfg = tomlParse(S.cfgTexto);
  enviarConfig(); pintarLista(); programarPrevia(300);
}
function mover(i, d) { const l = [...S.cfg.contenido]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; cambiarContenido(l); }
function quitar(i) {
  const c = S.cfg.contenido[i];
  const nombre = c.titulo || primerTitulo(S.textos.get(c.archivo) || '') || c.archivo;
  if (!confirm(`¿Quitar «${nombre}» del libro? El archivo no se borra: podés volver a sumarlo.`)) return;
  const l = [...S.cfg.contenido]; l.splice(i, 1); cambiarContenido(l);
}
async function nuevoCapitulo() {
  const t = await pedirTexto('Capítulo nuevo', 'Título (podés sumar una bajada después de « — »)', '');
  if (!t) return;
  const slug = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'capitulo';
  const n = (S.cfg.contenido || []).filter((c) => c.archivo).length + 1;
  const archivo = `texto/${String(n).padStart(2, '0')}-${slug}.md`;
  S.textos.set(archivo, `# ${t}\n\n`); S.originales.set(archivo, null);
  const l = [...S.cfg.contenido];
  let pos = l.length; for (let k = l.length - 1; k >= 0; k--) if (['capitulo', 'interludio'].includes(l[k].tipo)) { pos = k + 1; break; }
  l.splice(pos, 0, { tipo: 'capitulo', archivo });
  cambiarContenido(l); abrirTexto(archivo); toast('Capítulo creado. Se sube a GitHub al guardar.');
}
async function nuevaParte() {
  const t = await pedirTexto('Parte nueva', 'Título de la parte (va antes del capítulo abierto)', '');
  if (!t) return;
  const l = [...S.cfg.contenido]; const i = l.findIndex((c) => c.archivo === S.actual);
  l.splice(i < 0 ? l.length : i, 0, { tipo: 'parte', titulo: t }); cambiarContenido(l);
}
function otrosTextos() {
  const t = S.cfg.tapa || {};
  const ops = [[S.cfg.preliminares?.dedicatoria, 'Dedicatoria'], [t.contratapa, 'Contratapa'], [t.solapa_delantera, 'Solapa delantera'], [t.solapa_trasera, 'Solapa trasera']].filter(([a]) => a);
  const d = dialogo(`<h2>Otros textos</h2><div class="letras">${ops.map(([a, n]) => `<button class="letra" data-a="${esc(a)}"><span>${n}</span><span class="nombre">${esc(a)}</span></button>`).join('')}</div>`, [['Cerrar']]);
  $$('[data-a]', d).forEach((b) => (b.onclick = () => { d.close(); abrirTexto(b.dataset.a); verPestana('texto'); }));
}

/* ═════════ editor ═════════ */
const resaltado = HighlightStyle.define([
  { tag: tags.heading1, fontFamily: 'Bricolage, Manrope, sans-serif', fontWeight: '700', fontSize: '1.45em', color: '#1B2430' },
  { tag: tags.heading2, fontFamily: 'Bricolage, Manrope, sans-serif', fontWeight: '700', fontSize: '1.18em', color: '#1B2430' },
  { tag: tags.heading3, fontFamily: 'Bricolage, Manrope, sans-serif', fontWeight: '600', color: '#2A3644' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: [tags.link, tags.url], color: '#076A92' },
  { tag: tags.processingInstruction, color: '#8A939C' },
  { tag: tags.labelName, color: '#C2185B' },
  { tag: tags.quote, color: '#4A5562', fontStyle: 'italic' },
  { tag: tags.meta, color: '#8A939C' },
]);
function crearEditor() {
  S.editor = new EditorView({
    parent: $('#cm'),
    state: EditorState.create({ doc: '', extensions: extensionesEditor() }),
  });
}
function extensionesEditor() {
  return [
    history(), drawSelection(), highlightActiveLine(), highlightSelectionMatches(),
    EditorView.lineWrapping, markdown(), syntaxHighlighting(resaltado),
    campoMarcas, ...(S.conf.ortografia === false ? [] : [ortografiaNavegador]),
    EditorState.phrases.of({ 'Find': 'Buscar', 'Replace': 'Reemplazar', 'next': 'siguiente', 'previous': 'anterior', 'all': 'todos', 'match case': 'mayúsculas', 'by word': 'palabra entera', 'replace': 'reemplazar', 'replace all': 'reemplazar todos', 'close': 'cerrar', 'regexp': 'expresión regular' }),
    keymap.of([
      { key: 'Mod-i', run: () => { insertar('cursiva'); return true; } },
      { key: 'Mod-b', run: () => { insertar('negrita'); return true; } },
      ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab,
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && S.vista === 'revision') programarListaRevision();
      if (!u.docChanged || !S.actual) return;
      S.textos.set(S.actual, u.state.doc.toString());
      marcarEstado(); contarPalabras();
      if ($('#c-auto')?.checked) programarPrevia(1100);
    }),
  ];
}
function abrirTexto(archivo) {
  S.actual = archivo;
  const txt = S.textos.get(archivo) ?? '';
  S.editor.setState(EditorState.create({ doc: txt, extensions: extensionesEditor() }));
  const c = datosCapitulos().find((x) => x.archivo === archivo);
  $('#e-titulo').textContent = c ? c.titulo : archivo;
  $('#e-archivo').textContent = archivo;
  contarPalabras();
  $$('#lista .it').forEach((e) => e.classList.toggle('sel', e.dataset.a === archivo));
  $('#mesa').scrollTop = 0;
  programarPrevia(0);
  if (S.vista === 'asistente') pintarAsistente();
  if (S.vista === 'revision') pintarRevision();
}
function contarPalabras() {
  const t = S.textos.get(S.actual) || '';
  $('#e-palabras').textContent = `${numero(t.split(/\s+/).filter(Boolean).length)} palabras`;
}
function siguienteNota(t) { const ns = [...t.matchAll(/\[\^(\d+)\]/g)].map((m) => +m[1]); return ns.length ? Math.max(...ns) + 1 : 1; }
function insertar(tipo) {
  const v = S.editor; if (!S.actual) return;
  if (tipo === 'buscar') { openSearchPanel(v); return; }
  const { from, to } = v.state.selection.main;
  const sel = v.state.sliceDoc(from, to);
  const antesBloque = from > 0 && v.state.sliceDoc(from - 1, from) !== '\n' ? '\n\n' : '';
  let ins, cursor, alFinal = null;
  const bloque = (t) => { ins = antesBloque + t + '\n\n'; };
  switch (tipo) {
    case 'cursiva': ins = `*${sel || 'texto'}*`; break;
    case 'negrita': ins = `**${sel || 'texto'}**`; break;
    case 'seccion': bloque('## ' + (sel || 'Título de la sección')); break;
    case 'subseccion': bloque('### ' + (sel || 'Título de la subsección')); break;
    case 'nota': { const n = siguienteNota(v.state.doc.toString()); ins = `${sel}[^${n}]`; alFinal = `\n[^${n}]: Fuente o aclaración de la nota.\n`; break; }
    case 'cita': bloque(`::: cita\n\n${sel || 'Texto citado.'}\n\n:::`); break;
    case 'epigrafe': bloque(`::: epigrafe\n\n${sel || 'Primer verso\\\nsegundo verso\\\nAutor'}\n\n:::`); break;
    case 'recuadro': bloque(`::: recuadro\n\n${sel || 'Texto del recuadro.'}\n\n:::`); break;
    case 'leyenda': bloque(`::: leyenda\n\n${sel || 'Fuente: …'}\n\n:::`); break;
    case 'foto': bloque(`![${sel || 'Pie de foto'}](imagenes/archivo.jpg){ancho=80%}`); break;
    case 'mapa': bloque(`![${sel || 'Título del mapa'}](mapas/archivo.svg){.mapa fuente="Elaboración propia"}`); break;
    case 'tabla': bloque('::: tabla\n\n| Columna | Columna |\n|---|---|\n| dato | dato |\n\n:::'); break;
  }
  const cambios = [{ from, to, insert: ins }];
  if (alFinal) cambios.push({ from: v.state.doc.length, insert: alFinal });
  v.dispatch({ changes: cambios, selection: { anchor: from + ins.length } });
  v.focus();
}

/* ═════════ vista previa ═════════ */
function programarPrevia(ms) { clearTimeout(S.tPrevia); S.tPrevia = setTimeout(previa, ms); }
function infoCapitulo(archivo) {
  let n = 0, tipo = 'final';
  for (const c of S.cfg.contenido || []) { if (c.tipo === 'capitulo') n++; if (c.archivo === archivo) { tipo = c.tipo; break; } }
  const esTapa = archivo.startsWith('tapa/') || archivo === S.cfg.preliminares?.dedicatoria;
  return { tipo: esTapa ? 'final' : tipo, numero: n };
}
async function asegurarImagenes(typ) {
  const rutas = [...typ.matchAll(/#figura\("([^"]+)"/g)].map((m) => m[1]).filter((r) => !yaCargado(r));
  if (!rutas.length) return;
  const nuevos = {};
  await enLotes(rutas, 4, async (r) => {
    const rel = r.replace(/^\//, '');
    if (!S.arbol.some((e) => e.path === rel)) return;
    nuevos[r] = await S.gh.bytes(rel);
  });
  await cargarBinarios(nuevos);
}
async function previa() {
  if (!S.actual || S.vista !== 'paginas') return;
  const n = ++S.seqPrevia;
  const info = $('#p-info');
  info.innerHTML = '<span class="spin"></span> Componiendo…';
  try {
    const { tipo, numero: num } = infoCapitulo(S.actual);
    const typ = convertir(S.textos.get(S.actual) || '', { sinNumero: tipo !== 'capitulo', base: base() });
    await asegurarImagenes(typ);
    const pre = tipo === 'capitulo' ? `#counter(heading).update(${num - 1})\n` : '';
    await cargarTextos({
      [base() + '_vista/capitulo.typ']: typ,
      [base() + '_vista/main.typ']: `#import "/plantilla/estilos.typ": *\n#show: libro\n${pre}#modo.update("cuerpo")\n#apertura(impar: false)\n#include "capitulo.typ"\n#cierre()\n`,
    });
    const r = await compilar(base() + '_vista/main.typ', { libro: S.slug, vista: 'si' });
    if (n !== S.seqPrevia) return;
    if (!r.ok) { $('#mesa').innerHTML = `<div class="error">${esc(r.errores.join('\n'))}</div>`; info.textContent = 'Hay un error en el texto'; return; }
    const svg = await aSvg(r.bytes);
    if (n !== S.seqPrevia) return;
    const pags = montarPliegos(svg, $('#mesa'));
    info.textContent = `${pags} ${pags === 1 ? 'página' : 'páginas'} · ${r.segundos.toFixed(1)} s`;
  } catch (e) {
    if (n === S.seqPrevia) { $('#mesa').innerHTML = `<div class="error">${esc(e.message)}</div>`; info.textContent = ''; }
  }
}

// Reacomoda las páginas en pliegos (par a la izquierda, impar a la derecha) con marcas de corte.
function montarPliegos(svgTexto, destino, { pliego = true } = {}) {
  const caja = document.createElement('div');
  caja.innerHTML = svgTexto;
  const svg = caja.querySelector('svg');
  const doc = document;
  svg.querySelectorAll('script').forEach((s) => s.remove());
  const paginas = [...svg.querySelectorAll(':scope > g.typst-page')];
  if (!paginas.length) { destino.innerHTML = '<div class="vacio">Sin páginas.</div>'; return 0; }
  const w = +paginas[0].getAttribute('data-page-width'), alto = +paginas[0].getAttribute('data-page-height');
  const m = 26, gap = 34, marca = 14, sep = 4;
  const NS = 'http://www.w3.org/2000/svg';
  const fondo = doc.createElementNS(NS, 'g');
  svg.insertBefore(fondo, paginas[0]);
  let filas = 0;
  const linea = (x1, y1, x2, y2) => { const l = doc.createElementNS(NS, 'line'); Object.entries({ x1, y1, x2, y2, stroke: '#1B2430', 'stroke-width': 0.5 }).forEach(([k, v]) => l.setAttribute(k, v)); fondo.append(l); };
  const rect = (x, y, ww, hh, attrs) => { const r = doc.createElementNS(NS, 'rect'); Object.entries({ x, y, width: ww, height: hh, ...attrs }).forEach(([k, v]) => r.setAttribute(k, v)); fondo.append(r); };
  const cols = pliego ? 2 : 1;
  const filasPos = new Map();
  paginas.forEach((p, i) => {
    const num = i + 1;
    const col = pliego ? (num % 2 === 1 ? 1 : 0) : 0;
    const fila = pliego ? Math.floor(num / 2) : i;
    filas = Math.max(filas, fila + 1);
    const x = m + col * w, y = m + fila * (alto + gap);
    p.setAttribute('transform', `translate(${x}, ${y})`);
    rect(x + 1.2, y + 2, w, alto, { fill: 'rgba(27,36,48,.10)' });
    rect(x, y, w, alto, { fill: '#fff' });
    const f = filasPos.get(fila) || { x0: Infinity, x1: -Infinity, y };
    f.x0 = Math.min(f.x0, x); f.x1 = Math.max(f.x1, x + w); filasPos.set(fila, f);
  });
  for (const { x0, x1, y } of filasPos.values()) {
    // marcas de corte en las cuatro esquinas del pliego y en el lomo
    for (const [cx, cy, dx, dy] of [[x0, y, -1, -1], [x1, y, 1, -1], [x0, y + alto, -1, 1], [x1, y + alto, 1, 1]]) {
      linea(cx + dx * sep, cy, cx + dx * (sep + marca), cy);
      linea(cx, cy + dy * sep, cx, cy + dy * (sep + marca));
    }
    if (x1 - x0 > w + 1) { const lx = x0 + w; linea(lx, y - sep, lx, y - sep - marca * 0.7); linea(lx, y + alto + sep, lx, y + alto + sep + marca * 0.7); }
  }
  const W = m * 2 + cols * w, H = m * 2 + filas * alto + (filas - 1) * gap;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'pliego-svg');
  svg.removeAttribute('height'); svg.removeAttribute('width');
  svg.dataset.ancho = W;
  destino.replaceChildren(svg);
  aplicarZoom(destino);
  return paginas.length;
}
function aplicarZoom(destino = $('#mesa')) {
  const z = (+($('#zoom')?.value) || 100) / 100;
  $$('svg.pliego-svg', destino).forEach((s) => { s.style.width = Math.round(z * 100) + '%'; s.style.maxWidth = 'none'; });
}

/* ═════════ guardar ═════════ */
async function guardarTodo() {
  const cambios = [];
  for (const [k, v] of S.textos) if (S.originales.get(k) !== v) cambios.push([k, v]);
  if (S.cfgTexto !== S.originales.get('libro.toml')) cambios.push(['libro.toml', S.cfgTexto]);
  if (!cambios.length) return toast('No hay cambios para guardar.');
  const b = $('#b-guardar'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Guardando…';
  try {
    for (const [k, v] of cambios) {
      const nombre = k === 'libro.toml' ? 'configuración del libro' : (primerTitulo(v) || k);
      await S.gh.guardar(rutaLibro(k), v, `Taller: ${nombre}`);
      S.originales.set(k, v);
      if (!S.arbol.some((e) => e.path === rutaLibro(k))) S.arbol.push({ path: rutaLibro(k) });
    }
    marcarEstado();
    toast(cambios.length === 1 ? 'Guardado en GitHub.' : `Guardados ${cambios.length} archivos en GitHub.`);
  } catch (e) { toast(e.message); }
  finally { b.disabled = false; b.innerHTML = I.subir + 'Guardar'; }
}

/* ═════════ estilos ═════════ */
const val = (ruta) => { const [s, k] = ruta.split('.'); return S.cfg?.[s]?.[k]; };
function selectorLetra(ruta, muestra) {
  const actual = val(ruta) || 'EB Garamond';
  return `<div class="desplegable" data-c="${ruta}" data-valor="${esc(actual)}">
    <button type="button" class="letra" aria-haspopup="listbox"><span class="muestra" style="font-family:'${esc(actual)}'">${esc(muestra)}</span><span class="nombre">${esc(actual)}</span></button>
  </div>`;
}
function activarSelectoresLetra(raiz, alCambiar) {
  $$('.desplegable', raiz).forEach((d) => {
    const boton = $(':scope > .letra', d);
    boton.onclick = () => {
      const abierta = $('.opciones', d); if (abierta) { abierta.remove(); return; }
      $$('.desplegable .opciones').forEach((o) => o.remove());
      const muestra = $('.muestra', boton).textContent;
      const ops = h(`<div class="opciones" role="listbox">${familias().map((f) => `<button type="button" class="letra" role="option" aria-checked="${f === d.dataset.valor}" data-f="${esc(f)}"><span class="muestra" style="font-family:'${esc(f)}'">${esc(muestra)}</span><span class="nombre">${esc(f)}</span></button>`).join('')}</div>`);
      d.append(ops);
      $$('[data-f]', ops).forEach((o) => (o.onclick = () => {
        d.dataset.valor = o.dataset.f;
        $('.muestra', boton).style.fontFamily = `'${o.dataset.f}'`; $('.nombre', boton).textContent = o.dataset.f;
        ops.remove(); alCambiar?.();
      }));
    };
  });
}
document.addEventListener('click', (e) => { if (!e.target.closest('.desplegable')) $$('.desplegable .opciones').forEach((o) => o.remove()); });

function campo(ruta, etiqueta, tipo = 'text', extra = '') {
  const v = val(ruta);
  if (tipo === 'check') return `<label class="check"><input type="checkbox" data-c="${ruta}" ${v ?? true ? 'checked' : ''}>${etiqueta}</label>`;
  if (tipo === 'color') return `<label class="campo"><span>${etiqueta}</span><input class="entrada" type="color" data-c="${ruta}" value="${esc(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000')}"></label>`;
  return `<label class="campo ${extra}"><span>${etiqueta}</span><input class="entrada" ${tipo === 'number' ? 'type="number" step="any"' : ''} data-c="${ruta}" value="${esc(v ?? '')}"></label>`;
}
function opciones(ruta, etiqueta, lista) {
  const v = val(ruta);
  return `<label class="campo"><span>${etiqueta}</span><select class="entrada" data-c="${ruta}">${lista.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
}
function leerForm(raiz) {
  const cambios = {};
  $$('[data-c]', raiz).forEach((el) => {
    const [s, k] = el.dataset.c.split('.');
    let v;
    if (el.classList.contains('desplegable')) v = el.dataset.valor;
    else if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') v = el.value === '' ? 0 : Number(el.value);
    else v = el.value.trim();
    if (v === undefined) return;
    (cambios[s] ||= {})[k] = v;
  });
  return cambios;
}
function aplicarCambiosConfig(cambios) {
  let t = S.cfgTexto;
  for (const [s, kv] of Object.entries(cambios)) for (const [k, v] of Object.entries(kv)) {
    if (k === 'isbn' || k === 'anio' ? false : v === '' && val(`${s}.${k}`) === undefined) continue;
    t = tomlSet(t, s, k, v);
  }
  tomlParse(t); // valida
  S.cfgTexto = t; S.cfg = tomlParse(t);
  enviarConfig(); marcarEstado();
}

function pintarEstilos() {
  const v = $('#v-estilos');
  const formatos = Object.entries(S.presets.formatos).map(([k, f]) => [k, `${k.replace('x', ' × ')}  (${parseFloat(f.ancho)} × ${parseFloat(f.alto)} mm)`]);
  v.innerHTML = `
  <div class="form" id="f-estilos">
    <h2>Estilos del libro</h2>
    <p>Los cambios se ven en las páginas de la derecha y se guardan en GitHub con el botón Guardar.</p>
    <div class="grupo"><h3>Diseño del interior <small class="sutil">${DISENOS_INTERIOR.length} modelos · un clic aplica letras, medidas y apertura</small></h3>
      <div class="estilos-tapa galeria-int" role="radiogroup">${DISENOS_INTERIOR.map((d) => `<button type="button" class="est-tapa est-int" data-int="${d.id}" title="${esc(d.nota)}"><span class="mini mini-pag" data-mini-int="${d.id}"><span class="spin"></span></span><span>${d.nombre}</span></button>`).join('')}</div>
    </div>
    <div class="grupo"><h3>Datos del libro</h3><div class="grilla">
      ${campo('libro.titulo', 'Título', 'text', 'ancho')}${campo('libro.subtitulo', 'Subtítulo', 'text', 'ancho')}
      ${campo('libro.autor', 'Autor')}${campo('libro.editorial', 'Editorial')}
      ${campo('libro.ciudad', 'Ciudad')}${campo('libro.anio', 'Año', 'number')}
      ${campo('libro.isbn', 'ISBN')}${campo('libro.edicion', 'Edición')}
    </div></div>
    <div class="grupo"><h3>Medida y márgenes</h3><div class="grilla">
      <div class="ancho">${opciones('formato.preset', 'Medida de la página', formatos)}</div>
      ${campo('formato.margen_interior', 'Margen interior (lomo)')}${campo('formato.margen_exterior', 'Margen exterior')}
      ${campo('formato.margen_superior', 'Margen superior')}${campo('formato.margen_inferior', 'Margen inferior')}
    </div></div>
    <div class="grupo"><h3>Letras</h3><div class="grilla">
      <div class="campo ancho"><span>Texto</span>${selectorLetra('tipografia.fuente', 'Migrar no es un acto ilegal, es un acto humano.')}</div>
      <div class="campo ancho"><span>Títulos</span>${selectorLetra('tipografia.fuente_titulos', 'América Latina')}</div>
      <div class="campo ancho"><span>Apoyo: cornisas, pies y tablas</span>${selectorLetra('tipografia.fuente_apoyo', 'Fuente: ACNUR, 2024')}</div>
      ${campo('tipografia.cuerpo', 'Cuerpo')}${campo('tipografia.interlineado', 'Interlineado')}
      ${campo('tipografia.notas', 'Notas al pie')}${campo('tipografia.sangria', 'Sangría')}
      <div class="ancho">${campo('tipografia.justificado', 'Texto justificado', 'check')}${campo('tipografia.guiones', 'Partición silábica en castellano', 'check')}</div>
    </div></div>
    <div class="grupo"><h3>Página y capítulos</h3><div class="grilla">
      ${opciones('estilo.cornisa_par', 'Cornisa en página par', [['autor', 'Autor'], ['titulo', 'Título del libro'], ['capitulo', 'Capítulo'], ['nada', 'Nada']])}
      ${opciones('estilo.cornisa_impar', 'Cornisa en página impar', [['capitulo', 'Capítulo'], ['titulo', 'Título del libro'], ['autor', 'Autor'], ['nada', 'Nada']])}
      ${opciones('estilo.folio', 'Número de página', [['abajo-afuera', 'Abajo, hacia afuera'], ['abajo-centro', 'Abajo, al centro']])}
      ${opciones('estilo.apertura', 'Apertura de capítulo', APERTURAS)}
      ${campo('estilo.color_acento', 'Color de acento', 'color')}
      <div class="ancho">
        ${campo('estilo.secciones_color', 'Números de sección en el color de acento', 'check')}
        ${campo('estilo.capitulo_en_impar', 'Cada capítulo empieza en página impar', 'check')}
        ${campo('estilo.numerar_secciones', 'Numerar secciones (1.1, 1.2…)', 'check')}
        ${campo('estilo.notas_por_capitulo', 'Las notas vuelven a 1 en cada capítulo', 'check')}
        ${campo('estilo.indice_analitico', 'Índice analítico al final', 'check')}
        ${campo('estilo.colofon', 'Colofón', 'check')}
      </div>
    </div></div>
    <div class="guardar"><button class="btn prim" id="b-ver-estilos">Ver cómo queda</button><button class="btn" id="b-guardar-estilos">${I.subir}Guardar en GitHub</button></div>
  </div>
  <section class="lado-der"><div class="cab"><span class="info" id="pe-info">Capítulo abierto: ${esc($('#e-titulo').textContent)}</span></div><div class="mesa" id="mesa-estilos"><div class="vacio"><h3>Probá un cambio</h3>Tocá «Ver cómo queda» para componer el capítulo abierto con estos estilos.</div></div></section>`;
  const f = $('#f-estilos');
  const aplicar = () => { try { aplicarCambiosConfig(leerForm(f)); } catch (e) { toast('Hay un valor inválido: ' + e.message); return false; } return true; };
  activarSelectoresLetra(f, aplicar);
  $$('input, select', f).forEach((el) => el.addEventListener('change', aplicar));
  $('#b-ver-estilos').onclick = async () => {
    if (!aplicar()) return;
    const m = $('#mesa-estilos'); m.innerHTML = '<div class="vacio"><span class="spin"></span></div>';
    const vieja = $('#mesa'); const tmp = S.vista; S.vista = 'paginas';
    await previa(); S.vista = tmp;
    m.replaceChildren(...[...vieja.childNodes].map((n) => n.cloneNode(true)));
    aplicarZoom(m); $('#pe-info').textContent = $('#p-info').textContent;
  };
  $('#b-guardar-estilos').onclick = () => { if (aplicar()) guardarTodo(); };
  marcarDisenoInterior();
  $$('.est-int', f).forEach((b) => (b.onclick = () => {
    const d = DISENOS_INTERIOR.find((x) => x.id === b.dataset.int);
    const cambios = { tipografia: { fuente: d.fuente, fuente_titulos: d.fuente_titulos, fuente_apoyo: d.fuente_apoyo, cuerpo: d.cuerpo, interlineado: d.interlineado }, estilo: { apertura: d.apertura, color_acento: d.color_acento, secciones_color: d.secciones_color } };
    try { aplicarCambiosConfig(cambios); } catch (e) { return toast(e.message); }
    toast(`Diseño «${d.nombre}» aplicado. Guardá para que quede en GitHub.`);
    const scroll = f.scrollTop; pintarEstilos(); $('#f-estilos').scrollTop = scroll; $('#b-ver-estilos').click();
  }));
  miniaturasInterior();
}
function marcarDisenoInterior() {
  const t = S.cfg.tipografia || {}, e = S.cfg.estilo || {};
  $$('.est-int').forEach((b) => {
    const d = DISENOS_INTERIOR.find((x) => x.id === b.dataset.int);
    const igual = d.fuente === (t.fuente || 'EB Garamond') && d.fuente_titulos === (t.fuente_titulos || t.fuente) && d.apertura === (e.apertura || 'clasica');
    b.setAttribute('aria-checked', String(igual));
  });
}
// Miniaturas reales del interior: la primera página de un capítulo de muestra con cada diseño.
async function miniaturasInterior() {
  const n = ++seqInterior;
  await cargarTextos({ [base() + '_muestra/main.typ']: MUESTRA_INTERIOR });
  const fmt = S.presets.formatos[S.cfg.formato?.preset];
  for (const d of DISENOS_INTERIOR) {
    const caja = $(`[data-mini-int="${d.id}"]`); if (!caja || n !== seqInterior) return;
    if (fmt) caja.style.aspectRatio = `${parseFloat(fmt.ancho)} / ${parseFloat(fmt.alto)}`;
    try {
      const r = await compilar(base() + '_muestra/main.typ', { libro: S.slug, vista: 'si', fuente: d.fuente, fuente_titulos: d.fuente_titulos, fuente_apoyo: d.fuente_apoyo, cuerpo: d.cuerpo, interlineado: d.interlineado, apertura: d.apertura, color_acento: d.color_acento, secciones_color: String(d.secciones_color) });
      if (n !== seqInterior) return;
      caja.innerHTML = r.ok ? await aSvg(r.bytes) : '<small>error</small>';
    } catch { caja.innerHTML = '<small>—</small>'; }
  }
}

/* ═════════ tapa ═════════ */
const DISENOS_INTERIOR = [
  { id: 'clasico', nombre: 'Clásico', nota: 'Garamond, número arriba y título a la izquierda.', fuente: 'EB Garamond', fuente_titulos: 'EB Garamond', fuente_apoyo: 'Inter', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'clasica', color_acento: '#000000', secciones_color: false },
  { id: 'literario', nombre: 'Literario', nota: 'Crimson y Cormorant, apertura centrada con versalitas.', fuente: 'Crimson Pro', fuente_titulos: 'Cormorant', fuente_apoyo: 'Inter', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'centrada', color_acento: '#8A2B22', secciones_color: false },
  { id: 'ensayo', nombre: 'Ensayo moderno', nota: 'Source Serif con filete de color y apoyo en Inter.', fuente: 'Source Serif 4', fuente_titulos: 'Inter', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15pt', apertura: 'filete', color_acento: '#1F5F8B', secciones_color: true },
  { id: 'academico', nombre: 'Académico', nota: 'Libertinus compacto, ideal para muchas notas.', fuente: 'Libertinus Serif', fuente_titulos: 'Libertinus Serif', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '14.5pt', apertura: 'clasica', color_acento: '#000000', secciones_color: false },
  { id: 'periodistico', nombre: 'Periodístico', nota: 'Merriweather y Fraunces, número gigante de color.', fuente: 'Merriweather', fuente_titulos: 'Fraunces', fuente_apoyo: 'Inter', cuerpo: '10.5pt', interlineado: '15pt', apertura: 'numero', color_acento: '#C2410C', secciones_color: true },
  { id: 'contemporaneo', nombre: 'Contemporáneo', nota: 'Lora y Playfair, número grande y aire.', fuente: 'Lora', fuente_titulos: 'Playfair Display', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15.5pt', apertura: 'numero', color_acento: '#0F766E', secciones_color: false },
  { id: 'manual', nombre: 'Manual', nota: 'Banda de color a sangre, al estilo Orange Book.', fuente: 'Source Serif 4', fuente_titulos: 'Inter', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15pt', apertura: 'banda', color_acento: '#E07B00', secciones_color: true },
  { id: 'novela', nombre: 'Novela', nota: 'Título en negrita sin número, al estilo Wonderous.', fuente: 'EB Garamond', fuente_titulos: 'EB Garamond', fuente_apoyo: 'EB Garamond', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'novela', color_acento: '#000000', secciones_color: false },
];
const APERTURAS = [['clasica', 'Clásica'], ['centrada', 'Centrada'], ['numero', 'Número grande'], ['filete', 'Filete de color'], ['banda', 'Banda a sangre'], ['novela', 'Novela (sin número)']];
const MUESTRA_INTERIOR = `#import "/plantilla/estilos.typ": *
#show: libro
#counter(heading).update(2)
#modo.update("cuerpo")
#apertura(impar: false)
= Rutas del sur
La frontera no es una línea: es un lugar donde se espera. Hay quien espera días, hay quien espera años, y hay quien ya no sabe qué espera. En el borde de cada país se acumulan historias que nadie escribe.

Durante la última década, los movimientos de población en América Latina cambiaron de escala y de dirección. Lo que antes era una migración de norte a sur se volvió una red de rutas cruzadas.

== Entre dos orillas
Las cifras ayudan a entender la magnitud, pero no alcanzan. Detrás de cada número hay una decisión tomada a la fuerza, una despedida y un camino que nadie eligió del todo.
#cierre()
`;
let seqInterior = 0;
const ESTILOS_TAPA = [
  ['clasica', 'Clásica', 'Título sobre una línea que cruza la tapa, el lomo y la contratapa.'],
  ['editorial', 'Editorial', 'Filete de color, título grande y autor en el color de acento.'],
  ['tipografica', 'Tipográfica', 'El título ocupa la tapa; bloque de color abajo.'],
  ['minimalista', 'Minimalista', 'Mucho aire: título chico y un punto de color.'],
  ['coleccion', 'Colección', 'Franja de color con el sello y el número de la colección.'],
  ['dos-tintas', 'Dos tintas', 'Mitad de color, mitad fondo; el título apoyado en el corte.'],
  ['marco', 'Marco', 'Doble filete y composición centrada, de libro de biblioteca.'],
  ['cruce', 'Cruce', 'Dos franjas diagonales que se cruzan.'],
  ['centrada', 'Centrada', 'Todo al centro, título grande y un filete.'],
  ['foto', 'Foto', 'Imagen a sangre con el título abajo sobre una sombra (sin foto, un degradé).'],
  ['suiza', 'Suiza', 'Grilla, barra vertical de color y título en palo seco muy negro.'],
  ['generativa', 'Generativa', 'Arte geométrico creado a partir de las letras del título (10PRINT).'],
];
const PALETAS_TAPA = [
  ['Noche y oro', '#1d2a33', '#f4efe6', '#d9a441', '#8a6420'],
  ['Papel y tinta', '#f3eee4', '#1b1b1b', '#b8322a', '#6b1d18'],
  ['Mar', '#0f3b4c', '#eef4f2', '#5cc2b3', '#1f7a7a'],
  ['Terracota', '#efe3d3', '#2b211c', '#c2562e', '#7a3018'],
  ['Bosque', '#1f3326', '#f1efe4', '#c9a94d', '#6d8a4f'],
  ['Rojo editorial', '#a3201d', '#fbf4ea', '#f2c14e', '#5e0f0d'],
  ['Pizarra', '#2e3238', '#f2f2ef', '#e46a3c', '#8c3a1d'],
  ['Lavanda', '#e8e3f1', '#231f33', '#5b3fa8', '#b29be0'],
  ['Arena', '#e9dfc9', '#2a2a2a', '#2f5d8a', '#93a9c0'],
  ['Negro total', '#111111', '#ffffff', '#ffffff', '#555555'],
];
let seqMinis = 0;
function pintarTapa() {
  const v = $('#v-tapa');
  const t = S.cfg.tapa || {};
  const estilo = t.estilo || 'clasica';
  v.innerHTML = `
  <div class="form" id="f-tapa">
    <h2>Tapa</h2>
    <p>Elegí un diseño y una paleta; después ajustá a mano. El lomo se calcula con las páginas del último armado y el papel elegido.</p>
    <div class="grupo"><h3>Diseño <small class="sutil">${ESTILOS_TAPA.length} modelos · las miniaturas son tu tapa real</small></h3>
      <div class="estilos-tapa galeria" role="radiogroup">${ESTILOS_TAPA.map(([k, n, d]) => `<button type="button" class="est-tapa" role="radio" aria-checked="${k === estilo}" data-est="${k}" title="${esc(d)}"><span class="mini mini-real" data-mini="${k}"><span class="spin"></span></span><span>${n}</span></button>`).join('')}</div>
    </div>
    <div class="grupo"><h3>Colores</h3>
      <div class="paletas">${PALETAS_TAPA.map(([n, f, tx, ac, se], i) => `<button type="button" class="paleta" data-pal="${i}" title="${esc(n)}"><span style="background:${f}"></span><span style="background:${ac}"></span><span style="background:${se}"></span><span style="background:${tx}"></span><em>${esc(n)}</em></button>`).join('')}</div>
      <div class="grilla" style="margin-top:14px">
        ${campo('tapa.fondo', 'Fondo', 'color')}${campo('tapa.color_texto', 'Texto', 'color')}
        ${campo('tapa.color_acento', 'Acento', 'color')}${campo('tapa.color_secundario', 'Segundo color', 'color')}
      </div>
    </div>
    <div class="grupo"><h3>Título e imagen</h3><div class="grilla">
        <div class="campo ancho"><span>Letra del título de tapa</span>${selectorLetra('tapa.fuente_titulo', S.cfg.libro?.titulo || 'Título')}</div>
        ${campo('tapa.imagen', 'Imagen de tapa (ruta en el repo)', 'text', 'ancho')}
        ${campo('tapa.coleccion', 'Colección (diseño Colección)')}${campo('tapa.numero', 'Número en la colección')}
    </div></div>
    <div class="grupo"><h3>Papel y medidas</h3><div class="grilla">
      ${opciones('tapa.papel', 'Papel', Object.keys(S.presets.papeles).map((p) => [p, p]))}
      ${campo('tapa.cartulina_mm', 'Cartulina (mm al lomo)', 'number')}
      ${campo('tapa.solapa', 'Solapas (0mm = sin solapas)')}${campo('tapa.sangrado', 'Sangrado')}
    </div></div>
    <div class="grupo"><h3>Textos de tapa</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[['contratapa', 'Contratapa'], ['solapa_delantera', 'Solapa delantera'], ['solapa_trasera', 'Solapa trasera']].filter(([k]) => t[k]).map(([k, n]) => `<button class="btn chico" data-abrir="${esc(t[k])}">Editar ${n.toLowerCase()}</button>`).join('')}
    </div></div>
    <input type="hidden" data-c="tapa.estilo" value="${esc(estilo)}">
    <div class="guardar"><button class="btn prim" id="b-ver-tapa">Ver la tapa</button><button class="btn" id="b-guardar-tapa">${I.subir}Guardar en GitHub</button></div>
  </div>
  <section class="lado-der"><div class="cab"><span class="info" id="pt-info"></span><div class="der"><label class="check" style="font-size:12.5px"><input type="checkbox" id="c-guias" checked>Guías de corte y pliegue</label></div></div><div class="mesa" id="mesa-tapa"></div></section>`;
  const f = $('#f-tapa');
  const aplicar = () => { try { aplicarCambiosConfig(leerForm(f)); return true; } catch (e) { toast('Hay un valor inválido: ' + e.message); return false; } };
  const todo = () => { verTapa().then(miniaturasTapa); };
  activarSelectoresLetra(f, () => { aplicar(); todo(); });
  $$('.est-tapa', f).forEach((b) => (b.onclick = () => { $$('.est-tapa', f).forEach((x) => x.setAttribute('aria-checked', String(x === b))); $('[data-c="tapa.estilo"]', f).value = b.dataset.est; aplicar(); verTapa(); }));
  $$('.paleta', f).forEach((b) => (b.onclick = () => {
    const [, fo, tx, ac, se] = PALETAS_TAPA[+b.dataset.pal];
    $('[data-c="tapa.fondo"]', f).value = fo; $('[data-c="tapa.color_texto"]', f).value = tx;
    $('[data-c="tapa.color_acento"]', f).value = ac; $('[data-c="tapa.color_secundario"]', f).value = se;
    if (aplicar()) todo();
  }));
  $$('input, select', f).forEach((el) => el.addEventListener('change', () => { if (aplicar()) todo(); }));
  $$('[data-abrir]', f).forEach((b) => (b.onclick = () => { abrirTexto(b.dataset.abrir); verPestana('texto'); }));
  $('#b-ver-tapa').onclick = () => { if (aplicar()) verTapa(); };
  $('#b-guardar-tapa').onclick = () => { if (aplicar()) guardarTodo(); };
  $('#c-guias').onchange = verTapa;
  todo();
}
// Miniaturas reales: compila solo el frente de la tapa con cada diseño.
async function miniaturasTapa() {
  const n = ++seqMinis;
  const ult = leer('taller.paginas.' + S.slug, null);
  const paginas = String(ult?.paginas || estimarPaginas());
  for (const [k] of ESTILOS_TAPA) {
    const caja = $(`[data-mini="${k}"]`); if (!caja || n !== seqMinis) return;
    try {
      const r = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas, lomo: '20mm', solo_tapa: 'si', estilo_tapa: k });
      if (n !== seqMinis) return;
      if (!r.ok) { caja.innerHTML = '<small>error</small>'; continue; }
      caja.innerHTML = await aSvg(r.bytes);
    } catch { caja.innerHTML = '<small>—</small>'; }
  }
}
async function prepararTapa(paginas) {
  const t = S.cfg.tapa || {};
  const arch = {};
  for (const k of ['contratapa', 'solapa_delantera', 'solapa_trasera']) {
    const destino = base() + '_build/tapa-' + k.replace('_', '-') + '.typ';
    arch[destino] = t[k] && S.textos.has(t[k]) ? convertir(S.textos.get(t[k]), { sinNumero: true, base: base() }) : '';
  }
  await cargarTextos(arch);
  const img = [t.imagen, t.imagen_contratapa, t.foto_autor].filter(Boolean).map((p) => `#figura("${base()}${p}"`).join('\n');
  if (img) await asegurarImagenes(img);
  const lomo = lomoMm(S.cfg, S.presets, paginas);
  return { lomo };
}
async function verTapa() {
  const m = $('#mesa-tapa'); if (!m) return;
  const f = $('#f-tapa'); if (f) { const fmt = S.presets.formatos[S.cfg.formato?.preset]; const ar = fmt ? `${parseFloat(fmt.ancho)} / ${parseFloat(fmt.alto)}` : '2 / 3'; $$('.mini-real', f).forEach((x) => (x.style.aspectRatio = ar)); }
  const ult = leer('taller.paginas.' + S.slug, null);
  const paginas = ult?.paginas || estimarPaginas();
  m.innerHTML = '<div class="vacio"><span class="spin"></span></div>';
  try {
    const { lomo } = await prepararTapa(paginas);
    const r = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas: String(paginas), lomo: lomo.toFixed(2) + 'mm', guias: $('#c-guias')?.checked ? 'si' : 'no' });
    if (!r.ok) { m.innerHTML = `<div class="error">${esc(r.errores.join('\n'))}</div>`; return; }
    const svg = await aSvg(r.bytes);
    montarPliegos(svg, m, { pliego: false });
    $$('svg', m).forEach((s) => { s.style.width = '100%'; s.style.maxWidth = '100%'; });
    $('#pt-info').textContent = `Lomo de ${lomo.toFixed(1)} mm para ${paginas} páginas${ult ? '' : ' (estimadas: armá el libro para el valor real)'}`;
  } catch (e) { m.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
function estimarPaginas() {
  const palabras = [...S.textos.values()].reduce((a, t) => a + t.split(/\s+/).length, 0);
  return Math.round(palabras / 280 / 2) * 2 || 200;
}

/* ═════════ producción ═════════ */
function avisos() {
  const out = [];
  for (const c of S.cfg.contenido || []) {
    if (!c.archivo) continue;
    const s = S.textos.get(c.archivo);
    if (s == null) { out.push(`Falta el archivo ${c.archivo}.`); continue; }
    const t = primerTitulo(s) || c.archivo;
    if (/NOTA FALTANTE/.test(s)) out.push(`«${t}»: hay notas sin texto.`);
    if (/[Ee]spacio reservado/.test(s)) out.push(`«${t}»: todavía tiene texto de «espacio reservado».`);
    const llam = new Set([...s.matchAll(/\[\^([^\]]+)\](?!:)/g)].map((m) => m[1]));
    const defs = new Set([...s.matchAll(/^\[\^([^\]]+)\]:/gm)].map((m) => m[1]));
    const faltan = [...llam].filter((x) => !defs.has(x));
    if (faltan.length) out.push(`«${t}»: notas llamadas sin texto (${faltan.slice(0, 4).join(', ')}).`);
    for (const m of s.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) if (!/^https?:/.test(m[1]) && !S.arbol.some((e) => e.path === rutaLibro(m[1]))) out.push(`«${t}»: no encuentro la imagen ${m[1]}.`);
  }
  if (!S.cfg.libro?.isbn) out.push('Falta el ISBN: la contratapa lleva un recuadro en su lugar.');
  return out;
}
async function prepararLibroCompleto(progreso) {
  const arch = {};
  const contenido = S.cfg.contenido || [];
  contenido.forEach((it, i) => {
    if (it.tipo === 'parte') return;
    arch[base() + '_build/' + nombreTyp(i, it.archivo)] = convertir(S.textos.get(it.archivo) || '', { sinNumero: it.tipo !== 'capitulo', base: base() });
  });
  const ded = S.cfg.preliminares?.dedicatoria;
  if (ded) arch[base() + '_build/dedicatoria.typ'] = convertir(S.textos.get(ded) || '', { sinNumero: true });
  arch[base() + '_build/libro.typ'] = principal(S.cfg);
  const todas = Object.values(arch).join('\n');
  const rutas = [...new Set([...todas.matchAll(/#figura\("([^"]+)"/g)].map((m) => m[1]))].filter((r) => !yaCargado(r));
  let hechas = 0;
  const nuevos = {};
  await enLotes(rutas, 4, async (r) => {
    const rel = r.replace(/^\//, '');
    if (S.arbol.some((e) => e.path === rel)) nuevos[r] = await S.gh.bytes(rel);
    progreso?.(`Bajando imágenes y mapas: ${++hechas} de ${rutas.length}`, 0.05 + 0.35 * hechas / Math.max(rutas.length, 1));
  });
  await cargarBinarios(nuevos);
  await cargarTextos(arch);
}
let urls = [];
function pintarProduccion() {
  const v = $('#v-produccion');
  const ult = leer('taller.paginas.' + S.slug, null);
  const lista = avisos();
  v.innerHTML = `
  <div class="prod">
    <div class="bloque">
      <h2>Armar el libro</h2>
      <p>Compone el libro completo acá mismo, en tu navegador, y te da el PDF del interior y el de la tapa con el lomo calculado.</p>
      <button class="btn prim" id="b-armar" style="height:40px">Armar PDF y tapa</button>
      <div class="progreso" id="pr" hidden><i></i></div>
      <div class="nota" id="pr-msg" style="font-size:12.5px;color:var(--tinta-suave)"></div>
      <div class="cifras" id="cifras">${ult ? cifras(ult) : ''}</div>
      <div class="descargas" id="descargas"></div>
    </div>
    <div class="bloque">
      <h2>Antes de imprenta</h2>
      <p>Lo que conviene resolver antes de mandar los archivos.</p>
      <ul class="lista-avisos">${lista.length ? lista.map((a) => `<li>${esc(a)}</li>`).join('') : '<li class="ok">Todo en orden.</li>'}</ul>
    </div>
    <div class="bloque">
      <h2>Armado en GitHub</h2>
      <p>Arma interior, tapa y EPUB en los servidores de GitHub con lo último que guardaste. Los archivos quedan para descargar en la corrida.</p>
      <button class="btn" id="b-actions">Armar en GitHub</button>
      <div class="corridas" id="corridas"></div>
    </div>
    <div class="bloque ancho">
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:260px"><h2>Versiones publicadas</h2>
        <p>Cada versión guarda en GitHub el interior, la tapa y el EPUB con nombre y fecha. No vencen y se bajan desde cualquier compu o celular.</p></div>
        <button class="btn prim" id="b-publicar">Publicar versión</button>
      </div>
      <div id="versiones"><div class="nota" style="font-size:12.5px;color:var(--tinta-suave)"><span class="spin"></span> Buscando versiones…</div></div>
    </div>
    <div class="bloque">
      <h2>Simulador de páginas</h2>
      <p>Prueba medidas y cuerpos de letra y cuenta las páginas de cada combinación. Cada prueba tarda unos segundos.</p>
      <div class="grilla">
        <label class="campo"><span>Medidas</span><input class="entrada" id="s-formatos" value="14x21 15x23 17x24"></label>
        <label class="campo"><span>Cuerpo / interlineado</span><input class="entrada" id="s-cuerpos" value="11/14.5 12/17"></label>
        <label class="campo"><span>Páginas buscadas</span><input class="entrada" id="s-objetivo" type="number" value="500"></label>
        <div class="campo"><span>&nbsp;</span><button class="btn" id="b-simular">Simular</button></div>
      </div>
      <div id="sim"></div>
    </div>
  </div>`;
  $('#b-armar').onclick = armarAca;
  $('#b-actions').onclick = armarGitHub;
  $('#b-simular').onclick = simular;
  $('#b-publicar').onclick = publicarVersion;
  listarVersiones();
  if (urls.length) $('#descargas').innerHTML = urls.map(([u, n, a]) => `<a class="btn" href="${u}" download="${esc(a)}">${I.bajar}${esc(n)}</a>`).join('');
  listarCorridas();
}
const cifras = (u) => `<div class="cifra"><b>${u.paginas}</b><span>páginas</span></div><div class="cifra"><b>${u.lomo.toFixed(1)}<small style="font-size:16px"> mm</small></b><span>de lomo</span></div><div class="cifra"><b style="font-size:20px;line-height:34px">${new Date(u.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</b><span>último armado</span></div>`;
async function armarAca() {
  const b = $('#b-armar'); b.disabled = true;
  const pr = $('#pr'), msg = $('#pr-msg'); pr.hidden = false;
  const paso = (t, f) => { msg.textContent = t; $('i', pr).style.width = Math.round(f * 100) + '%'; };
  try {
    paso('Preparando los textos…', 0.03);
    await prepararLibroCompleto(paso);
    paso('Componiendo el libro completo (puede tardar medio minuto)…', 0.45);
    const r = await compilar(base() + '_build/libro.typ', { libro: S.slug }, 'pdf');
    if (!r.ok) throw new Error(r.errores.join('\n'));
    const paginas = contarPaginasPdf(r.bytes);
    paso('Componiendo la tapa…', 0.85);
    const { lomo } = await prepararTapa(paginas);
    const rt = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas: String(paginas), lomo: lomo.toFixed(2) + 'mm', guias: 'no' }, 'pdf');
    const rg = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas: String(paginas), lomo: lomo.toFixed(2) + 'mm', guias: 'si' }, 'pdf');
    urls.forEach(([u]) => URL.revokeObjectURL(u));
    const blob = (bytes) => URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const nombre = (S.cfg.libro?.titulo || S.slug).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    urls = [[blob(r.bytes), 'Interior para imprenta', `${nombre}-interior.pdf`]];
    if (rt.ok) urls.push([blob(rt.bytes), 'Tapa para imprenta', `${nombre}-tapa.pdf`]);
    if (rg.ok) urls.push([blob(rg.bytes), 'Tapa con guías', `${nombre}-tapa-guias.pdf`]);
    const ult = { paginas, lomo, fecha: Date.now() };
    escribir('taller.paginas.' + S.slug, ult);
    $('#cifras').innerHTML = cifras(ult);
    $('#descargas').innerHTML = urls.map(([u, n, a]) => `<a class="btn" href="${u}" download="${esc(a)}">${I.bajar}${esc(n)}</a>`).join('');
    paso(`Listo en ${r.segundos.toFixed(0)} segundos.${paginas % 16 ? ` Para pliegos de 16 faltan ${16 - (paginas % 16)} páginas.` : ''}`, 1);
    pintarLista();
  } catch (e) { msg.innerHTML = `<div class="error" style="margin-top:8px">${esc(e.message)}</div>`; }
  finally { b.disabled = false; }
}
async function armarGitHub() {
  if (hayCambios() && !confirm('Hay cambios sin guardar. GitHub arma con lo último guardado. ¿Seguir igual?')) return;
  const b = $('#b-actions'); b.disabled = true;
  try { await S.gh.lanzarArmado(S.slug); toast('Armado pedido. En unos minutos aparece listo.'); setTimeout(listarCorridas, 4000); }
  catch (e) { toast(e.message); } finally { b.disabled = false; }
}
async function publicarVersion() {
  if (hayCambios()) { toast('Primero guardá los cambios: la versión se arma con lo que está en GitHub.'); return; }
  const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = dialogo(`<h2>Publicar versión</h2>
    <p style="margin:0;color:var(--tinta-suave)">GitHub arma el libro con lo último guardado y lo publica. Tarda unos tres minutos.</p>
    <label class="campo"><span>Nombre</span><input class="entrada" id="v-nombre" value="${esc((S.cfg.libro?.titulo || S.slug) + ' · ' + fecha)}"></label>
    <label class="campo"><span>Nota (opcional)</span><textarea class="entrada" id="v-nota" rows="3" placeholder="Por ejemplo: versión para enviar a la imprenta, con los capítulos 21 a 23 condensados."></textarea></label>`,
  [['Cancelar'], ['Publicar', 'prim']]);
  d.addEventListener('close', async () => {
    if (d.returnValue !== '1') return;
    const nombre = $('#v-nombre', d).value.trim() || S.slug, nota = $('#v-nota', d).value.trim();
    try {
      await S.gh.lanzarArmado(S.slug, nombre, nota);
      toast('Publicando. En unos minutos aparece en la lista.');
      $('#versiones').insertAdjacentHTML('afterbegin', `<div class="corrida" id="v-pend"><i class="va"></i><span>Armando «${esc(nombre)}»…</span><span></span></div>`);
      esperarVersion(nombre, 0);
      setTimeout(listarCorridas, 4000);
    } catch (e) { toast(e.message); }
  });
}
function esperarVersion(nombre, n) {
  if (n > 40 || !$('#versiones')) return;
  setTimeout(async () => {
    const lista = await S.gh.versiones().catch(() => []);
    if (lista.some((r) => r.name === nombre)) { listarVersiones(); toast(`Versión «${nombre}» publicada.`); }
    else esperarVersion(nombre, n + 1);
  }, 15000);
}
async function listarVersiones() {
  const c = $('#versiones'); if (!c) return;
  try {
    const lista = (await S.gh.versiones()).filter((r) => r.tag_name.startsWith(S.slug + '-'));
    const pend = $('#v-pend')?.outerHTML || '';
    const tam = (b) => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' kB';
    const nombreArch = (n) => n.endsWith('.epub') ? 'EPUB' : n.includes('tapa-guias') ? 'Tapa con guías' : n.includes('tapa') ? 'Tapa' : n.includes('interior') ? 'Interior' : n;
    c.innerHTML = pend + (lista.length ? `<table class="tabla"><tr><th>Versión</th><th>Fecha</th><th>Archivos</th></tr>${lista.map((r) => `<tr>
      <td><b>${esc(r.name || r.tag_name)}</b>${r.body ? `<div style="font-size:12px;color:var(--tinta-suave);max-width:46ch">${esc(r.body.split('\n')[0])}</div>` : ''}</td>
      <td style="white-space:nowrap">${new Date(r.published_at || r.created_at).toLocaleDateString('es-AR', { dateStyle: 'medium' })}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">${r.assets.map((a) => `<a class="btn chico" href="${a.browser_download_url}" title="${tam(a.size)}">${I.bajar}${nombreArch(a.name)}</a>`).join('')}</div></td></tr>`).join('')}</table>`
      : (pend ? '' : '<div class="nota" style="font-size:12.5px;color:var(--tinta-suave)">Todavía no publicaste ninguna versión.</div>'));
  } catch (e) { c.innerHTML = `<div class="nota" style="font-size:12.5px;color:var(--tinta-suave)">${esc(e.message)}</div>`; }
}
let tCorridas;
async function listarCorridas() {
  const c = $('#corridas'); if (!c) return;
  try {
    const r = await S.gh.corridas();
    const filas = (r.workflow_runs || []).slice(0, 4);
    c.innerHTML = filas.length ? filas.map((x) => {
      const cl = x.status !== 'completed' ? 'va' : x.conclusion === 'success' ? 'ok' : 'mal';
      const est = x.status !== 'completed' ? 'Armando…' : x.conclusion === 'success' ? 'Listo' : 'Falló';
      return `<div class="corrida"><i class="${cl}"></i><span>${est} · ${new Date(x.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span><a class="enlace" href="${x.html_url}" target="_blank" rel="noopener">${x.conclusion === 'success' ? 'Descargar' : 'Ver'}</a></div>`;
    }).join('') : '<div class="nota" style="font-size:12.5px;color:var(--tinta-suave)">Todavía no hay armados.</div>';
    clearTimeout(tCorridas);
    if (filas.some((x) => x.status !== 'completed') && $('#v-produccion').classList.contains('activa')) tCorridas = setTimeout(listarCorridas, 8000);
  } catch (e) { c.innerHTML = `<div class="nota" style="font-size:12.5px;color:var(--tinta-suave)">${esc(e.message)}</div>`; }
}
async function simular() {
  const b = $('#b-simular'); b.disabled = true;
  const formatos = $('#s-formatos').value.trim().split(/\s+/).filter((f) => S.presets.formatos[f]);
  const cuerpos = $('#s-cuerpos').value.trim().split(/\s+/).filter((c) => /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test(c));
  const obj = +$('#s-objetivo').value || null;
  const sim = $('#sim');
  if (!formatos.length || !cuerpos.length) { sim.innerHTML = '<p class="nota">Revisá las medidas (por ejemplo 15x23) y los cuerpos (por ejemplo 11/14.5).</p>'; b.disabled = false; return; }
  const filas = [];
  const pintar = (actual) => {
    const cerca = obj ? [...filas].sort((a, c) => Math.abs(a.p - obj) - Math.abs(c.p - obj)).slice(0, 2) : [];
    sim.innerHTML = `<table class="tabla"><tr><th>Medida</th><th>Letra</th><th style="text-align:right">Páginas</th><th style="text-align:right">Lomo</th><th></th></tr>${filas.map((f, i) => `<tr class="${cerca.includes(f) ? 'cerca' : ''}"><td>${f.f.replace('x', ' × ')}</td><td>${f.c.replace('/', ' / ')} pt</td><td class="num">${f.p}</td><td class="num">${f.l.toFixed(1)} mm</td><td><button class="btn chico" data-usar="${i}">Usar</button></td></tr>`).join('')}</table>${actual ? `<p class="nota" style="margin-top:10px"><span class="spin"></span> Probando ${actual}…</p>` : ''}`;
    $$('[data-usar]', sim).forEach((x) => (x.onclick = () => {
      const f = filas[+x.dataset.usar]; const [cu, il] = f.c.split('/');
      aplicarCambiosConfig({ formato: { preset: f.f }, tipografia: { cuerpo: cu + 'pt', interlineado: il + 'pt' } });
      toast(`Aplicado: ${f.f.replace('x', ' × ')}, ${cu}/${il}. Guardá para conservarlo.`); programarPrevia(100);
    }));
  };
  try {
    pintar('los textos');
    await prepararLibroCompleto();
    for (const f of formatos) for (const c of cuerpos) {
      const [cu, il] = c.split('/');
      pintar(`${f.replace('x', ' × ')} con ${cu}/${il}`);
      const r = await compilar(base() + '_build/libro.typ', { libro: S.slug, formato: f, cuerpo: cu + 'pt', interlineado: il + 'pt', notas: (cu * 0.82).toFixed(1) + 'pt' }, 'pdf');
      if (!r.ok) continue;
      const p = contarPaginasPdf(r.bytes);
      filas.push({ f, c, p, l: lomoMm(S.cfg, S.presets, p) });
    }
    pintar(null);
  } catch (e) { sim.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  finally { b.disabled = false; }
}

/* ═════════ asistente (Groq o Gemini) ═════════ */
let ultimaRespuesta = null;
let listaGemini = null;
const provActual = () => S.conf.proveedor || (S.conf.groq || !S.conf.gemini ? 'groq' : 'gemini');
const claveIA = (p = provActual()) => S.conf[p] || '';
function modelosDe(p) { return p === 'gemini' ? (listaGemini || MODELOS_GEMINI) : MODELOS; }
function pintarAsistente() {
  const a = $('#asistente');
  const p = provActual();
  const selProv = `<div class="segmento" role="group" style="align-self:flex-start">${Object.entries(PROVEEDORES).map(([k, x]) => `<button aria-pressed="${k === p}" data-prov="${k}">${x.nombre}${S.conf[k] ? '' : ' ·'}</button>`).join('')}</div>`;
  const enlazarProv = () => $$('[data-prov]', a).forEach((b) => (b.onclick = () => { S.conf.proveedor = b.dataset.prov; escribir('taller.conf', S.conf); pintarAsistente(); }));
  if (!claveIA(p)) {
    const P = PROVEEDORES[p];
    a.innerHTML = `<div class="vacio" style="margin-top:22px"><h3>Asistente de edición</h3><p>Condensa, corrige y encuentra repeticiones en el texto que marques. Groq y Gemini tienen plan gratuito: podés activar uno o los dos.</p>
      ${selProv}
      <ol class="pasos" style="text-align:left;margin:14px 0"><li>Entrá a <a href="${P.claves}" target="_blank" rel="noopener">${P.claves.replace('https://', '')}</a> y creá una clave${p === 'gemini' ? ' («Create API key»)' : ''}.</li><li>Pegala acá. Queda guardada solo en este navegador.</li></ol>
      <input class="entrada" id="i-clave-ia" type="password" placeholder="${P.pista}" style="margin-bottom:10px"><button class="btn prim" id="b-clave-ia">Activar ${P.nombre}</button></div>`;
    enlazarProv();
    $('#b-clave-ia').onclick = () => { const k = $('#i-clave-ia').value.trim(); if (!k) return; S.conf[p] = k; S.conf.proveedor = p; escribir('taller.conf', S.conf); pintarAsistente(); };
    return;
  }
  if (p === 'gemini' && !listaGemini) modelosGemini(claveIA('gemini')).then((l) => { listaGemini = l; if (S.vista === 'asistente' && provActual() === 'gemini') pintarAsistente(); });
  const mods = modelosDe(p);
  const elegido = S.conf['modelo_' + p] || (p === 'groq' ? S.conf.modelo : '') || mods[0].id;
  a.innerHTML = `${selProv}
    <div class="nota">Marcá un fragmento en el editor y elegí qué hacer. Sin selección, trabaja sobre todo el capítulo.</div>
    <div class="acciones">${Object.entries(ACCIONES).map(([k, x]) => `<button class="btn chico" data-ia="${k}">${x.nombre}</button>`).join('')}</div>
    <label class="campo"><span>O pedile otra cosa</span><textarea class="entrada" id="ia-pedido" rows="2" placeholder="Por ejemplo: ¿qué partes de este capítulo repiten lo que ya dice el capítulo anterior?"></textarea></label>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn" id="b-ia-pedir">Preguntar</button>
      <select class="entrada" id="ia-modelo" style="width:auto;max-width:210px;height:30px;font-size:12.5px">${mods.map((m) => `<option value="${m.id}" ${m.id === elegido ? 'selected' : ''}>${m.nombre}</option>`).join('')}${mods.some((m) => m.id === elegido) ? '' : `<option value="${esc(elegido)}" selected>${esc(elegido)}</option>`}</select></div>
    <div id="ia-out"></div>`;
  enlazarProv();
  $('#ia-modelo').onchange = (e) => { S.conf['modelo_' + p] = e.target.value; escribir('taller.conf', S.conf); };
  $$('[data-ia]', a).forEach((b) => (b.onclick = () => consultar(b.dataset.ia)));
  $('#b-ia-pedir').onclick = () => { const q = $('#ia-pedido').value.trim(); if (q) consultar(null, q); };
  if (ultimaRespuesta) mostrarRespuesta(ultimaRespuesta);
}
function opcionesIA() {
  const p = provActual();
  return { proveedor: p, clave: claveIA(p), modelo: S.conf['modelo_' + p] || (p === 'groq' ? S.conf.modelo : '') || modelosDe(p)[0].id };
}
async function consultar(accion, pedido) {
  const v = S.editor; const { from, to } = v.state.selection.main;
  const conSel = to > from;
  const texto = conSel ? v.state.sliceDoc(from, to) : v.state.doc.toString();
  if (texto.length > 60000) return toast('El capítulo es muy largo para una sola consulta: marcá una parte.');
  const out = $('#ia-out'); out.innerHTML = '<div class="nota"><span class="spin"></span> Pensando…</div>';
  try {
    const r = await preguntar({ ...opcionesIA(), accion, texto, pedido });
    ultimaRespuesta = { r, accion, from, to, conSel, archivo: S.actual };
    mostrarRespuesta(ultimaRespuesta);
  } catch (e) { out.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
function mostrarRespuesta(x) {
  const out = $('#ia-out'); if (!out) return;
  const reemplaza = x.accion && ACCIONES[x.accion].reemplaza;
  out.innerHTML = `<div class="respuesta">${esc(x.r)}</div>
    <div class="respuesta-acc" style="margin-top:10px">
      ${reemplaza && x.archivo === S.actual ? `<button class="btn prim chico" id="ia-reemp">${x.conSel ? 'Reemplazar el fragmento' : 'Reemplazar el capítulo'}</button>` : ''}
      <button class="btn chico" id="ia-copiar">Copiar</button></div>`;
  $('#ia-copiar').onclick = () => { navigator.clipboard?.writeText(x.r); toast('Copiado.'); };
  const rb = $('#ia-reemp');
  if (rb) rb.onclick = () => {
    const v = S.editor;
    const from = x.conSel ? x.from : 0, to = x.conSel ? x.to : v.state.doc.length;
    v.dispatch({ changes: { from, to, insert: x.r }, selection: { anchor: from, head: from + x.r.length } });
    ultimaRespuesta = null; toast('Reemplazado. Podés deshacer con Ctrl+Z.'); pintarAsistente();
  };
}

/* ═════════ revisión: ortografía, gramática y estilo ═════════ */
const TIPOS_REV = { orto: 'Ortografía', gram: 'Gramática y puntuación', estilo: 'Estilo' };
let tListaRev;
function programarListaRevision() { clearTimeout(tListaRev); tListaRev = setTimeout(pintarListaRevision, 300); }
function pintarRevision() {
  const a = $('#revision');
  const hayIA = !!claveIA();
  a.innerHTML = `
    <div class="nota">Revisá el capítulo abierto. Las palabras dudosas quedan subrayadas en el editor; acá abajo elegís la corrección. Con un fragmento marcado, revisa solo ese fragmento.</div>
    <div class="acciones">
      <button class="btn prim chico" id="rev-lt">Revisar con LanguageTool</button>
      <button class="btn chico" id="rev-ia" ${hayIA ? '' : 'disabled title="Activá Gemini o Groq en la pestaña Asistente"'}>Revisar con ${PROVEEDORES[provActual()].nombre.replace(' (Google)', '')}</button>
      <button class="btn chico" id="rev-limpiar">Limpiar marcas</button>
    </div>
    <label class="check" style="font-size:12.5px"><input type="checkbox" id="rev-orto" ${S.conf.ortografia === false ? '' : 'checked'}>Subrayado ortográfico del navegador mientras escribo</label>
    <div id="rev-estado"></div>
    <div id="rev-lista" class="rev-lista"></div>`;
  $('#rev-lt').onclick = () => revisar('lt');
  $('#rev-ia').onclick = () => revisar('ia');
  $('#rev-limpiar').onclick = () => { S.editor.dispatch({ effects: fijarMarcas.of([]) }); pintarListaRevision(); };
  $('#rev-orto').onchange = (e) => {
    S.conf.ortografia = e.target.checked; escribir('taller.conf', S.conf);
    const marcas = listarMarcas(S.editor.state), sel = S.editor.state.selection;
    S.editor.setState(EditorState.create({ doc: S.editor.state.doc, selection: sel, extensions: extensionesEditor() }));
    S.editor.dispatch({ effects: fijarMarcas.of(marcas) });
  };
  pintarListaRevision();
}
function zonaRevision() {
  const v = S.editor; const { from, to } = v.state.selection.main;
  return to > from ? { from, to, texto: v.state.sliceDoc(from, to) } : { from: 0, to: v.state.doc.length, texto: v.state.doc.toString() };
}
async function revisar(cual) {
  if (!S.actual) return toast('Abrí un capítulo primero.');
  const z = zonaRevision();
  const est = $('#rev-estado');
  const botones = $$('#revision .acciones button'); botones.forEach((b) => (b.disabled = true));
  try {
    let marcas;
    if (cual === 'lt') {
      marcas = await revisarLanguageTool(z.texto, { progreso: (i, n) => { est.innerHTML = `<div class="nota"><span class="spin"></span> Revisando… ${n > 1 ? `parte ${Math.min(i + 1, n)} de ${n}` : ''}</div>`; } });
    } else {
      // la IA trabaja mejor por tramos: de a ~6000 caracteres, cortando en párrafos
      marcas = [];
      const tramos = []; let ini = 0;
      while (ini < z.texto.length) { let fin = Math.min(z.texto.length, ini + 6000); if (fin < z.texto.length) { const p = z.texto.lastIndexOf('\n\n', fin); if (p > ini + 1000) fin = p; } tramos.push([ini, fin]); ini = fin; }
      for (let i = 0; i < tramos.length; i++) {
        est.innerHTML = `<div class="nota"><span class="spin"></span> ${PROVEEDORES[provActual()].nombre} está leyendo… ${tramos.length > 1 ? `tramo ${i + 1} de ${tramos.length}` : ''}</div>`;
        const [a, b] = tramos[i];
        const r = await preguntar({ ...opcionesIA(), pedido: PEDIDO_REVISION, texto: z.texto.slice(a, b), accion: null });
        marcas.push(...marcasDesdeIA(r, z.texto.slice(a, b), a));
      }
    }
    marcas = marcas.map((m) => ({ ...m, from: m.from + z.from, to: m.to + z.from }));
    const previas = listarMarcas(S.editor.state).filter((m) => m.to <= z.from || m.from >= z.to);
    S.editor.dispatch({ effects: fijarMarcas.of([...previas, ...marcas]) });
    est.innerHTML = marcas.length ? '' : '<div class="nota">No encontré nada para corregir.</div>';
  } catch (e) { est.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  finally { botones.forEach((b) => (b.disabled = false)); if (!claveIA()) $('#rev-ia').disabled = true; pintarListaRevision(); }
}
function contexto(doc, m) {
  const a = Math.max(0, m.from - 40), b = Math.min(doc.length, m.to + 40);
  return `${a > 0 ? '…' : ''}${esc(doc.sliceString(a, m.from))}<mark>${esc(doc.sliceString(m.from, m.to))}</mark>${esc(doc.sliceString(m.to, b))}${b < doc.length ? '…' : ''}`.replace(/\n+/g, ' ');
}
function pintarListaRevision() {
  const caja = $('#rev-lista'); if (!caja) return;
  const v = S.editor, marcas = listarMarcas(v.state);
  if (!marcas.length) { caja.innerHTML = ''; return; }
  const cuenta = Object.keys(TIPOS_REV).map((t) => [t, marcas.filter((m) => m.tipo === t).length]).filter(([, n]) => n);
  caja.innerHTML = `<div class="rev-cuenta">${marcas.length} ${marcas.length === 1 ? 'observación' : 'observaciones'} · ${cuenta.map(([t, n]) => `<span class="punto-${t}"></span>${TIPOS_REV[t]} ${n}`).join(' · ')}</div>` +
    marcas.map((m, i) => `<div class="rev-item" data-i="${i}">
      <div class="rev-msg"><span class="punto-${m.tipo}"></span>${esc(m.mensaje)} <small>${esc(m.origen)}</small></div>
      <div class="rev-ctx">${contexto(v.state.doc, m)}</div>
      <div class="respuesta-acc">${m.sugerencias.map((s, k) => `<button class="btn chico prim-suave" data-s="${k}">${esc(s) || '<i>borrar</i>'}</button>`).join('')}<button class="btn chico" data-ign>Ignorar</button></div>
    </div>`).join('');
  $$('.rev-item', caja).forEach((el) => {
    const m = marcas[+el.dataset.i];
    el.querySelector('.rev-ctx').onclick = () => { v.dispatch({ selection: { anchor: m.from, head: m.to }, scrollIntoView: true }); v.focus(); };
    $$('[data-s]', el).forEach((b) => (b.onclick = () => {
      const actual = listarMarcas(v.state).find((x) => x.id === m.id); if (!actual) return pintarListaRevision();
      v.dispatch({ changes: { from: actual.from, to: actual.to, insert: m.sugerencias[+b.dataset.s] }, effects: quitarMarca.of(m.id) });
      pintarListaRevision();
    }));
    el.querySelector('[data-ign]').onclick = () => { v.dispatch({ effects: quitarMarca.of(m.id) }); pintarListaRevision(); };
  });
}

/* ═════════ diálogos ═════════ */
function dialogo(html, botones) {
  const d = h(`<dialog><div class="cuerpo">${html}</div><div class="pie">${botones.map(([t, c], i) => `<button class="btn ${c || ''}" data-i="${i}">${t}</button>`).join('')}</div></dialog>`);
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  $$('.pie [data-i]', d).forEach((b) => (b.onclick = () => { d.returnValue = b.dataset.i; d.close(); }));
  return d;
}
function pedirTexto(titulo, etiqueta, valor) {
  return new Promise((res) => {
    const d = dialogo(`<h2>${esc(titulo)}</h2><label class="campo"><span>${esc(etiqueta)}</span><input class="entrada" id="d-in" value="${esc(valor)}"></label>`, [['Cancelar'], ['Aceptar', 'prim']]);
    const inp = $('#d-in', d); inp.focus();
    inp.onkeydown = (e) => { if (e.key === 'Enter') { d.returnValue = '1'; d.close(); } };
    d.addEventListener('close', () => res(d.returnValue === '1' ? inp.value.trim() : null));
  });
}
function dialogoAjustes() {
  const d = dialogo(`<h2>Ajustes</h2>
    <div class="grilla"><label class="campo"><span>Cuenta de GitHub</span><input class="entrada" id="a-owner" value="${esc(S.conf.owner)}"></label>
    <label class="campo"><span>Repositorio</span><input class="entrada" id="a-repo" value="${esc(S.conf.repo)}"></label></div>
    <label class="campo"><span>Clave de GitHub</span><input class="entrada" id="a-token" type="password" value="${esc(S.conf.token)}"></label>
    <label class="campo"><span>Clave de Groq (asistente)</span><input class="entrada" id="a-groq" type="password" value="${esc(S.conf.groq || '')}" placeholder="gsk_…"><small>Se crea gratis en console.groq.com/keys.</small></label>
    <label class="campo"><span>Clave de Gemini (asistente y revisión)</span><input class="entrada" id="a-gemini" type="password" value="${esc(S.conf.gemini || '')}" placeholder="AIza…"><small>Se crea gratis en aistudio.google.com/apikey.</small></label>
    <p style="margin:0;font-size:12.5px;color:var(--tinta-suave)">Las claves quedan guardadas solo en este navegador.</p>`,
  [['Cerrar sesión'], ['Cancelar'], ['Guardar', 'prim']]);
  d.addEventListener('close', async () => {
    if (d.returnValue === '0') { if (hayCambios() && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return; try { localStorage.removeItem('taller.conf'); } catch {} location.reload(); }
    if (d.returnValue !== '2') return;
    const cambioRepo = $('#a-owner', d).value.trim() !== S.conf.owner || $('#a-repo', d).value.trim() !== S.conf.repo || $('#a-token', d).value.trim() !== S.conf.token;
    Object.assign(S.conf, { owner: $('#a-owner', d).value.trim(), repo: $('#a-repo', d).value.trim(), token: $('#a-token', d).value.trim(), groq: $('#a-groq', d).value.trim(), gemini: $('#a-gemini', d).value.trim() });
    escribir('taller.conf', S.conf);
    if (cambioRepo) location.reload(); else { toast('Ajustes guardados.'); if (S.vista === 'asistente') pintarAsistente(); }
  });
}
