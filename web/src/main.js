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
import { importarTexto } from './importar.js';
import { diffWords } from 'diff';
import { revisarOrtotipografia, REGLAS } from './ortotipo.js';
import { abrirPdf, marcadores, dibujarPagina, lienzoPagina } from './compaginar.js';
import { ESTILOS_IMAGEN, ENCUADRES, armarPrompt, generarPollinations, generarGemini } from './imagenia.js';
import { buscarOpenAlex, buscarCrossref, buscarWikipedia, buscarGemini, formatear, ESTILOS_CITA, notasSinEnlace, parecido, NORMAS, revisarNorma, pedidoNorma } from './citas.js';
import { puntuar, hayDictadoNavegador, dictarNavegador, dictarWhisper } from './dictado.js';
import { campoMarcas, fijarMarcas, quitarMarca, listarMarcas, revisarLanguageTool, PEDIDO_REVISION, marcasDesdeIA, ortografiaNavegador, revisarParrafos } from './revision.js';
import { iniciarMotor, cargarTextos, cargarBinarios, yaCargado, compilar, aSvg } from './motor.js';
import { MODELOS, MODELOS_GEMINI, PROVEEDORES, ACCIONES, preguntar, modelosGemini } from './ia.js';
import { instalarPasamanos, entrarConClave, iaDelServidor } from './servidor.js';
import { leerManuscrito, TIPOS_MANUSCRITO } from './leerarchivo.js';
import { SupabaseAlmacen, configBase, guardarConfigBase, sesionActual, entrarConGoogle, entrarConCorreo, salir as salirBase, supa } from './almacen-supabase.js';

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
  pegar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="10" height="11.5" rx="1.5"/><path d="M6 3V1.8h4V3M5.5 7h5M5.5 9.5h5M5.5 12h3"/></svg>',
  micro: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5"/><path d="M3 7.5a5 5 0 0010 0M8 12.5V15"/></svg>',
  imprimir: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 6V2h7v4M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7V14h-7z"/></svg>',
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
if (S.conf.modo === 'clave' && S.conf.clave) instalarPasamanos(() => ({ 'X-Taller-Clave': S.conf.clave }));
(async () => {
  // 1) base propia (Supabase): si hay sesión abierta, entra directo
  if (configBase() && S.conf.modo !== 'clave' && !(S.conf.token && S.conf.modo !== 'supabase')) {
    try {
      const ses = await sesionActual();
      if (ses) return entrarSupabase(ses);
    } catch {}
    return pantallaIngreso();
  }
  // 2) contraseña del taller o clave de GitHub
  if (S.conf.token) { await iaConGitHub(); conectar().catch((e) => pantallaIngreso(e.message)); } else pantallaIngreso();
})();

// Con clave de GitHub propia: la IA gratuita (Gemini) del taller también, sin claves en el navegador.
async function iaConGitHub() {
  const cab = S.conf.modo === 'clave' ? { 'X-Taller-Clave': S.conf.clave } : { 'X-GitHub-Token': S.conf.token };
  const ia = await iaDelServidor(cab);
  if (!ia.gemini && !ia.groq) return;
  instalarPasamanos(() => (S.conf.modo === 'clave' ? { 'X-Taller-Clave': S.conf.clave } : { 'X-GitHub-Token': S.conf.token }), { soloIA: S.conf.modo !== 'clave' });
  // las claves guardadas en este navegador ya no se usan: va todo por el servidor
  S.conf.gemini = ia.gemini ? 'servidor' : '';
  S.conf.groq = ia.groq ? 'servidor' : '';
  S.conf.proveedor = ia.gemini ? 'gemini' : 'groq';
  escribir('taller.conf', S.conf);
}

async function entrarSupabase(ses) {
  S.sesion = ses;
  supa()?.auth.onAuthStateChange((_e, nueva) => { if (nueva) S.sesion = nueva; });
  Object.assign(S.conf, { modo: 'supabase', token: '' });
  // IA: si la publicación tiene claves de Gemini o Groq en el servidor, se usan con la sesión del usuario
  const token = () => S.sesion?.access_token || '';
  const ia = await iaDelServidor({ 'X-Supabase-Token': token() });
  if (ia.gemini || ia.groq) {
    instalarPasamanos(() => ({ 'X-Supabase-Token': token() }), { soloIA: true });
    if (ia.gemini && !S.conf.gemini) S.conf.gemini = 'servidor';
    if (ia.groq && !S.conf.groq) S.conf.groq = 'servidor';
    if (!S.conf.proveedor) S.conf.proveedor = ia.gemini ? 'gemini' : 'groq';
  }
  try { await conectar(); } catch (e) { pantallaIngreso(e.message); }
}

