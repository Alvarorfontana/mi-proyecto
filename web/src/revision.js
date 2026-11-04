// Revisión del texto: LanguageTool (ortografía, gramática, estilo) y revisión con IA.
// Las marcas viven dentro del editor y se mueven solas mientras escribís.
import { EditorView, Decoration } from '@codemirror/view';
import { StateField, StateEffect } from '@codemirror/state';

export const fijarMarcas = StateEffect.define();
export const quitarMarca = StateEffect.define();

export const campoMarcas = StateField.define({
  create: () => Decoration.none,
  update(marcas, tr) {
    marcas = marcas.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(fijarMarcas)) {
        const rangos = e.value
          .filter((m) => m.to > m.from && m.to <= tr.state.doc.length)
          .sort((a, b) => a.from - b.from)
          .map((m) => Decoration.mark({ class: 'marca-rev marca-' + m.tipo, attributes: { title: m.mensaje }, rev: m }).range(m.from, m.to));
        marcas = Decoration.set(rangos, true);
      }
      if (e.is(quitarMarca)) marcas = marcas.update({ filter: (f, t, d) => d.spec.rev.id !== e.value });
    }
    // si se edita dentro de una marca, la marca ya no vale
    if (tr.docChanged) {
      const tocadas = [];
      tr.changes.iterChangedRanges((a, b, fa, fb) => tocadas.push([fa, fb]));
      marcas = marcas.update({ filter: (f, t) => !tocadas.some(([a, b]) => a < t && b > f) });
    }
    return marcas;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function listarMarcas(state) {
  const out = [];
  const it = state.field(campoMarcas, false)?.iter();
  if (!it) return out;
  for (; it.value; it.next()) out.push({ ...it.value.spec.rev, from: it.from, to: it.to });
  return out;
}

// Tapa el Markdown con espacios del mismo largo, para que las posiciones no cambien.
function enmascarar(t) {
  const tapar = (m) => m.replace(/[^\n]/g, ' ');
  return t
    .replace(/^:::.*$/gm, tapar)
    .replace(/^#{1,6}\s/gm, tapar)
    .replace(/^\s*>\s?/gm, tapar)
    .replace(/^\[\^\d+\]:/gm, tapar)
    .replace(/\[\^\d+\]/g, tapar)
    .replace(/\{[#.][^}\n]*\}/g, tapar)
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, tapar)
    .replace(/\]\([^)\n]*\)/g, (m) => ' ' + tapar(m.slice(1)))
    .replace(/https?:\/\/\S+/g, tapar)
    .replace(/[*_`]/g, ' ');
}

function trozos(t, max = 12000) {
  const out = [];
  let ini = 0;
  while (ini < t.length) {
    let fin = Math.min(t.length, ini + max);
    if (fin < t.length) { const p = t.lastIndexOf('\n\n', fin); if (p > ini + 2000) fin = p; }
    out.push([ini, fin]);
    ini = fin;
  }
  return out;
}

const IGNORAR = 'WHITESPACE_RULE,COMMA_PARENTHESIS_WHITESPACE,UPPERCASE_SENTENCE_START,ES_QUESTION_MARK,DOUBLE_PUNCTUATION,TYPOGRAPHY';

export async function revisarLanguageTool(texto, { variante = 'es', progreso = () => {} } = {}) {
  const limpio = enmascarar(texto);
  const partes = trozos(limpio);
  const marcas = [];
  for (let i = 0; i < partes.length; i++) {
    const [a, b] = partes[i];
    progreso(i, partes.length);
    if (!limpio.slice(a, b).trim()) continue;
    const cuerpo = new URLSearchParams({ text: limpio.slice(a, b), language: variante, disabledRules: IGNORAR, level: 'default' });
    let r;
    for (let intento = 0; intento < 3; intento++) {
      r = await fetch('https://api.languagetool.org/v2/check', { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.status !== 429) break;
      await new Promise((ok) => setTimeout(ok, 4000 * (intento + 1)));
    }
    if (!r.ok) throw new Error(r.status === 429 ? 'LanguageTool pide esperar un minuto (límite gratuito). Probá de nuevo enseguida.' : `LanguageTool respondió ${r.status}.`);
    const j = await r.json();
    for (const m of j.matches || []) {
      const from = a + m.offset, to = from + m.length;
      const original = texto.slice(from, to);
      if (!original.trim()) continue;
      const cat = m.rule?.issueType || '';
      const tipo = cat === 'misspelling' ? 'orto' : cat === 'style' || cat === 'locale-violation' ? 'estilo' : 'gram';
      marcas.push({
        id: 'lt' + from + '-' + m.rule?.id,
        origen: 'LanguageTool', tipo, from, to, original,
        mensaje: m.message, regla: m.rule?.description || '',
        sugerencias: (m.replacements || []).slice(0, 4).map((x) => x.value),
      });
    }
    if (i < partes.length - 1) await new Promise((ok) => setTimeout(ok, 1500));
  }
  progreso(partes.length, partes.length);
  return marcas;
}

export const PEDIDO_REVISION = `Revisá este texto como corrector de estilo de una editorial: ortografía, tildes, puntuación, concordancia, erratas, palabras repetidas muy cerca y frases confusas. No toques la voz del autor ni el contenido.
Respondé SOLO con un arreglo JSON, sin texto antes ni después, con este formato:
[{"original":"fragmento exacto tal como aparece (de 1 a 12 palabras)","sugerencia":"cómo debería quedar","motivo":"explicación breve","tipo":"orto|gram|estilo"}]
El campo "original" tiene que copiarse letra por letra del texto para poder encontrarlo. Si no hay nada que corregir, respondé [].`;

// Convierte la respuesta de la IA en marcas ubicadas en el texto.
export function marcasDesdeIA(respuesta, texto, base = 0) {
  let lista;
  try {
    const m = respuesta.match(/\[[\s\S]*\]/);
    lista = JSON.parse(m ? m[0] : respuesta);
  } catch { throw new Error('La IA no devolvió una lista legible. Probá de nuevo o con un fragmento más corto.'); }
  const usados = new Set();
  const out = [];
  for (const x of lista) {
    if (!x?.original || x.original === x.sugerencia) continue;
    let p = texto.indexOf(x.original);
    while (p >= 0 && usados.has(p)) p = texto.indexOf(x.original, p + 1);
    if (p < 0) continue;
    usados.add(p);
    out.push({
      id: 'ia' + (base + p), origen: 'IA', tipo: ['orto', 'gram', 'estilo'].includes(x.tipo) ? x.tipo : 'gram',
      from: base + p, to: base + p + x.original.length, original: x.original,
      mensaje: x.motivo || 'Sugerencia', regla: '', sugerencias: x.sugerencia != null ? [String(x.sugerencia)] : [],
    });
  }
  return out;
}

// Corrector ortográfico del navegador dentro del editor.
export const ortografiaNavegador = EditorView.contentAttributes.of({ spellcheck: 'true', lang: 'es', autocorrect: 'off' });
