// Asistente de edición con Groq (API compatible con OpenAI, plan gratuito).
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

export async function preguntar({ clave, modelo, accion, texto, pedido }) {
  const instr = accion ? ACCIONES[accion].pide : pedido;
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo || MODELOS[0].id,
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
    if (r.status === 401) throw new Error('Groq no acepta la clave. Revisala en Ajustes.');
    if (r.status === 429) throw new Error('Groq pide esperar un momento (límite del plan gratuito).');
    if (r.status === 413 || /too large|context/i.test(String(msg))) throw new Error('El fragmento es muy largo para este modelo. Probá con una parte más corta.');
    throw new Error('Groq respondió: ' + msg);
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || '';
}
