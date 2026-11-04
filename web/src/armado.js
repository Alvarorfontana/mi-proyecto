// Arma el archivo principal del libro (equivalente a herramientas/construir.py → armar_principal)
// y calcula el lomo. Se usa en el navegador y en las pruebas con Node.

const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export const nombreTyp = (i, archivo) => `${String(i).padStart(2, '0')}-${archivo.split('/').pop().replace(/\.md$/, '')}.typ`;

export function principal(cfg, { conIndice = true } = {}) {
  const est = cfg.estilo || {};
  const pre = cfg.preliminares || {};
  const L = ['#import "/plantilla/estilos.typ": *', '#show: libro', ''];
  if (pre.portadilla ?? true) L.push('#portadilla()');
  L.push('#portada()', '#creditos()');
  if (pre.dedicatoria) L.push('#dedicatoria(include "dedicatoria.typ")');
  const posIndice = pre.indice ?? 'inicio';
  if (posIndice === 'inicio') L.push('#indice-general()');
  let primero = true;
  (cfg.contenido || []).forEach((it, i) => {
    if (it.tipo === 'parte') { L.push(`#parte(${q(it.titulo)})`); return; }
    const nombre = nombreTyp(i, it.archivo);
    const indexa = it.indice === false ? 'false' : 'true';
    if (it.tipo === 'capitulo') {
      if (primero) { L.push('#counter(heading).update(0)', '#modo.update("cuerpo")'); primero = false; }
      L.push(`#apertura(impar: ${est.capitulo_en_impar ?? true}, reiniciar-notas: ${est.notas_por_capitulo ?? false})`);
    } else {
      if (it.tipo === 'final') L.push('#modo.update("final")');
      L.push('#apertura(impar: true)');
    }
    L.push(`#indexar.update(${indexa})`, `#include ${q(nombre)}`, '#cierre()', '');
  });
  L.push('#indexar.update(false)');
  if ((est.indice_analitico ?? true) && conIndice) L.push('#indice-analitico()');
  if (posIndice === 'final') L.push('#indice-general()');
  if (est.colofon ?? true) L.push('#colofon()');
  return L.join('\n') + '\n';
}

export function lomoMm(cfg, presets, paginas) {
  const tapa = cfg.tapa || {};
  const hoja = tapa.grosor_hoja_mm || presets.papeles?.[tapa.papel || 'obra-80'] || 0.1;
  return paginas / 2 * hoja + (tapa.cartulina_mm ?? 0.6);
}

export function contarPaginasPdf(bytes) {
  // Typst escribe /Count N en el árbol de páginas raíz
  const s = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4_000_000)));
  const m = [...s.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/g)];
  if (m.length) return Math.max(...m.map((x) => Number(x[1] || x[2])));
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
}
