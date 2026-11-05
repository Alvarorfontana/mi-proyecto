// Convierte el manuscrito que sube el autor en texto Markdown para el asistente de importación.
// Word (.docx) con títulos, negritas, cursivas y notas al pie; PDF (solo el texto); .txt y .md tal cual.
// mammoth (licencia BSD-2) lee el Word dentro del navegador: el archivo no sale de la compu.

function inline(n) {
  if (n.nodeType === 3) return n.textContent.replace(/\s+/g, ' ');
  if (n.nodeType !== 1) return '';
  const tag = n.tagName.toLowerCase();
  // llamada de nota de Word: <sup><a href="#footnote-3">[3]</a></sup>
  const a = tag === 'a' ? n : tag === 'sup' && n.querySelector('a[href^="#footnote-"],a[href^="#endnote-"]');
  if (a && /^#(foot|end)note-\d+/.test(a.getAttribute('href') || '')) return `[^${a.getAttribute('href').replace(/\D+/g, '')}]`;
  const dentro = [...n.childNodes].map(inline).join('');
  if (!dentro.trim()) return dentro;
  if (tag === 'strong' || tag === 'b') return `**${dentro.trim()}** `.replace(/ $/, dentro.endsWith(' ') ? ' ' : '');
  if (tag === 'em' || tag === 'i') return `*${dentro.trim()}*` + (dentro.endsWith(' ') ? ' ' : '');
  if (tag === 'br') return '\n';
  if (tag === 'a' && /^#(foot|end)note-ref/.test(n.getAttribute('href') || '')) return ''; // flecha de vuelta
  return dentro;
}

function htmlAMarkdown(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const raiz = doc.body.firstChild;
  const bloques = [], notas = [];
  for (const n of [...raiz.children]) {
    const tag = n.tagName.toLowerCase();
    // lista final de notas que arma mammoth
    if ((tag === 'ol' || tag === 'ul') && n.querySelector('li[id^="footnote-"],li[id^="endnote-"]')) {
      for (const li of n.querySelectorAll('li[id]')) notas.push(`[^${li.id.replace(/\D+/g, '')}]: ${[...li.childNodes].map(inline).join('').replace(/[↑\s]+$/, '').trim()}`);
      continue;
    }
    const t = [...n.childNodes].map(inline).join('').trim();
    if (!t) continue;
    if (/^h[1-6]$/.test(tag)) bloques.push('#'.repeat(Math.min(3, +tag[1])) + ' ' + t.replace(/\*\*/g, ''));
    else if (tag === 'ul' || tag === 'ol') bloques.push([...n.children].map((li, i) => `${tag === 'ol' ? i + 1 + '.' : '-'} ${[...li.childNodes].map(inline).join('').trim()}`).join('\n'));
    else if (tag === 'blockquote') bloques.push('> ' + t);
    else if (tag === 'table') bloques.push([...n.querySelectorAll('tr')].map((tr) => '| ' + [...tr.children].map((c) => c.textContent.trim()).join(' | ') + ' |').join('\n'));
    else bloques.push(t);
  }
  return bloques.join('\n\n') + (notas.length ? '\n\n' + notas.join('\n') : '') + '\n';
}

async function leerWord(archivo) {
  const mammoth = (await import('mammoth/mammoth.browser.js')).default;
  const r = await mammoth.convertToHtml({ arrayBuffer: await archivo.arrayBuffer() }, {
    styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Título'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh", "p[style-name='Subtítulo'] => h2:fresh"],
  });
  return htmlAMarkdown(r.value);
}

async function leerPdf(archivo) {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    let linea = '', out = [], ultY = null;
    for (const it of c.items) {
      const y = it.transform?.[5];
      if (ultY !== null && Math.abs(y - ultY) > 2) { out.push(linea); linea = ''; }
      linea += it.str; ultY = y;
      if (it.hasEOL) { out.push(linea); linea = ''; ultY = null; }
    }
    if (linea) out.push(linea);
    paginas.push(out.join('\n'));
  }
  return paginas.join('\n\n');
}

export const TIPOS_MANUSCRITO = '.docx,.pdf,.txt,.md,.markdown,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function leerManuscrito(archivo) {
  const n = archivo.name.toLowerCase();
  if (n.endsWith('.docx')) return { texto: await leerWord(archivo), tipo: 'Word' };
  if (n.endsWith('.pdf')) return { texto: await leerPdf(archivo), tipo: 'PDF' };
  if (n.endsWith('.doc')) throw new Error('Ese es un Word viejo (.doc). Abrilo en Word y guardalo como .docx («Guardar como» → Documento de Word).');
  if (n.endsWith('.odt') || n.endsWith('.pages') || n.endsWith('.rtf')) throw new Error('Guardalo como Word (.docx) o PDF y subilo de nuevo.');
  return { texto: await archivo.text(), tipo: 'texto' };
}
