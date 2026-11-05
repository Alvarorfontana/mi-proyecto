import { quien, json, REPO } from './_comun.js';

export async function POST(request) {
  const nombre = quien(request);
  if (!nombre) return json({ error: 'Contraseña incorrecta.' }, 401);
  if (!process.env.TALLER_GITHUB_TOKEN) return json({ error: 'Falta cargar TALLER_GITHUB_TOKEN en Vercel.' }, 500);
  const [owner, repo] = REPO.split('/');
  return json({ ok: true, nombre, owner, repo, ia: { gemini: !!process.env.GEMINI_CLAVE, groq: !!process.env.GROQ_CLAVE } });
}