function pantallaIngreso(error) {
  const app = $('#app');
  const paginas = Array.from({ length: 8 }, (_, i) => [8, 1, 4, 5, 7, 2, 3, 6][i]);
  app.innerHTML = `
  <div class="ingreso">
    <section class="lado">
      <div>
        <div class="logo" style="margin-bottom:56px">${I.registro}Taller editorial</div>
        <h1>Del manuscrito al pliego.</h1>
        <p class="bajada">Escribís y corregís en el navegador, ves cada página como va a salir de imprenta y armás el PDF, la tapa con su lomo y el EPUB.</p>
        <div class="pliego" aria-hidden="true">${paginas.map((n, i) => `<i data-n="${n}" class="${[1, 2, 5, 6].includes(i) ? 'lleno' : ''}"></i>`).join('')}</div>
        <div class="pliego-pie">Un pliego de 8 páginas, impuesto para imprenta.</div>
      </div>
      <div class="cmyk" style="width:120px"><i></i><i></i><i></i><i></i></div>
    </section>
    <section class="form-lado">
      <div><h2>Entrar al taller</h2><p style="margin-top:6px">Se hace una sola vez en cada navegador: después entra solo.</p></div>
      ${error ? `<div class="aviso mal">${esc(error)}</div>` : ''}
      ${configBase() ? `
      <button class="btn prim" id="b-google" style="height:44px;justify-content:center;gap:10px"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>Entrar con Google</button>
      <div style="display:flex;gap:8px"><input class="entrada" id="i-correo" type="email" placeholder="o con tu correo: nombre@ejemplo.com" style="flex:1"><button class="btn" id="b-correo">Enviarme el enlace</button></div>
      <p class="sutil" style="font-size:12px;margin:0">Tus libros quedan guardados en tu cuenta, privados. Nadie más los ve.</p>
      <details style="font-size:12.5px;color:var(--tinta-suave)"><summary style="cursor:pointer">Otras formas de entrar</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">` : ''}
      <label class="campo"><span>Contraseña del taller</span>
        <input class="entrada" id="i-clave" type="password" autocomplete="current-password" placeholder="La que te dieron para entrar"></label>
      <button class="btn prim" id="b-clave" style="height:42px;justify-content:center">Entrar al taller</button>
      <details style="font-size:12.5px;color:var(--tinta-suave)"><summary style="cursor:pointer">Entrar con una clave de GitHub (avanzado)</summary>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
      <a class="btn" style="height:40px;justify-content:center" href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Taller%20editorial" target="_blank" rel="noopener">1. Crear la clave en GitHub</a>
      <p style="font-size:13px">Se abre GitHub con todo ya marcado. Elegí <b>No expiration</b> en «Expiration», bajá hasta el final, tocá <b>Generate token</b> y copiá la clave que empieza con <code>ghp_</code>.</p>
      <label class="campo"><span>2. Pegá la clave acá</span>
        <input class="entrada" id="i-token" type="password" autocomplete="off" placeholder="ghp_…"></label>
      <button class="btn" id="b-entrar" style="height:42px;justify-content:center">3. Entrar con la clave de GitHub</button>
      </div></details>
      <details style="font-size:12.5px;color:var(--tinta-suave)"><summary style="cursor:pointer">Otro repositorio</summary>
        <div class="grilla" style="margin-top:10px">
          <label class="campo"><span>Cuenta</span><input class="entrada" id="i-owner" value="${esc(S.conf.owner)}"></label>
          <label class="campo"><span>Repositorio</span><input class="entrada" id="i-repo" value="${esc(S.conf.repo)}"></label>
        </div></details>
      ${configBase() ? '</div></details>' : ''}
      <details style="font-size:12.5px;color:var(--tinta-suave)" ${configBase() ? '' : 'open'}><summary style="cursor:pointer">${configBase() ? 'Usar otra base de datos' : 'Conectar tu base (Supabase) para entrar con Google'}</summary>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          <p style="font-size:12.5px;margin:0">Creá gratis un proyecto en supabase.com y copiá dos datos de <b>Project Settings → API</b>. La guía completa está en el archivo <code>docs/supabase.md</code> del taller.</p>
          <label class="campo"><span>Project URL</span><input class="entrada" id="i-base-url" placeholder="https://xxxx.supabase.co" value="${esc(configBase()?.propia ? configBase().url : '')}"></label>
          <label class="campo"><span>Clave pública (anon / publishable)</span><input class="entrada" id="i-base-clave" placeholder="eyJ… o sb_publishable_…"></label>
          <div style="display:flex;gap:8px"><button class="btn" id="b-base">Conectar</button>${configBase()?.propia ? '<button class="btn" id="b-base-quitar">Volver a la base del taller</button>' : ''}</div>
        </div></details>
    </section>
  </div>`;
  if ($('#b-google')) $('#b-google').onclick = async () => { try { await entrarConGoogle(); } catch (e) { toast(e.message); } };
  if ($('#b-correo')) $('#b-correo').onclick = async () => {
    const c = $('#i-correo').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return toast('Escribí un correo válido.');
    try { await entrarConCorreo(c); toast('Listo: revisá tu correo y tocá el enlace para entrar.'); } catch (e) { toast(e.message); }
  };
  $('#b-base').onclick = () => {
    const u = $('#i-base-url').value.trim(), k = $('#i-base-clave').value.trim();
    if (!/^https:\/\/.+/.test(u) || k.length < 20) return toast('Pegá la Project URL y la clave pública.');
    guardarConfigBase(u, k); Object.assign(S.conf, { modo: '', token: '' }); escribir('taller.conf', S.conf); location.reload();
  };
  if ($('#b-base-quitar')) $('#b-base-quitar').onclick = () => { guardarConfigBase(''); location.reload(); };
  const conClave = async () => {
    const clave = $('#i-clave').value.trim();
    if (!clave) return toast('Escribí la contraseña del taller.');
    const b = $('#b-clave'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Entrando…';
    try {
      const d = await entrarConClave(clave);
      Object.assign(S.conf, { modo: 'clave', clave, token: 'servidor', owner: d.owner, repo: d.repo, nombre: d.nombre,
        gemini: d.ia.gemini ? 'servidor' : S.conf.gemini || '', groq: d.ia.groq ? 'servidor' : d.ia.gemini ? '' : S.conf.groq || '',
        proveedor: d.ia.gemini ? 'gemini' : d.ia.groq ? 'groq' : S.conf.proveedor });
      instalarPasamanos(() => ({ 'X-Taller-Clave': clave }));
      await conectar(); escribir('taller.conf', S.conf);
    } catch (e) { pantallaIngreso(e.message); }
  };
  $('#b-clave').onclick = conClave;
  $('#i-clave').onkeydown = (e) => { if (e.key === 'Enter') conClave(); };
  $('#b-entrar').onclick = async () => {
    S.conf.modo = ''; S.conf.clave = '';
    S.conf.token = $('#i-token').value.trim(); S.conf.owner = $('#i-owner').value.trim(); S.conf.repo = $('#i-repo').value.trim();
    if (!S.conf.token) return toast('Pegá la clave de GitHub para seguir.');
    const b = $('#b-entrar'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Conectando…';
    try { await iaConGitHub(); await conectar(); escribir('taller.conf', S.conf); } catch (e) { pantallaIngreso(e.message); }
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
    S.gh = S.conf.modo === 'supabase' ? new SupabaseAlmacen(S.sesion) : new GitHub(S.conf);
    S.usuario = await S.gh.usuario();
    const info = await S.gh.infoRepo();
    S.gh.rama = S.conf.rama = info.default_branch || 'main';
    cargando('Leyendo el repositorio…');
    S.arbol = await S.gh.arbol();
    S.libros = S.arbol.map((e) => e.path.match(/^libros\/([^/]+)\/libro\.toml$/)?.[1]).filter(Boolean);
    if (!S.libros.length && S.gh.esSupabase) {
      // usuario nuevo: se le crea un primer libro vacío
      cargando('Preparando tu primer libro…');
      const { archivos } = archivosLibroNuevo({ titulo: 'Mi primer libro', autor: S.usuario?.name || '', formato: '15x21' });
      await S.gh.commitVarios(archivos, 'Primer libro');
      S.arbol = await S.gh.arbol();
      S.libros = S.arbol.map((e) => e.path.match(/^libros\/([^/]+)\/libro\.toml$/)?.[1]).filter(Boolean);
    }
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
    // bibliotecas de terceros que usa la plantilla (letra capital: droplet, MIT)
    const terceros = {};
    for (const e of S.arbol.filter((x) => x.path.startsWith('plantilla/terceros/') && x.path.endsWith('.typ'))) terceros['/' + e.path] = await S.gh.texto(e.path);
    await cargarTextos({ '/plantilla/estilos.typ': S.estilosTyp, '/plantilla/tapa.typ': S.tapaTyp, '/plantilla/presets.toml': S.presetsTexto, ...terceros });
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
        <button class="btn chico btn-libros" id="b-libros" title="Ver todos tus libros, abrir uno o empezar uno nuevo">${I.libro || ''}Mis libros</button>
        <select class="selector-libro" id="sel-libro" aria-label="Libro"></select>
        <button class="btn chico prim btn-nuevo-libro" id="b-nuevo-libro" title="Empezar un libro nuevo">${I.mas}Nuevo libro</button>
        <nav class="pestanas" role="tablist">
          <button role="tab" data-v="texto" aria-selected="true">Texto</button>
          <button role="tab" data-v="estilos" aria-selected="false">Estilos</button>
          <button role="tab" data-v="tapa" aria-selected="false">Tapa</button>
          <button role="tab" data-v="libro" aria-selected="false">Libro</button>
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
            <button class="btn chico prim" id="b-importar" title="Subí el manuscrito (Word, PDF o texto) o pegalo, y el taller lo arma solo">${I.subir}Subir manuscrito</button>
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
            <span class="sep"></span>
            <button id="b-dictar" class="dictar" title="Dictar con la voz: escribe donde está el cursor">${I.micro}Dictar</button>
          </div>
          <div class="cm-host" id="cm"></div>
        </section>
        <section class="lado-der">
          <div class="cab">
            <div class="segmento" role="group">
              <button data-lado="paginas" aria-pressed="true">Páginas</button>
              <button data-lado="indice" aria-pressed="false">Índice</button>
              <button data-lado="revision" aria-pressed="false">Revisión</button>
              <button data-lado="citas" aria-pressed="false">Citas</button>
              <button data-lado="asistente" aria-pressed="false">Asistente</button>
            </div>
            <span class="info" id="p-info"></span>
            <div class="der" id="p-der">
              <button class="btn chico" id="b-pdf-cap" title="Descargar o imprimir este capítulo en PDF">${I.bajar}PDF</button>
              <label class="check" style="font-size:12.5px"><input type="checkbox" id="c-auto" checked>Al escribir</label>
              <input type="range" id="zoom" min="40" max="160" value="${leer('taller.zoom', 100)}" aria-label="Tamaño de las páginas">
            </div>
          </div>
          <div class="mesa" id="mesa"><div class="vacio"><h3>Las páginas aparecen acá</h3>Elegí un capítulo del índice.</div></div>
          <div class="asistente" id="indice-vivo" hidden></div>
          <div class="asistente" id="revision" hidden></div>
          <div class="asistente" id="citas" hidden></div>
          <div class="asistente" id="asistente" hidden></div>
        </section>
      </section>
      <section class="vista" id="v-estilos"></section>
      <section class="vista" id="v-tapa"></section>
      <section class="vista" id="v-libro"></section>
      <section class="vista" id="v-produccion"></section>
    </main>
  </div>`;

  pintarSelectorLibros();
  $('#b-libros').onclick = misLibros;
  $('#b-nuevo-libro').onclick = nuevoLibro;
  $('#sel-libro').onchange = (e) => { if (e.target.value === '__nuevo') { e.target.value = S.slug; nuevoLibro(); } else abrirLibro(e.target.value); };
  $$('.pestanas button').forEach((b) => (b.onclick = () => verPestana(b.dataset.v)));
  $('#b-guardar').onclick = guardarTodo;
  $('#b-ajustes').onclick = dialogoAjustes;
  $('#b-nuevo').onclick = nuevoCapitulo;
  $('#b-importar').onclick = () => asistenteImportar();
  $('#b-dictar').onclick = alternarDictado;
  $('#b-parte').onclick = nuevaParte;
  $('#b-otros').onclick = otrosTextos;
  $$('#herr [data-ins]').forEach((b) => (b.onclick = () => insertar(b.dataset.ins)));
  $$('[data-lado]').forEach((b) => (b.onclick = () => verLado(b.dataset.lado)));
  $('#b-pdf-cap').onclick = pdfCapitulo;
  window.addEventListener('resize', () => { clearTimeout(S.tCapa); S.tCapa = setTimeout(capaArrastre, 200); });
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
  if (v === 'libro') pintarLibro();
}
function verLado(l) {
  S.vista = l;
  $$('[data-lado]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lado === l)));
  $('#mesa').hidden = l !== 'paginas';
  $('#asistente').hidden = l !== 'asistente';
  $('#revision').hidden = l !== 'revision';
  $('#indice-vivo').hidden = l !== 'indice';
  $('#citas').hidden = l !== 'citas';
  $('#p-der').style.visibility = l === 'paginas' ? 'visible' : 'hidden';
  $('#p-info').style.visibility = l === 'paginas' ? 'visible' : 'hidden';
  if (l === 'asistente') pintarAsistente();
  if (l === 'revision') pintarRevision();
  if (l === 'indice') pintarIndice();
  if (l === 'citas') pintarCitas();
}

/* ═════════ libro ═════════ */
function pintarSelectorLibros() {
  const nombre = (l) => (l === S.slug && S.cfg?.libro?.titulo) || l;
  $('#sel-libro').innerHTML = S.libros.map((l) => `<option value="${esc(l)}">${esc(nombre(l))}</option>`).join('') + '<option value="__nuevo">＋ Nuevo libro…</option>';
  if (S.slug) $('#sel-libro').value = S.slug;
}

// ── Mis libros: todos los libros del repositorio, para abrir uno o empezar uno nuevo ──
async function misLibros() {
  const d = dialogo(`<h2>Mis libros</h2>
    <p class="sutil" style="margin-top:4px">Cada libro se guarda solo en GitHub, en su propia carpeta. Elegí uno para seguir trabajando donde lo dejaste, o empezá uno nuevo.</p>
    <div class="lista-libros" id="ml-lista"><p class="sutil">Cargando…</p></div>`, [['Cerrar'], ['＋ Nuevo libro', 'prim']]);
  d.addEventListener('close', () => { if (d.returnValue === '1') nuevoLibro(); });
  const datos = await Promise.all(S.libros.map(async (l) => {
    try { const c = tomlParse(await S.gh.texto(`libros/${l}/libro.toml`)); return { l, t: c.libro?.titulo || l, a: c.libro?.autor || '', n: (c.contenido || []).filter((x) => x.archivo).length }; }
    catch { return { l, t: l, a: '', n: 0 }; }
  }));
  $('#ml-lista', d).innerHTML = datos.map((x) => `<button type="button" class="tarjeta-libro ${x.l === S.slug ? 'actual' : ''}" data-l="${esc(x.l)}">
      <b>${esc(x.t)}</b><span>${esc(x.a)}${x.a ? ' · ' : ''}${x.n} ${x.n === 1 ? 'capítulo' : 'capítulos'}</span>${x.l === S.slug ? '<em>abierto ahora</em>' : '<em>Abrir →</em>'}</button>`).join('');
  $$('[data-l]', d).forEach((b) => (b.onclick = () => { d.close(); if (b.dataset.l !== S.slug) abrirLibro(b.dataset.l); }));
}

// ── Libro nuevo: crea la carpeta libros/<nombre>/ con su configuración, un capítulo y los textos de tapa ──
function bloqueToml(texto, seccion) {
  const lineas = texto.split('\n'); const out = []; let dentro = false;
  for (const l of lineas) {
    if (/^\[\[?[a-z_]+\]\]?\s*$/.test(l.trim())) dentro = l.trim() === `[${seccion}]`;
    if (dentro) out.push(l);
  }
  return out.join('\n').trim();
}
const comillas = (t) => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

// Arma los archivos de un libro nuevo (configuración, primer capítulo y textos de tapa)
function archivosLibroNuevo({ titulo, sub = '', autor = '', editorial = '', formato = '15x21', copiar = false }) {
  let slug = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'libro';
  while ((S.libros || []).includes(slug)) slug += '-2';
  copiar = copiar && !!S.cfgTexto;
  const v = (k) => ({ '#nl-sub': sub, '#nl-autor': autor, '#nl-editorial': editorial, '#nl-formato': formato })[k] || '';
    const limpiarTapa = (b) => b.replace(/^(imagen|imagen_contratapa|foto_autor|elementos)\s*=.*$/gm, (m, k) => `${k.padEnd(14)} = ""`);
    const seccion = (nombre, porDefecto) => (copiar && bloqueToml(S.cfgTexto, nombre)) || porDefecto;
    const toml = `# ${titulo} — configuración del libro (creado desde el taller)

[libro]
titulo     = ${comillas(titulo)}
subtitulo  = ${comillas(v('#nl-sub'))}
autor      = ${comillas(v('#nl-autor'))}
editorial  = ${comillas(v('#nl-editorial'))}
ciudad     = ${comillas(S.cfg?.libro?.ciudad || 'Buenos Aires')}
anio       = ${new Date().getFullYear()}
isbn       = ""
edicion    = "Primera edición"

[creditos]
numero_edicion       = "1a ed."
numero_edicion_texto = "Primera edición"
fecha_edicion        = ""
ficha                = true

${seccion('formato', '[formato]').replace(/^preset\s*=.*$/m, '').replace('[formato]', `[formato]\npreset = "${v('#nl-formato')}"`)}

${seccion('tipografia', `[tipografia]
fuente          = "EB Garamond"
fuente_titulos  = "EB Garamond"
fuente_apoyo    = "Inter"
cuerpo          = "11pt"
interlineado    = "15pt"
notas           = "9pt"
sangria         = "1.2em"
justificado     = true
guiones         = true
idioma          = "es"`)}

${seccion('estilo', `[estilo]
columnas          = 1
capitulo_en_impar = true
cornisa_par       = "autor"
cornisa_impar     = "capitulo"
folio             = "abajo-afuera"
apertura          = "clasica"
colofon           = true`)}

[preliminares]
portadilla = true
indice     = "inicio"

${limpiarTapa(seccion('tapa', `[tapa]
estilo           = "clasica"
fuente_titulo    = "EB Garamond"
papel            = "obra-80"
cartulina_mm     = 0.6
solapa           = "0mm"
sangrado         = "3mm"
fondo            = "#1d2a33"
color_texto      = "#f4efe6"
color_acento     = "#d9a441"
elementos        = ""
imagen           = ""
contratapa       = "tapa/contratapa.md"
solapa_delantera = "tapa/solapa-delantera.md"
solapa_trasera   = "tapa/solapa-trasera.md"`))}

[[contenido]]
tipo = "capitulo"
archivo = "texto/01-capitulo-1.md"
`;
    const base = `libros/${slug}/`;
    const archivos = {
      [base + 'libro.toml']: toml,
      [base + 'texto/01-capitulo-1.md']: '# Capítulo 1\n\nEscribí, pegá o importá acá el texto del libro.\n',
      [base + 'tapa/contratapa.md']: 'Texto de la contratapa.\n',
      [base + 'tapa/solapa-delantera.md']: 'Sobre el autor o la autora.\n',
      [base + 'tapa/solapa-trasera.md']: '\n',
    };
  return { slug, archivos };
}

async function nuevoLibro() {
  if (hayCambios() && !confirm('Hay cambios sin guardar en este libro. ¿Seguir igual?')) return;
  const formatos = Object.entries(S.presets?.formatos || { '15x21': { ancho: '150mm', alto: '210mm' } });
  const d = dialogo(`<h2>Nuevo libro</h2>
    <p class="sutil" style="margin-top:4px">Se crea su carpeta en el repositorio con un primer capítulo. Después escribís, pegás o importás el texto.</p>
    <label class="campo"><span>Título</span><input class="entrada" id="nl-titulo" placeholder="Ej.: La patria grande"></label>
    <label class="campo"><span>Subtítulo (opcional)</span><input class="entrada" id="nl-sub"></label>
    <label class="campo"><span>Autor o autora</span><input class="entrada" id="nl-autor" value="${esc(S.cfg?.libro?.autor || '')}"></label>
    <label class="campo"><span>Editorial (opcional)</span><input class="entrada" id="nl-editorial" value="${esc(S.cfg?.libro?.editorial || '')}"></label>
    <label class="campo"><span>Medida</span><select class="entrada" id="nl-formato">${formatos.map(([k, f]) => `<option value="${k}" ${k === (S.cfg?.formato?.preset || '15x21') ? 'selected' : ''}>${k.replace('x', ' × ')} cm (${parseFloat(f.ancho)} × ${parseFloat(f.alto)} mm)</option>`).join('')}</select></label>
    <label class="campo"><span>Diseño de partida</span><select class="entrada" id="nl-base">
      <option value="copiar">El mismo diseño que «${esc(S.cfg?.libro?.titulo || S.slug)}» (letras, márgenes, tapa)</option>
      <option value="limpio">Diseño clásico, desde cero</option></select></label>
    <label class="campo"><span>Manuscrito (opcional)</span><input class="entrada" type="file" id="nl-archivo" accept="${TIPOS_MANUSCRITO}"><small>Word (.docx), PDF o texto. El taller lo corta en capítulos y te muestra cómo queda antes de crear nada.</small></label>`,
    [['Cancelar'], ['Crear el libro', 'prim']]);
  $('#nl-titulo', d).focus();
  d.addEventListener('close', async () => {
    if (d.returnValue !== '1') return;
    const titulo = $('#nl-titulo', d).value.trim();
    if (!titulo) return toast('Escribí el título del libro.');
    const manuscrito = $('#nl-archivo', d).files?.[0] || null;
    const { slug, archivos } = archivosLibroNuevo({ titulo, sub: $('#nl-sub', d).value.trim(), autor: $('#nl-autor', d).value.trim(), editorial: $('#nl-editorial', d).value.trim(), formato: $('#nl-formato', d).value, copiar: $('#nl-base', d).value === 'copiar' });
    cargando('Creando el libro…');
    try {
      await S.gh.commitVarios(archivos, `Libro nuevo: ${titulo}`);
      S.arbol = await S.gh.arbol();
      S.libros = S.arbol.map((e) => e.path.match(/^libros\/([^/]+)\/libro\.toml$/)?.[1]).filter(Boolean);
      S.originales.clear(); S.textos.clear();
      await abrirLibro(slug);
      pintarSelectorLibros();
      if (manuscrito) asistenteImportar(manuscrito);
      else toast(`Listo: «${titulo}» creado. Ya podés escribir o subir el manuscrito.`);
    } catch (e) {
      cargando();
      toast('No se pudo crear el libro: ' + e.message);
    }
  });
}

async function abrirLibro(slug) {
  if (S.slug && hayCambios() && !confirm('Hay cambios sin guardar. ¿Cambiar de libro igual?')) { $('#sel-libro').value = S.slug; return; }
  cargando('Abriendo el libro…');
  try {
    S.slug = slug; escribir('taller.libro', slug); $('#sel-libro').value = slug;
    S.textos.clear(); S.originales.clear(); S.actual = null;
    S.cfgTexto = await S.gh.texto(rutaLibro('libro.toml'));
    S.originales.set('libro.toml', S.cfgTexto);
    S.cfg = tomlParse(S.cfgTexto);
    pintarSelectorLibros();
    const tieneIndice = S.arbol.some((e) => e.path === rutaLibro('indice.toml'));
    S.indiceToml = tieneIndice ? await S.gh.texto(rutaLibro('indice.toml')) : '# sin términos\n';
    S.originales.set('indice.toml', tieneIndice ? S.indiceToml : null);
    // títulos de todos los capítulos (también sirven para avisos y para armar)
    const archivos = new Set((S.cfg.contenido || []).filter((c) => c.archivo).map((c) => c.archivo));
    const t = S.cfg.tapa || {};
    for (const k of ['contratapa', 'solapa_delantera', 'solapa_trasera', 'elementos']) if (t[k]) archivos.add(t[k]);
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
  return S.cfgTexto !== S.originales.get('libro.toml') || (S.originales.has('indice.toml') && S.indiceToml !== S.originales.get('indice.toml'));
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
  if (S.vista === 'citas') pintarCitas();
}
function contarPalabras() {
  const t = S.textos.get(S.actual) || '';
  $('#e-palabras').textContent = `${numero(t.split(/\s+/).filter(Boolean).length)} palabras`;
}
function siguienteNota(t) { const ns = [...t.matchAll(/\[\^(\d+)\]/g)].map((m) => +m[1]); return ns.length ? Math.max(...ns) + 1 : 1; }
// Foto, mapa o gráfico en el interior: subir o elegir una imagen del libro, con pie, fuente y tamaño.
function dialogoFoto(sel = '') {
  const v = S.editor; const { from, to } = v.state.selection.main;
  const ya = S.arbol.map((e) => e.path).filter((p) => p.startsWith(rutaLibro('')) && /\.(jpe?g|png|svg|gif|webp)$/i.test(p) && !/\/tapa\//.test(p)).map((p) => p.slice(rutaLibro('').length));
  const d = dialogo(`<h2>Imagen en el texto</h2>
    <div class="subida"><button type="button" class="btn prim" id="fo-subir">${I.subir}Subir una foto, mapa o gráfico</button><span class="sutil" id="fo-elegida">${ya.length ? `o elegí una de las ${ya.length} del libro:` : ''}</span></div>
    ${ya.length ? `<select class="entrada" id="fo-lista"><option value="">—</option>${ya.map((p) => `<option>${esc(p)}</option>`).join('')}</select>` : ''}
    <div class="grilla">
      <label class="campo ancho"><span>Pie (texto debajo de la imagen)</span><input class="entrada" id="fo-pie" value="${esc(sel)}" placeholder="Ej.: Migrantes cruzando el río Bravo, 2023"></label>
      <label class="campo"><span>Fuente o crédito</span><input class="entrada" id="fo-fuente" placeholder="Ej.: ACNUR / Foto: Ana Pérez"></label>
      <label class="campo"><span>Qué es</span><select class="entrada" id="fo-tipo"><option value="foto">Foto</option><option value="mapa">Mapa</option><option value="grafico">Gráfico</option><option value="ilustracion">Ilustración</option></select></label>
      <label class="campo ancho"><span>Tamaño y lugar</span><select class="entrada" id="fo-tam">
        <option value="ancho=50%">Chica, media caja</option><option value="ancho=80%" selected>Mediana</option><option value="ancho=100%">Todo el ancho del texto</option>
        <option value="pagina=completa">Página completa (dentro de los márgenes)</option><option value="sangrado=si">Página a sangre (sin márgenes)</option><option value="apaisado=si">Apaisada (girada, ocupa una página)</option></select></label>
    </div>
    <p class="sutil" style="margin:0">Para imprimir conviene que la foto tenga al menos 1.800 px de ancho (300 ppp en 15 cm).</p>`, [['Cancelar'], ['Insertar', 'prim']]);
  let ruta = null;
  $('#fo-subir', d).onclick = async () => { const r = await subirFoto('imagenes'); if (r) { ruta = r; $('#fo-elegida', d).textContent = 'Subida: ' + r; } };
  const lista = $('#fo-lista', d); if (lista) lista.onchange = () => { ruta = lista.value || null; };
  d.addEventListener('close', () => {
    if (d.returnValue !== '1') return;
    if (!ruta) return toast('Elegí o subí una imagen.');
    const tipo = $('#fo-tipo', d).value, fuente = $('#fo-fuente', d).value.trim().replace(/"/g, "'");
    const attrs = [tipo !== 'foto' ? '.' + tipo : '', $('#fo-tam', d).value, fuente ? `fuente="${fuente}"` : ''].filter(Boolean).join(' ');
    const md = `![${$('#fo-pie', d).value.trim()}](${ruta}){${attrs}}`;
    const antes = from > 0 && v.state.sliceDoc(from - 1, from) !== '\n' ? '\n\n' : '';
    v.dispatch({ changes: { from, to, insert: antes + md + '\n\n' } });
    programarPrevia(300);
  });
}
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
    case 'foto': dialogoFoto(sel); return;
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
  if (S.indiceToml && S.originales.has('indice.toml') && S.indiceToml !== S.originales.get('indice.toml')) cambios.push(['indice.toml', S.indiceToml]);
  if (!cambios.length) return toast('No hay cambios para guardar.');
  const b = $('#b-guardar'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Guardando…';
  try {
    for (const [k, v] of cambios) {
      const nombre = k === 'libro.toml' ? 'configuración del libro' : k === 'indice.toml' ? 'índice analítico' : (primerTitulo(v) || k);
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

function campo(ruta, etiqueta, tipo = 'text', extra = '', pista = '') {
  const v = val(ruta);
  if (tipo === 'check') return `<label class="check"><input type="checkbox" data-c="${ruta}" ${v ?? (extra !== 'no') ? 'checked' : ''}>${etiqueta}</label>`;
  if (tipo === 'color') return `<label class="campo"><span>${etiqueta}</span><input class="entrada" type="color" data-c="${ruta}" value="${esc(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000')}"></label>`;
  return `<label class="campo ${extra}"><span>${etiqueta}</span><input class="entrada" ${tipo === 'number' ? 'type="number" step="any"' : ''} data-c="${ruta}" value="${esc(v ?? '')}" ${pista ? `placeholder="${esc(pista)}"` : ''}></label>`;
}
function opciones(ruta, etiqueta, lista, defecto) {
  const v = val(ruta) == null ? defecto : String(val(ruta));
  return `<label class="campo"><span>${etiqueta}</span><select class="entrada" data-c="${ruta}">${lista.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
}
function leerForm(raiz) {
  const cambios = {};
  $$('[data-c]', raiz).forEach((el) => {
    const [s, k] = el.dataset.c.split('.');
    let v;
    if (el.classList.contains('desplegable')) v = el.dataset.valor;
    else if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') v = el.value === '' ? (val(el.dataset.c) === undefined ? undefined : 0) : Number(el.value);
    else v = el.value.trim();
    if (['estilo.columnas', 'estilo.indice_profundidad', 'estilo.capitular_lineas'].includes(el.dataset.c)) v = Number(v);
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
    <div class="grupo ia-todo"><h3>Diseño completo con IA</h3>
      <p class="sutil" style="margin:0 0 10px">La IA lee el comienzo del libro y propone todo junto: diseño interior, letra capital, medida, color, diseño de tapa, paleta, letra del título, texto de contratapa e idea para la imagen. Te muestra la propuesta y la aplicás si te gusta. Usa Gemini o Groq gratis (se activan en Texto → Asistente).</p>
      <button type="button" class="btn prim" id="b-ia-todo" ${claveIA() ? '' : 'disabled title="Activá Gemini o Groq en Texto → Asistente"'}>Diseñar el libro con IA</button>
      <div id="ia-todo-res"></div>
    </div>
    <div class="grupo"><h3>Diseño del interior <small class="sutil">${DISENOS_INTERIOR.length} modelos · un clic aplica letras, medidas y apertura</small></h3>
      <div class="estilos-tapa galeria-int" role="radiogroup">${DISENOS_INTERIOR.map((d) => `<button type="button" class="est-tapa est-int" data-int="${d.id}" title="${esc(d.nota)}"><span class="mini mini-pag" data-mini-int="${d.id}"><span class="spin"></span></span><span>${d.nombre}</span></button>`).join('')}</div>
    </div>
    <div class="grupo"><h3>Página de créditos <small class="sutil">página legal: lo vacío no se imprime</small></h3><div class="grilla">
      ${campo('creditos.numero_edicion_texto', 'Edición', 'text', '', 'Primera edición')}${campo('creditos.fecha_edicion', 'Fecha de la edición', 'text', '', 'noviembre de 2026')}
      ${campo('creditos.edicion_a_cargo', 'Edición a cargo de')}${campo('creditos.correccion', 'Corrección')}
      ${campo('creditos.diseno_tapa', 'Diseño de tapa')}${campo('creditos.diseno_interior', 'Diseño interior y composición')}
      ${campo('creditos.foto_tapa', 'Foto de tapa')}${campo('creditos.ilustraciones', 'Ilustraciones')}
      ${campo('creditos.direccion', 'Dirección de la editorial', 'text', 'ancho')}${campo('creditos.web', 'Web o correo de la editorial')}
      ${campo('creditos.impreso', 'Pie de imprenta', 'text', '', 'Impreso en Argentina')}
      <div class="ancho fila-checks">${campo('creditos.ficha', 'Ficha catalográfica (se arma sola; la oficial la da la Cámara del Libro)', 'check')}</div>
      ${campo('creditos.numero_edicion', 'Edición en la ficha', 'text', '', '1a ed.')}${campo('creditos.ciudad_ficha', 'Ciudad en la ficha', 'text', '', 'Ciudad Autónoma de Buenos Aires')}
      ${campo('creditos.cdd', 'CDD (clasificación)', 'text', '', '304.8')}<label class="campo"><span>Materias (separadas por coma)</span><input class="entrada" id="cr-materias" value="${esc((S.cfg.creditos?.materias || []).join(', '))}"></label>
    </div></div>
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
      ${opciones('tipografia.cortes', 'Cortes de palabra en el margen', [['normales', 'Normales'], ['pocos', 'Pocos (menos guiones)'], ['ninguno', 'Ninguno (sin partir palabras)']])}
      <div class="campo"><span>Viudas y huérfanas</span>${campo('tipografia.viudas', 'Evitar renglones sueltos', 'check')}</div>
      <div class="ancho">${campo('tipografia.justificado', 'Texto justificado', 'check')}${campo('tipografia.guiones', 'Partición silábica en castellano', 'check')}</div>
    </div></div>
    <div class="grupo"><h3>Página y capítulos</h3><div class="grilla">
      ${opciones('estilo.cornisa_par', 'Cornisa en página par', [['autor', 'Autor'], ['titulo', 'Título del libro'], ['capitulo', 'Capítulo'], ['nada', 'Nada']])}
      ${opciones('estilo.cornisa_impar', 'Cornisa en página impar', [['capitulo', 'Capítulo'], ['titulo', 'Título del libro'], ['autor', 'Autor'], ['nada', 'Nada']])}
      ${opciones('estilo.folio', 'Número de página', [['abajo-afuera', 'Abajo, hacia afuera'], ['abajo-centro', 'Abajo, al centro'], ['arriba-afuera', 'Arriba, junto a la cornisa']])}
      ${opciones('estilo.norma_citas', 'Norma de citas', [['apa', 'APA 7'], ['chicago', 'Chicago (notas)'], ['iso', 'ISO 690']])}
      <div class="ancho fila-checks">${campo('estilo.capitular', 'Letra capital al empezar cada capítulo', 'check', 'no')}${campo('estilo.capitular_color', 'En el color de acento', 'check', 'no')}</div>
      ${opciones('estilo.capitular_lineas', 'Alto de la letra capital', [['2', '2 renglones'], ['3', '3 renglones'], ['4', '4 renglones']], '3')}
      ${opciones('estilo.indice_profundidad', 'El índice muestra', [['1', 'Solo capítulos'], ['2', 'Capítulos y secciones'], ['3', 'Hasta subsecciones']], '2')}
      ${opciones('estilo.columnas', 'Columnas de texto', [['1', 'Una'], ['2', 'Dos'], ['3', 'Tres']])}
      ${campo('estilo.separacion_columnas', 'Separación entre columnas', 'text', '', '6mm')}
      <div class="ancho fila-checks">${campo('estilo.filete_cornisa', 'Línea bajo la cornisa', 'check', 'no')}${campo('estilo.filete_pie', 'Línea sobre el pie', 'check', 'no')}</div>
      ${opciones('estilo.apertura', 'Apertura de capítulo', APERTURAS)}
      ${campo('estilo.color_acento', 'Color de acento', 'color')}
      <div class="ancho">
        ${campo('estilo.secciones_color', 'Números de sección en el color de acento', 'check', 'no')}
        ${campo('estilo.capitulo_en_impar', 'Cada capítulo empieza en página impar', 'check')}
        ${campo('estilo.numerar_secciones', 'Numerar secciones (1.1, 1.2…)', 'check')}
        ${campo('estilo.notas_por_capitulo', 'Las notas vuelven a 1 en cada capítulo', 'check')}
        ${campo('estilo.indice_analitico', 'Índice analítico al final', 'check')}
        ${campo('estilo.indice_puntos', 'Puntos guía en el índice', 'check')}
        ${campo('estilo.colofon', 'Colofón', 'check')}
      </div>
    </div></div>
    <div class="guardar"><button class="btn prim" id="b-ver-estilos">Ver cómo queda</button><button class="btn" id="b-guardar-estilos">${I.subir}Guardar en GitHub</button></div>
  </div>
  <section class="lado-der"><div class="cab"><div class="segmento" role="group"><button data-ve="plano" aria-pressed="true">Plano de página</button><button data-ve="paginas" aria-pressed="false">Páginas</button></div><span class="info" id="pe-info">Arrastrá los bordes del texto para cambiar los márgenes</span></div><div class="mesa" id="plano-estilos"></div><div class="mesa" id="mesa-estilos" hidden><div class="vacio"><h3>Probá un cambio</h3>Tocá «Ver cómo queda» para componer el capítulo abierto con estos estilos.</div></div></section>`;
  const f = $('#f-estilos');
  const aplicar = () => { try { aplicarCambiosConfig(leerForm(f)); } catch (e) { toast('Hay un valor inválido: ' + e.message); return false; } return true; };
  activarSelectoresLetra(f, aplicar);
  $$('input, select', f).forEach((el) => el.addEventListener('change', aplicar));
  const verLadoEstilos = (cual) => {
    $$('[data-ve]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ve === cual)));
    $('#plano-estilos').hidden = cual !== 'plano'; $('#mesa-estilos').hidden = cual !== 'paginas';
    $('#pe-info').textContent = cual === 'plano' ? 'Arrastrá los bordes del texto para cambiar los márgenes' : 'Capítulo abierto: ' + $('#e-titulo').textContent;
  };
  $$('[data-ve]').forEach((b) => (b.onclick = () => verLadoEstilos(b.dataset.ve)));
  $$('input, select', f).forEach((el) => el.addEventListener('change', () => pintarPlano(f, aplicar)));
  pintarPlano(f, aplicar);
  $('#b-ver-estilos').onclick = async () => {
    verLadoEstilos('paginas');
    if (!aplicar()) return;
    const m = $('#mesa-estilos'); m.innerHTML = '<div class="vacio"><span class="spin"></span></div>';
    const vieja = $('#mesa'); const tmp = S.vista; S.vista = 'paginas';
    await previa(); S.vista = tmp;
    m.replaceChildren(...[...vieja.childNodes].map((n) => n.cloneNode(true)));
    aplicarZoom(m); $('#pe-info').textContent = $('#p-info').textContent;
  };
  $('#b-guardar-estilos').onclick = () => { if (aplicar()) guardarTodo(); };
  marcarDisenoInterior();
  const bia = $('#b-ia-todo', f); if (bia) bia.onclick = disenarConIa;
  const mat = $('#cr-materias', f); if (mat) mat.onchange = () => { try { aplicarCambiosConfig({ creditos: { materias: mat.value.split(',').map((x) => x.trim()).filter(Boolean) } }); } catch (e) { toast(e.message); } };
  $$('.est-int', f).forEach((b) => (b.onclick = () => {
    const d = DISENOS_INTERIOR.find((x) => x.id === b.dataset.int);
    const cambios = { tipografia: { fuente: d.fuente, fuente_titulos: d.fuente_titulos, fuente_apoyo: d.fuente_apoyo, cuerpo: d.cuerpo, interlineado: d.interlineado }, estilo: { apertura: d.apertura, color_acento: d.color_acento, secciones_color: d.secciones_color, capitular: !!d.capitular } };
    try { aplicarCambiosConfig(cambios); } catch (e) { return toast(e.message); }
    toast(`Diseño «${d.nombre}» aplicado. Guardá para que quede en GitHub.`);
    const scroll = f.scrollTop; pintarEstilos(); $('#f-estilos').scrollTop = scroll; $('#b-ver-estilos').click();
  }));
  miniaturasInterior();
}
// Plano de página: par e impar lado a lado, con márgenes, columnas, cornisa, pie y folio.
function pintarPlano(f, aplicar) {
  const caja = $('#plano-estilos'); if (!caja) return;
  const fo = S.cfg.formato || {}, ti = S.cfg.tipografia || {}, es = S.cfg.estilo || {};
  const pre = S.presets.formatos[fo.preset] || S.presets.formatos['15x23'];
  const W = aMm(fo.ancho || pre.ancho), H = aMm(fo.alto || pre.alto);
  const m = { interior: aMm(fo.margen_interior, 20), exterior: aMm(fo.margen_exterior, 16), superior: aMm(fo.margen_superior, 18), inferior: aMm(fo.margen_inferior, 22) };
  const cols = Number(es.columnas || 1), gut = aMm(es.separacion_columnas, 6);
  const cuerpo = aMm(ti.cuerpo || '11pt'), inter = aMm(ti.interlineado || '14.5pt');
  const folio = es.folio || 'abajo-afuera';
  const disp = Math.max(320, caja.clientWidth - 60);
  const k = Math.min(disp / (2 * W + 6), (Math.max(380, caja.clientHeight - 140)) / H); // px por mm
  const ox = 30, oy = 34, gap = 6 * k;
  const X = (p) => ox + (p === 'impar' ? W * k + gap : 0);
  const pagina = (lado) => {
    const x0 = X(lado);
    const izq = lado === 'par' ? m.exterior : m.interior, der = lado === 'par' ? m.interior : m.exterior;
    const tx = x0 + izq * k, ty = oy + m.superior * k, tw = (W - izq - der) * k, th = (H - m.superior - m.inferior) * k;
    const cw = (tw - (cols - 1) * gut * k) / cols;
    const lineas = Math.max(0, Math.floor((H - m.superior - m.inferior) / inter));
    let g = `<rect x="${x0}" y="${oy}" width="${W * k}" height="${H * k}" class="pl-hoja"/>`;
    g += `<rect x="${x0}" y="${oy}" width="${W * k}" height="${H * k}" class="pl-margen"/>`;
    // columnas con renglones simulados
    for (let c = 0; c < cols; c++) {
      const cx = tx + c * (cw + gut * k);
      g += `<rect x="${cx}" y="${ty}" width="${cw}" height="${th}" class="pl-texto"/>`;
      const paso = Math.max(inter * k, 2.2);
      for (let y = ty + paso * 0.8; y < ty + th - 1; y += paso) g += `<line x1="${cx + 1}" x2="${cx + cw - 1}" y1="${y}" y2="${y}" class="pl-renglon"/>`;
    }
    if (cols > 1) for (let c = 1; c < cols; c++) { const gx = tx + c * cw + (c - 0.5) * gut * k; g += `<line x1="${gx}" x2="${gx}" y1="${ty}" y2="${ty + th}" class="pl-medianil"/>`; }
    // cornisa y pie
    const yc = oy + m.superior * k * 0.6, yp = oy + (H - m.inferior * 0.65) * k;
    const alinIzq = lado === 'par';
    const corn = (lado === 'par' ? es.cornisa_par : es.cornisa_impar) || (lado === 'par' ? 'autor' : 'capitulo');
    const textoCorn = { autor: S.cfg.libro?.autor || 'Autor', titulo: S.cfg.libro?.titulo || 'Título', capitulo: 'Capítulo', nada: '' }[corn] || '';
    const n = lado === 'par' ? '24' : '25';
    const cornTxt = folio === 'arriba-afuera' ? (alinIzq ? `${n}   ${textoCorn.toUpperCase()}` : `${textoCorn.toUpperCase()}   ${n}`) : textoCorn.toUpperCase();
    g += `<text x="${alinIzq ? tx : tx + tw}" y="${yc - 3}" text-anchor="${alinIzq ? 'start' : 'end'}" class="pl-cornisa">${esc(cornTxt)}</text>`;
    if (es.filete_cornisa) g += `<line x1="${tx}" x2="${tx + tw}" y1="${yc}" y2="${yc}" class="pl-filete"/>`;
    if (es.filete_pie) g += `<line x1="${tx}" x2="${tx + tw}" y1="${yp - 9}" y2="${yp - 9}" class="pl-filete"/>`;
    if (folio !== 'arriba-afuera') g += `<text x="${folio === 'abajo-centro' ? tx + tw / 2 : alinIzq ? tx : tx + tw}" y="${yp}" text-anchor="${folio === 'abajo-centro' ? 'middle' : alinIzq ? 'start' : 'end'}" class="pl-folio">${n}</text>`;
    // cotas de los márgenes
    const cota = (x, y, t, anc = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anc}" class="pl-cota">${t}</text>`;
    g += cota(x0 + izq * k / 2, oy + H * k / 2, `${+izq.toFixed(1)}`) + cota(tx + tw + der * k / 2, oy + H * k / 2, `${+der.toFixed(1)}`);
    g += cota(tx + tw / 2, oy + m.superior * k * 0.32 + 4, `${+m.superior.toFixed(1)}`) + cota(tx + tw / 2, oy + H * k - m.inferior * k * 0.25, `${+m.inferior.toFixed(1)}`);
    g += `<text x="${x0 + W * k / 2}" y="${oy - 12}" text-anchor="middle" class="pl-titulo">Página ${lado} · ${lineas} líneas</text>`;
    // tiradores (solo en la impar; la par se espeja)
    if (lado === 'impar') {
      const t = (cual, x, y, w, h, cursor) => `<rect data-borde="${cual}" x="${x}" y="${y}" width="${w}" height="${h}" class="pl-tirador" style="cursor:${cursor}"/>`;
      g += t('interior', tx - 5, ty, 10, th, 'ew-resize') + t('exterior', tx + tw - 5, ty, 10, th, 'ew-resize');
      g += t('superior', tx, ty - 5, tw, 10, 'ns-resize') + t('inferior', tx, ty + th - 5, tw, 10, 'ns-resize');
    }
    return g;
  };
  const anchoTexto = W - m.interior - m.exterior;
  const colMm = (anchoTexto - (cols - 1) * gut) / cols;
  const cpl = Math.round(colMm / (cuerpo * 0.3528 * 0.47));
  const alto = 2 * oy + H * k + 30;
  caja.innerHTML = `<div class="plano">
    <svg width="${2 * ox + 2 * W * k + gap}" height="${alto}" class="plano-svg">
      <line x1="${X('impar') - gap / 2}" x2="${X('impar') - gap / 2}" y1="${oy - 4}" y2="${oy + H * k + 4}" class="pl-lomo"/>
      ${pagina('par')}${pagina('impar')}
    </svg>
    <div class="plano-datos">
      <div><b>${+W.toFixed(1)} × ${+H.toFixed(1)} mm</b><span>página</span></div>
      <div><b>${+anchoTexto.toFixed(1)} × ${+(H - m.superior - m.inferior).toFixed(1)} mm</b><span>caja de texto</span></div>
      <div><b>${cols} × ${+colMm.toFixed(1)} mm</b><span>${cols === 1 ? 'columna' : 'columnas'}${cols > 1 ? ` · medianil ${gut} mm` : ''}</span></div>
      <div class="${cpl < 45 || cpl > 80 ? 'fuera' : ''}"><b>≈ ${cpl}</b><span>caracteres por línea${cpl < 45 ? ' (pocos: subí el ancho o bajá el cuerpo)' : cpl > 80 ? ' (muchos: mejor 2 columnas o más margen)' : ' (cómodo: 45 a 75)'}</span></div>
      <div><b>${Math.floor((H - m.superior - m.inferior) / inter)}</b><span>líneas por página · cuerpo ${ti.cuerpo || '11pt'} / ${ti.interlineado || '14.5pt'}</span></div>
    </div>
    <p class="sutil">Las medidas están en milímetros. El margen interior es el del lomo: conviene que sea un poco mayor que el exterior para que el texto no se pierda en la encuadernación.</p>
  </div>`;
  // arrastrar los bordes
  const svg = $('.plano-svg', caja);
  $$('[data-borde]', svg).forEach((t) => t.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); t.setPointerCapture(ev.pointerId);
    const cual = t.dataset.borde, x0 = ev.clientX, y0 = ev.clientY, base = m[cual];
    const signo = { interior: 1, exterior: -1, superior: 1, inferior: -1 }[cual];
    const vertical = cual === 'superior' || cual === 'inferior';
    let nuevo = base;
    const mover = (e2) => {
      const d = ((vertical ? e2.clientY - y0 : e2.clientX - x0) / k) * signo;
      nuevo = Math.max(5, Math.min((vertical ? H : W) / 2 - 10, Math.round((base + d) * 2) / 2));
      $('#pe-info').textContent = `Margen ${cual}: ${nuevo} mm`;
      const inp = $(`[data-c="formato.margen_${cual}"]`, f); if (inp) inp.value = nuevo + 'mm';
    };
    t.addEventListener('pointermove', mover);
    t.addEventListener('pointerup', () => { t.removeEventListener('pointermove', mover); if (nuevo !== base && aplicar()) pintarPlano(f, aplicar); }, { once: true });
  }));
}
// La IA propone el diseño completo (interior y tapa) eligiendo entre los modelos del taller.
async function disenarConIa() {
  const out = $('#ia-todo-res'); const b = $('#b-ia-todo'); b.disabled = true;
  out.innerHTML = '<div class="nota"><span class="spin"></span> Leyendo el libro y pensando el diseño…</div>';
  const L = S.cfg.libro || {};
  const caps = (S.cfg.contenido || []).filter((c) => c.archivo && c.tipo !== 'preliminar');
  const muestra = caps.slice(0, 3).map((c) => (S.textos.get(c.archivo) || '').replace(/^\[\^.*$/gm, '').slice(0, 1500)).join('\n\n---\n\n');
  const ult = leer('taller.paginas.' + S.slug, null);
  const contratapa = S.cfg.tapa?.contratapa ? (S.textos.get(S.cfg.tapa.contratapa) || '') : '';
  const fuentes = [...new Set(familias())].join(', ');
  const pedido = `Sos director de arte de una editorial. Elegí el diseño completo de este libro usando SOLO las opciones del catálogo.
CATÁLOGO
- Diseños de interior (id: descripción): ${DISENOS_INTERIOR.map((d) => `${d.id}: ${d.nota}`).join(' | ')}
- Medidas: ${Object.keys(S.presets.formatos).join(', ')}
- Diseños de tapa (id: descripción): ${ESTILOS_TAPA.filter(([k]) => k !== 'libre').map(([k, , d]) => `${k}: ${d}`).join(' | ')}
- Paletas: ${PALETAS_TAPA.map(([n, f, t, a, s]) => `${n} (fondo ${f}, texto ${t}, acento ${a}, segundo ${s})`).join(' | ')}
- Letras disponibles: ${fuentes}
LIBRO: «${L.titulo || ''}» ${L.subtitulo ? '— ' + L.subtitulo : ''}, de ${L.autor || ''}. ${ult ? ult.paginas + ' páginas.' : ''}
${contratapa ? 'Texto de contratapa actual: ' + contratapa.slice(0, 800) : 'No tiene texto de contratapa.'}
Respondé SOLO con JSON:
{"interior":"id","medida":"id o vacío para no cambiar","capitular":true|false,"color_acento":"#hex","tapa":"id","paleta":"nombre","fuente_titulo":"una de las letras","contratapa":"${contratapa ? 'vacío (ya tiene)' : 'texto de contratapa de 90 a 140 palabras, en castellano rioplatense, sin inventar datos que no estén en el texto'}","idea_imagen":"qué tendría que mostrar la imagen de tapa, en castellano, una oración","por_que":"explicación de 2 o 3 oraciones para el autor"}`;
  try {
    const r = await preguntar({ ...opcionesIA(), pedido, texto: muestra, accion: null });
    const m = r.match(/\{[\s\S]*\}/); if (!m) throw new Error('La IA no devolvió una propuesta legible. Probá de nuevo.');
    const x = JSON.parse(m[0]);
    const di = DISENOS_INTERIOR.find((d) => d.id === x.interior) || DISENOS_INTERIOR[0];
    const pal = PALETAS_TAPA.find(([n]) => n === x.paleta) || PALETAS_TAPA[0];
    const est = ESTILOS_TAPA.find(([k]) => k === x.tapa) || ESTILOS_TAPA[0];
    const fte = familias().includes(x.fuente_titulo) ? x.fuente_titulo : di.fuente_titulos;
    const medida = S.presets.formatos[x.medida] ? x.medida : '';
    const acento = /^#[0-9a-f]{6}$/i.test(x.color_acento || '') ? x.color_acento : di.color_acento;
    out.innerHTML = `<div class="propuesta">
      <p>${esc(x.por_que || '')}</p>
      <ul>
        <li><b>Interior:</b> ${esc(di.nombre)} — ${esc(di.nota)}${x.capitular ? ' Con letra capital.' : ''}</li>
        ${medida ? `<li><b>Medida:</b> ${esc(medida)}</li>` : ''}
        <li><b>Color de acento:</b> <span class="muestra-color" style="background:${acento}"></span> ${esc(acento)}</li>
        <li><b>Tapa:</b> ${esc(est[1])} con la paleta ${esc(pal[0])} <span class="muestra-color" style="background:${pal[1]}"></span><span class="muestra-color" style="background:${pal[3]}"></span> y el título en ${esc(fte)}</li>
        ${x.idea_imagen ? `<li><b>Imagen de tapa:</b> ${esc(x.idea_imagen)}</li>` : ''}
        ${x.contratapa && !contratapa ? `<li><b>Contratapa:</b> <i>${esc(x.contratapa)}</i></li>` : ''}
      </ul>
      <div class="acciones"><button type="button" class="btn prim" id="ia-aplicar">Aplicar todo</button><button type="button" class="btn" id="ia-otra">Pedir otra propuesta</button></div></div>`;
    $('#ia-otra').onclick = disenarConIa;
    $('#ia-aplicar').onclick = () => {
      const cambios = {
        tipografia: { fuente: di.fuente, fuente_titulos: di.fuente_titulos, fuente_apoyo: di.fuente_apoyo, cuerpo: di.cuerpo, interlineado: di.interlineado },
        estilo: { apertura: di.apertura, color_acento: acento, secciones_color: di.secciones_color, capitular: !!x.capitular },
        tapa: { estilo: est[0], fondo: pal[1], color_texto: pal[2], color_acento: pal[3], color_secundario: pal[4], fuente_titulo: fte },
      };
      if (medida) cambios.formato = { preset: medida };
      aplicarCambiosConfig(cambios);
      if (x.contratapa && !contratapa && !/^vac/i.test(x.contratapa)) {
        const ruta = S.cfg.tapa?.contratapa || 'tapa/contratapa.md';
        if (!S.cfg.tapa?.contratapa) aplicarCambiosConfig({ tapa: { contratapa: ruta } });
        S.textos.set(ruta, x.contratapa.trim() + '\n'); S.originales.has(ruta) || S.originales.set(ruta, null);
      }
      if (x.idea_imagen) S.iaTapa = { idea: x.idea_imagen, estilo: 'documental', encuadre: 'tapa', extra: '' };
      marcarEstado();
      toast('Diseño aplicado al interior y a la tapa. Miralo en Libro y en Tapa; guardá si te gusta.');
      const sc = $('#f-estilos').scrollTop; pintarEstilos(); $('#f-estilos').scrollTop = sc;
    };
  } catch (e) { out.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  finally { if (b.isConnected) b.disabled = false; }
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
      const r = await compilar(base() + '_muestra/main.typ', { libro: S.slug, vista: 'si', fuente: d.fuente, fuente_titulos: d.fuente_titulos, fuente_apoyo: d.fuente_apoyo, cuerpo: d.cuerpo, interlineado: d.interlineado, apertura: d.apertura, color_acento: d.color_acento, secciones_color: String(d.secciones_color), capitular: String(!!d.capitular) });
      if (n !== seqInterior) return;
      caja.innerHTML = r.ok ? await aSvg(r.bytes) : '<small>error</small>';
    } catch { caja.innerHTML = '<small>—</small>'; }
  }
}

/* ═════════ tapa ═════════ */
const DISENOS_INTERIOR = [
  { id: 'clasico', nombre: 'Clásico', nota: 'Garamond, número arriba y título a la izquierda.', fuente: 'EB Garamond', fuente_titulos: 'EB Garamond', fuente_apoyo: 'Inter', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'clasica', color_acento: '#000000', secciones_color: false },
  { id: 'literario', capitular: true, nombre: 'Literario', nota: 'Crimson y Cormorant, apertura centrada y letra capital.', fuente: 'Crimson Pro', fuente_titulos: 'Cormorant', fuente_apoyo: 'Inter', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'centrada', color_acento: '#8A2B22', secciones_color: false },
  { id: 'ensayo', nombre: 'Ensayo moderno', nota: 'Source Serif con filete de color y apoyo en Inter.', fuente: 'Source Serif 4', fuente_titulos: 'Inter', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15pt', apertura: 'filete', color_acento: '#1F5F8B', secciones_color: true },
  { id: 'academico', nombre: 'Académico', nota: 'Libertinus compacto, ideal para muchas notas.', fuente: 'Libertinus Serif', fuente_titulos: 'Libertinus Serif', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '14.5pt', apertura: 'clasica', color_acento: '#000000', secciones_color: false },
  { id: 'periodistico', nombre: 'Periodístico', nota: 'Merriweather y Fraunces, número gigante de color.', fuente: 'Merriweather', fuente_titulos: 'Fraunces', fuente_apoyo: 'Inter', cuerpo: '10.5pt', interlineado: '15pt', apertura: 'numero', color_acento: '#C2410C', secciones_color: true },
  { id: 'contemporaneo', nombre: 'Contemporáneo', nota: 'Lora y Playfair, número grande y aire.', fuente: 'Lora', fuente_titulos: 'Playfair Display', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15.5pt', apertura: 'numero', color_acento: '#0F766E', secciones_color: false },
  { id: 'manual', nombre: 'Manual', nota: 'Banda de color a sangre, al estilo Orange Book.', fuente: 'Source Serif 4', fuente_titulos: 'Inter', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15pt', apertura: 'banda', color_acento: '#E07B00', secciones_color: true },
  { id: 'tecnico', nombre: 'Técnico', nota: 'Todo a la derecha con filete fino, al estilo O’Reilly (bookly).', fuente: 'Source Serif 4', fuente_titulos: 'Inter', fuente_apoyo: 'Inter', cuerpo: '10.5pt', interlineado: '14.5pt', apertura: 'manual', color_acento: '#B91C1C', secciones_color: false },
  { id: 'didactico', nombre: 'Didáctico', nota: 'Pestaña de color con el número, para libros de estudio (bookly).', fuente: 'Lora', fuente_titulos: 'Lora', fuente_apoyo: 'Inter', cuerpo: '11pt', interlineado: '15.5pt', apertura: 'pestana', color_acento: '#2563EB', secciones_color: true },
  { id: 'cronica', nombre: 'Crónica', nota: 'Recuadro redondeado y Merriweather: no ficción de lectura ágil (bookly).', fuente: 'Merriweather', fuente_titulos: 'Merriweather', fuente_apoyo: 'Inter', cuerpo: '10.5pt', interlineado: '15pt', apertura: 'recuadro', color_acento: '#7C2D12', secciones_color: true },
  { id: 'novela', capitular: true, nombre: 'Novela', nota: 'Título en negrita sin número y letra capital, al estilo Wonderous.', fuente: 'EB Garamond', fuente_titulos: 'EB Garamond', fuente_apoyo: 'EB Garamond', cuerpo: '12pt', interlineado: '16.5pt', apertura: 'novela', color_acento: '#000000', secciones_color: false },
];
const APERTURAS = [['clasica', 'Clásica'], ['centrada', 'Centrada'], ['numero', 'Número grande'], ['filete', 'Filete de color'], ['banda', 'Banda a sangre'], ['novela', 'Novela (sin número)'], ['manual', 'Manual (a la derecha)'], ['pestana', 'Pestaña de color'], ['recuadro', 'Recuadro']];
const MUESTRA_INTERIOR = `#import "/plantilla/estilos.typ": *
#show: libro
#counter(heading).update(2)
#modo.update("cuerpo")
#apertura(impar: false)
= Rutas del sur
#capitular[La frontera no es una línea: es un lugar donde se espera. Hay quien espera días, hay quien espera años, y hay quien ya no sabe qué espera. En el borde de cada país se acumulan historias que nadie escribe.]

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
  ['patron', 'Patrón', 'Tela estampada: un motivo repetido en toda la cubierta y el título en una etiqueta.'],
  ['libre', 'Libre', 'Solo el fondo: armá la tapa a mano con textos, fotos y formas.'],
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
    ${estilo === 'patron' ? `<div class="grupo"><h3>Motivo del patrón</h3><div class="grilla">
      ${opciones('tapa.motivo', 'Dibujo', [['rombo', 'Rombos'], ['hoja', 'Hojas'], ['estrella', 'Estrellas'], ['circulos', 'Círculos'], ['ondas', 'Ondas'], ['cuadro', 'Cuadrados']])}
      ${campo('tapa.motivo_tam', 'Tamaño del motivo (mm)', 'number', '', '14')}
      <div class="campo ancho"><span>O un motivo propio (PNG con fondo transparente)</span><div class="subida"><input class="entrada" data-c="tapa.motivo_imagen" value="${esc(t.motivo_imagen || '')}" placeholder="sin imagen: usa el dibujo elegido"><button type="button" class="btn chico" data-subir="motivo_imagen">${I.subir}Subir</button>${t.motivo_imagen ? '<button type="button" class="btn chico" data-sacar="motivo_imagen">Quitar</button>' : ''}</div></div>
    </div></div>` : ''}
    <div class="grupo"><h3>Textos de la tapa</h3><div class="grilla">
        ${campo('tapa.titulo', 'Título en la tapa (usá | para cortar la línea)', 'text', 'ancho', S.cfg.libro?.titulo || '')}
        ${campo('tapa.subtitulo', 'Subtítulo en la tapa', 'text', 'ancho', S.cfg.libro?.subtitulo || '')}
        <div class="campo ancho"><span>Letra del título de tapa</span>${selectorLetra('tapa.fuente_titulo', S.cfg.libro?.titulo || 'Título')}</div>
        <div class="ancho fila-checks">${campo('tapa.mostrar_subtitulo', 'Subtítulo', 'check')}${campo('tapa.mostrar_autor', 'Autor', 'check')}${campo('tapa.mostrar_editorial', 'Editorial', 'check')}</div>
        ${campo('tapa.coleccion', 'Colección (diseño Colección)')}${campo('tapa.numero', 'Número en la colección')}
      </div>
      ${[['contratapa', 'Contratapa'], ['solapa_delantera', 'Solapa delantera'], ['solapa_trasera', 'Solapa trasera']].filter(([k]) => t[k]).map(([k, n]) => `<label class="campo" style="margin-top:12px"><span>${n}</span><textarea class="entrada texto-tapa" rows="${k === 'contratapa' ? 7 : 5}" data-texto="${esc(t[k])}">${esc(S.textos.get(t[k]) || '')}</textarea></label>`).join('')}
      <small class="sutil" style="margin:6px 0 0">Markdown: *cursiva*, **negrita**. Un renglón en blanco separa párrafos.</small>
    </div>
    <div class="grupo"><h3>Imagen con IA <small class="sutil">para la tapa, la contratapa o envolvente</small></h3>
      <div id="ia-tapa"></div>
    </div>
    <div class="grupo"><h3>Fotos de fondo</h3><div class="grilla">
      ${['imagen:Foto de tapa (a sangre)', 'imagen_envolvente:Imagen envolvente (contratapa + lomo + tapa)', 'imagen_contratapa:Foto de contratapa', 'foto_autor:Foto del autor (solapa)'].map((x) => { const [k, n] = x.split(':'); return `<div class="campo ancho"><span>${n}</span><div class="subida"><input class="entrada" data-c="tapa.${k}" value="${esc(t[k] || '')}" placeholder="sin foto"><button type="button" class="btn chico" data-subir="${k}">${I.subir}Subir</button>${t[k] ? `<button type="button" class="btn chico" data-sacar="${k}">Quitar</button>` : ''}</div></div>`; }).join('')}
    </div></div>
    <div class="grupo"><h3>Solapas</h3><div class="grilla">
      ${opciones('tapa.foto_autor_forma', 'Foto del autor', [['rectangular', 'Rectangular'], ['redonda', 'Redonda']])}
      ${campo('tapa.foto_autor_ancho', 'Tamaño de la foto (%)', 'number', '', '100')}
      ${campo('tapa.foto_autor_credito', 'Crédito de la foto', 'text', 'ancho', 'Ej.: Ana Pérez')}
      ${campo('tapa.cuerpo_solapas', 'Letra de solapas (pt)', 'number', '', '9.5')}
      ${campo('tapa.cuerpo_contratapa', 'Letra de contratapa (pt)', 'number', '', '12')}
      ${campo('tapa.fondo_solapas', 'Color de las solapas', 'text', '', 'vacío = el del fondo')}
      ${campo('tapa.fondo_lomo', 'Color del lomo', 'text', '', 'vacío = el del fondo')}
      <div class="campo ancho"><span>Logo de la editorial (lomo, contratapa y solapa)</span><div class="subida"><input class="entrada" data-c="tapa.logo" value="${esc(t.logo || '')}" placeholder="sin logo: va el nombre en letras"><button type="button" class="btn chico" data-subir="logo">${I.subir}Subir</button>${t.logo ? '<button type="button" class="btn chico" data-sacar="logo">Quitar</button>' : ''}</div><small class="sutil" style="margin:0">Mejor un PNG con fondo transparente.</small></div>
    </div></div>
    <div class="grupo"><h3>Código de barras y precio</h3><div class="grilla">
      ${campo('libro.isbn', 'ISBN', 'text', '', '978-…')}
      ${opciones('tapa.codigo_posicion', 'Dónde va', [['derecha', 'Abajo a la derecha'], ['izquierda', 'Abajo a la izquierda'], ['centro', 'Abajo al centro']])}
      <div class="ancho" id="isbn-estado"></div>
      ${campo('tapa.codigo_precio', 'Agregado de 5 cifras (EAN-5)', 'text', '', 'vacío = sin agregado; 90000 = sin precio')}
      ${campo('tapa.precio', 'Precio impreso', 'text', '', 'Ej.: PVP $ 25.000')}
    </div></div>
    <div class="grupo"><h3>Textos y fotos libres <small class="sutil">en cualquier cara: tapa, contratapa, lomo o solapas</small></h3>
      <div id="elementos"></div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn chico" id="b-el-texto">${I.mas}Texto</button><button type="button" class="btn chico" id="b-el-foto">${I.mas}Foto</button><button type="button" class="btn chico" data-forma="rect">${I.mas}Rectángulo</button><button type="button" class="btn chico" data-forma="circulo">${I.mas}Círculo</button><button type="button" class="btn chico" data-forma="linea">${I.mas}Línea</button><button type="button" class="btn chico fant" id="b-el-deshacer">Deshacer</button></div>
      ${estilo !== 'libre' ? `<div class="aviso" style="margin-top:12px">¿Querés mover también el título, el subtítulo y el autor? <button type="button" class="btn chico" id="b-desarmar">Pasar la tapa a capas</button><br><small>Convierte el diseño en capas sueltas que se editan con el mouse (el fondo y los colores se mantienen).</small></div>` : ''}
    </div>
    <div class="grupo"><h3>Papel y medidas</h3><div class="grilla">
      ${opciones('tapa.encuadernacion', 'Encuadernación', [['rustica', 'Rústica (cartulina)'], ['dura', 'Tapa dura (cartoné)']], 'rustica')}
      ${t.encuadernacion === 'dura' ? `${campo('tapa.carton', 'Grosor del cartón', 'text', '', '2.5mm')}${campo('tapa.canal', 'Canal (bisagra) a cada lado del lomo', 'text', '', '8mm')}${campo('tapa.vuelta', 'Vuelta (papel que se pega adentro)', 'text', '', '17mm')}${campo('tapa.ceja', 'Ceja (cuánto sobresale el cartón)', 'text', '', '3mm')}<p class="sutil ancho" style="margin:0">En tapa dura no hay solapas; la sobrecubierta se arma aparte. Confirmá cartón, canal y vuelta con la imprenta.</p>` : ''}
      ${opciones('tapa.papel', 'Papel', Object.keys(S.presets.papeles).map((p) => [p, p]))}
      ${campo('tapa.cartulina_mm', 'Cartulina (mm al lomo)', 'number')}
      ${campo('tapa.solapa', 'Solapas (0mm = sin solapas)')}${campo('tapa.sangrado', 'Sangrado')}
    </div></div>
    <input type="hidden" data-c="tapa.estilo" value="${esc(estilo)}">
    <div class="grupo"><h3>Tapa para tiendas digitales</h3><p class="sutil" style="margin:0 0 8px">Amazon, Google Libros y las tiendas de ebooks piden solo el frente, como imagen de 2.560 px de alto.</p>
      <div class="acciones"><button type="button" class="btn chico" id="b-ebook">${I.bajar}Frente en JPG (2.560 px)</button><button type="button" class="btn chico" id="b-ebook-png">${I.bajar}Frente en PNG</button></div></div>
    <div class="guardar"><button class="btn prim" id="b-ver-tapa">Ver la tapa</button><button class="btn" id="b-guardar-tapa">${I.subir}Guardar en GitHub</button></div>
  </div>
  <section class="lado-der"><div class="cab"><span class="info" id="pt-info"></span><div class="der"><label class="check" style="font-size:12.5px"><input type="checkbox" id="c-guias" checked>Guías de corte y pliegue</label></div></div><div class="mesa" id="mesa-tapa"></div></section>`;
  const f = $('#f-tapa');
  const aplicar = () => { try { aplicarCambiosConfig(leerForm(f)); return true; } catch (e) { toast('Hay un valor inválido: ' + e.message); return false; } };
  const todo = () => { verTapa().then(miniaturasTapa); };
  activarSelectoresLetra(f, () => { aplicar(); todo(); });
  $$('.est-tapa', f).forEach((b) => (b.onclick = () => {
    const antes = $('[data-c="tapa.estilo"]', f).value;
    $$('.est-tapa', f).forEach((x) => x.setAttribute('aria-checked', String(x === b))); $('[data-c="tapa.estilo"]', f).value = b.dataset.est; aplicar();
    if ((antes === 'patron') !== (b.dataset.est === 'patron')) { const sc = f.scrollTop; pintarTapa(); $('#f-tapa').scrollTop = sc; } else verTapa();
  }));
  $$('.paleta', f).forEach((b) => (b.onclick = () => {
    const [, fo, tx, ac, se] = PALETAS_TAPA[+b.dataset.pal];
    $('[data-c="tapa.fondo"]', f).value = fo; $('[data-c="tapa.color_texto"]', f).value = tx;
    $('[data-c="tapa.color_acento"]', f).value = ac; $('[data-c="tapa.color_secundario"]', f).value = se;
    if (aplicar()) todo();
  }));
  $$('input, select', f).forEach((el) => el.addEventListener('change', () => { if (aplicar()) todo(); }));
  $$('.texto-tapa', f).forEach((ta) => ta.addEventListener('input', () => { S.textos.set(ta.dataset.texto, ta.value); marcarEstado(); programarTapa(); }));
  $$('[data-subir]', f).forEach((b) => (b.onclick = async () => {
    const ruta = await subirFoto(); if (!ruta) return;
    $(`[data-c="tapa.${b.dataset.subir}"]`, f).value = ruta;
    if (b.dataset.subir === 'imagen' && $('[data-c="tapa.estilo"]', f).value !== 'foto') toast('Foto cargada. El diseño «Foto» es el que mejor la aprovecha.');
    if (aplicar()) { const sc = f.scrollTop; pintarTapa(); $('#f-tapa').scrollTop = sc; }
  }));
  $$('[data-sacar]', f).forEach((b) => (b.onclick = () => { $(`[data-c="tapa.${b.dataset.sacar}"]`, f).value = ''; if (aplicar()) { const sc = f.scrollTop; pintarTapa(); $('#f-tapa').scrollTop = sc; } }));
  $('#b-el-texto').onclick = () => agregarElemento({ tipo: 'texto', cara: 'tapa', texto: 'Texto nuevo', x: 12, y: 45, ancho: 76, tam: 14, color: (S.cfg.tapa?.color_texto || '#ffffff'), alineacion: 'left' });
  $$('[data-forma]', f).forEach((b) => (b.onclick = () => agregarElemento(b.dataset.forma === 'linea'
    ? { tipo: 'forma', forma: 'linea', cara: 'tapa', x: 12, y: 50, ancho: 40, borde: S.cfg.tapa?.color_acento || '#d9a441', grosor: 1.5 }
    : { tipo: 'forma', forma: b.dataset.forma, cara: 'tapa', x: 20, y: 30, ancho: b.dataset.forma === 'circulo' ? 40 : 60, alto: b.dataset.forma === 'circulo' ? 28 : 20, relleno: S.cfg.tapa?.color_acento || '#d9a441', opacidad: 100 })));
  $('#b-el-deshacer').onclick = deshacerElemento;
  const bd = $('#b-desarmar', f); if (bd) bd.onclick = desarmarDiseno;
  $('#b-el-foto').onclick = async () => { const ruta = await subirFoto(); if (ruta) agregarElemento({ tipo: 'foto', cara: 'tapa', archivo: ruta, x: 12, y: 55, ancho: 76, alto: 30, ajuste: 'cover' }); };
  pintarElementos();
  pintarIaTapa();
  const isbnInp = $('[data-c="libro.isbn"]', f);
  const verIsbn = () => { const r = revisarIsbn(isbnInp.value); $('#isbn-estado').innerHTML = r ? `<div class="aviso ${r.ok ? 'bien' : 'mal'}">${esc(r.texto)}</div>` : ''; };
  isbnInp.addEventListener('input', verIsbn); verIsbn();
  $('#b-ver-tapa').onclick = () => { if (aplicar()) verTapa(); };
  $('#b-ebook').onclick = () => tapaEbook('jpg');
  $('#b-ebook-png').onclick = () => tapaEbook('png');
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
// Verifica el dígito de control del ISBN-13 (y convierte un ISBN-10).
function revisarIsbn(v) {
  const d = String(v || '').replace(/[^0-9Xx]/g, '');
  if (!d) return null;
  const ctl13 = (x) => (10 - ([...x].slice(0, 12).reduce((a, c, i) => a + +c * (i % 2 ? 3 : 1), 0) % 10)) % 10;
  if (d.length === 10) {
    const n = '978' + d.slice(0, 9);
    return { ok: false, texto: `Es un ISBN de 10 cifras. Para el código de barras usá el de 13: ${n}${ctl13(n)}` };
  }
  if (d.length !== 13) return { ok: false, texto: `Tiene ${d.length} cifras; un ISBN tiene 13.` };
  if (!/^97[89]/.test(d)) return { ok: false, texto: 'Un ISBN empieza con 978 o 979.' };
  const c = ctl13(d);
  return +d[12] === c ? { ok: true, texto: 'ISBN válido. El código de barras se genera solo.' } : { ok: false, texto: `El último dígito debería ser ${c}, no ${d[12]}. Revisalo con la constancia de la Agencia ISBN.` };
}
// Solo el frente, a 2.560 px de alto, para tiendas de ebooks.
async function tapaEbook(formato) {
  try {
    toast('Preparando la tapa…');
    const ult = leer('taller.paginas.' + S.slug, null);
    const paginas = String(ult?.paginas || estimarPaginas());
    await prepararTapa(+paginas);
    const r = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas, lomo: '20mm', solo_tapa: 'si' }, 'pdf');
    if (!r.ok) throw new Error(r.errores.join('\n'));
    const doc = await abrirPdf(r.bytes);
    const c = await lienzoPagina(doc, 1, 2560);
    const blob = await new Promise((ok) => c.toBlob(ok, formato === 'png' ? 'image/png' : 'image/jpeg', 0.92));
    const u = URL.createObjectURL(blob);
    const a = h(`<a href="${u}" download="${S.slug}-tapa-ebook.${formato}"></a>`); document.body.append(a); a.click(); a.remove();
    toast(`Tapa para ebook: ${c.width} × ${c.height} px.`);
  } catch (e) { toast('No pude armar la tapa: ' + e.message); }
}

/* ── imagen de tapa con IA ── */
let iaTapaRes = [];
function medidasTapa(encuadre) {
  const g = geometriaTapa();
  if (encuadre === 'envolvente') return { ancho: 2 * g.W + (S.lomoTapa || 15) + 2 * g.sg, alto: g.H + 2 * g.sg };
  return { ancho: g.W + 2 * g.sg, alto: g.H + 2 * g.sg };
}
function pintarIaTapa() {
  const caja = $('#ia-tapa'); if (!caja) return;
  const t = S.cfg.tapa || {}, L = S.cfg.libro || {};
  const c = S.iaTapa ||= { idea: `${L.titulo || ''}${L.subtitulo ? ': ' + L.subtitulo : ''}`, estilo: 'documental', encuadre: 'tapa', extra: '' };
  const m = medidasTapa(c.encuadre);
  const px = (mm) => Math.round(mm / 25.4 * 300);
  const prompt = armarPrompt({ ...c, colores: [t.fondo, t.color_acento].filter(Boolean), ancho: m.ancho, alto: m.alto });
  caja.innerHTML = `
    <label class="campo"><span>Idea: qué tiene que mostrar (en castellano, como se lo contarías a un fotógrafo)</span><textarea class="entrada" rows="3" id="it-idea">${esc(c.idea)}</textarea></label>
    <div class="grilla" style="margin-top:10px">
      <label class="campo"><span>Estilo</span><select class="entrada" id="it-estilo">${Object.keys(ESTILOS_IMAGEN).map((k) => `<option value="${k}" ${k === c.estilo ? 'selected' : ''}>${{ documental: 'Foto documental', cinematografica: 'Foto cinematográfica', ilustracion: 'Ilustración editorial', acuarela: 'Acuarela', grabado: 'Grabado', collage: 'Collage', minimalista: 'Conceptual minimalista', abstracta: 'Abstracta geométrica' }[k]}</option>`).join('')}</select></label>
      <label class="campo"><span>Para dónde</span><select class="entrada" id="it-encuadre">${Object.entries(ENCUADRES).map(([k, x]) => `<option value="${k}" ${k === c.encuadre ? 'selected' : ''}>${x.nombre}</option>`).join('')}</select></label>
    </div>
    <div class="esquema-ia">
      <div><b>${m.ancho.toFixed(0)} × ${m.alto.toFixed(0)} mm</b><span>con 3 mm de sangrado</span></div>
      <div><b>${px(m.ancho)} × ${px(m.alto)} px</b><span>lo ideal para imprimir (300 ppp)</span></div>
      <div><b>Sin letras</b><span>los textos los pone el taller</span></div>
    </div>
    <details class="prompt-ia"><summary>Ver y editar el prompt</summary><textarea class="entrada" rows="6" id="it-prompt">${esc(prompt)}</textarea>
      <label class="campo" style="margin-top:8px"><span>Algo más para agregar (en inglés o castellano)</span><input class="entrada" id="it-extra" value="${esc(c.extra)}" placeholder="Ej.: dusk light, a river, a long line of people walking"></label></details>
    <div class="acciones" style="margin-top:10px">
      <button type="button" class="btn prim chico" id="it-poll">Generar gratis (Pollinations)</button>
      <button type="button" class="btn chico" id="it-copiar">Copiar prompt</button>
      <a class="btn chico fant" href="https://chatgpt.com/" target="_blank" rel="noopener">Abrir ChatGPT</a>
      <a class="btn chico fant" href="https://gemini.google.com/app" target="_blank" rel="noopener">Abrir Gemini</a>
      <button type="button" class="btn chico fant" id="it-subir">${I.subir}Subir una hecha afuera</button>
    </div>
    <div id="it-res" class="ia-res"></div>`;
  const leerC = () => { c.idea = $('#it-idea').value; c.estilo = $('#it-estilo').value; c.encuadre = $('#it-encuadre').value; c.extra = $('#it-extra').value; };
  const rehacer = () => { leerC(); pintarIaTapa(); };
  ['#it-estilo', '#it-encuadre'].forEach((q) => ($(q).onchange = rehacer));
  $('#it-idea').onchange = rehacer; $('#it-extra').onchange = rehacer;
  $('#it-copiar').onclick = () => { navigator.clipboard?.writeText($('#it-prompt').value); toast('Prompt copiado. Pegalo en ChatGPT o Gemini y pedí la imagen en la proporción indicada.'); };
  $('#it-subir').onclick = async () => { const r = await subirFoto('tapa'); if (r) usarImagenIa(r, c.encuadre); };
  const generar = async (con) => {
    leerC();
    const pr = $('#it-prompt').value; const med = medidasTapa(c.encuadre);
    const res = $('#it-res');
    const cant = con === 'gemini' ? 1 : 2;
    for (let i = 0; i < cant; i++) {
      res.insertAdjacentHTML('afterbegin', `<div class="ia-img cargando"><span class="spin"></span><small>${con === 'gemini' ? 'Gemini' : 'Pollinations'} está pintando…${i ? ' (la segunda tarda un poco más)' : ''}</small></div>`);
      try {
        if (i) await new Promise((ok) => setTimeout(ok, 16000));
        const r = con === 'gemini' ? await generarGemini(pr, S.conf.gemini, med) : await generarPollinations(pr, med, (m) => toast(m));
        iaTapaRes.unshift({ ...r, url: URL.createObjectURL(r.blob), encuadre: c.encuadre });
      } catch (e) { toast(e.message); }
      mostrarIaTapa();
    }
  };
  $('#it-poll').onclick = () => generar('pollinations');
  mostrarIaTapa();
}
function mostrarIaTapa() {
  const res = $('#it-res'); if (!res) return;
  res.innerHTML = iaTapaRes.slice(0, 8).map((x, i) => `<div class="ia-img"><img src="${x.url}" alt=""><small>${esc(x.origen)}</small>
    <div class="respuesta-acc"><button type="button" class="btn chico prim-suave" data-usar="${i}">Usar ${x.encuadre === 'envolvente' ? 'envolvente' : x.encuadre === 'contratapa' ? 'en contratapa' : 'en la tapa'}</button><button type="button" class="btn chico" data-ampliar="${i}" title="Agrandar con IA a resolución de imprenta (tarda uno o dos minutos)">Ampliar</button><a class="btn chico" href="${x.url}" download="tapa-ia-${i + 1}.jpg">${I.bajar}</a></div></div>`).join('');
  $$('[data-ampliar]', res).forEach((b) => (b.onclick = async () => {
    const x = iaTapaRes[+b.dataset.ampliar];
    b.disabled = true;
    try {
      const { ampliarImagen } = await import('./ampliar.js');
      const bm = await createImageBitmap(x.blob);
      const r = await ampliarImagen(x.blob, { escala: bm.width >= 1100 ? 2 : 4, alProgreso: (p) => { b.textContent = Math.round(p * 100) + ' %'; } });
      iaTapaRes[+b.dataset.ampliar] = { ...x, blob: r.blob, url: URL.createObjectURL(r.blob), origen: `${x.origen} · ampliada a ${r.ancho}×${r.alto}` };
      toast(`Ampliada a ${r.ancho} × ${r.alto} px.`); mostrarIaTapa();
    } catch (e) { toast('No pude ampliarla: ' + e.message); b.disabled = false; b.textContent = 'Ampliar'; }
  }));
  $$('[data-usar]', res).forEach((b) => (b.onclick = async () => {
    const x = iaTapaRes[+b.dataset.usar];
    const archivo = new File([x.blob], `tapa-ia.${/png/.test(x.blob.type) ? 'png' : 'jpg'}`, { type: x.blob.type || 'image/jpeg' });
    const r = await subirFoto('tapa', archivo); if (r) usarImagenIa(r, x.encuadre);
  }));
}
function usarImagenIa(ruta, encuadre) {
  const clave = encuadre === 'envolvente' ? 'imagen_envolvente' : encuadre === 'contratapa' ? 'imagen_contratapa' : 'imagen';
  const cambios = { tapa: { [clave]: ruta } };
  if (clave === 'imagen' && !['foto', 'libre'].includes(S.cfg.tapa?.estilo)) cambios.tapa.estilo = 'foto';
  aplicarCambiosConfig(cambios);
  toast('Imagen puesta. Guardá para que quede en GitHub.');
  const f = $('#f-tapa'); const sc = f?.scrollTop; pintarTapa(); if (sc != null) $('#f-tapa').scrollTop = sc;
}

/* ── textos y fotos libres en la tapa (tapa/elementos.json) ── */
const CARAS = [['tapa', 'Tapa'], ['contratapa', 'Contratapa'], ['lomo', 'Lomo'], ['solapa-del', 'Solapa delantera'], ['solapa-tras', 'Solapa trasera']];
function elementosTapa() {
  const r = S.cfg?.tapa?.elementos; if (!r) return [];
  try { return JSON.parse(S.textos.get(r) || '[]'); } catch { return []; }
}
function guardarElementos(lista, { historia = true } = {}) {
  if (historia) { (S.histEl ||= []).push(JSON.stringify(elementosTapa())); if (S.histEl.length > 60) S.histEl.shift(); }
  const nuevo = !S.cfg.tapa?.elementos;
  const r = S.cfg.tapa?.elementos || 'tapa/elementos.json';
  const json = JSON.stringify(lista, null, 1) + '\n';
  S.textos.set(r, json);
  cargarTextos({ [base() + r]: json }); // primero el archivo, después la configuración que lo nombra
  if (nuevo) aplicarCambiosConfig({ tapa: { elementos: r } });
  marcarEstado();
}
function agregarElemento(e) { const l = elementosTapa(); l.push(e); guardarElementos(l); S.selEl = l.length - 1; pintarElementos(l.length - 1); verTapa(); }
function deshacerElemento() {
  const prev = (S.histEl || []).pop(); if (prev == null) return toast('No hay nada para deshacer.');
  guardarElementos(JSON.parse(prev), { historia: false }); S.selEl = null; pintarElementos(); verTapa();
}
// Convierte el diseño elegido en capas sueltas (título, subtítulo, autor, editorial) para moverlas a mano.
function desarmarDiseno() {
  const t = S.cfg.tapa || {}, L = S.cfg.libro || {};
  const color = t.color_texto || '#f4efe6', acento = t.color_acento || '#d9a441', fuente = t.fuente_titulo || 'EB Garamond';
  const titulo = (t.titulo || L.titulo || 'Título').replace(/\|/g, '\n');
  const largo = Math.max(...titulo.split(/\s|\n/).map((w) => w.length), 1);
  const capas = [
    { tipo: 'texto', cara: 'tapa', rol: 'autor', texto: L.autor || '', x: 10, y: 9, ancho: 80, tam: 10, color, fuente: 'Inter', mayusculas: true, espaciado: 30, alineacion: 'left' },
    { tipo: 'texto', cara: 'tapa', rol: 'titulo', texto: titulo, x: 10, y: 38, ancho: 82, tam: Math.round(Math.min(60, 300 / largo)), color, fuente, negrita: true, alineacion: 'left', interlineado: 0.2 },
    { tipo: 'forma', cara: 'tapa', forma: 'linea', x: 10, y: 54, ancho: 22, borde: acento, grosor: 1.5 },
    { tipo: 'texto', cara: 'tapa', rol: 'subtitulo', texto: t.subtitulo || L.subtitulo || '', x: 10, y: 58, ancho: 75, tam: 15, color, fuente, cursiva: true, alineacion: 'left' },
    { tipo: 'texto', cara: 'tapa', rol: 'editorial', texto: L.editorial || '', x: 10, y: 91, ancho: 80, tam: 7.5, color, fuente: 'Inter', mayusculas: true, espaciado: 30, alineacion: 'left' },
  ].filter((c) => c.tipo !== 'texto' || c.texto);
  const l = [...capas, ...elementosTapa()];
  guardarElementos(l);
  aplicarCambiosConfig({ tapa: { estilo: 'libre' } });
  S.selEl = 1;
  toast('Listo: la tapa quedó en capas. Hacé clic en cualquier texto para moverlo o cambiarlo.');
  pintarTapa();
}
let tTapa;
function programarTapa() { clearTimeout(tTapa); tTapa = setTimeout(verTapa, 450); }
function pintarElementos(abierto = -1) {
  const caja = $('#elementos'); if (!caja) return;
  const l = elementosTapa();
  if (!l.length) { caja.innerHTML = '<p class="sutil" style="margin:0">Sumá una frase, un sello, «Prólogo de…», un logo o una foto, y ubicalos con los deslizadores.</p>'; return; }
  const deslizador = (i, k, n, min, max, v) => `<label class="desl"><span>${n} <b>${v}</b></span><input type="range" min="${min}" max="${max}" step="0.5" value="${v}" data-i="${i}" data-k="${k}"></label>`;
  const fams = [...new Set([...familias(), 'Inter'])].sort();
  caja.innerHTML = l.map((e, i) => `<details class="elem" ${i === abierto ? 'open' : ''}>
    <summary><span class="elem-tipo">${e.tipo === 'foto' ? 'Foto' : e.tipo === 'forma' ? 'Forma' : 'Texto'}</span><span class="elem-nombre">${esc(e.tipo === 'foto' ? e.archivo.split('/').pop() : e.tipo === 'forma' ? ({ rect: 'Rectángulo', circulo: 'Círculo', linea: 'Línea' }[e.forma] || 'Forma') : (e.texto || '').split('\n')[0].slice(0, 40))}</span><span class="elem-cara">${CARAS.find(([k]) => k === e.cara)?.[1] || ''}</span>
      <button type="button" class="ico" data-mov="${i}:-1" title="Más atrás">${I.arriba}</button><button type="button" class="ico" data-mov="${i}:1" title="Más adelante">${I.abajo}</button><button type="button" class="ico" data-borrar="${i}" title="Quitar">${I.quitar}</button></summary>
    <div class="elem-cuerpo">
      <label class="campo"><span>Dónde va</span><select class="entrada" data-i="${i}" data-k="cara">${CARAS.map(([k, n]) => `<option value="${k}" ${k === e.cara ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${e.tipo === 'forma' ? `
        <label class="campo"><span>Forma</span><select class="entrada" data-i="${i}" data-k="forma">${[['rect', 'Rectángulo'], ['circulo', 'Círculo'], ['linea', 'Línea']].map(([k, n]) => `<option value="${k}" ${k === (e.forma || 'rect') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Relleno</span><div class="subida"><input class="entrada" type="color" data-i="${i}" data-k="relleno" value="${esc(e.relleno || '#000000')}" ${e.relleno ? '' : 'style="opacity:.35"'}><label class="check"><input type="checkbox" data-i="${i}" data-k="con_relleno" ${e.relleno ? 'checked' : ''}>usar</label></div></label>
        <label class="campo"><span>Borde</span><div class="subida"><input class="entrada" type="color" data-i="${i}" data-k="borde" value="${esc(e.borde || '#000000')}" ${e.borde ? '' : 'style="opacity:.35"'}><label class="check"><input type="checkbox" data-i="${i}" data-k="con_borde" ${e.borde ? 'checked' : ''}>usar</label></div></label>
        ${deslizador(i, 'grosor', 'Grosor del borde (pt)', 0.25, 12, e.grosor ?? 1)}
        ${deslizador(i, 'opacidad', 'Opacidad %', 5, 100, e.opacidad ?? 100)}${deslizador(i, 'redondeo', 'Esquinas (mm)', 0, 30, e.redondeo ?? 0)}
        ${deslizador(i, 'x', 'Izquierda %', -20, 100, e.x ?? 0)}${deslizador(i, 'y', 'Arriba %', -20, 100, e.y ?? 0)}
        ${deslizador(i, 'ancho', 'Ancho %', 1, 140, e.ancho ?? 50)}${e.forma === 'linea' ? '' : deslizador(i, 'alto', 'Alto %', 0.5, 140, e.alto ?? 10)}
        ${deslizador(i, 'giro', 'Giro °', -90, 90, e.giro ?? 0)}` : e.tipo === 'foto' ? `
        <label class="campo"><span>Cómo entra</span><select class="entrada" data-i="${i}" data-k="ajuste">${[['cover', 'Llena el recuadro (recorta)'], ['contain', 'Entera (sin recortar)'], ['stretch', 'Estirada']].map(([k, n]) => `<option value="${k}" ${k === (e.ajuste || 'cover') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="ancho fila-checks"><label class="check"><input type="checkbox" data-i="${i}" data-k="sangre" ${e.sangre ? 'checked' : ''}>A sangre si toca el borde</label><button type="button" class="btn chico" data-cambiar="${i}">Cambiar foto</button></div>
        ${deslizador(i, 'x', 'Izquierda %', -20, 100, e.x ?? 0)}${deslizador(i, 'y', 'Arriba %', -20, 100, e.y ?? 0)}
        ${deslizador(i, 'ancho', 'Ancho %', 5, 140, e.ancho ?? 80)}${deslizador(i, 'alto', 'Alto %', 5, 140, e.alto ?? 30)}
        ${deslizador(i, 'redondeo', 'Esquinas (mm)', 0, 20, e.redondeo ?? 0)}${deslizador(i, 'giro', 'Giro °', -45, 45, e.giro ?? 0)}` : `
        <label class="campo ancho"><span>Texto</span><textarea class="entrada" rows="2" data-i="${i}" data-k="texto">${esc(e.texto || '')}</textarea></label>
        <label class="campo"><span>Letra</span><select class="entrada" data-i="${i}" data-k="fuente">${fams.map((f) => `<option ${f === (e.fuente || S.cfg.tapa?.fuente_titulo || 'EB Garamond') ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select></label>
        <label class="campo"><span>Alineación</span><select class="entrada" data-i="${i}" data-k="alineacion">${[['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']].map(([k, n]) => `<option value="${k}" ${k === (e.alineacion || 'left') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Color</span><input class="entrada" type="color" data-i="${i}" data-k="color" value="${esc(e.color || '#ffffff')}"></label>
        <label class="campo"><span>Recuadro de color</span><div class="subida"><input class="entrada" type="color" data-i="${i}" data-k="fondo" value="${esc(e.fondo || '#000000')}" ${e.fondo ? '' : 'style="opacity:.35"'}><label class="check"><input type="checkbox" data-i="${i}" data-k="con_fondo" ${e.fondo ? 'checked' : ''}>usar</label></div></label>
        <div class="ancho fila-checks"><label class="check"><input type="checkbox" data-i="${i}" data-k="negrita" ${e.negrita ? 'checked' : ''}>Negrita</label><label class="check"><input type="checkbox" data-i="${i}" data-k="cursiva" ${e.cursiva ? 'checked' : ''}>Cursiva</label><label class="check"><input type="checkbox" data-i="${i}" data-k="mayusculas" ${e.mayusculas ? 'checked' : ''}>Mayúsculas</label></div>
        ${deslizador(i, 'tam', 'Tamaño (pt)', 5, 120, e.tam ?? 14)}${deslizador(i, 'espaciado', 'Espaciado', -5, 60, e.espaciado ?? 0)}
        ${deslizador(i, 'x', 'Izquierda %', -10, 100, e.x ?? 10)}${deslizador(i, 'y', 'Arriba %', -5, 100, e.y ?? 10)}
        ${deslizador(i, 'ancho', 'Ancho %', 5, 120, e.ancho ?? 80)}${deslizador(i, 'giro', 'Giro °', -90, 90, e.giro ?? 0)}`}
    </div></details>`).join('');
  const cambiar = (i, k, v) => {
    const lista = elementosTapa();
    if (k === 'con_fondo') { if (v) lista[i].fondo = lista[i].fondo || '#000000'; else delete lista[i].fondo; }
    else if (k === 'con_relleno') { if (v) lista[i].relleno = lista[i].relleno || '#000000'; else delete lista[i].relleno; }
    else if (k === 'con_borde') { if (v) lista[i].borde = lista[i].borde || '#000000'; else delete lista[i].borde; }
    else if ((k === 'fondo' || k === 'relleno' || k === 'borde') && !lista[i][k]) return;
    else lista[i][k] = v;
    guardarElementos(lista); programarTapa();
  };
  $$('[data-k]', caja).forEach((el) => {
    const ev = el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'color' ? 'input' : 'change';
    el.addEventListener(ev, () => {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
      if (el.type === 'range') el.previousElementSibling.querySelector('b').textContent = el.value;
      if (/^con_/.test(el.dataset.k)) { cambiar(+el.dataset.i, el.dataset.k, v); return pintarElementos(+el.dataset.i); }
      cambiar(+el.dataset.i, el.dataset.k, v);
      if (el.dataset.k === 'cara' || el.dataset.k === 'texto') { const s = el.closest('details').querySelector('.elem-nombre, .elem-cara'); if (el.dataset.k === 'cara') el.closest('details').querySelector('.elem-cara').textContent = CARAS.find(([k]) => k === v)[1]; else el.closest('details').querySelector('.elem-nombre').textContent = String(v).split('\n')[0].slice(0, 40); }
    });
  });
  $$('[data-borrar]', caja).forEach((b) => (b.onclick = (ev) => { ev.preventDefault(); const lista = elementosTapa(); lista.splice(+b.dataset.borrar, 1); guardarElementos(lista); pintarElementos(); verTapa(); }));
  $$('[data-mov]', caja).forEach((b) => (b.onclick = (ev) => {
    ev.preventDefault(); const [i, d] = b.dataset.mov.split(':').map(Number); const lista = elementosTapa(); const j = i + d;
    if (j < 0 || j >= lista.length) return; [lista[i], lista[j]] = [lista[j], lista[i]]; guardarElementos(lista); pintarElementos(j); verTapa();
  }));
  $$('[data-cambiar]', caja).forEach((b) => (b.onclick = async () => { const r = await subirFoto(); if (r) cambiar(+b.dataset.cambiar, 'archivo', r), pintarElementos(+b.dataset.cambiar); }));
}
// Elige una foto, la achica si hace falta y la sube a GitHub (libros/<libro>/tapa/).
function subirFoto(carpeta = 'tapa', archivoDado = null) {
  return new Promise((listo) => {
    const inp = h('<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden>');
    document.body.append(inp);
    const procesar = async (f) => {
      if (!f) return listo(null);
      try {
        toast('Preparando la foto…');
        let bytes = new Uint8Array(await f.arrayBuffer());
        let ext = f.type === 'image/png' ? 'png' : 'jpg';
        const bmp = await createImageBitmap(f);
        const lado = Math.max(bmp.width, bmp.height);
        if (lado > 4200 || bytes.length > 7e6 || !['image/jpeg', 'image/png'].includes(f.type)) {
          const k = Math.min(1, 4200 / lado);
          const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          bytes = new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9))).arrayBuffer()); ext = 'jpg';
        }
        if (Math.min(bmp.width, bmp.height) < 1200) toast('Ojo: la foto es chica para imprimir; puede verse pixelada.');
        const nombre = f.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';
        const rel = `${carpeta}/${nombre}-${Date.now().toString(36).slice(-4)}.${ext}`;
        toast('Subiendo la foto a GitHub…');
        await S.gh.guardar(rutaLibro(rel), bytes, `Taller: imagen ${rel}`);
        S.arbol.push({ path: rutaLibro(rel) });
        await cargarBinarios({ [base() + rel]: bytes });
        toast('Foto subida.');
        listo(rel);
      } catch (e) { toast('No pude subir la foto: ' + e.message); listo(null); }
    };
    if (archivoDado) { inp.remove(); procesar(archivoDado); return; }
    inp.onchange = () => { inp.remove(); procesar(inp.files[0]); };
    inp.click();
  });
}
async function prepararTapa(paginas) {
  const t = S.cfg.tapa || {};
  const arch = {};
  for (const k of ['contratapa', 'solapa_delantera', 'solapa_trasera']) {
    const destino = base() + '_build/tapa-' + k.replace('_', '-') + '.typ';
    arch[destino] = t[k] && S.textos.has(t[k]) ? convertir(S.textos.get(t[k]), { sinNumero: true, base: base() }) : '';
  }
  await cargarTextos(arch);
  const elems = elementosTapa();
  if (t.elementos) await cargarTextos({ [base() + t.elementos]: JSON.stringify(elems, null, 1) });
  const img = [t.imagen, t.imagen_contratapa, t.foto_autor, ...elems.filter((e) => e.tipo === 'foto').map((e) => e.archivo)].filter(Boolean).map((p) => `#figura("${base()}${p}"`).join('\n');
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
    $('#pt-info').textContent = `Lomo de ${lomo.toFixed(1)} mm para ${paginas} páginas${ult ? '' : ' (estimadas: armá el libro para el valor real)'} · arrastrá los textos y fotos agregados`;
    S.lomoTapa = lomo;
    capaArrastre();
  } catch (e) { m.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
/* ── arrastrar textos y fotos sobre la vista de la tapa ── */
function aMm(v, d = 0) {
  if (v == null || v === '') return d;
  const n = parseFloat(v); const u = String(v).replace(/[0-9.\s-]/g, '');
  return u === 'cm' ? n * 10 : u === 'in' ? n * 25.4 : u === 'pt' ? n * 0.3528 : n;
}
function geometriaTapa() {
  const fo = S.cfg.formato || {}, t = S.cfg.tapa || {};
  const pre = S.presets.formatos[fo.preset] || S.presets.formatos['15x23'];
  const dura = t.encuadernacion === 'dura';
  const ceja = dura ? aMm(t.ceja, 3) : 0;
  const W = aMm(fo.ancho || pre.ancho) + ceja, H = aMm(fo.alto || pre.alto) + 2 * ceja;
  const sg = dura ? aMm(t.vuelta, 17) : aMm(t.sangrado, 3), sol = dura ? 0 : aMm(t.solapa, 0), pl = sol > 0 ? aMm(t.pliegue_solapa, 3) : 0;
  const lomo = (S.lomoTapa || 15) + (dura ? 2 * aMm(t.carton, 2.5) + 2 * aMm(t.canal, 8) : 0);
  const xc = sg + sol + pl, xl = xc + W, xt = xl + lomo, xd = xt + W + pl;
  return { W, H, sg, total: xd + sol + sg, alto: H + 2 * sg, caras: { 'solapa-tras': [sg, sol], contratapa: [xc, W], lomo: [xl, lomo], tapa: [xt, W], 'solapa-del': [xd, sol] } };
}
function cajaElemento(e, g) {
  const [x0, ac] = g.caras[e.cara || 'tapa'] || g.caras.tapa;
  const x = x0 + ac * (e.x ?? 10) / 100, y = g.sg + g.H * (e.y ?? 10) / 100, w = ac * (e.ancho ?? 80) / 100;
  let h;
  if (e.tipo === 'foto') h = g.H * (e.alto ?? 30) / 100;
  else if (e.tipo === 'forma') h = e.forma === 'linea' ? Math.max(1, (e.grosor ?? 1) * 0.3528) : g.H * (e.alto ?? 10) / 100;
  else {
    const lineas = String(e.texto || '').split('\n').length;
    h = lineas * (e.tam ?? 14) * 0.3528 * (1 + (e.interlineado ?? 0.45)) + (e.fondo ? 5 : 0);
  }
  return { x, y, w, h, ac };
}
function capaArrastre() {
  const m = $('#mesa-tapa'); const svg = m && $('svg', m); if (!svg) return;
  $('.capa-tapa', m)?.remove(); $('.barra-el')?.remove();
  const lista = elementosTapa(); if (!lista.length) return;
  const g = geometriaTapa();
  m.style.position = 'relative';
  const rs = svg.getBoundingClientRect(), rm = m.getBoundingClientRect();
  const k = rs.width / g.total; // px por mm
  const capa = h(`<div class="capa-tapa" style="left:${rs.left - rm.left + m.scrollLeft}px;top:${rs.top - rm.top + m.scrollTop}px;width:${rs.width}px;height:${rs.height}px"></div>`);
  // guías de imán: bordes, centro y zona segura de cada cara
  const guiasX = [], guiasY = [g.sg + 6, g.sg + g.H / 2, g.sg + g.H - 6, g.sg, g.sg + g.H];
  for (const [x0, w] of Object.values(g.caras)) if (w > 0) guiasX.push(x0, x0 + w / 2, x0 + w, x0 + 6, x0 + w - 6);
  const linea = (vertical) => { const d = h(`<i class="guia-iman ${vertical ? 'v' : 'h'}"></i>`); capa.append(d); return d; };
  const gv = linea(true), gh = linea(false);
  const iman = (v, guias) => { for (const gg of guias) if (Math.abs(v - gg) < 1.6) return gg; return null; };
  lista.forEach((e, i) => {
    if (e.cara?.startsWith('solapa') && !(g.caras[e.cara][1] > 0)) return;
    const c = cajaElemento(e, g);
    const d = h(`<div class="caja-el ${S.selEl === i ? 'sel' : ''}" data-i="${i}" title="Clic: elegir · arrastrar: mover · doble clic: escribir · la bolita: tamaño" style="left:${c.x * k}px;top:${c.y * k}px;width:${c.w * k}px;height:${Math.max(c.h * k, 8)}px"><i class="tirador"></i></div>`);
    capa.append(d);
    d.addEventListener('dblclick', () => { if (e.tipo === 'texto') editarEnLugar(i, d); else if (e.tipo === 'foto') subirFoto().then((r) => { if (r) { const l = elementosTapa(); l[i].archivo = r; guardarElementos(l); verTapa(); } }); });
    d.addEventListener('pointerdown', (ev) => {
      if (ev.detail > 1) return;
      ev.preventDefault(); d.setPointerCapture(ev.pointerId);
      seleccionar(i);
      const redim = ev.target.classList.contains('tirador');
      const x0 = ev.clientX, y0 = ev.clientY, l0 = d.offsetLeft, t0 = d.offsetTop, w0 = d.offsetWidth, h0 = d.offsetHeight;
      let movio = false;
      d.classList.add('activa');
      const mover = (ev2) => {
        const dx = ev2.clientX - x0, dy = ev2.clientY - y0;
        if (Math.abs(dx) + Math.abs(dy) > 2) movio = true;
        if (redim) {
          d.style.width = Math.max(8, w0 + dx) + 'px';
          if (e.tipo !== 'texto' && e.forma !== 'linea') d.style.height = Math.max(8, ev2.shiftKey ? (w0 + dx) * h0 / w0 : h0 + dy) + 'px';
          return;
        }
        let L = l0 + dx, T = t0 + dy;
        // imán: borde izquierdo, centro o borde derecho contra las guías
        let sx = null, sy = null;
        for (const off of [0, d.offsetWidth / 2, d.offsetWidth]) { const gx = iman((L + off) / k, guiasX); if (gx != null) { L = gx * k - off; sx = gx; break; } }
        for (const off of [0, d.offsetHeight / 2, d.offsetHeight]) { const gy = iman((T + off) / k, guiasY); if (gy != null) { T = gy * k - off; sy = gy; break; } }
        d.style.left = L + 'px'; d.style.top = T + 'px';
        gv.style.display = sx != null ? 'block' : 'none'; if (sx != null) gv.style.left = sx * k + 'px';
        gh.style.display = sy != null ? 'block' : 'none'; if (sy != null) gh.style.top = sy * k + 'px';
      };
      const soltar = () => {
        d.removeEventListener('pointermove', mover); d.classList.remove('activa'); gv.style.display = gh.style.display = 'none';
        if (!movio) return;
        const r = (v) => Math.round(v * 2) / 2;
        const l = elementosTapa(); const el = l[i];
        if (redim) {
          const [, ac] = g.caras[el.cara || 'tapa'];
          el.ancho = r(d.offsetWidth / k / ac * 100);
          if (el.tipo !== 'texto' && el.forma !== 'linea') el.alto = r(d.offsetHeight / k / g.H * 100);
        } else {
          // si se suelta en otra cara, el elemento se muda a esa cara
          const cxMm = (d.offsetLeft + d.offsetWidth / 2) / k;
          const nueva = Object.entries(g.caras).find(([, [a, w]]) => w > 0 && cxMm >= a && cxMm < a + w)?.[0] || el.cara || 'tapa';
          const [nx0, nac] = g.caras[nueva];
          el.cara = nueva;
          el.x = r((d.offsetLeft / k - nx0) / nac * 100);
          el.y = r((d.offsetTop / k - g.sg) / g.H * 100);
        }
        guardarElementos(l); pintarElementos(i); verTapa();
      };
      d.addEventListener('pointermove', mover);
      d.addEventListener('pointerup', soltar, { once: true });
    });
  });
  m.append(capa);
  barraElemento();
}
function seleccionar(i) {
  S.selEl = i;
  $$('.caja-el').forEach((d) => d.classList.toggle('sel', +d.dataset.i === i));
  barraElemento();
  // abre su ficha en el formulario
  $$('#elementos details.elem').forEach((d, j) => { d.open = j === i; if (j === i) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
}
// Barra de herramientas sobre la vista: alinear, ordenar, duplicar, tamaño, borrar.
function barraElemento() {
  $('.barra-el')?.remove();
  const l = elementosTapa(), i = S.selEl;
  if (i == null || !l[i]) return;
  const e = l[i];
  const btn = (acc, t, tit) => `<button type="button" data-acc="${acc}" title="${tit}">${t}</button>`;
  const b = h(`<div class="barra-el"><span class="be-nombre">${e.tipo === 'texto' ? 'Texto' : e.tipo === 'foto' ? 'Foto' : 'Forma'}</span>
    ${btn('izq', '⇤', 'Alinear a la izquierda de la cara')}${btn('cen', '↔', 'Centrar en la cara')}${btn('der', '⇥', 'Alinear a la derecha')}
    <span class="sep"></span>${btn('arr', '⤒', 'Arriba')}${btn('med', '↕', 'Centrar en alto')}${btn('aba', '⤓', 'Abajo')}
    <span class="sep"></span>${e.tipo === 'texto' ? btn('menos', 'A−', 'Más chico') + btn('mas', 'A+', 'Más grande') + btn('escribir', '✎', 'Escribir (doble clic)') : ''}
    ${btn('atras', '▽', 'Mandar atrás')}${btn('frente', '△', 'Traer al frente')}${btn('dup', '⧉', 'Duplicar (Ctrl+D)')}${btn('borrar', '✕', 'Borrar (Supr)')}
    <span class="sep"></span>${btn('soltar', 'Listo', 'Dejar de editar (Esc)')}</div>`);
  $('#mesa-tapa').prepend(b);
  $$('[data-acc]', b).forEach((x) => (x.onclick = () => accionElemento(x.dataset.acc)));
}
function accionElemento(acc) {
  const l = elementosTapa(), i = S.selEl; if (i == null || !l[i]) return;
  const e = l[i]; const g = geometriaTapa(); const [, ac] = g.caras[e.cara || 'tapa'];
  const c = cajaElemento(e, g); const altoPct = (c.h / g.H) * 100, anchoPct = e.ancho ?? 80;
  const margen = (6 / ac) * 100, margenV = (6 / g.H) * 100;
  const r = (v) => Math.round(v * 2) / 2;
  if (acc === 'soltar') { S.selEl = null; capaArrastre(); return; }
  if (acc === 'escribir') { const d = $(`.caja-el[data-i="${i}"]`); if (d) editarEnLugar(i, d); return; }
  if (acc === 'izq') { e.x = r(margen); if (e.tipo === 'texto') e.alineacion = 'left'; }
  if (acc === 'cen') { e.x = r((100 - anchoPct) / 2); if (e.tipo === 'texto') e.alineacion = 'center'; }
  if (acc === 'der') { e.x = r(100 - anchoPct - margen); if (e.tipo === 'texto') e.alineacion = 'right'; }
  if (acc === 'arr') e.y = r(margenV);
  if (acc === 'med') e.y = r((100 - altoPct) / 2);
  if (acc === 'aba') e.y = r(100 - altoPct - margenV);
  if (acc === 'mas') e.tam = Math.round((e.tam ?? 14) * 1.12 * 2) / 2;
  if (acc === 'menos') e.tam = Math.max(4, Math.round((e.tam ?? 14) / 1.12 * 2) / 2);
  if (acc === 'dup') { const cp = JSON.parse(JSON.stringify(e)); cp.x = (cp.x ?? 0) + 3; cp.y = (cp.y ?? 0) + 3; l.push(cp); S.selEl = l.length - 1; }
  if (acc === 'borrar') { l.splice(i, 1); S.selEl = null; }
  if (acc === 'frente') { l.push(l.splice(i, 1)[0]); S.selEl = l.length - 1; }
  if (acc === 'atras') { l.unshift(l.splice(i, 1)[0]); S.selEl = 0; }
  guardarElementos(l); pintarElementos(S.selEl ?? -1); verTapa();
}
// Escribir directamente sobre la tapa (doble clic en un texto).
function editarEnLugar(i, caja) {
  const e = elementosTapa()[i]; if (!e) return;
  $('.edicion-lugar')?.remove();
  const ta = h(`<textarea class="edicion-lugar" spellcheck="true" lang="es">${esc(e.texto || '')}</textarea>`);
  ta.style.left = caja.style.left; ta.style.top = caja.style.top; ta.style.width = Math.max(160, caja.offsetWidth) + 'px';
  caja.parentElement.append(ta); ta.focus(); ta.select();
  const cerrar = (guardar) => {
    if (!ta.isConnected) return;
    const v = ta.value; ta.remove();
    if (guardar && v !== e.texto) { const l = elementosTapa(); l[i].texto = v; guardarElementos(l); pintarElementos(i); verTapa(); }
  };
  ta.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(false); if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) cerrar(true); ev.stopPropagation(); });
  ta.addEventListener('blur', () => cerrar(true));
}
// Teclado en la pestaña Tapa: flechas mueven, Supr borra, Ctrl+D duplica, Ctrl+Z deshace, Esc suelta.
document.addEventListener('keydown', (ev) => {
  if (!$('#v-tapa')?.classList.contains('activa')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); deshacerElemento(); return; }
  if (S.selEl == null) return;
  const paso = ev.shiftKey ? 5 : 0.5;
  const mov = { ArrowLeft: ['x', -paso], ArrowRight: ['x', paso], ArrowUp: ['y', -paso], ArrowDown: ['y', paso] }[ev.key];
  if (mov) {
    ev.preventDefault();
    const l = elementosTapa(); const e = l[S.selEl]; if (!e) return;
    e[mov[0]] = Math.round(((e[mov[0]] ?? 0) + mov[1]) * 2) / 2;
    guardarElementos(l); programarTapa();
    const d = $(`.caja-el[data-i="${S.selEl}"]`); if (d) { const g = geometriaTapa(); const k = d.parentElement.offsetWidth / g.total; const c = cajaElemento(e, g); d.style.left = c.x * k + 'px'; d.style.top = c.y * k + 'px'; }
    return;
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); accionElemento('borrar'); }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); accionElemento('dup'); }
  if (ev.key === 'Escape') accionElemento('soltar');
});
function estimarPaginas() {
  const palabras = [...S.textos.values()].reduce((a, t) => a + t.split(/\s+/).length, 0);
  return Math.round(palabras / 280 / 2) * 2 || 200;
}

/* ═════════ producción ═════════ */
function avisos() {
  const out = [];
  const isbn = revisarIsbn(S.cfg.libro?.isbn);
  if (isbn && !isbn.ok) out.push('ISBN: ' + isbn.texto);
  if (!S.cfg.libro?.isbn) out.push('Falta el ISBN: la contratapa sale con un recuadro «ISBN pendiente».');
  {
    const norma = S.cfg.estilo?.norma_citas || 'apa';
    let mal = 0, caps = 0;
    for (const c of S.cfg.contenido || []) { const md = S.textos.get(c.archivo || ''); if (!md) continue; const n = revisarNorma(md, norma).length; if (n) { mal += n; caps++; } }
    if (mal) out.push(`Norma de citas (${NORMAS[norma].nombre}): ${mal} notas en ${caps} capítulos no la siguen. Se corrigen en Texto → Citas.`);
  }
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
// Lista de control de imprenta: [estado ok|aviso|mal, título, detalle]
function controlImprenta(ult) {
  const L = S.cfg.libro || {}, t = S.cfg.tapa || {}, ti = S.cfg.tipografia || {};
  const out = [];
  const isbn = revisarIsbn(L.isbn);
  out.push(!L.isbn ? ['aviso', 'ISBN pendiente', 'La contratapa sale con un recuadro en vez del código de barras.'] : isbn.ok ? ['ok', 'ISBN válido', L.isbn] : ['mal', 'ISBN con error', isbn.texto]);
  if (!ult) out.push(['aviso', 'Todavía no se armó el libro', 'Armalo para saber páginas, pliegos y lomo reales.']);
  else {
    const resto = ult.paginas % 16;
    out.push(resto && !S.cfg.estilo?.completar_pliego ? ['aviso', `${ult.paginas} páginas: el último pliego queda incompleto`, `Faltan ${16 - resto} para completar 16 (o sobran ${resto}). La imprenta agrega blancas o se ajusta el texto.`] : ['ok', `${ult.paginas} páginas, ${ult.paginas / 16} pliegos completos`, '']);
    out.push(ult.lomo < 6 ? ['aviso', `Lomo de ${ult.lomo.toFixed(1)} mm`, 'Con menos de 6 mm no entra texto en el lomo.'] : ['ok', `Lomo de ${ult.lomo.toFixed(1)} mm`, `papel ${t.papel || 'obra-80'}: confirmalo con la imprenta`]);
  }
  out.push(aMm(t.sangrado, 3) >= 3 ? ['ok', 'Sangrado de tapa', `${aMm(t.sangrado, 3)} mm por lado`] : ['mal', 'Sangrado de tapa insuficiente', 'Las imprentas piden al menos 3 mm.']);
  out.push(ti.viudas === false ? ['aviso', 'Viudas y huérfanas permitidas', 'Activá «Evitar renglones sueltos» en Estilos.'] : ['ok', 'Viudas y huérfanas controladas', '']);
  out.push(ti.cortes === 'pocos' || ti.cortes === 'ninguno' || ti.justificado === false ? ['ok', 'Cortes de palabra moderados', ''] : ['aviso', 'Cortes de palabra normales', 'Con texto justificado conviene «Pocos» para evitar guiones seguidos.']);
  let orto = 0, largos = 0, notasMal = 0, sinLlamada = 0;
  const norma = S.cfg.estilo?.norma_citas || 'apa';
  for (const c of S.cfg.contenido || []) {
    const md = S.textos.get(c.archivo || ''); if (!md) continue;
    orto += revisarOrtotipografia(md).filter((x) => x.sugerencias.length).length;
    largos += revisarParrafos(md).filter((x) => x.id.startsWith('par')).length;
    notasMal += revisarNorma(md, norma).length;
    const llam = new Set([...md.matchAll(/\[\^([^\]]+)\](?!:)/g)].map((m) => m[1]));
    sinLlamada += [...md.matchAll(/^\[\^([^\]]+)\]:/gm)].filter((m) => !llam.has(m[1])).length;
  }
  out.push(orto ? ['aviso', `${orto} arreglos ortotipográficos pendientes`, 'Comillas, rayas, espacios, cifras. Se aplican en Texto → Revisión → Normas ortotipográficas.'] : ['ok', 'Ortotipografía', 'sin arreglos pendientes']);
  out.push(notasMal ? ['aviso', `${notasMal} notas fuera de la norma ${NORMAS[norma].nombre}`, 'Texto → Citas → Norma de citas.'] : ['ok', `Notas en ${NORMAS[norma].nombre}`, '']);
  if (sinLlamada) out.push(['mal', `${sinLlamada} notas sin llamada en el texto`, 'Salen en el PDF sin número que las llame.']);
  if (largos) out.push(['aviso', `${largos} párrafos de más de media página`, 'Texto → Revisión → Largo de párrafos.']);
  out.push(['ok', 'Fuentes incrustadas', 'el PDF lleva las letras adentro']);
  out.push(['aviso', 'Color', 'El PDF del navegador sale en RGB. Para imprenta usá los CMYK que arma GitHub («Armar en GitHub» o «Publicar versión»).']);
  return out;
}
// Resolución real de cada imagen según el tamaño al que se imprime (300 ppp ideal, 200 mínimo).
async function revisarResolucion() {
  const caja = $('#ppp'); caja.innerHTML = '<div class="nota"><span class="spin"></span> Midiendo imágenes…</div>';
  const fo = S.cfg.formato || {}, pre = S.presets.formatos[fo.preset] || S.presets.formatos['15x23'];
  const W = aMm(fo.ancho || pre.ancho), H = aMm(fo.alto || pre.alto);
  const caja_mm = W - aMm(fo.margen_interior, 20) - aMm(fo.margen_exterior, 16);
  const usos = [];
  for (const c of S.cfg.contenido || []) {
    const md = S.textos.get(c.archivo || ''); if (!md) continue;
    for (const m of md.matchAll(/!\[[^\]]*\]\(([^)]+)\)(\{[^}]*\})?/g)) {
      if (/\.svg$/i.test(m[1]) || /^https?:/.test(m[1])) continue;
      const at = m[2] || '';
      const pct = /pagina=completa|apaisado/.test(at) ? 100 : /sangrado/.test(at) ? (W + 6) / caja_mm * 100 : parseFloat((at.match(/ancho=(\d+)/) || [])[1] || 100);
      usos.push({ ruta: m[1], mm: caja_mm * pct / 100, donde: primerTitulo(md) || c.archivo });
    }
  }
  const t = S.cfg.tapa || {}, g = geometriaTapa();
  if (t.imagen) usos.push({ ruta: t.imagen, mm: g.W + 2 * g.sg, donde: 'Tapa' });
  if (t.imagen_envolvente) usos.push({ ruta: t.imagen_envolvente, mm: 2 * g.W + (S.lomoTapa || 15) + 2 * g.sg, donde: 'Tapa envolvente' });
  if (t.imagen_contratapa) usos.push({ ruta: t.imagen_contratapa, mm: g.W, donde: 'Contratapa' });
  for (const e of elementosTapa()) if (e.tipo === 'foto' && e.archivo) usos.push({ ruta: e.archivo, mm: (g.caras[e.cara || 'tapa']?.[1] || g.W) * (e.ancho ?? 80) / 100, donde: 'Tapa (capa)' });
  if (!usos.length) { caja.innerHTML = '<p class="sutil">El libro no tiene fotos (los mapas en SVG no tienen problema de resolución).</p>'; return; }
  const filas = [];
  await enLotes(usos, 4, async (u) => {
    try {
      const bytes = await S.gh.bytes(rutaLibro(u.ruta));
      const bmp = await createImageBitmap(new Blob([bytes]));
      const ppp = Math.round(bmp.width / (u.mm / 25.4));
      filas.push({ ...u, ppp, px: `${bmp.width}×${bmp.height}` });
    } catch { filas.push({ ...u, ppp: null }); }
  });
  filas.sort((a, b) => (a.ppp ?? 0) - (b.ppp ?? 0));
  const malas = filas.filter((f) => f.ppp != null && f.ppp < 200).length, justas = filas.filter((f) => f.ppp >= 200 && f.ppp < 300).length;
  caja.innerHTML = `<div class="aviso ${malas ? 'mal' : 'bien'}" style="margin-top:10px">${filas.length} imágenes · ${malas} con poca resolución (menos de 200 ppp) · ${justas} justas (200 a 300)</div>
    <table class="tabla"><tr><th>Imagen</th><th>Dónde</th><th>Tamaño impreso</th><th>Resolución</th></tr>${filas.map((f) => `<tr><td>${esc(f.ruta.split('/').pop())}<br><small class="sutil">${f.px || ''}</small></td><td>${esc(f.donde)}</td><td>${Math.round(f.mm)} mm</td><td class="${f.ppp == null ? '' : f.ppp < 200 ? 'mal' : f.ppp < 300 ? 'justa' : 'bien'}">${f.ppp == null ? 'no la pude leer' : f.ppp + ' ppp'}${f.ppp != null && f.ppp < 300 ? `<br><button class="btn chico" data-amp="${esc(f.ruta)}">Ampliar ×${f.ppp < 150 ? 4 : 2}</button>` : ''}</td></tr>`).join('')}</table>`;
  $$('[data-amp]', caja).forEach((b) => (b.onclick = async () => {
    const ruta = b.dataset.amp; b.disabled = true;
    try {
      const fila = filas.find((x) => x.ruta === ruta);
      const { ampliarImagen } = await import('./ampliar.js');
      const bytes = await S.gh.bytes(rutaLibro(ruta));
      const r = await ampliarImagen(new Blob([bytes]), { escala: fila.ppp < 150 ? 4 : 2, alProgreso: (p) => { b.textContent = Math.round(p * 100) + ' %'; } });
      const nueva = ruta.replace(/\.[^.]+$/, '') + '-hd.jpg';
      const datos = new Uint8Array(await r.blob.arrayBuffer());
      await S.gh.guardar(rutaLibro(nueva), datos, `Taller: imagen ampliada ${nueva}`);
      S.arbol.push({ path: rutaLibro(nueva) });
      await cargarBinarios({ [base() + nueva]: datos });
      // reemplazar las referencias en textos y tapa
      for (const [k, v] of S.textos) if (v.includes(ruta)) { const n2 = v.split('](' + ruta + ')').join('](' + nueva + ')'); if (k === S.actual) S.editor.dispatch({ changes: { from: 0, to: S.editor.state.doc.length, insert: n2 } }); else S.textos.set(k, n2); }
      const t = S.cfg.tapa || {}; const camb = {};
      for (const k of ['imagen', 'imagen_envolvente', 'imagen_contratapa', 'foto_autor']) if (t[k] === ruta) camb[k] = nueva;
      if (Object.keys(camb).length) aplicarCambiosConfig({ tapa: camb });
      const els = elementosTapa(); if (els.some((e) => e.archivo === ruta)) guardarElementos(els.map((e) => (e.archivo === ruta ? { ...e, archivo: nueva } : e)));
      marcarEstado(); b.textContent = `Lista: ${r.ancho}×${r.alto}`; toast('Imagen ampliada y reemplazada. Guardá para conservar los cambios.');
    } catch (e) { toast('No pude ampliarla: ' + e.message); b.disabled = false; b.textContent = 'Reintentar'; }
  }));
}
async function fichaTecnica() {
  const b = $('#b-ficha'); b.disabled = true;
  try {
    const ult = leer('taller.paginas.' + S.slug, null);
    const paginas = ult?.paginas || estimarPaginas();
    const lomo = ult?.lomo ?? lomoMm(S.cfg, S.presets, paginas);
    if (!S.fichaTyp) { S.fichaTyp = await S.gh.texto('plantilla/ficha.typ'); await cargarTextos({ '/plantilla/ficha.typ': S.fichaTyp }); }
    const r = await compilar('/plantilla/ficha.typ', { libro: S.slug, paginas: String(paginas), lomo: lomo.toFixed(1) + 'mm' }, 'pdf');
    if (!r.ok) throw new Error(r.errores.join('\n'));
    const u = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
    const a = h(`<a href="${u}" download="ficha-tecnica-${S.slug}.pdf"></a>`); document.body.append(a); a.click(); a.remove();
    if (!ult) toast('Ojo: las páginas son estimadas. Armá el libro para que la ficha tenga las reales.');
  } catch (e) { toast(e.message); }
  finally { b.disabled = false; }
}
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
      <h2>Control de imprenta</h2>
      <p>Revisión final de todo lo que una imprenta te rebotaría.</p>
      <ul class="control">${controlImprenta(ult).map(([e, t, d]) => `<li class="${e}"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ''}</li>`).join('')}</ul>
      <div class="acciones" style="margin-top:10px"><button class="btn chico" id="b-ppp">Revisar resolución de imágenes</button><button class="btn chico" id="b-ficha">${I.bajar}Ficha técnica para la imprenta</button></div>
      <div id="ppp"></div>
      ${lista.length ? `<details style="margin-top:10px"><summary class="sutil" style="cursor:pointer">Otros avisos (${lista.length})</summary><ul class="lista-avisos" style="margin-top:8px">${lista.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
    </div>
    ${S.gh?.esSupabase ? '' : `<div class="bloque">
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
      <h2>Pruebas de autor</h2>
      <p>Cuando mandás el libro al autor para revisar, marcá una prueba. Después podés ver qué cambió desde esa prueba, capítulo por capítulo, con lo agregado y lo borrado.</p>
      <div class="acciones"><button class="btn" id="b-prueba">Marcar nueva prueba</button></div>
      <div id="pruebas"><div class="nota" style="font-size:12.5px;color:var(--tinta-suave)"><span class="spin"></span> Buscando pruebas…</div></div>
    </div>`}
    <div class="bloque">
      <h2>Cerrar pliegos</h2>
      <p>Las imprentas trabajan en pliegos de 16 páginas. El taller prueba cambios mínimos de interlineado (décimas de punto, invisibles a la lectura) hasta que el libro cierre justo. Si no se puede, te dice cuántas páginas en blanco agrega la imprenta al final.</p>
      <div class="acciones"><button class="btn" id="b-pliegos">Buscar el cierre</button><select class="entrada" id="pl-de" style="width:auto;height:32px"><option value="16">Pliegos de 16</option><option value="32">Pliegos de 32</option><option value="8">Pliegos de 8</option></select></div>
      <div id="pliegos"></div>
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
  $('#b-ppp').onclick = revisarResolucion;
  $('#b-ficha').onclick = fichaTecnica;
  $('#b-simular').onclick = simular;
  $('#b-pliegos').onclick = cerrarPliegos;
  if (urls.length) $('#descargas').innerHTML = botonesPdf(urls);
  if (!S.gh?.esSupabase) {
    $('#b-actions').onclick = armarGitHub;
    $('#b-prueba').onclick = marcarPrueba;
    listarPruebas();
    $('#b-publicar').onclick = publicarVersion;
    listarVersiones();
    listarCorridas();
  }
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
    S.libroArmado = { interior: r.bytes, tapa: rt.ok ? rt.bytes : null, fecha: Date.now() };
    const ult = { paginas, lomo, fecha: Date.now() };
    escribir('taller.paginas.' + S.slug, ult);
    $('#cifras').innerHTML = cifras(ult);
    $('#descargas').innerHTML = botonesPdf(urls);
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
    const nombreArch = (n) => n.endsWith('.epub') ? 'EPUB' : n.endsWith('.docx') ? 'Word' : n.includes('-cmyk') ? (n.includes('tapa') ? 'Tapa CMYK' : 'Interior CMYK') : n.includes('tapa-guias') ? 'Tapa con guías' : n.includes('tapa') ? 'Tapa' : n.includes('interior') ? 'Interior' : n;
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
/* ── pruebas de autor y control de cambios ── */
async function listarPruebas() {
  const caja = $('#pruebas'); if (!caja) return;
  try {
    const refs = await S.gh.etiquetas(`prueba-${S.slug}-`);
    const lista = await Promise.all(refs.map(async (r) => {
      const n = +r.ref.split('-').pop();
      let fecha = '';
      try { const c = await S.gh.commit(r.object.sha); fecha = new Date(c.committer.date).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch {}
      return { n, tag: r.ref.replace('refs/tags/', ''), fecha };
    }));
    lista.sort((a, b) => b.n - a.n);
    S.pruebas = lista;
    caja.innerHTML = lista.length ? `<ul class="lista-pruebas">${lista.map((p) => `<li><b>Prueba ${p.n}</b><span>${esc(p.fecha)}</span><button class="btn chico" data-cambios="${esc(p.tag)}">Ver cambios desde acá</button></li>`).join('')}</ul>` : '<p class="sutil">Todavía no marcaste ninguna prueba.</p>';
    $$('[data-cambios]', caja).forEach((b) => (b.onclick = () => verCambios(b.dataset.cambios)));
  } catch (e) { caja.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
async function marcarPrueba() {
  if (hayCambios()) return toast('Primero guardá en GitHub: la prueba se marca sobre lo guardado.');
  const n = (S.pruebas?.[0]?.n || 0) + 1;
  try {
    const sha = await S.gh.shaRama();
    await S.gh.crearEtiqueta(`prueba-${S.slug}-${n}`, sha);
    toast(`Prueba ${n} marcada. Si querés mandarle el PDF al autor, usá «Publicar versión».`);
    listarPruebas();
  } catch (e) { toast('No pude marcar la prueba: ' + e.message); }
}
async function verCambios(tag) {
  const d = h(`<dialog class="grande"><div class="cuerpo"><h2>Cambios desde la ${esc(tag.replace(`prueba-${S.slug}-`, 'prueba '))}</h2><div id="cmb"><div class="nota"><span class="spin"></span> Comparando…</div></div></div><div class="pie"><button class="btn prim" data-x>Cerrar</button></div></dialog>`);
  document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
  $('[data-x]', d).onclick = () => d.close();
  const caja = $('#cmb', d);
  try {
    const cmp = await S.gh.comparar(tag, S.gh.rama);
    const pre = rutaLibro('');
    const archivos = (cmp.files || []).filter((f) => f.filename.startsWith(pre) && /\.md$/.test(f.filename));
    // también lo que todavía no se guardó
    const sinGuardar = [...S.textos.keys()].filter((k) => k.endsWith('.md') && S.textos.get(k) !== S.originales.get(k)).map((k) => pre + k);
    const todos = [...new Set([...archivos.map((f) => f.filename), ...sinGuardar])];
    if (!todos.length) { caja.innerHTML = '<p>No hubo cambios en los textos desde esa prueba.</p>'; return; }
    caja.innerHTML = `<p class="sutil">${todos.length} ${todos.length === 1 ? 'texto cambió' : 'textos cambiaron'}. Tocá uno para ver el detalle: en verde lo agregado, tachado en rojo lo borrado.</p><div class="lista-cambios">${todos.map((f) => { const k = f.slice(pre.length); const st = archivos.find((x) => x.filename === f); return `<button class="btn" data-f="${esc(k)}">${esc(primerTitulo(S.textos.get(k) || '') || k)}<small>${st ? (st.status === 'added' ? 'nuevo' : st.status === 'removed' ? 'borrado' : '') : ''}${sinGuardar.includes(f) ? ' · sin guardar' : ''}</small></button>`; }).join('')}</div><div id="cmb-det"></div>`;
    $$('[data-f]', caja).forEach((b) => (b.onclick = async () => {
      const k = b.dataset.f; const det = $('#cmb-det', caja);
      det.innerHTML = '<div class="nota"><span class="spin"></span> Cargando…</div>';
      let antes = ''; try { antes = await S.gh.textoEn(rutaLibro(k), tag); } catch {}
      const ahora = S.textos.get(k) ?? '';
      const partes = diffWords(antes, ahora);
      const mas = partes.filter((p) => p.added).reduce((a, p) => a + p.value.split(/\s+/).filter(Boolean).length, 0);
      const menos = partes.filter((p) => p.removed).reduce((a, p) => a + p.value.split(/\s+/).filter(Boolean).length, 0);
      // mostrar solo los párrafos con cambios, con un poco de contexto
      let html = '';
      for (const p of partes) {
        if (p.added) html += `<ins>${esc(p.value)}</ins>`;
        else if (p.removed) html += `<del>${esc(p.value)}</del>`;
        else { const v = p.value; html += v.length > 360 ? esc(v.slice(0, 160)) + '<span class="corte"> […] </span>' + esc(v.slice(-160)) : esc(v); }
      }
      det.innerHTML = `<div class="cmb-cifras"><span class="mas">+${mas} palabras</span> <span class="menos">−${menos} palabras</span></div><div class="cmb-texto">${html.replace(/\n/g, '<br>')}</div>`;
    }));
  } catch (e) { caja.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}

// Prueba ajustes mínimos de interlineado para que el libro termine justo en un pliego.
async function cerrarPliegos() {
  const b = $('#b-pliegos'); b.disabled = true;
  const caja = $('#pliegos'); const de = +$('#pl-de').value;
  const ti = S.cfg.tipografia || {};
  const base0 = aMm(ti.interlineado || '14.5pt') / 0.3528; // en puntos
  const cuerpo = ti.cuerpo || '11pt';
  const probar = async (il) => {
    const r = await compilar(base() + '_build/libro.typ', { libro: S.slug, interlineado: il.toFixed(2) + 'pt' }, 'pdf');
    return r.ok ? contarPaginasPdf(r.bytes) : null;
  };
  try {
    caja.innerHTML = '<div class="nota"><span class="spin"></span> Armando el libro como está…</div>';
    await prepararLibroCompleto();
    const n0 = await probar(base0);
    if (n0 == null) throw new Error('No pude armar el libro.');
    const resto = n0 % de;
    if (!resto) { caja.innerHTML = `<div class="aviso bien">${n0} páginas: ya cierra justo en pliegos de ${de}.</div>`; return; }
    const abajo = n0 - resto, arriba = n0 + (de - resto);
    const objetivos = [];
    // primero el más cercano; ganar páginas (achicar) suele ser más fácil si sobran pocas
    if (resto <= de / 2) objetivos.push(['achicar', abajo], ['agrandar', arriba]); else objetivos.push(['agrandar', arriba], ['achicar', abajo]);
    const res = [];
    let mejor = null; // el ajuste que deja menos páginas en blanco
    for (const [modo, meta] of objetivos) {
      for (const d of [0.05, 0.1, 0.15, 0.2, 0.3, 0.4]) {
        const il = modo === 'achicar' ? base0 - d : base0 + d;
        caja.innerHTML = `<div class="nota"><span class="spin"></span> ${n0} páginas. Probando interlineado ${il.toFixed(2)} pt para llegar a ${meta}…</div>`;
        const n = await probar(il);
        if (n == null) continue;
        const sobra = (de - (n % de)) % de;
        if (!mejor || sobra < mejor.blancas) mejor = { il, d, n, blancas: sobra, modo };
        if (n === meta) { res.push({ modo, meta, il, d }); break; }
        if ((modo === 'achicar' && n < meta) || (modo === 'agrandar' && n > meta)) break;
      }
      if (res.length) break;
    }
    const blancas = de - resto;
    const pasoBlancas = mejor && mejor.blancas < blancas ? `<div class="propuesta">O casi: con interlineado ${mejor.il.toFixed(2)} pt quedan ${mejor.n} páginas y solo ${mejor.blancas} en blanco antes del colofón.<div class="acciones" style="margin-top:8px"><button class="btn chico" id="pl-casi">Aplicar este ajuste y completar con blancas</button></div></div>` : '';
    caja.innerHTML = `<div class="aviso">El libro tiene <b>${n0}</b> páginas: ${Math.floor(n0 / de)} pliegos de ${de} y sobran ${resto}.</div>` +
      (res.length ? `<div class="propuesta"><b>Se cierra justo en ${res[0].meta} páginas</b> con interlineado ${res[0].il.toFixed(2)} pt en vez de ${base0.toFixed(2)} pt (${res[0].modo === 'achicar' ? '−' : '+'}${res[0].d.toFixed(2)} pt, no se nota a la lectura).<div class="acciones" style="margin-top:8px"><button class="btn prim chico" id="pl-aplicar">Aplicar</button></div></div>`
        : `<div class="nota">Con cambios invisibles no cierra justo: los capítulos empiezan en página impar y el total salta de a dos o más páginas.</div>${pasoBlancas}`) +
      `<div class="propuesta">También podés dejar el texto como está y completar con ${blancas} ${blancas === 1 ? 'página en blanco' : 'páginas en blanco'} antes del colofón, que es lo habitual en imprenta.<div class="acciones" style="margin-top:8px"><button class="btn chico" id="pl-blancas">Completar con páginas en blanco</button></div></div>`;
    const ap = $('#pl-aplicar');
    if (ap) ap.onclick = () => { aplicarCambiosConfig({ tipografia: { interlineado: res[0].il.toFixed(2) + 'pt' }, estilo: { completar_pliego: 0 } }); toast(`Interlineado ${res[0].il.toFixed(2)} pt aplicado. Armá el libro para confirmar y guardá.`); };
    const casi = $('#pl-casi');
    if (casi) casi.onclick = () => { aplicarCambiosConfig({ tipografia: { interlineado: mejor.il.toFixed(2) + 'pt' }, estilo: { completar_pliego: de } }); toast('Ajuste aplicado y el último pliego se completa con blancas. Armá el libro para confirmar.'); };
    $('#pl-blancas').onclick = () => { aplicarCambiosConfig({ estilo: { completar_pliego: de } }); toast(`El libro va a cerrar en ${n0 + blancas} páginas con ${blancas} en blanco antes del colofón. Guardá para conservarlo.`); };
  } catch (e) { caja.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  finally { b.disabled = false; }
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
const provActual = () => {
  const p = S.conf.proveedor || (S.conf.groq || !S.conf.gemini ? 'groq' : 'gemini');
  if (!S.conf[p]) { const otro = p === 'groq' ? 'gemini' : 'groq'; if (S.conf[otro]) return otro; }
  return p;
};
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
  // sin límite de largo: si el texto es más grande de lo que el modelo acepta de una vez, va por tramos
  const op = opcionesIA();
  const max = op.proveedor === 'gemini' ? 300000 : 9000;
  const tramos = []; let ini = 0;
  while (ini < texto.length) { let fin = Math.min(texto.length, ini + max); if (fin < texto.length) { const p = texto.lastIndexOf('\n\n', fin); if (p > ini + max / 3) fin = p; } tramos.push(texto.slice(ini, fin)); ini = fin; }
  const out = $('#ia-out');
  try {
    const partes = [];
    for (let i = 0; i < tramos.length; i++) {
      out.innerHTML = `<div class="nota"><span class="spin"></span> Pensando…${tramos.length > 1 ? ` tramo ${i + 1} de ${tramos.length}` : ''}</div>`;
      partes.push(await preguntar({ ...op, accion, texto: tramos[i].trim(), pedido }));
    }
    const reemplaza = accion && ACCIONES[accion].reemplaza;
    const r = partes.length === 1 ? partes[0] : reemplaza ? partes.join('\n\n') : partes.map((x, i) => `— Tramo ${i + 1} de ${partes.length} —\n${x}`).join('\n\n');
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
      <button class="btn chico" id="rev-normas" title="Comillas, rayas, puntos suspensivos, espacios, cifras y siglas según la norma del castellano">Normas ortotipográficas</button>
      <button class="btn chico" id="rev-parrafos" title="Marca párrafos de más de media página y rachas de párrafos muy cortos">Largo de párrafos</button>
      <button class="btn chico" id="rev-limpiar">Limpiar marcas</button>
    </div>
    <label class="check" style="font-size:12.5px"><input type="checkbox" id="rev-orto" ${S.conf.ortografia === false ? '' : 'checked'}>Subrayado ortográfico del navegador mientras escribo</label>
    <div id="rev-estado"></div>
    <div id="rev-lista" class="rev-lista"></div>`;
  $('#rev-lt').onclick = () => revisar('lt');
  $('#rev-normas').onclick = () => {
    if (!S.actual) return;
    const t = S.editor.state.doc.toString();
    const marcas = revisarOrtotipografia(t);
    const otras = listarMarcas(S.editor.state).filter((x) => x.origen !== 'Normas');
    S.editor.dispatch({ effects: fijarMarcas.of([...otras, ...marcas]) });
    // en todo el libro
    let total = 0, caps = 0;
    for (const c of S.cfg.contenido || []) { const md = S.textos.get(c.archivo || ''); if (!md) continue; const n = revisarOrtotipografia(md).filter((x) => x.sugerencias.length).length; if (n) { total += n; caps++; } }
    $('#rev-estado').innerHTML = `<div class="nota">En este capítulo: ${marcas.length} ${marcas.length === 1 ? 'cosa' : 'cosas'} para revisar. En todo el libro: ${total} arreglos en ${caps} capítulos.
      ${total ? '<button class="btn chico prim" id="rev-normas-libro" style="margin-top:8px">Aplicar los arreglos en todo el libro</button>' : ''}</div>`;
    const bl = $('#rev-normas-libro');
    if (bl) bl.onclick = () => {
      if (!confirm(`Se van a aplicar ${total} arreglos ortotipográficos en ${caps} capítulos (comillas, rayas, espacios, cifras…). Los avisos sin arreglo automático quedan para revisar a mano. ¿Seguir?`)) return;
      for (const c of S.cfg.contenido || []) {
        const md = S.textos.get(c.archivo || ''); if (!md) continue;
        const ms = revisarOrtotipografia(md).filter((x) => x.sugerencias.length).sort((a, b) => b.from - a.from);
        if (!ms.length) continue;
        let nuevo = md; for (const x of ms) nuevo = nuevo.slice(0, x.from) + x.sugerencias[0] + nuevo.slice(x.to);
        if (c.archivo === S.actual) S.editor.dispatch({ changes: { from: 0, to: S.editor.state.doc.length, insert: nuevo } });
        else S.textos.set(c.archivo, nuevo);
      }
      marcarEstado(); pintarLista?.();
      toast(`Listo: ${total} arreglos aplicados. Revisá y guardá. En el capítulo abierto podés deshacer con Ctrl+Z.`);
      $('#rev-normas').click();
    };
    pintarListaRevision();
  };
  $('#rev-parrafos').onclick = () => {
    if (!S.actual) return;
    const t = S.editor.state.doc.toString();
    const marcas = revisarParrafos(t);
    const otras = listarMarcas(S.editor.state).filter((x) => x.origen !== 'Párrafos');
    S.editor.dispatch({ effects: fijarMarcas.of([...otras, ...marcas]) });
    const pars = t.split(/\n\n+/).filter((p) => p.trim() && !/^(#|:::|\[\^)/.test(p.trim()));
    const prom = Math.round(pars.reduce((a, p) => a + p.split(/\s+/).length, 0) / Math.max(1, pars.length));
    $('#rev-estado').innerHTML = `<div class="nota">${pars.length} párrafos, ${prom} palabras de promedio. ${marcas.length ? `${marcas.length} para revisar.` : 'Todos en un largo cómodo.'}</div>`;
    pintarListaRevision();
  };
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
  const conArreglo = marcas.filter((m) => m.sugerencias.length);
  caja.innerHTML = `<div class="rev-cuenta">${marcas.length} ${marcas.length === 1 ? 'observación' : 'observaciones'} · ${cuenta.map(([t, n]) => `<span class="punto-${t}"></span>${TIPOS_REV[t]} ${n}`).join(' · ')}${conArreglo.length > 1 ? ` <button class="btn chico" id="rev-todas" style="margin-left:auto">Aplicar las ${conArreglo.length} primeras sugerencias</button>` : ''}</div>` +
    marcas.map((m, i) => `<div class="rev-item" data-i="${i}">
      <div class="rev-msg"><span class="punto-${m.tipo}"></span>${esc(m.mensaje)} <small>${esc(m.origen)}</small></div>
      <div class="rev-ctx">${contexto(v.state.doc, m)}</div>${m.sugerencias.length && m.origen === 'Normas' ? `<div class="rev-cambio"><s>${esc(m.original)}</s> → <b>${esc(m.sugerencias[0])}</b></div>` : ''}
      <div class="respuesta-acc">${m.sugerencias.map((s, k) => `<button class="btn chico prim-suave" data-s="${k}">${esc(s) || '<i>borrar</i>'}</button>`).join('')}<button class="btn chico" data-ign>Ignorar</button></div>
    </div>`).join('');
  const bt = $('#rev-todas', caja);
  if (bt) bt.onclick = () => {
    const cambios = listarMarcas(v.state).filter((m) => m.sugerencias.length).map((m) => ({ from: m.from, to: m.to, insert: m.sugerencias[0] }));
    v.dispatch({ changes: cambios, effects: fijarMarcas.of(listarMarcas(v.state).filter((m) => !m.sugerencias.length)) });
    toast(`${cambios.length} cambios aplicados. Podés deshacer con Ctrl+Z.`); pintarListaRevision();
  };
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

/* ═════════ índice en vivo ═════════ */
function pintarIndice() {
  const a = $('#indice-vivo');
  const prof = Number(S.cfg.estilo?.indice_profundidad || 2);
  const fo = S.cfg.formato || {}, ti = S.cfg.tipografia || {};
  const pre = S.presets.formatos[fo.preset] || S.presets.formatos['15x23'];
  const W = aMm(fo.ancho || pre.ancho), H = aMm(fo.alto || pre.alto);
  const anchoT = W - aMm(fo.margen_interior, 20) - aMm(fo.margen_exterior, 16), altoT = H - aMm(fo.margen_superior, 18) - aMm(fo.margen_inferior, 22);
  // palabras por página aproximadas: caracteres por línea × líneas ÷ 6,2 (palabra media del castellano con espacio)
  const ppp = Math.max(120, (anchoT / (aMm(ti.cuerpo || '11pt') * 0.3528 * 0.47)) * Math.floor(altoT / aMm(ti.interlineado || '14.5pt')) / 6.2 * 0.93);
  const ult = leer('taller.paginas.' + S.slug, null);
  let pag = 9, n = 0, filas = '';
  for (const c of S.cfg.contenido || []) {
    if (c.tipo === 'parte') { filas += `<div class="ind-parte">${esc(c.titulo)}</div>`; pag += pag % 2 ? 2 : 1; continue; }
    const md = S.textos.get(c.archivo); if (md == null) continue;
    if (pag % 2 === 0) pag++;
    const titulo = primerTitulo(md) || c.archivo;
    const num = c.tipo === 'capitulo' ? `${++n}. ` : '';
    filas += `<button class="ind-cap" data-a="${esc(c.archivo)}"><span>${esc(num + titulo)}</span><b>${pag}</b></button>`;
    if (prof >= 2) {
      let acum = pag;
      const lineas = md.split('\n'); let pal = 0;
      for (const l of lineas) {
        pal += l.split(/\s+/).filter(Boolean).length;
        const m = l.match(/^(#{2,3})\s+(.+)/);
        if (m && (m[1].length === 2 || prof >= 3)) filas += `<div class="ind-sec n${m[1].length}"><span>${esc(m[2].replace(/\{.*\}$/, ''))}</span><b>${acum + Math.floor(pal / ppp)}</b></div>`;
      }
    }
    pag += Math.max(1, Math.ceil(md.split(/\s+/).length / ppp));
  }
  a.innerHTML = `<div class="nota">El índice se arma solo con los títulos (#) y secciones (##) de cada capítulo, en el orden del libro. Las páginas son aproximadas${ult ? ` (el último armado dio ${ult.paginas})` : ''}; las exactas salen al armar.</div>
    <div class="ind-vista">${filas || '<p class="sutil">Todavía no hay capítulos.</p>'}</div>
    <div class="grupo-ind"><h3>Índice analítico</h3><p class="sutil" style="margin:0 0 8px">Nombres, lugares y organismos con las páginas donde aparecen. Hoy tiene ${(S.indiceToml.match(/\[\[termino\]\]/g) || []).length} términos.</p>
      <button class="btn chico" id="b-sugerir">Sugerir términos del texto</button><div id="sugeridos"></div></div>`;
  $$('.ind-cap', a).forEach((b) => (b.onclick = () => abrirTexto(b.dataset.a)));
  $('#b-sugerir').onclick = sugerirTerminos;
}
// Busca nombres propios que se repiten (Ana Pérez, Naciones Unidas, ACNUR) y no están en el índice.
function sugerirTerminos() {
  const ya = new Set([...S.indiceToml.matchAll(/buscar\s*=\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1].replace(/\\\\w\*|\\w\*/g, '').toLowerCase())));
  const cuenta = new Map();
  const comunes = new Set('El La Los Las Un Una En Por Para Con Sin Desde Hasta Entre Como Cuando Donde Pero Este Esta Estos Estas Ese Esa Eso Hay Sus Su Al Del Que Qué Se No Sí Ya Más Lo Le Les Mi Nos Otro Otra Cada Todo Toda Según Durante Tras Ante Aunque Sobre También Incluso Así Además Luego Entonces Primero Hoy Ayer Allí Ahí Aquí Fuente Notas Capítulo Parte Tabla Mapa Gráfico Figura Ver Cf'.split(' '));
  for (const c of S.cfg.contenido || []) {
    const md = S.textos.get(c.archivo || ''); if (!md) continue;
    const cuerpo = md.replace(/^\[\^[^\]]+\]:.*$/gm, '').replace(/^#.*$/gm, '').replace(/https?:\/\/\S+/g, '');
    for (const m of cuerpo.matchAll(/(?<![.!?¿¡]\s|^|\n)\b(\p{Lu}[\p{L}'-]+(?:\s+(?:de|del|la|las|los|y|e)?\s*\p{Lu}[\p{L}'-]+){0,3}|\p{Lu}{2,}[\p{Lu}0-9]*)\b/gu)) {
      const t = m[1].trim().replace(/\s+(de|del|la|las|los|y|e)$/, '');
      if (t.length < 3 || comunes.has(t) || comunes.has(t.split(' ')[0]) && !t.includes(' ')) continue;
      cuenta.set(t, (cuenta.get(t) || 0) + 1);
    }
  }
  // una palabra suelta que también aparece en minúscula («Estado» / «estado») no es un nombre propio
  const todo = (S.cfg.contenido || []).map((c) => S.textos.get(c.archivo || '') || '').join('\n');
  const minus = (w) => (todo.match(new RegExp(`\\b${w.toLowerCase()}\\b`, 'g')) || []).length;
  const multis = [...cuenta].filter(([t, n]) => t.includes(' ') && n >= 3);
  const parte = (t, n) => !t.includes(' ') && multis.some(([m, k]) => m.split(' ').includes(t) && k >= n * 0.4);
  const lista = [...cuenta].filter(([t, n]) => (t.includes(' ') || t === t.toUpperCase() || minus(t) < n / 3) && !parte(t, n) && n >= 3 && ![...ya].some((y) => y && t.toLowerCase().includes(y))).sort((a, b) => b[1] - a[1]).slice(0, 60);
  const caja = $('#sugeridos');
  if (!lista.length) { caja.innerHTML = '<p class="sutil">No encontré nombres nuevos que se repitan.</p>'; return; }
  caja.innerHTML = `<div class="sug-lista">${lista.map(([t, n], i) => `<label class="check"><input type="checkbox" data-t="${i}" ${n >= 5 ? 'checked' : ''}>${esc(t)} <small>${n}</small></label>`).join('')}</div>
    <button class="btn prim chico" id="b-agregar-terminos">Agregar al índice analítico</button>`;
  $('#b-agregar-terminos').onclick = () => {
    const elegidos = $$('[data-t]', caja).filter((x) => x.checked).map((x) => lista[+x.dataset.t][0]);
    if (!elegidos.length) return;
    const esc2 = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&');
    S.indiceToml = S.indiceToml.replace(/\s*$/, '\n') + elegidos.map((t) => `\n[[termino]]\nentrada = "${t.replace(/"/g, '\\"')}"\nbuscar  = ["${esc2(t).replace(/"/g, '\\"')}"]\n`).join('');
    enviarConfig(); marcarEstado();
    toast(`${elegidos.length} términos agregados. Guardá para subirlos; las páginas salen al armar.`);
    pintarIndice();
  };
}

/* ═════════ citas: buscar la fuente y armar la nota ═════════ */
let citasRes = [];
function pintarCitas() {
  const a = $('#citas'); if (!a) return;
  const v = S.editor; const { from, to } = v.state.selection.main;
  const sel = to > from ? v.state.sliceDoc(from, to).replace(/\s+/g, ' ').trim() : '';
  const estilo = S.cfg.estilo?.norma_citas || S.conf.estiloCita || 'apa';
  const hayGemini = !!S.conf.gemini;
  a.innerHTML = `<div class="nota">Marcá en el editor una frase, un dato o un título, y buscá de dónde sale. Elegí la fuente y se inserta como nota al pie con su enlace.</div>
    <label class="campo"><span>Buscar</span><textarea class="entrada" id="ci-q" rows="2" placeholder="Ej.: 120 millones de personas desplazadas ACNUR 2024">${esc(sel.slice(0, 400))}</textarea></label>
    <div class="acciones">
      <button class="btn prim chico" data-buscar="academico">Libros y artículos</button>
      <button class="btn chico" data-buscar="wikipedia">Wikipedia</button>
      <button class="btn chico" data-buscar="google" ${hayGemini ? '' : 'disabled title="Activá Gemini en el Asistente"'}>Google (con Gemini)</button>
      <select class="entrada" id="ci-estilo" style="width:auto;height:30px;font-size:12.5px">${Object.entries(ESTILOS_CITA).map(([k, n]) => `<option value="${k}" ${k === estilo ? 'selected' : ''}>${n}</option>`).join('')}</select>
    </div>
    <div id="ci-res"></div>
    <div class="grupo-ind"><h3>Norma de citas del libro</h3><div id="ci-norma"></div></div>
    <div class="grupo-ind"><h3>Notas sin enlace</h3><p class="sutil" style="margin:0 0 8px">Revisa las notas del capítulo que no tienen link ni DOI y busca el artículo o libro que citan.</p>
      <button class="btn chico" id="ci-completar">Buscar enlaces para las notas</button><div id="ci-notas"></div></div>`;
  $('#ci-estilo').onchange = (e) => { try { aplicarCambiosConfig({ estilo: { norma_citas: e.target.value } }); } catch {} if (citasRes.length) mostrarCitas(); pintarNorma(); };
  $$('[data-buscar]', a).forEach((b) => (b.onclick = () => buscarCita(b.dataset.buscar)));
  $('#ci-completar').onclick = completarNotas;
  pintarNorma();
  if (citasRes.length) mostrarCitas();
}
// Revisa las notas del capítulo contra la norma elegida y, con IA, las reescribe para que la cumplan.
function pintarNorma() {
  const caja = $('#ci-norma'); if (!caja || !S.actual) return;
  const norma = S.cfg.estilo?.norma_citas || 'apa';
  const probs = revisarNorma(S.editor.state.doc.toString(), norma);
  const total = [...S.editor.state.doc.toString().matchAll(/^\[\^[^\]]+\]:/gm)].length;
  caja.innerHTML = `<p class="sutil" style="margin:0 0 8px">Norma: <b>${NORMAS[norma].nombre}</b> (se cambia en el selector de arriba o en Estilos). Ejemplo: <i>${esc(NORMAS[norma].ejemplo).replace(/\*([^*]+)\*/g, '<i>$1</i>')}</i></p>
    <div class="aviso ${probs.length ? 'mal' : 'bien'}">${total} notas en este capítulo · ${probs.length ? `${probs.length} no siguen la norma` : 'todas parecen seguir la norma'}</div>
    ${probs.length ? `<details class="lista-norma"><summary>Ver cuáles</summary>${probs.slice(0, 40).map((p) => `<div class="rev-item"><div class="rev-msg">Nota ${esc(p.id)} <small>${esc(p.problemas.join(' · '))}</small></div><div class="rev-ctx">${esc(p.texto.slice(0, 200))}</div></div>`).join('')}</details>
      <div class="acciones" style="margin-top:8px"><button class="btn prim chico" id="ci-aplicar-norma" ${claveIA() ? '' : 'disabled title="Activá Gemini o Groq en el Asistente"'}>Pasar las notas a ${NORMAS[norma].nombre} con IA</button></div><div id="ci-norma-res"></div>` : ''}`;
  const b = $('#ci-aplicar-norma', caja); if (b) b.onclick = () => aplicarNorma(probs, norma);
}
async function aplicarNorma(probs, norma) {
  const out = $('#ci-norma-res');
  const lotes = []; for (let i = 0; i < probs.length; i += 15) lotes.push(probs.slice(i, i + 15));
  const nuevas = [];
  try {
    for (let i = 0; i < lotes.length; i++) {
      out.innerHTML = `<div class="nota"><span class="spin"></span> Reescribiendo ${lotes.length > 1 ? `tanda ${i + 1} de ${lotes.length}` : 'las notas'}…</div>`;
      const r = await preguntar({ ...opcionesIA(), pedido: pedidoNorma(norma), texto: JSON.stringify(lotes[i].map((p) => ({ id: p.id, nota: p.texto }))), accion: null });
      const m = r.match(/\[[\s\S]*\]/); if (!m) throw new Error('La IA no devolvió la lista. Probá de nuevo.');
      for (const x of JSON.parse(m[0])) { const p = lotes[i].find((q) => q.id === String(x.id)); if (p && x.nota && x.nota.trim() !== p.texto) nuevas.push({ id: p.id, antes: p.texto, despues: x.nota.trim() }); }
    }
  } catch (e) { out.innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  if (!nuevas.length) { out.innerHTML = '<div class="nota">La IA no propuso cambios.</div>'; return; }
  const cursiva = (t) => esc(t).replace(/\*([^*]+)\*/g, '<i>$1</i>');
  out.innerHTML = `<p class="sutil" style="margin:8px 0 6px">Revisá cada una: la IA no debe agregar datos que no estaban.</p>` + nuevas.map((x, i) => `<div class="rev-item"><div class="rev-msg">Nota ${esc(x.id)}</div><div class="rev-ctx"><s>${cursiva(x.antes)}</s></div><div class="ci-ref">${cursiva(x.despues)}</div><div class="respuesta-acc"><button class="btn chico prim-suave" data-ok-n="${i}">Aplicar</button></div></div>`).join('') + '<button class="btn prim chico" id="ci-norma-todas">Aplicar todas</button>';
  const aplicar = (x) => {
    const doc = S.editor.state.doc.toString();
    const m = doc.match(new RegExp(`^\\[\\^${x.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:.*$`, 'm')); if (!m) return;
    S.editor.dispatch({ changes: { from: m.index, to: m.index + m[0].length, insert: `[^${x.id}]: ${x.despues}` } });
  };
  $$('[data-ok-n]', out).forEach((b) => (b.onclick = () => { aplicar(nuevas[+b.dataset.okN]); b.disabled = true; b.textContent = 'Aplicada'; }));
  $('#ci-norma-todas').onclick = () => { nuevas.forEach(aplicar); toast('Notas pasadas a la norma. Podés deshacer con Ctrl+Z.'); pintarNorma(); };
}
async function buscarCita(donde) {
  const q = $('#ci-q').value.trim(); if (!q) return toast('Escribí o marcá qué buscar.');
  const out = $('#ci-res'); out.innerHTML = '<div class="nota"><span class="spin"></span> Buscando…</div>';
  try {
    if (donde === 'academico') {
      const [oa, cr] = await Promise.allSettled([buscarOpenAlex(q), buscarCrossref(q)]);
      const lista = [...(oa.value || []), ...(cr.value || [])];
      const vistos = new Set();
      citasRes = lista.filter((x) => { const k = (x.doi || x.titulo).toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
        .sort((x, y) => parecido(y.titulo, q) - parecido(x.titulo, q) || (y.citas || 0) - (x.citas || 0)).slice(0, 10);
      if (!citasRes.length && oa.reason) throw oa.reason;
    } else if (donde === 'wikipedia') citasRes = await buscarWikipedia(q);
    else citasRes = await buscarGemini(q, S.conf.gemini);
    mostrarCitas();
  } catch (e) { out.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}
function mostrarCitas() {
  const out = $('#ci-res'); if (!out) return;
  const estilo = S.cfg.estilo?.norma_citas || 'apa';
  if (!citasRes.length) { out.innerHTML = '<div class="nota">No encontré nada. Probá con menos palabras: un nombre, un organismo, un título.</div>'; return; }
  out.innerHTML = citasRes.map((x, i) => `<div class="rev-item">
    <div class="rev-msg">${esc(x.titulo)} <small>${esc(x.origen)}${x.anio ? ' · ' + x.anio : ''}</small></div>
    ${x.resumen ? `<div class="rev-ctx">${esc(x.resumen.slice(0, 360))}</div>` : ''}
    <div class="ci-ref">${esc(formatear(x, estilo)).replace(/\*([^*]+)\*/g, '<i>$1</i>')}</div>
    <div class="respuesta-acc"><button class="btn chico prim-suave" data-nota="${i}">Insertar como nota</button><button class="btn chico" data-bib="${i}">Nota + bibliografía</button><button class="btn chico" data-copiar="${i}">Copiar</button>${x.url || x.doi ? `<a class="btn chico" href="${esc(x.doi ? 'https://doi.org/' + x.doi : x.url)}" target="_blank" rel="noopener">Abrir</a>` : ''}</div>
  </div>`).join('');
  $$('[data-nota]', out).forEach((b) => (b.onclick = () => insertarCita(citasRes[+b.dataset.nota], false)));
  $$('[data-bib]', out).forEach((b) => (b.onclick = () => insertarCita(citasRes[+b.dataset.bib], true)));
  $$('[data-copiar]', out).forEach((b) => (b.onclick = () => { navigator.clipboard?.writeText(formatear(citasRes[+b.dataset.copiar], S.cfg.estilo?.norma_citas || 'apa')); toast('Copiado.'); }));
}
function insertarCita(x, conBiblio) {
  if (!S.actual) return toast('Abrí un capítulo primero.');
  const v = S.editor; const estilo = S.cfg.estilo?.norma_citas || 'apa';
  const doc = v.state.doc.toString();
  const n = siguienteNota(doc);
  const pos = v.state.selection.main.to;
  // la llamada va pegada a la palabra (después del punto si lo hay)
  let at = pos; while (at < doc.length && /[.,;:»"”)]/.test(doc[at])) at++;
  const ref = formatear(x, estilo);
  const cambios = [{ from: at, insert: `[^${n}]` }, { from: doc.length, insert: `${doc.endsWith('\n') ? '' : '\n'}\n[^${n}]: ${ref}\n` }];
  if (conBiblio) {
    const apa = formatear(x, 'apa');
    const m = doc.match(/::: bibliografia\n[\s\S]*?\n:::/);
    if (m) cambios.push({ from: m.index + m[0].length - 3, insert: `${apa}\n\n` });
    else cambios.push({ from: doc.length, insert: `\n## Bibliografía\n\n::: bibliografia\n${apa}\n:::\n` });
  }
  v.dispatch({ changes: cambios, selection: { anchor: at + `[^${n}]`.length } });
  toast(`Nota ${n} insertada${conBiblio ? ' y sumada a la bibliografía' : ''}.`);
}
async function completarNotas() {
  if (!S.actual) return;
  const caja = $('#ci-notas');
  const notas = notasSinEnlace(S.editor.state.doc.toString());
  if (!notas.length) { caja.innerHTML = '<p class="sutil">Todas las notas de este capítulo ya tienen enlace (o son muy cortas para buscarlas).</p>'; return; }
  const props = [];
  for (let i = 0; i < notas.length; i++) {
    caja.innerHTML = `<div class="nota"><span class="spin"></span> Nota ${i + 1} de ${notas.length}…</div>`;
    const nt = notas[i];
    try {
      const res = await buscarOpenAlex(nt.texto.replace(/\*|«|»/g, ''), 3);
      const mejor = res.map((x) => ({ x, p: parecido(x.titulo, nt.texto) })).sort((a, b) => b.p - a.p)[0];
      if (mejor && mejor.p >= 0.7 && (mejor.x.doi || mejor.x.url)) props.push({ nt, x: mejor.x, p: mejor.p });
    } catch {}
    await new Promise((ok) => setTimeout(ok, 150));
  }
  if (!props.length) { caja.innerHTML = `<p class="sutil">Revisé ${notas.length} notas y no encontré enlaces seguros. Probá buscarlas una por una arriba.</p>`; return; }
  caja.innerHTML = `<p class="sutil" style="margin:0 0 6px">Encontré ${props.length} de ${notas.length}. Revisá que sea la misma obra antes de aceptar.</p>` + props.map((r, i) => `<div class="rev-item">
    <div class="rev-msg">Nota ${esc(r.nt.id)} <small>${Math.round(r.p * 100)} % parecido</small></div>
    <div class="rev-ctx">${esc(r.nt.texto.slice(0, 220))}</div>
    <div class="ci-ref">→ ${esc(r.x.titulo)} (${esc(String(r.x.anio))}) · ${esc(r.x.doi ? 'doi.org/' + r.x.doi : r.x.url)}</div>
    <div class="respuesta-acc"><button class="btn chico prim-suave" data-ok="${i}">Agregar el enlace</button></div></div>`).join('') + (props.length > 1 ? '<button class="btn prim chico" id="ci-todos">Agregar todos</button>' : '');
  const aplicar = (r) => {
    const doc = S.editor.state.doc.toString();
    const re = new RegExp(`^\\[\\^${r.nt.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]:.*$`, 'm');
    const m = doc.match(re); if (!m) return;
    const enl = r.x.doi ? `https://doi.org/${r.x.doi}` : r.x.url;
    const linea = m[0].replace(/\s*$/, '') + (/[.]$/.test(m[0].trim()) ? ' ' : '. ') + enl;
    S.editor.dispatch({ changes: { from: m.index, to: m.index + m[0].length, insert: linea } });
  };
  $$('[data-ok]', caja).forEach((b) => (b.onclick = () => { aplicar(props[+b.dataset.ok]); b.disabled = true; b.textContent = 'Agregado'; }));
  const t = $('#ci-todos'); if (t) t.onclick = () => { props.forEach(aplicar); $$('[data-ok]', caja).forEach((b) => { b.disabled = true; b.textContent = 'Agregado'; }); toast('Enlaces agregados.'); };
}

/* ═════════ pegar texto: del bloc de notas al libro ═════════ */
function asistenteImportar(archivoInicial = null) {
  const fmts = Object.keys(S.presets.formatos);
  const d = h(`<dialog class="grande"><div class="cuerpo">
    <h2>Subir o pegar el manuscrito</h2>
    <p class="sutil" style="margin:-8px 0 0">Pegá un capítulo o el libro entero, del largo que sea: no hay límite. El taller reconoce títulos, partes, notas al pie numeradas, bibliografía y epígrafes, y te muestra cómo lo va a armar antes de crear nada.</p>
    <div class="imp-pasos">
      <div class="imp-col">
        <h3>1 · Antes de pegar, elegí</h3>
        <label class="campo"><span>Diseño del interior</span><select class="entrada" id="im-diseno"><option value="">Dejar el actual</option>${DISENOS_INTERIOR.map((x) => `<option value="${x.id}">${x.nombre} — ${esc(x.nota)}</option>`).join('')}</select></label>
        <label class="campo"><span>Medida</span><select class="entrada" id="im-medida"><option value="">Dejar la actual (${esc(S.cfg.formato?.preset || '')})</option>${fmts.map((f) => `<option>${f}</option>`).join('')}</select></label>
        <label class="campo"><span>Dónde va</span><select class="entrada" id="im-destino"><option value="agregar">Agregar al libro como capítulos nuevos</option>${S.actual ? `<option value="reemplazar">Reemplazar el capítulo abierto</option>` : ''}</select></label>
        <div class="imp-ops">
          <label class="check"><input type="checkbox" id="im-cortar" checked>Cortar en capítulos por los títulos</label>
          <label class="check"><input type="checkbox" id="im-notas" checked>Convertir notas numeradas en notas al pie</label>
          <label class="check"><input type="checkbox" id="im-unir" checked>Unir renglones cortados (texto copiado de PDF)</label>
          <label class="check"><input type="checkbox" id="im-epi" checked>Reconocer epígrafes («— Autor»)</label>
          <label class="check"><input type="checkbox" id="im-bib" checked>Formato de bibliografía</label>
        </div>
      </div>
      <div class="imp-col">
        <h3>2 · Pegá el texto</h3>
        <textarea class="entrada imp-texto" id="im-texto" placeholder="Pegá acá (Ctrl+V)…"></textarea>
        <div class="imp-pie"><span id="im-cuenta" class="sutil">0 palabras</span><label class="btn chico prim">${I.subir}Subir el manuscrito (Word, PDF o texto)<input type="file" id="im-archivo" accept="${TIPOS_MANUSCRITO}" hidden></label></div>
      </div>
    </div>
    <div id="im-vista"></div>
  </div><div class="pie"><button class="btn" data-x>Cancelar</button><button class="btn" id="im-analizar">Ver cómo queda</button><button class="btn prim" id="im-crear" disabled>Crear</button></div></dialog>`);
  document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
  $('[data-x]', d).onclick = () => d.close();
  const ta = $('#im-texto', d);
  const cuenta = () => { $('#im-cuenta', d).textContent = `${numero(ta.value.split(/\s+/).filter(Boolean).length)} palabras · ${numero(ta.value.length)} caracteres`; $('#im-crear', d).disabled = true; };
  ta.addEventListener('input', cuenta);
  const cargarArchivo = async (f) => {
    if (!f) return;
    ta.value = ''; ta.placeholder = `Leyendo «${f.name}»…`;
    try {
      const { texto, tipo } = await leerManuscrito(f);
      ta.value = texto; cuenta();
      if (tipo === 'PDF') $('#im-unir', d).checked = true;
      analizar();
      toast(tipo === 'Word' ? 'Leí el Word con sus títulos, cursivas y notas al pie.' : tipo === 'PDF' ? 'Leí el texto del PDF. Revisá los títulos: el PDF no guarda los estilos.' : 'Archivo leído.');
    } catch (e) { ta.placeholder = 'Pegá acá (Ctrl+V)…'; toast(e.message); }
  };
  $('#im-archivo', d).onchange = (e) => cargarArchivo(e.target.files[0]);
  // también se puede arrastrar el archivo encima del recuadro
  ta.addEventListener('dragover', (e) => e.preventDefault());
  ta.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); cargarArchivo(e.dataTransfer.files[0]); } });
  if (archivoInicial instanceof File) setTimeout(() => cargarArchivo(archivoInicial), 50);
  let resultado = null;
  const analizar = () => {
    if (!ta.value.trim()) return toast('Pegá un texto primero.');
    const reemplazar = $('#im-destino', d).value === 'reemplazar';
    resultado = importarTexto(ta.value, { cortar: !reemplazar && $('#im-cortar', d).checked, notas: $('#im-notas', d).checked, unir: $('#im-unir', d).checked ? 'auto' : false, epigrafes: $('#im-epi', d).checked, biblio: $('#im-bib', d).checked });
    const caps = resultado.filter((x) => x.tipo === 'capitulo');
    const notas = caps.reduce((a, c) => a + c.informe.notas, 0);
    const sueltas = caps.flatMap((c) => c.informe.notasSinLlamada.map((n) => `${c.titulo}: nota ${n}`));
    $('#im-vista', d).innerHTML = `<h3>3 · Así lo voy a armar</h3>
      <div class="imp-resumen">${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'}${resultado.some((x) => x.tipo === 'parte') ? ` en ${resultado.filter((x) => x.tipo === 'parte').length} partes` : ''} · ${numero(notas)} notas al pie · ${numero(caps.reduce((a, c) => a + c.palabras, 0))} palabras</div>
      ${sueltas.length ? `<div class="aviso mal">No encontré dónde va la llamada de ${sueltas.length} ${sueltas.length === 1 ? 'nota' : 'notas'} (${esc(sueltas.slice(0, 4).join('; '))}${sueltas.length > 4 ? '…' : ''}). Quedan al final del capítulo para ubicarlas a mano.</div>` : ''}
      <div class="imp-lista">${resultado.map((x, i) => x.tipo === 'parte'
        ? `<div class="imp-parte">Parte · <input class="entrada" data-tit="${i}" value="${esc(x.titulo)}"></div>`
        : `<div class="imp-cap"><input class="entrada" data-tit="${i}" value="${esc(x.titulo)}"><span>${numero(x.palabras)} pal.${x.informe.notas ? ` · ${x.informe.notas} notas` : ''}${x.informe.epigrafe ? ' · epígrafe' : ''}${x.informe.biblio ? ` · bibliografía (${x.informe.biblio})` : ''}</span></div>`).join('')}</div>
      <p class="sutil" style="margin:6px 0 0">Podés corregir los títulos acá. Si cortó mal un capítulo, destildá «Cortar en capítulos» o marcá los títulos en el texto con # al principio del renglón.</p>`;
    $('#im-crear', d).disabled = false;
    $('#im-crear', d).textContent = reemplazar ? 'Reemplazar el capítulo' : `Crear ${caps.length} ${caps.length === 1 ? 'capítulo' : 'capítulos'}`;
  };
  $('#im-analizar', d).onclick = analizar;
  $('#im-crear', d).onclick = () => {
    if (!resultado) return;
    $$('[data-tit]', d).forEach((inp) => { const x = resultado[+inp.dataset.tit]; const nuevo = inp.value.trim() || x.titulo; if (x.md) x.md = x.md.replace(/^# .*$/m, '# ' + nuevo); x.titulo = nuevo; });
    const diseno = DISENOS_INTERIOR.find((x) => x.id === $('#im-diseno', d).value);
    const medida = $('#im-medida', d).value;
    const cambios = {};
    if (diseno) Object.assign(cambios, { tipografia: { fuente: diseno.fuente, fuente_titulos: diseno.fuente_titulos, fuente_apoyo: diseno.fuente_apoyo, cuerpo: diseno.cuerpo, interlineado: diseno.interlineado }, estilo: { apertura: diseno.apertura, color_acento: diseno.color_acento, secciones_color: diseno.secciones_color } });
    if (medida) cambios.formato = { preset: medida };
    if (Object.keys(cambios).length) aplicarCambiosConfig(cambios);
    const caps = resultado.filter((x) => x.tipo === 'capitulo');
    if ($('#im-destino', d).value === 'reemplazar') {
      const md = caps.map((c) => c.md).join('\n');
      S.editor.dispatch({ changes: { from: 0, to: S.editor.state.doc.length, insert: md } });
      d.close(); toast('Capítulo reemplazado. Podés deshacer con Ctrl+Z.'); return;
    }
    // libro recién creado: se saca el capítulo de ejemplo vacío
    const vacio = (a) => /^# Capítulo 1\s+Escribí, pegá o importá acá el texto del libro\.\s*$/.test(S.textos.get(a) || '');
    const l = [...(S.cfg.contenido || [])].filter((c) => !(c.archivo && vacio(c.archivo)));
    let n = l.filter((c) => c.archivo).length;
    const usados = new Set(l.map((c) => c.archivo));
    let primero = null;
    for (const x of resultado) {
      if (x.tipo === 'parte') { l.push({ tipo: 'parte', titulo: x.titulo }); continue; }
      n++;
      const slug = x.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'capitulo';
      let archivo = `texto/${String(n).padStart(2, '0')}-${slug}.md`;
      while (usados.has(archivo)) archivo = archivo.replace(/\.md$/, '-b.md');
      usados.add(archivo);
      S.textos.set(archivo, x.md); S.originales.set(archivo, null);
      l.push({ tipo: 'capitulo', archivo });
      primero ||= archivo;
    }
    cambiarContenido(l);
    d.close();
    if (primero) abrirTexto(primero);
    toast(`Listo: ${caps.length} ${caps.length === 1 ? 'capítulo creado' : 'capítulos creados'}. Revisalos y tocá Guardar para subirlos a GitHub.`);
  };
  ta.focus();
}

/* ═════════ dictado por voz ═════════ */
let dictado = null;
function alternarDictado() {
  if (dictado) { dictado.ctrl?.parar(); return; }
  if (!S.actual) return toast('Abrí un capítulo primero.');
  const conWhisper = !!S.conf.groq;
  const nav = hayDictadoNavegador();
  if (!nav && !conWhisper) return toast('Este navegador no dicta. Usá Chrome o Edge, o activá Groq en el Asistente para usar Whisper.');
  const motor = S.conf.dictado || (nav ? 'navegador' : 'whisper');
  const barra = h(`<div class="barra-dictado"><span class="punto-rojo"></span><span class="dic-estado">Escuchando… hablá normalmente. Decí «coma», «punto», «punto y aparte», «abrir comillas»…</span><span class="dic-parcial"></span>
    ${nav && conWhisper ? `<select class="entrada" id="dic-motor"><option value="navegador" ${motor === 'navegador' ? 'selected' : ''}>Navegador (en vivo)</option><option value="whisper" ${motor === 'whisper' ? 'selected' : ''}>Whisper de Groq (más preciso)</option></select>` : ''}
    <button class="btn chico prim" id="dic-parar">Terminar</button></div>`);
  $('.editor').append(barra);
  $('#b-dictar').classList.add('activo');
  const insertar = (crudo) => {
    const v = S.editor; const pos = v.state.selection.main.head;
    const antes = v.state.sliceDoc(Math.max(0, pos - 3), pos);
    const inicio = !antes.trim() || /[.?!…]\s*$|\n\s*$/.test(antes);
    let t = puntuar(crudo, { inicio });
    if (antes && !/[\s(«¿¡\n]$/.test(antes) && !/^[.,;:?!…»)\n]/.test(t)) t = ' ' + t;
    v.dispatch({ changes: { from: pos, insert: t }, selection: { anchor: pos + t.length }, scrollIntoView: true });
  };
  const fin = () => { barra.remove(); $('#b-dictar')?.classList.remove('activo'); dictado = null; };
  const opts = { alTexto: insertar, alParcial: (p) => { $('.dic-parcial', barra).textContent = p; }, alTerminar: fin, alError: (m) => { toast(m); } };
  dictado = {};
  const arrancar = async (cual) => {
    dictado.ctrl = cual === 'whisper' ? await dictarWhisper({ clave: S.conf.groq, ...opts }) : dictarNavegador(opts);
    if (!dictado.ctrl) fin();
  };
  $('#dic-parar', barra).onclick = () => dictado?.ctrl?.parar();
  const sel = $('#dic-motor', barra);
  if (sel) sel.onchange = () => { S.conf.dictado = sel.value; escribir('taller.conf', S.conf); const c = dictado.ctrl; dictado.ctrl = null; c.parar(); toast('Cambiá el motor: tocá Dictar de nuevo.'); };
  arrancar(motor);
}

/* ═════════ libro: compaginación completa ═════════ */
function pintarLibro() {
  const v = $('#v-libro');
  const a = S.libroArmado;
  v.innerHTML = `<div class="libro-vista">
    <div class="libro-cab">
      <div><h2>El libro completo</h2><p class="sutil">Tapa y todas las páginas, en pliegos de par e impar, con cada parte y capítulo marcado. ${a ? `Armado a las ${new Date(a.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.` : 'Tocá «Compaginar» para armarlo con lo último que escribiste (tarda medio minuto).'}</p></div>
      <div class="libro-acc">
        <label class="check"><input type="checkbox" id="lb-pliegos" ${S.conf.verPliegos !== false ? 'checked' : ''}>Marcar pliegos de 16</label>
        <select class="entrada" id="lb-tam" style="width:auto;height:32px"><option value="70">Chico</option><option value="110" selected>Mediano</option><option value="170">Grande</option></select>
        <button class="btn prim" id="lb-armar">${a ? 'Volver a compaginar' : 'Compaginar'}</button>
      </div>
    </div>
    <div id="lb-progreso"></div>
    <div id="lb-indice" class="lb-indice"></div>
    <div id="lb-hojas"></div>
  </div>`;
  $('#lb-armar').onclick = compaginar;
  $('#lb-tam').value = String(S.conf.tamPagina || 110);
  $('#lb-tam').onchange = (e) => { S.conf.tamPagina = +e.target.value; escribir('taller.conf', S.conf); if (S.libroArmado) mostrarLibro(); };
  $('#lb-pliegos').onchange = (e) => { S.conf.verPliegos = e.target.checked; escribir('taller.conf', S.conf); if (S.libroArmado) mostrarLibro(); };
  if (a) mostrarLibro();
}
async function compaginar() {
  const b = $('#lb-armar'); b.disabled = true;
  const pr = $('#lb-progreso');
  const paso = (t) => { pr.innerHTML = `<div class="nota"><span class="spin"></span> ${esc(t)}</div>`; };
  try {
    paso('Preparando los textos…');
    await prepararLibroCompleto();
    paso('Componiendo todas las páginas…');
    const r = await compilar(base() + '_build/libro.typ', { libro: S.slug }, 'pdf');
    if (!r.ok) throw new Error(r.errores.join('\n'));
    const paginas = contarPaginasPdf(r.bytes);
    paso('Componiendo la tapa…');
    const { lomo } = await prepararTapa(paginas);
    const rt = await compilar('/plantilla/tapa.typ', { libro: S.slug, paginas: String(paginas), lomo: lomo.toFixed(2) + 'mm', guias: 'no' }, 'pdf');
    S.libroArmado = { interior: r.bytes, tapa: rt.ok ? rt.bytes : null, fecha: Date.now() };
    escribir('taller.paginas.' + S.slug, { paginas, lomo, fecha: Date.now() });
    pr.innerHTML = '';
    pintarLibro();
  } catch (e) { pr.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  finally { if (b.isConnected) b.disabled = false; }
}
async function mostrarLibro() {
  const caja = $('#lb-hojas'); if (!caja) return;
  const a = S.libroArmado;
  const ancho = S.conf.tamPagina || 110;
  const doc = S.docLibro?.fecha === a.fecha ? S.docLibro.doc : await abrirPdf(a.interior);
  S.docLibro = { fecha: a.fecha, doc };
  const n = doc.numPages;
  const marcas = await marcadores(doc);
  const inicio = new Map(); for (const m of marcas) if (m.nivel === 0 && !inicio.has(m.pagina)) inicio.set(m.pagina, m);
  const pliegos = S.conf.verPliegos !== false;
  // índice de capítulos arriba: salta al pliego
  $('#lb-indice').innerHTML = `<div class="lb-cifras"><b>${n}</b> páginas · <b>${Math.ceil(n / 16)}</b> pliegos de 16${n % 16 ? ` (faltan ${16 - (n % 16)} para cerrar el último)` : ''} · <b>${marcas.filter((m) => m.nivel === 0).length}</b> entradas</div>` +
    marcas.filter((m) => m.nivel === 0).map((m) => `<button data-ir="${m.pagina}">${esc(m.titulo.split(' — ')[0])} <span>${m.pagina}</span></button>`).join('');
  // tapa
  let html = '';
  if (a.tapa) html += `<div class="lb-tapa"><div class="lb-etq">Tapa completa</div><canvas id="lb-canvas-tapa"></canvas></div>`;
  // pliegos: la página 1 va sola a la derecha; después 2-3, 4-5…
  const pares = [[null, 1]];
  for (let p = 2; p <= n; p += 2) pares.push([p, p + 1 <= n ? p + 1 : null]);
  html += '<div class="lb-grilla">';
  for (const [iz, de] of pares) {
    const etq = [iz, de].filter(Boolean).map((p) => inicio.get(p)).filter(Boolean);
    const corte = pliegos && iz && (iz - 1) % 16 === 0 ? `<div class="lb-pliego">Pliego ${Math.floor((iz - 1) / 16) + 1}</div>` : '';
    const pag = (p, lado) => p ? `<figure class="lb-pag ${lado}" data-p="${p}" style="width:${ancho}px"><canvas></canvas><figcaption>${p}</figcaption></figure>` : `<div class="lb-pag vacia" style="width:${ancho}px"></div>`;
    html += `${corte}<div class="lb-pliego-par" id="lb-p${iz || 1}">${etq.length ? `<div class="lb-cap">${etq.map((m) => esc(m.titulo.split(' — ')[0])).join(' · ')}</div>` : '<div class="lb-cap vacio"></div>'}<div class="lb-dos">${pag(iz, 'par')}${pag(de, 'impar')}</div></div>`;
  }
  html += '</div>';
  caja.innerHTML = html;
  $$('#lb-indice [data-ir]').forEach((b) => (b.onclick = () => { const p = +b.dataset.ir; const id = p === 1 ? 1 : p % 2 ? p - 1 : p; document.getElementById('lb-p' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
  if (a.tapa) abrirPdf(a.tapa).then((d) => { const c = $('#lb-canvas-tapa'); if (c) dibujarPagina(d, 1, c, Math.min(caja.clientWidth - 40, 1000)); });
  // las miniaturas se dibujan a medida que aparecen en pantalla
  const obs = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) {
      obs.unobserve(e.target);
      const p = +e.target.dataset.p;
      dibujarPagina(doc, p, $('canvas', e.target), ancho).then((blanca) => { if (blanca) e.target.classList.add('blanca'); });
    }
  }, { root: $('#v-libro'), rootMargin: '600px' });
  $$('.lb-pag[data-p]', caja).forEach((f) => { obs.observe(f); f.onclick = () => verPaginaGrande(doc, +f.dataset.p); });
}
function verPaginaGrande(doc, p) {
  const n = doc.numPages;
  const d = h(`<dialog class="grande lb-modal"><div class="cuerpo"><div class="lb-dos grande"><canvas></canvas><canvas></canvas></div></div><div class="pie"><button class="btn" data-ant>← Anterior</button><span class="sutil" data-num></span><button class="btn" data-sig>Siguiente →</button><button class="btn prim" data-x>Cerrar</button></div></dialog>`);
  document.body.append(d); d.addEventListener('close', () => d.remove()); d.showModal();
  let actual = p;
  const pintar = async () => {
    const iz = actual === 1 ? null : actual % 2 ? actual - 1 : actual, de = actual === 1 ? 1 : iz + 1 <= n ? iz + 1 : null;
    const [c1, c2] = $$('canvas', d);
    const w = Math.min(420, (window.innerWidth - 160) / 2);
    c1.style.visibility = iz ? 'visible' : 'hidden'; c2.style.visibility = de ? 'visible' : 'hidden';
    if (iz) await dibujarPagina(doc, iz, c1, w);
    if (de) await dibujarPagina(doc, de, c2, w);
    $('[data-num]', d).textContent = [iz, de].filter(Boolean).join(' – ') + ` de ${n}`;
  };
  $('[data-ant]', d).onclick = () => { actual = Math.max(1, (actual % 2 ? actual - 1 : actual) - 1); pintar(); };
  $('[data-sig]', d).onclick = () => { actual = Math.min(n, (actual % 2 ? actual + 1 : actual + 2)); pintar(); };
  $('[data-x]', d).onclick = () => d.close();
  d.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') $('[data-sig]', d).click(); if (e.key === 'ArrowLeft') $('[data-ant]', d).click(); });
  pintar();
}

/* ═════════ PDF: descargar e imprimir ═════════ */
function botonesPdf(urls) {
  return urls.map(([u, n, a]) => `<span class="par-pdf"><a class="btn" href="${u}" download="${esc(a)}">${I.bajar}${esc(n)}</a><button type="button" class="btn ico-btn" data-imprimir="${u}" title="Imprimir ${esc(n.toLowerCase())}">${I.imprimir}</button></span>`).join('');
}
function imprimirPdf(url) {
  // un PDF propio (blob) se puede imprimir desde un marco invisible; si el navegador no deja, se abre en otra pestaña
  if (!url.startsWith('blob:')) { window.open(url, '_blank', 'noopener'); return; }
  $('#marco-imprimir')?.remove();
  const f = h('<iframe id="marco-imprimir" style="position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0"></iframe>');
  f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(url, '_blank'); } };
  f.src = url; document.body.append(f);
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-imprimir]'); if (b) imprimirPdf(b.dataset.imprimir); });
let urlCapitulo;
async function pdfCapitulo() {
  if (!S.actual) return toast('Abrí un capítulo primero.');
  const b = $('#b-pdf-cap'); b.disabled = true; const t = b.innerHTML; b.innerHTML = '<span class="spin"></span>';
  try {
    const r = await compilar(base() + '_vista/main.typ', { libro: S.slug, vista: 'si' }, 'pdf');
    if (!r.ok) throw new Error(r.errores.join('\n'));
    if (urlCapitulo) URL.revokeObjectURL(urlCapitulo);
    urlCapitulo = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
    const nombre = S.actual.split('/').pop().replace(/\.md$/, '') + '.pdf';
    const d = dialogo(`<h2>PDF del capítulo</h2><p>Sale con la medida real del libro. Para revisarlo en papel, imprimilo en A4 con «Tamaño real» o «Ajustar a la página».</p>
      <div style="display:flex;gap:8px;margin-top:10px"><a class="btn prim" href="${urlCapitulo}" download="${esc(nombre)}">${I.bajar}Descargar</a><button class="btn" data-imprimir="${urlCapitulo}">${I.imprimir}Imprimir</button></div>`, [['Cerrar']]);
  } catch (e) { toast(e.message); }
  finally { b.disabled = false; b.innerHTML = t; }
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
    <label class="campo"><span>Clave de Gemini (asistente y revisión)</span><input class="entrada" id="a-gemini" type="password" value="${esc(S.conf.gemini || '')}" placeholder="AIza… o AQ.…"><small>${S.conf.gemini === 'servidor' ? 'Usa la clave del taller (no hace falta poner nada).' : 'Se crea gratis en aistudio.google.com/apikey. Si la pegás acá, el taller usa Gemini.'}</small></label>
    <p style="margin:0;font-size:12.5px;color:var(--tinta-suave)">Las claves quedan guardadas solo en este navegador.</p>`,
  [['Cerrar sesión'], ['Cancelar'], ['Guardar', 'prim']]);
  d.addEventListener('close', async () => {
    if (d.returnValue === '0') { if (hayCambios() && !confirm('Hay cambios sin guardar. ¿Salir igual?')) return; try { localStorage.removeItem('taller.conf'); } catch {} location.reload(); }
    if (d.returnValue !== '2') return;
    const cambioRepo = $('#a-owner', d).value.trim() !== S.conf.owner || $('#a-repo', d).value.trim() !== S.conf.repo || $('#a-token', d).value.trim() !== S.conf.token;
    Object.assign(S.conf, { owner: $('#a-owner', d).value.trim(), repo: $('#a-repo', d).value.trim(), token: $('#a-token', d).value.trim(), groq: $('#a-groq', d).value.trim(), gemini: $('#a-gemini', d).value.trim() });
    if (S.conf.gemini) S.conf.proveedor = 'gemini'; else if (S.conf.groq) S.conf.proveedor = 'groq';
    escribir('taller.conf', S.conf);
    if (cambioRepo) location.reload(); else { toast('Ajustes guardados.'); if (S.vista === 'asistente') pintarAsistente(); }
  });
}
