// Pasamanos a la IA gratuita (Gemini y Groq) con las claves guardadas en el servidor.
import { quien, json, reenviar } from './_comun.js';

async function manejar(request) {
  if (!quien(request)) return json({ error: { message: 'Contraseña incorrecta.' } }, 401);
  const u = new URL(request.url);
  const prov = u.searchParams.get('prov');
  const ruta = (u.searchParams.get('ruta') || '').replace(/^\/+/, '');
  u.searchParams.delete('prov'); u.searchParams.delete('ruta'); u.searchParams.delete('key');
  let destino, auth = {};
  if (prov === 'groq') {
    if (!process.env.GROQ_CLAVE) return json({ error: { message: 'El taller no tiene clave de Groq.' } }, 400);
    destino = 'https://api.groq.com/openai/v1/' + ruta;
    auth = { Authorization: `Bearer ${process.env.GROQ_CLAVE}` };
  } else if (prov === 'gemini') {
    if (!process.env.GEMINI_CLAVE) return json({ error: { message: 'El taller no tiene clave de Gemini.' } }, 400);
    destino = 'https://generativelanguage.googleapis.com/' + ruta;
    auth = { 'x-goog-api-key': process.env.GEMINI_CLAVE }; // una sola credencial (las claves «AQ.» no aceptan dos)
  } else return json({ error: { message: 'Proveedor desconocido.' } }, 400);
  const q = u.searchParams.toString();
  const r = await fetch(destino + (q ? '?' + q : ''), {
    method: request.method,
    headers: { ...auth, ...(request.headers.get('content-type') ? { 'Content-Type': request.headers.get('content-type') } : {}) },
    body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
  });
  return reenviar(r);
}
export { manejar as GET, manejar as POST };
