// Entrada con contraseña: el navegador no guarda ninguna clave de GitHub ni de IA.
// Todas las llamadas a GitHub, Gemini y Groq pasan por el servidor del taller (carpeta /api),
// que agrega las claves guardadas en Vercel.
const BINARIO = /\.(png|jpe?g|webp|gif|tiff?|otf|ttf|woff2?|pdf|zip)$/i;

export function instalarPasamanos(clave) {
  if (window.__pasamanos) return;
  window.__pasamanos = true;
  const original = window.fetch.bind(window);
  window.fetch = (entrada, init = {}) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    let nuevo = null;
    if (url.startsWith('https://api.github.com/')) {
      // imágenes y fuentes del repo (público): directo del depósito de GitHub, sin pasar por el servidor
      const m = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/contents\/([^?]+)\?ref=([^&]+)/);
      if (m && (!init.method || init.method === 'GET') && BINARIO.test(decodeURIComponent(m[3]))) {
        return original(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${decodeURIComponent(m[4])}/${m[3]}`, { cache: 'no-store' });
      }
      nuevo = '/api/gh/' + url.slice('https://api.github.com/'.length);
    } else if (url.startsWith('https://api.groq.com/openai/v1/')) nuevo = '/api/ia/groq/' + url.slice('https://api.groq.com/openai/v1/'.length);
    else if (url.startsWith('https://generativelanguage.googleapis.com/')) nuevo = '/api/ia/gemini/' + url.slice('https://generativelanguage.googleapis.com/'.length).replace(/([?&])key=[^&]*&?/, '$1').replace(/[?&]$/, '');
    if (!nuevo) return original(entrada, init);
    const headers = new Headers(init.headers || (typeof entrada === 'object' && 'headers' in entrada ? entrada.headers : undefined));
    headers.delete('Authorization');
    headers.delete('x-goog-api-key');
    headers.set('X-Taller-Clave', clave);
    return original(nuevo, { ...init, headers });
  };
}

export async function entrarConClave(clave) {
  const r = await fetch('/api/entrar', { method: 'POST', headers: { 'X-Taller-Clave': clave } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo entrar.');
  return j; // { nombre, owner, repo, ia: { gemini, groq } }
}
