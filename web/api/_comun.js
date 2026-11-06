// Funciones compartidas de la entrada con contraseña (los archivos que empiezan con _ no son rutas).
// Variables en Vercel → Settings → Environment Variables (nunca en el código):
//   TALLER_CLAVES        contraseñas, separadas por coma, con nombre opcional: "Álvaro:clave1, Juan:clave2"
//   TALLER_GITHUB_TOKEN  clave de GitHub con permisos repo y workflow
//   TALLER_REPO          (opcional) cuenta/repositorio; por defecto Alvarorfontana/mi-proyecto
//   GEMINI_CLAVE, GROQ_CLAVE  claves gratuitas de IA (opcionales)
export const REPO = process.env.TALLER_REPO || 'Alvarorfontana/mi-proyecto';

export function quien(request) {
  const dada = (request.headers.get('x-taller-clave') || '').trim();
  if (!dada) return null;
  for (const par of (process.env.TALLER_CLAVES || '').split(',')) {
    const t = par.trim();
    if (!t) continue;
    const i = t.lastIndexOf(':');
    const nombre = i > 0 ? t.slice(0, i).trim() : 'Equipo';
    const clave = i > 0 ? t.slice(i + 1).trim() : t;
    if (clave && clave === dada) return nombre;
  }
  return null;
}

export const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// copia la respuesta de afuera tal cual (estado, tipo y cuerpo)
export async function reenviar(r) {
  const h = new Headers();
  for (const k of ['content-type', 'content-disposition', 'link', 'etag']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  return new Response(r.status === 204 ? null : await r.arrayBuffer(), { status: r.status, headers: h });
}

// Usuarios que entran con Google o correo (Supabase): se verifica la sesión con la base de la publicación.
// Variables: SUPABASE_URL y SUPABASE_ANON (las mismas que VITE_SUPABASE_URL y VITE_SUPABASE_ANON).
export async function usuarioSupabase(request) {
  const token = request.headers.get('x-supabase-token');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON || process.env.VITE_SUPABASE_ANON;
  if (!token || !url || !anon) return null;
  try {
    const r = await fetch(url.replace(/\/+$/, '') + '/auth/v1/user', { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.email || u?.id || null;
  } catch { return null; }
}

// Quien entra con su propia clave de GitHub: vale si esa clave puede escribir en el repositorio del taller.
export async function usuarioGitHub(request) {
  const token = (request.headers.get('x-github-token') || '').trim();
  if (!token) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'taller-editorial' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.permissions?.push ? 'github' : null;
  } catch { return null; }
}
