// Pasamanos a la API de GitHub con la clave guardada en el servidor.
// Solo deja tocar el repositorio del taller (y leer el usuario).
import { quien, json, reenviar, REPO } from './_comun.js';

async function manejar(request) {
  if (!quien(request)) return json({ message: 'Contraseña incorrecta.' }, 401);
  const u = new URL(request.url);
  const ruta = '/' + (u.searchParams.get('ruta') || '').replace(/^\/+/, '');
  u.searchParams.delete('ruta');
  if (!(ruta === '/user' || ruta.startsWith(`/repos/${REPO}/`) || ruta === `/repos/${REPO}`)) return json({ message: 'Ese repositorio no es del taller.' }, 403);
  const destino = 'https://api.github.com' + ruta + (u.searchParams.toString() ? '?' + u.searchParams : '');
  const metodo = request.method;
  const r = await fetch(destino, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.TALLER_GITHUB_TOKEN}`,
      Accept: request.headers.get('accept') || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'taller-editorial',
      ...(request.headers.get('content-type') ? { 'Content-Type': request.headers.get('content-type') } : {}),
    },
    body: metodo === 'GET' || metodo === 'HEAD' ? undefined : await request.arrayBuffer(),
  });
  return reenviar(r);
}
export { manejar as GET, manejar as POST, manejar as PUT, manejar as PATCH, manejar as DELETE };
