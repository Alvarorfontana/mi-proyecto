// Almacén de libros en Supabase (base propia de cada usuario o de cada editorial).
// Cada usuario tiene su carpeta privada en el depósito «libros»: <id del usuario>/libros/<libro>/…
// Tiene los mismos métodos que la clase GitHub, así el resto del taller no cambia.
import { createClient } from '@supabase/supabase-js';

const DEPOSITO = 'libros';
const TIPOS = { md: 'text/markdown', toml: 'text/plain', json: 'application/json', typ: 'text/plain', txt: 'text/plain', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf', otf: 'font/otf', ttf: 'font/ttf' };
const tipo = (p) => TIPOS[(p.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

// Configuración de la base: primero la que se cargó en «Conectar tu base», si no la de la publicación (Vercel).
export function configBase() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem('taller.base') || 'null'); } catch {}
  const url = c?.url || import.meta.env.VITE_SUPABASE_URL || '';
  const clave = c?.clave || import.meta.env.VITE_SUPABASE_ANON || '';
  return url && clave ? { url: url.replace(/\/+$/, ''), clave, propia: !!c?.url } : null;
}
export function guardarConfigBase(url, clave) {
  try { if (url) localStorage.setItem('taller.base', JSON.stringify({ url: url.trim(), clave: clave.trim() })); else localStorage.removeItem('taller.base'); } catch {}
  cliente = null;
}

let cliente = null;
export function supa() {
  const c = configBase();
  if (!c) return null;
  if (!cliente) cliente = createClient(c.url, c.clave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return cliente;
}

export async function sesionActual() {
  const s = supa(); if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session || null;
}
export async function entrarConGoogle() {
  const { error } = await supa().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) throw new Error(error.message);
}
export async function entrarConCorreo(correo) {
  const { error } = await supa().auth.signInWithOtp({ email: correo, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw new Error(error.message);
}
export async function salir() { try { await supa()?.auth.signOut(); } catch {} }

export class SupabaseAlmacen {
  constructor(sesion) {
    this.s = supa();
    this.uid = sesion.user.id;
    this.usuarioDatos = sesion.user;
    this.rama = 'main';
    this.shas = new Map();
    this.esSupabase = true;
  }
  d() { return this.s.storage.from(DEPOSITO); }
  ruta(p) { return `${this.uid}/${p}`; }

  async usuario() {
    const u = this.usuarioDatos, m = u.user_metadata || {};
    return { login: u.email, name: m.full_name || m.name || u.email, avatar_url: m.avatar_url || m.picture || '' };
  }
  async infoRepo() { return { default_branch: 'main' }; }

  async listar(prefijo) {
    const out = [];
    let desde = 0;
    for (;;) {
      const { data, error } = await this.d().list(prefijo, { limit: 1000, offset: desde, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw new Error('La base no deja leer los libros: ' + error.message);
      for (const e of data || []) {
        const p = `${prefijo}/${e.name}`;
        if (e.id === null || e.metadata == null) out.push(...(await this.listar(p))); // carpeta
        else out.push({ path: p.slice(this.uid.length + 1), type: 'blob', size: e.metadata?.size || 0 });
      }
      if (!data || data.length < 1000) break;
      desde += 1000;
    }
    return out;
  }
  async arbol() {
    const libros = await this.listar(`${this.uid}/libros`);
    // la plantilla viene con la página (no se guarda en la base de cada usuario)
    let plantilla = [];
    try { plantilla = (await (await fetch('/plantilla/lista.json', { cache: 'no-store' })).json()).map((p) => ({ path: p, type: 'blob' })); } catch {}
    return [...libros, ...plantilla];
  }
  async bajar(p) {
    if (p.startsWith('plantilla/')) {
      const r = await fetch('/' + p, { cache: 'no-store' });
      if (!r.ok) throw new Error('Falta ' + p);
      return r.blob();
    }
    const { data, error } = await this.d().download(this.ruta(p), { cacheNonce: Date.now() });
    if (error) { const e = new Error(`No encuentro ${p} en tu base.`); e.status = 404; throw e; }
    return data;
  }
  async texto(p) { return (await this.bajar(p)).text(); }
  async bytes(p) { return new Uint8Array(await (await this.bajar(p)).arrayBuffer()); }
  async guardar(p, contenido) {
    const cuerpo = typeof contenido === 'string' ? new Blob([contenido], { type: tipo(p) + ';charset=utf-8' }) : new Blob([contenido], { type: tipo(p) });
    const { error } = await this.d().upload(this.ruta(p), cuerpo, { upsert: true, contentType: tipo(p), cacheControl: '0' });
    if (error) throw new Error('No se pudo guardar en tu base: ' + error.message);
    return { content: { sha: String(Date.now()) } };
  }
  async commitVarios(archivos) {
    for (const [p, c] of Object.entries(archivos)) await this.guardar(p, c);
    return 'ok';
  }
  async borrar(p) { await this.d().remove([this.ruta(p)]); }

  // Funciones que solo existen con GitHub (armado en la nube, versiones con etiquetas)
  sinGitHub() { throw new Error('Con tu base propia, el PDF se arma en el navegador: usá «Armar el PDF acá».'); }
  lanzarArmado() { this.sinGitHub(); }
  async versiones() { return []; }
  async corridas() { return { workflow_runs: [] }; }
  async artefactos() { return { artifacts: [] }; }
  async etiquetas() { return []; }
  shaRama() { this.sinGitHub(); }
  crearEtiqueta() { this.sinGitHub(); }
  commit() { this.sinGitHub(); }
  comparar() { this.sinGitHub(); }
  textoEn() { this.sinGitHub(); }
}
