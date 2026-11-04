// Edición del libro.toml respetando comentarios y formato (port de panel/servidor.py).

export function tomlValor(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function tomlSet(texto, seccion, clave, valor) {
  const lineas = texto.split('\n');
  const ini = lineas.findIndex((l) => l.trim() === `[${seccion}]`);
  if (ini < 0) return texto.replace(/\s*$/, '') + `\n\n[${seccion}]\n${clave} = ${tomlValor(valor)}\n`;
  let fin = lineas.length;
  for (let j = ini + 1; j < lineas.length; j++) if (lineas[j].trimStart().startsWith('[')) { fin = j; break; }
  const patron = new RegExp('^(\\s*#?\\s*)' + reEsc(clave) + '(\\s*=\\s*)([^#\\n]*?)(\\s*#.*)?$');
  for (let j = ini + 1; j < fin; j++) {
    const m = lineas[j].match(patron);
    if (m) { lineas[j] = `${clave}${m[2]}${tomlValor(valor)}${m[4] || ''}`; return lineas.join('\n'); }
  }
  let k = fin;
  while (k > ini + 1 && !lineas[k - 1].trim()) k--;
  lineas.splice(k, 0, `${clave} = ${tomlValor(valor)}`);
  return lineas.join('\n');
}

export function tomlContenido(texto, items) {
  const bloques = items.map((it) => {
    const b = ['[[contenido]]', `tipo = ${tomlValor(it.tipo)}`];
    if (it.tipo === 'parte') b.push(`titulo = ${tomlValor(it.titulo)}`);
    else { b.push(`archivo = ${tomlValor(it.archivo)}`); if (it.indice === false) b.push('indice = false'); }
    return b.join('\n');
  });
  const nuevo = bloques.join('\n\n') + '\n';
  const patron = /^\[\[contenido\]\]\n(?:(?![\[#])[^\n]*\n?)*/gm;
  const m = patron.exec(texto);
  if (!m) return texto.replace(/\s*$/, '') + '\n\n' + nuevo;
  const pos = m.index;
  const sin = texto.replace(patron, '');
  return sin.slice(0, pos) + nuevo + '\n' + sin.slice(pos);
}
