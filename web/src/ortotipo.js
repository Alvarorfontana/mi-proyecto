// Ortotipografía del castellano (RAE, Martínez de Sousa y usos editoriales argentinos).
// Cada regla propone cambios que se revisan antes de aplicar; nada se cambia solo.

// Zonas que no se tocan: URLs, código, llamadas y definiciones de notas, atributos {…}, imágenes y bloques :::
function zonasProtegidas(t) {
  const z = [];
  const re = /https?:\/\/\S+|doi:\S+|`[^`\n]*`|\[\^[^\]]+\]|\{[^}\n]*\}|!\[[^\]\n]*\]\([^)\n]*\)|\]\([^)\n]*\)|^:::.*$|^\|.*$|<!--[\s\S]*?-->/gm;
  let m; while ((m = re.exec(t))) z.push([m.index, m.index + m[0].length]);
  return z;
}
const dentro = (z, a, b) => z.some(([x, y]) => a < y && b > x);

export const REGLAS = [
  { id: 'comillas', nombre: 'Comillas latinas « »', ej: '"palabra" → «palabra»',
    re: /(^|[\s(\[—¿¡])"([^"\n]{1,600}?)"(?=[\s.,;:!?)…\]—]|$)/gm,
    fix: (m) => m[1] + '«' + m[2] + '»', desde: 1 },
  { id: 'comillas-tipograficas', nombre: 'Comillas inglesas dentro de latinas', ej: '« … "x" … » → « … “x” … »',
    re: /«([^»\n]*?)"([^"\n]+?)"([^»\n]*?)»/g, fix: (m) => `«${m[1]}“${m[2]}”${m[3]}»` },
  { id: 'punto-comillas', nombre: 'El punto va después de las comillas y paréntesis', ej: '«texto.» → «texto».',
    re: /([^.\s])\.([»”’)])(?=\s|$)/g, fix: (m) => m[1] + m[2] + '.', excepto: /(etc|pág|págs|cf|ed|eds|vol|núm|p|pp|art|cap|Sr|Sra|Dr|Dra|ej|aprox|EE\.UU)\.[»”’)]$/ },
  { id: 'suspensivos', nombre: 'Puntos suspensivos en un solo signo', ej: '... → …', re: /(?<!\.)\.{3}(?!\.)/g, fix: () => '…' },
  { id: 'etc', nombre: '«etc.» no lleva puntos suspensivos', ej: 'etc... → etc.', re: /\betc(\.\.\.|…)/g, fix: () => 'etc.' },
  { id: 'raya-dialogo', nombre: 'Raya de diálogo', ej: '- Hola → —Hola', re: /^(-{1,2}|–)\s?(?=[¿¡«A-ZÁÉÍÓÚÑ])/gm, fix: () => '—' },
  { id: 'raya-inciso', nombre: 'Raya en los incisos', ej: 'texto - inciso - texto → texto —inciso— texto',
    re: /(\p{L}|[,;])\s(?:-{1,2}|–)\s([^\n]{1,180}?)\s(?:-{1,2}|–)(\s|[,.;:])/gu, fix: (m) => `${m[1]} —${m[2]}—${m[3]}` },
  { id: 'raya-doble-guion', nombre: 'Doble guion por raya', ej: '-- → —', re: /(?<!-)--(?!-)/g, fix: () => '—' },
  { id: 'espacio-doble', nombre: 'Espacios de más', ej: 'dos  espacios → uno', re: /(\S) {2,}(?=\S)/g, fix: (m) => m[1] + ' ' },
  { id: 'espacio-antes', nombre: 'Sin espacio antes de coma, punto y coma, dos puntos o cierre', ej: 'hola , chau → hola, chau',
    re: /(\p{L}|[»”)\d]) +([,;:.?!»”)])(?!\.)/gu, fix: (m) => m[1] + m[2] },
  { id: 'espacio-despues', nombre: 'Espacio después de coma y punto y coma', ej: 'hola,chau → hola, chau', re: /(\p{Ll}{2,})([,;])(\p{L}{2,})/gu, fix: (m) => `${m[1]}${m[2]} ${m[3]}` },
  { id: 'siglas', nombre: 'Siglas sin puntos', ej: 'O.N.U. → ONU', re: /\b((?:[A-ZÁÉÍÓÚÑ]\.){2,})(?=[\s,;:)»]|$)(?!\s*[§\d])/g, fix: (m) => m[1].replace(/\./g, ''), excepto: /^(EE\.UU\.|[A-Z]\.[A-Z]\.)$/ },
  { id: 'miles', nombre: 'Punto de miles en cifras de cinco o más dígitos', ej: '12500 → 12.500',
    re: /(?<![\d.,/:\-#A-Za-z])(\d{5,})(?![\d.,]?\d)(?![/\-:\p{L}])/gu, fix: (m) => m[1].replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    antes: /(ley|orden|ejecutiva|resoluci[oó]n|decreto|expediente|causa|n\.º|nº|n°|número|art[ií]culo|art\.|c[oó]digo|ISBN|ISSN|CUIT|DNI|tel[eé]fono|CP|meeting)\s*$/i },
  { id: 'anio-punto', nombre: 'Los años no llevan punto', ej: 'en 2.024 → en 2024', re: /\b(en|de|del|año|años|hasta|desde|hacia)\s(1\.[5-9]\d\d|2\.0\d\d)\b/g, fix: (m) => `${m[1]} ${m[2].replace('.', '')}` },
  { id: 'porcentaje', nombre: 'Espacio entre el número y %', ej: '50% → 50 %', re: /(\d)%/g, fix: (m) => m[1] + ' %' },
  { id: 'apertura', nombre: 'Falta el signo de apertura ¿ o ¡', ej: 'Qué pasa? → ¿Qué pasa?', soloAviso: true,
    re: /(^|[.!?…»]\s+|\n)([^¿¡\n.!?]{2,160}?)([?!])/g,
    prueba: (m) => {
      const signo = m[3] === '?' ? '¿' : '¡';
      if (m[2].includes(signo)) return false;
      const ini = m.input.lastIndexOf('\n', m.index) + 1;
      if (/^\[\^/.test(m.input.slice(ini, ini + 3))) return false; // notas: suelen citar títulos en otros idiomas
      const previo = m.input.slice(Math.max(0, m.index - 400), m.index);
      if (previo.lastIndexOf(signo) > previo.search(/[?!][^?!]*$/)) return false; // la apertura quedó en un renglón anterior (versos)
      return !/\b(the|of|and|to|is|or|what|why|how|who)\b/i.test(m[2]);
    }, mensaje: (m) => `Falta el signo de apertura ${m[3] === '?' ? '¿' : '¡'} en esta oración.` },
];

// Devuelve marcas para el panel de Revisión: {id, origen, tipo, from, to, original, mensaje, sugerencias}
export function revisarOrtotipografia(texto, activas = REGLAS.map((r) => r.id)) {
  const z = zonasProtegidas(texto);
  const marcas = [];
  const ocupado = [];
  for (const r of REGLAS) {
    if (!activas.includes(r.id)) continue;
    r.re.lastIndex = 0;
    let m;
    while ((m = r.re.exec(texto))) {
      if (m[0].length === 0) { r.re.lastIndex++; continue; }
      const desde = m.index + (r.desde ? m[1].length : 0);
      const hasta = m.index + m[0].length;
      if (dentro(z, desde, hasta)) continue;
      if (r.excepto && r.excepto.test(m[0])) continue;
      if (r.antes && r.antes.test(texto.slice(Math.max(0, desde - 30), desde))) continue;
      if (r.prueba && !r.prueba(m)) continue;
      // en encabezados (#) y notas no se tocan las comillas de títulos de obras citadas en inglés
      const linea = texto.lastIndexOf('\n', desde) + 1;
      if (/^#/.test(texto.slice(linea, linea + 2)) && r.id !== 'espacio-doble' && r.id !== 'suspensivos') continue;
      if (ocupado.some(([a, b]) => desde < b && hasta > a)) continue;
      const original = texto.slice(desde, hasta);
      if (r.soloAviso) {
        const ini = m.index + m[1].length;
        marcas.push({ id: `ot-${r.id}-${ini}`, origen: 'Normas', tipo: 'gram', from: ini, to: Math.min(hasta, ini + 40), original: texto.slice(ini, hasta), mensaje: r.mensaje(m), sugerencias: [], regla: r.id });
        continue;
      }
      const nuevo = r.fix(m).slice(r.desde ? m[1].length : 0);
      if (nuevo === original) continue;
      ocupado.push([desde, hasta]);
      marcas.push({ id: `ot-${r.id}-${desde}`, origen: 'Normas', tipo: 'estilo', from: desde, to: hasta, original, mensaje: r.nombre, sugerencias: [nuevo], regla: r.id });
    }
  }
  return marcas.sort((a, b) => a.from - b.from);
}
