// Copia las tipografías del taller a la página (para el motor y las muestras).
import fs from 'fs'; import path from 'path';
const origen = path.resolve('..', 'fuentes'), destino = path.resolve('public', 'fuentes');
fs.mkdirSync(destino, { recursive: true });
for (const f of fs.readdirSync(origen)) if (/\.(ttf|otf|json)$/.test(f)) fs.copyFileSync(path.join(origen, f), path.join(destino, f));
console.log('Fuentes copiadas:', fs.readdirSync(destino).length);
