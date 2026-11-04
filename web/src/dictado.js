// Dictado por voz: el navegador (gratis, en vivo; Chrome y Edge) o Whisper de Groq (más preciso, con clave).
// Entiende órdenes de puntuación dichas en voz alta: «coma», «punto y aparte», «abrir comillas»…

const ORDENES = [
  [/\s*\b(punto y aparte|nuevo p[aá]rrafo)\b\s*/gi, '.\n\n'],
  [/\s*\b(nueva l[ií]nea|otro rengl[oó]n)\b\s*/gi, '\n'],
  [/\s*\bpunto y coma\b\s*/gi, '; '],
  [/\s*\b(punto y seguido|punto(?! de\b)(?! final\b)(?! clave\b))\b\s*/gi, '. '],
  [/\s*\bdos puntos\b\s*/gi, ': '],
  [/\s*\bcoma\b\s*/gi, ', '],
  [/\s*\bpuntos suspensivos\b\s*/gi, '… '],
  [/\s*\b(abrir|abre) comillas\b\s*/gi, ' «'],
  [/\s*\b(cerrar|cierra) comillas\b\s*/gi, '» '],
  [/\s*\b(abrir|abre) (pregunta|interrogaci[oó]n)\b\s*/gi, ' ¿'],
  [/\s*\b(cerrar|cierra) (pregunta|interrogaci[oó]n)\b\s*/gi, '? '],
  [/\s*\b(abrir|abre) exclamaci[oó]n\b\s*/gi, ' ¡'],
  [/\s*\b(cerrar|cierra) exclamaci[oó]n\b\s*/gi, '! '],
  [/\s*\b(abrir|abre) par[eé]ntesis\b\s*/gi, ' ('],
  [/\s*\b(cerrar|cierra) par[eé]ntesis\b\s*/gi, ') '],
  [/\s*\b(raya|guion largo)\b\s*/gi, ' — '],
];

// Aplica las órdenes y arregla mayúsculas y espacios.
export function puntuar(texto, { inicio = true } = {}) {
  let t = ' ' + texto.trim() + ' ';
  for (const [re, rep] of ORDENES) t = t.replace(re, rep);
  t = t
    .replace(/ +([.,;:?!…»)])/g, '$1')
    .replace(/([«¿¡(]) +/g, '$1')
    .replace(/([.,;:])\1+/g, '$1')
    .replace(/\.\s*\./g, '.')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/^ +| +$/g, '');
  // mayúscula después de punto, signos de apertura y al empezar
  t = t.replace(/([.?!…]\s+|\n\s*|[¿¡]\s*)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
  if (inicio) t = t.replace(/^([¿¡«(]?)(\p{Ll})/u, (m, a, b) => a + b.toUpperCase());
  return t;
}

export const hayDictadoNavegador = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);

// Dictado en vivo con el reconocimiento del navegador.
export function dictarNavegador({ alTexto, alParcial, alTerminar, alError, idioma = 'es-AR' }) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new R();
  rec.lang = idioma; rec.continuous = true; rec.interimResults = true;
  let activo = true;
  rec.onresult = (e) => {
    let parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) alTexto(r[0].transcript); else parcial += r[0].transcript;
    }
    alParcial(parcial);
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    activo = false;
    alError(e.error === 'not-allowed' ? 'El navegador no tiene permiso para usar el micrófono.' : e.error === 'network' ? 'El dictado del navegador necesita conexión a internet.' : 'El dictado se cortó: ' + e.error);
  };
  // Chrome corta solo después de un rato de silencio: se reinicia mientras siga activo
  rec.onend = () => { if (activo) { try { rec.start(); } catch { activo = false; alTerminar(); } } else alTerminar(); };
  rec.start();
  return { parar: () => { activo = false; rec.stop(); } };
}

// Graba y manda a Whisper (Groq) cada tramo de ~25 segundos, para ir viendo el texto.
export async function dictarWhisper({ clave, alTexto, alParcial, alTerminar, alError }) {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { alError('El navegador no tiene permiso para usar el micrófono.'); return null; }
  let activo = true; let rec; const cola = [];
  const enviar = async (blob) => {
    if (blob.size < 2000) return;
    const fd = new FormData();
    fd.append('file', blob, 'dictado.webm');
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', 'es');
    fd.append('response_format', 'json');
    alParcial('transcribiendo…');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${clave}` }, body: fd });
    if (!r.ok) throw new Error(r.status === 401 ? 'Groq no acepta la clave.' : r.status === 429 ? 'Groq pide esperar un momento.' : 'Whisper respondió ' + r.status);
    const j = await r.json();
    alParcial('');
    if (j.text?.trim()) alTexto(j.text);
  };
  const tramo = () => {
    const partes = [];
    const r = new MediaRecorder(stream);
    rec = r;
    r.ondataavailable = (e) => partes.push(e.data);
    r.onstop = () => {
      const blob = new Blob(partes, { type: r.mimeType || 'audio/webm' });
      cola.push(enviar(blob).catch((e) => alError(e.message)));
      if (activo) tramo(); else Promise.all(cola).then(() => { stream.getTracks().forEach((t) => t.stop()); alTerminar(); });
    };
    r.start();
    setTimeout(() => { if (r.state === 'recording') r.stop(); }, 25000);
  };
  tramo();
  return { parar: () => { activo = false; if (rec.state === 'recording') rec.stop(); } };
}
