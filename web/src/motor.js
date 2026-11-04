// Interfaz del motor: compila en el worker y dibuja páginas con el renderizador de Typst.
import { createTypstRenderer } from '@myriaddreamin/typst.ts';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';

const worker = new Worker(new URL('./motor.worker.js', import.meta.url), { type: 'module' });
let seq = 0;
const pendientes = new Map();
worker.onmessage = (e) => {
  const p = pendientes.get(e.data.id);
  if (!p) return;
  pendientes.delete(e.data.id);
  e.data.ok ? p.resolve(e.data.res) : p.reject(new Error(e.data.error));
};
const pedir = (accion, datos = {}, transfer = []) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pendientes.set(id, { resolve, reject });
    worker.postMessage({ id, accion, ...datos }, transfer);
  });

let listo = null;
let renderer = null;

export function iniciarMotor() {
  if (!listo) {
    listo = (async () => {
      const cat = await (await fetch('/fuentes/catalogo.json')).json();
      const fuentes = cat.map((c) => new URL('/fuentes/' + c.archivo, location.origin).href);
      await pedir('iniciar', { fuentes });
      renderer = createTypstRenderer();
      await renderer.init({ getModule: () => rendererWasm });
      return cat;
    })();
  }
  return listo;
}

const binariosEnviados = new Set();
export async function cargarTextos(archivos) { await iniciarMotor(); return pedir('texto', { archivos }); }
export async function cargarBinarios(archivos) {
  await iniciarMotor();
  const nuevos = {};
  const transfer = [];
  for (const [ruta, bytes] of Object.entries(archivos)) {
    if (binariosEnviados.has(ruta)) continue;
    binariosEnviados.add(ruta);
    nuevos[ruta] = bytes;
  }
  if (Object.keys(nuevos).length) await pedir('binario', { archivos: nuevos }, transfer);
}
export const yaCargado = (ruta) => binariosEnviados.has(ruta);

export async function compilar(principal, inputs, formato = 'vector') {
  await iniciarMotor();
  return pedir('compilar', { principal, inputs, formato });
}

export async function aSvg(bytes) {
  await iniciarMotor();
  return renderer.renderSvg({ artifactContent: bytes });
}
