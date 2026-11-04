// Acceso al repo en GitHub: leer, guardar y lanzar el armado.
const API = 'https://api.github.com';

function b64(texto) {
  const bytes = typeof texto === 'string' ? new TextEncoder().encode(texto) : texto;
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const ruta = (p) => p.split('/').map(encodeURIComponent).join('/');

export class GitHub {
  constructor({ token, owner, repo, rama = 'main' }) {
    Object.assign(this, { token, owner, repo, rama });
    this.shas = new Map();
  }
  async req(path, { method = 'GET', body, accept = 'application/vnd.github+json', tipo = 'json' } = {}) {
    const r = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!r.ok) {
      let msg = `${r.status}`;
      try { msg = (await r.json()).message || msg; } catch {}
      const e = new Error(traducir(r.status, msg));
      e.status = r.status;
      throw e;
    }
    if (tipo === 'nada' || r.status === 204) return null;
    if (tipo === 'texto') return r.text();
    if (tipo === 'bytes') return new Uint8Array(await r.arrayBuffer());
    return r.json();
  }
  get base() { return `/repos/${this.owner}/${this.repo}`; }

  usuario() { return this.req('/user'); }
  infoRepo() { return this.req(this.base); }

  async arbol() {
    const r = await this.req(`${this.base}/git/trees/${encodeURIComponent(this.rama)}?recursive=1`);
    this.shas.clear();
    for (const e of r.tree) if (e.type === 'blob') this.shas.set(e.path, e.sha);
    return r.tree.filter((e) => e.type === 'blob');
  }
  texto(p) {
    return this.req(`${this.base}/contents/${ruta(p)}?ref=${encodeURIComponent(this.rama)}`, { accept: 'application/vnd.github.raw', tipo: 'texto' });
  }
  bytes(p) {
    return this.req(`${this.base}/contents/${ruta(p)}?ref=${encodeURIComponent(this.rama)}`, { accept: 'application/vnd.github.raw', tipo: 'bytes' });
  }
  // contenido puede ser texto o bytes (Uint8Array, para fotos)
  async guardar(p, contenido, mensaje) {
    const body = { message: mensaje || `Edición desde el taller: ${p}`, content: b64(contenido), branch: this.rama };
    const sha = this.shas.get(p);
    if (sha) body.sha = sha;
    try {
      const r = await this.req(`${this.base}/contents/${ruta(p)}`, { method: 'PUT', body });
      this.shas.set(p, r.content.sha);
      return r;
    } catch (e) {
      if (e.status === 409 || e.status === 422) {
        // el archivo cambió en GitHub: tomamos el sha actual y reintentamos una vez
        const info = await this.req(`${this.base}/contents/${ruta(p)}?ref=${encodeURIComponent(this.rama)}`);
        body.sha = info.sha;
        const r = await this.req(`${this.base}/contents/${ruta(p)}`, { method: 'PUT', body });
        this.shas.set(p, r.content.sha);
        return r;
      }
      throw e;
    }
  }
  lanzarArmado(libro, version = '', nota = '') {
    const inputs = { libro };
    if (version) Object.assign(inputs, { version, nota });
    return this.req(`${this.base}/actions/workflows/construir.yml/dispatches`, { method: 'POST', body: { ref: this.rama, inputs }, tipo: 'nada' });
  }
  versiones() { return this.req(`${this.base}/releases?per_page=12`); }
  corridas() { return this.req(`${this.base}/actions/workflows/construir.yml/runs?per_page=6`); }
  artefactos(id) { return this.req(`${this.base}/actions/runs/${id}/artifacts`); }
}

function traducir(status, msg) {
  if (status === 401) return 'GitHub no acepta la clave (token). Revisá que esté bien copiada y no haya vencido.';
  if (status === 403 && /rate limit/i.test(msg)) return 'GitHub pide esperar unos minutos (límite de consultas).';
  if (status === 403) return 'La clave no tiene permiso para esto. Revisá los permisos del token (Contents y Actions: lectura y escritura).';
  if (status === 404) return 'No encuentro el repo o el archivo. Revisá el nombre del repo y que el token tenga acceso a él.';
  return `GitHub respondió: ${msg}`;
}
