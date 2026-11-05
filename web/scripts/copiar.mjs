// Copia las tipografías del taller a la página (para el motor y las muestras).
import fs from 'fs'; import path from 'path';
const origen = path.resolve('..', 'fuentes'), destino = path.resolve('public', 'fuentes');
fs.mkdirSync(destino, { recursive: true });
for (const f of fs.readdirSync(origen)) if (/\.(ttf|otf|json)$/.test(f)) fs.copyFileSync(path.join(origen, f), path.join(destino, f));
console.log('Fuentes copiadas:', fs.readdirSync(destino).length);

// La plantilla del libro viaja con la página (la usan los que guardan sus libros en su propia base).
const pOrigen = path.resolve('..', 'plantilla'), pDestino = path.resolve('public', 'plantilla');
const lista = [];
(function copiar(dir, rel) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const o = path.join(dir, f.name), r = rel ? rel + '/' + f.name : f.name;
    if (f.isDirectory()) copiar(o, r);
    else if (/\.(typ|toml|json|docx)$/.test(f.name)) {
      fs.mkdirSync(path.join(pDestino, path.dirname(r)), { recursive: true });
      fs.copyFileSync(o, path.join(pDestino, r));
      lista.push('plantilla/' + r);
    }
  }
})(pOrigen, '');
fs.writeFileSync(path.join(pDestino, 'lista.json'), JSON.stringify(lista));
console.log('Plantilla copiada:', lista.length, 'archivos');
