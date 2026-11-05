// Markdown → Typst, con las mismas reglas que herramientas/filtro.lua.
// Corre en el navegador (y en Node para las pruebas).
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import attrs from 'markdown-it-attrs';
import container from 'markdown-it-container';

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false })
  .use(footnote)
  .use(attrs, { leftDelimiter: '{', rightDelimiter: '}', allowedAttributes: [] })
  .use(container, 'div', { validate: () => true });

const ESPECIALES = /[\\#$*_<>@\[\]`~"']/g;

function escTexto(s) {
  let t = s.replace(ESPECIALES, (c) => '\\' + c);
  t = t.replace(/\/(?=[\/*])/g, '\\/');          // evita comentarios // y /*
  return t;
}
// al comienzo de un párrafo, algunas marcas cambian de sentido en Typst
function escInicio(t) {
  return t.replace(/^(\s*)([=+\-\/]|\d+\.)/, (m, sp, c) => sp + '\\' + c);
}
const str = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

function textoConUrls(s) {
  const out = [];
  let ult = 0;
  const re = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/g;
  let m;
  while ((m = re.exec(s))) {
    let u = m[1];
    const cola = (u.match(/[.,;:)]+$/) || [''])[0];
    u = u.slice(0, u.length - cola.length);
    out.push(escTexto(s.slice(ult, m.index)));
    out.push(`#url(${str(u)})`);
    ult = m.index + m[1].length - cola.length;
  }
  out.push(escTexto(s.slice(ult)));
  return out.join('');
}

function attr(tok, nombre) {
  const a = (tok.attrs || []).find((x) => x[0] === nombre);
  return a ? a[1] : null;
}
function clases(tok) {
  return (attr(tok, 'class') || '').split(/\s+/).filter(Boolean);
}

export function convertir(fuente, { sinNumero = false, base = '/' } = {}) {
  const env = {};
  const tokens = md.parse(fuente, env);

  // 1) notas al pie: renderizar cada definición
  const notas = {};
  {
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === 'footnote_open') {
        const id = t.meta.id;
        let j = i + 1, prof = 1;
        const interior = [];
        while (j < tokens.length) {
          if (tokens[j].type === 'footnote_open') prof++;
          if (tokens[j].type === 'footnote_close' && --prof === 0) break;
          interior.push(tokens[j]);
          j++;
        }
        notas[id] = interior;
        i = j + 1;
      } else i++;
    }
  }

  function inline(children) {
    let o = '';
    const pila = [];
    for (const c of children || []) {
      switch (c.type) {
        case 'text': o += textoConUrls(c.content); break;
        case 'softbreak': o += ' '; break;
        case 'hardbreak': o += ' \\\n'; break;
        case 'em_open': o += '#emph['; break;
        case 'em_close': o += ']'; break;
        case 'strong_open': o += '#strong['; break;
        case 'strong_close': o += ']'; break;
        case 'code_inline': o += `#raw(${str(c.content)})`; break;
        case 'link_open': {
          const href = attr(c, 'href');
          pila.push(href); o += `#link(${str(href)})[`; break;
        }
        case 'link_close': pila.pop(); o += ']'; break;
        case 'footnote_ref': {
          const id = c.meta.id;
          o += '#footnote[' + bloques(notas[id] || [], true).trim() + ']';
          break;
        }
        case 'image': o += figuraInline(c); break;
        default: if (c.content) o += escTexto(c.content);
      }
    }
    return o;
  }

  function figuraArgs(img) {
    let src = attr(img, 'src');
    if (!src.startsWith('/') && !/^https?:/.test(src)) src = base + src;
    const cl = clases(img);
    let tipo = 'foto';
    for (const c of cl) if (['mapa', 'grafico', 'foto', 'ilustracion'].includes(c)) tipo = c;
    const args = [str(src), 'tipo: ' + str(tipo)];
    const ancho = attr(img, 'ancho') || attr(img, 'width');
    if (ancho) args.push('ancho: ' + ancho);
    if (attr(img, 'pagina') === 'completa') args.push('pagina-completa: true');
    if (['si', 'true'].includes(attr(img, 'apaisado'))) args.push('apaisado: true');
    if (['si', 'true'].includes(attr(img, 'sangrado'))) args.push('sangrado: true');
    const fuente = attr(img, 'fuente');
    if (fuente) args.push('fuente: [' + fuente + ']');
    const pie = inline(img.children);
    if (pie) args.push('pie: [' + pie + ']');
    return '#figura(' + args.join(', ') + ')';
  }
  const figuraInline = (img) => figuraArgs(img);

  function bloques(toks, enNota = false) {
    let o = '';
    let capitular = false, prof = 0; // la primera párrafo del capítulo lleva letra capital
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      switch (t.type) {
        case 'heading_open': {
          const nivel = Number(t.tag.slice(1));
          const sinNum = sinNumero || clases(t).some((c) => c === 'unnumbered' || c === 'sin-numero');
          const cont = inline(toks[i + 1].children);
          o += `#heading(level: ${nivel}${sinNum ? ', numbering: none' : ''})[${cont}]\n\n`;
          if (nivel === 1 && !enNota && prof === 0) capitular = true;
          i += 2;
          break;
        }
        case 'paragraph_open': {
          const inl = toks[i + 1];
          const kids = inl.children || [];
          const solo = kids.filter((k) => !(k.type === 'text' && !k.content.trim()) && k.type !== 'softbreak');
          if (solo.length === 1 && solo[0].type === 'image') o += figuraArgs(solo[0]) + '\n\n';
          else if (capitular && prof === 0) { o += `#capitular[${inline(kids)}]\n\n`; capitular = false; }
          else o += escInicio(inline(kids)) + (enNota ? '\n\n' : '\n\n');
          i += 2;
          break;
        }
        case 'container_div_open': {
          const nombre = t.info.trim().replace(/^\{?\.?/, '').replace(/\}$/, '').split(/\s+/)[0];
          o += (nombre && /^[a-z][a-z0-9-]*$/.test(nombre)) ? `#${nombre}[\n` : '#block[\n';
          prof++;
          break;
        }
        case 'container_div_close': o += ']\n\n'; prof--; break;
        case 'blockquote_open': o += '#quote(block: true)[\n'; prof++; break;
        case 'blockquote_close': o += ']\n\n'; prof--; break;
        case 'hr': o += '#separador()\n\n'; break;
        case 'bullet_list_open': case 'ordered_list_open': break;
        case 'list_item_open': o += (toks[i].markup.match(/[.)]/) ? '+ ' : '- '); break;
        case 'list_item_close': break;
        case 'fence': case 'code_block': o += `#raw(block: true, ${str(t.content)})\n\n`; break;
        case 'table_open': {
          // juntar filas hasta table_close
          const filas = []; let fila = null, enCabeza = false, cabeza = 0;
          let j = i + 1;
          for (; j < toks.length && toks[j].type !== 'table_close'; j++) {
            const x = toks[j];
            if (x.type === 'thead_open') enCabeza = true;
            if (x.type === 'thead_close') enCabeza = false;
            if (x.type === 'tr_open') { fila = []; }
            if (x.type === 'tr_close') { filas.push(fila); if (enCabeza) cabeza++; }
            if (x.type === 'inline') fila.push(inline(x.children));
          }
          const n = Math.max(...filas.map((f) => f.length));
          const celdas = (f) => f.map((c) => `[${c}]`).join(', ');
          let s = `#table(columns: ${n}, inset: 6pt,\n`;
          if (cabeza) s += `  table.header(${celdas(filas[0])}),\n`;
          for (const f of filas.slice(cabeza)) s += `  ${celdas(f)},\n`;
          o += s + ')\n\n';
          i = j;
          break;
        }
        case 'footnote_block_open': {
          // se saltean: las notas ya se insertaron donde se llaman
          while (i < toks.length && toks[i].type !== 'footnote_block_close') i++;
          break;
        }
        case 'inline': o += inline(t.children); break;
        default: break;
      }
    }
    return o;
  }

  return '#import "/plantilla/estilos.typ": *\n\n' + bloques(tokens);
}

export function primerTitulo(fuente) {
  const m = fuente.match(/^# (.+)$/m);
  return m ? m[1].replace(/\\/g, '').replace(/\s*\{[^}]*\}\s*$/, '').trim() : null;
}
