// Asistente de edición: Groq o Gemini (las dos con API compatible con OpenAI y plan gratuito).
export const PROVEEDORES = {
  groq: { nombre: 'Groq', url: 'https://api.groq.com/openai/v1', claves: 'https://console.groq.com/keys', pista: 'gsk_…' },
  gemini: { nombre: 'Gemini (Google)', url: 'https://generativelanguage.googleapis.com/v1beta/openai', claves: 'https://aistudio.google.com/apikey', pista: 'AIza…' },
};
// Gemini: la lista real se pide a Google con la clave; esta es la de respaldo.
export const MODELOS_GEMINI = [
  { id: 'gemini-flash-latest', nombre: 'Gemini Flash (el más nuevo) — rápido' },
  { id: 'gemini-pro-latest', nombre: 'Gemini Pro (el más nuevo) — más preciso' },
  { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash — rápido' },
  { id: 'gemini-2.5-pro', nombre: 'Gemini 2.5 Pro — más preciso' },
  { id: 'gemini-2.5-flash-lite', nombre: 'Gemini 2.5 Flash-Lite — instantáneo' },
];
export async function modelosGemini(clave) {
  try {
    const r = await fetch(PROVEEDORES.gemini.url + '/models', { headers: { Authorization: `Bearer ${clave}` } });
    if (!r.ok) return MODELOS_GEMINI;
    const j = await r.json();
    const ids = (j.data || []).map((m) => String(m.id).replace(/^models\//, ''))
      .filter((id) => /^gemini-/.test(id) && !/image|embed|tts|audio|live|vision|aqa|computer|robotics/i.test(id));
    if (!ids.length) return MODELOS_GEMINI;
    const peso = (id) => (/pro/.test(id) ? 0 : /lite/.test(id) ? 2 : 1) + (/preview|exp/.test(id) ? 0.5 : 0);
    const ver = (id) => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    ids.sort((a, b) => ver(b) - ver(a) || peso(a) - peso(b) || a.localeCompare(b));
    return ids.slice(0, 12).map((id) => ({ id, nombre: id.replace(/^gemini-/, 'Gemini ').replace(/-/g, ' ') }));
  } catch { return MODELOS_GEMINI; }
}
export const MODELOS = [
  { id: 'llama-3.3-70b-versatile', nombre: 'Llama 3.3 70B — equilibrado' },
  { id: 'openai/gpt-oss-120b', nombre: 'GPT-OSS 120B — más preciso' },
  { id: 'openai/gpt-oss-20b', nombre: 'GPT-OSS 20B — rápido' },
  { id: 'llama-3.1-8b-instant', nombre: 'Llama 3.1 8B — instantáneo' },
];

const SISTEMA = `Sos un editor de mesa de una editorial argentina. Trabajás sobre un libro de no ficción periodística escrito en castellano rioplatense.
Respetá la voz del autor, sus datos y sus fuentes. No inventes hechos, cifras ni citas.
El texto está en Markdown: conservá intactas las llamadas a notas [^n], las cursivas *así*, los títulos con # y los bloques ::: .
Respondé solo con lo que se pide, sin preámbulos.`;

export const ACCIONES = {
  condensar: { nombre: 'Condensar', pide: 'Condensá este fragmento a cerca del 70 % de su extensión sin perder datos, fuentes ni la voz del autor. Devolvé solo el texto nuevo.', reemplaza: true },
  corregir: { nombre: 'Corregir', pide: 'Corregí ortografía, puntuación, concordancias y erratas. No cambies el estilo ni el contenido. Devolvé solo el texto corregido.', reemplaza: true },
  fluir: { nombre: 'Mejorar fluidez', pide: 'Mejorá la fluidez: oraciones más claras, menos repeticiones y conectores pesados. Mantené datos, notas y voz. Devolvé solo el texto nuevo.', reemplaza: true },
  repeticiones: { nombre: 'Buscar repeticiones', pide: 'Señalá ideas, datos o frases que se repiten dentro de este texto. Para cada caso citá brevemente dónde aparece y sugerí qué conservar. Respondé en una lista breve.', reemplaza: false },
  titulos: { nombre: 'Sugerir títulos', pide: 'Proponé cinco títulos posibles para este texto, con su bajada, en el estilo del libro. Lista breve.', reemplaza: false },
  resumen: { nombre: 'Resumir', pide: 'Resumí este texto en un párrafo de no más de 120 palabras, útil para una solapa o una contratapa.', reemplaza: false },
};

// Si Google retira un modelo, se busca solo uno vigente (Flash) y se reintenta.
let modeloVigente = '';
export async function preguntar(op) {
  try {
    return await preguntar0(modeloVigente && op.proveedor === 'gemini' ? { ...op, modelo: modeloVigente } : op);
  } catch (e) {
    if (op.proveedor !== 'gemini' || !/no encuentra el modelo/.test(e.message)) throw e;
    const lista = await modelosGemini(op.clave);
    const nuevo = (lista.find((m) => /flash/.test(m.id) && !/lite/.test(m.id)) || lista[0] || MODELOS_GEMINI[0]).id;
    modeloVigente = nuevo === op.modelo ? 'gemini-flash-latest' : nuevo;
    return preguntar0({ ...op, modelo: modeloVigente });
  }
}

async function preguntar0({ proveedor = 'groq', clave, modelo, accion, texto, pedido }) {
  const instr = accion ? ACCIONES[accion].pide : pedido;
  const P = PROVEEDORES[proveedor] || PROVEEDORES.groq;
  const nom = proveedor === 'gemini' ? 'Gemini' : 'Groq';
  const r = await fetch(P.url + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo || (proveedor === 'gemini' ? MODELOS_GEMINI[0].id : MODELOS[0].id),
      temperature: accion === 'corregir' ? 0.1 : 0.5,
      messages: [
        { role: 'system', content: SISTEMA },
        { role: 'user', content: `${instr}\n\n---\n${texto}` },
      ],
    }),
  });
  if (!r.ok) {
    let msg = r.status;
    try { msg = (await r.json()).error?.message || msg; } catch {}
    if (r.status === 401 || r.status === 403 || (r.status === 400 && /api key/i.test(String(msg)))) throw new Error(`${nom} no acepta la clave. Revisala en Ajustes.`);
    if (r.status === 404) throw new Error(`${nom} no encuentra el modelo elegido. Probá con otro de la lista.`);
    if (r.status === 429) throw new Error(`${nom} pide esperar un momento (límite del plan gratuito).`);
    if (r.status === 413 || /too large|context/i.test(String(msg))) throw new Error('El fragmento es muy largo para este modelo. Probá con una parte más corta.');
    throw new Error(`${nom} respondió: ` + msg);
  }
  const j = await r.json();
  if (Array.isArray(j)) return j[0]?.choices?.[0]?.message?.content?.trim() || '';
  return j.choices?.[0]?.message?.content?.trim() || '';
}
