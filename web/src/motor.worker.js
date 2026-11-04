// Motor de composición: Typst corriendo en un Web Worker (no traba la pantalla).
import { createTypstCompiler, loadFonts, initOptions } from '@myriaddreamin/typst.ts';
import wasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';

let compilador = null;
const textos = new Map();

async function iniciar(fuentes) {
  compilador = createTypstCompiler();
  await compilador.init({
    getModule: () => wasmUrl,
    beforeBuild: [initOptions.disableDefaultFontAssets(), loadFonts(fuentes)],
  });
}

self.onmessage = async (e) => {
  const { id, accion } = e.data;
  try {
    let res = null;
    if (accion === 'iniciar') {
      await iniciar(e.data.fuentes);
    } else if (accion === 'texto') {
      for (const [ruta, contenido] of Object.entries(e.data.archivos)) {
        if (textos.get(ruta) === contenido) continue;
        textos.set(ruta, contenido);
        compilador.addSource(ruta, contenido);
      }
    } else if (accion === 'binario') {
      for (const [ruta, bytes] of Object.entries(e.data.archivos)) compilador.mapShadow(ruta, bytes);
    } else if (accion === 'compilar') {
      const t0 = performance.now();
      const r = await compilador.compile({
        mainFilePath: e.data.principal,
        inputs: e.data.inputs || {},
        format: e.data.formato === 'pdf' ? 1 : 0,
        diagnostics: 'full',
      });
      const errores = (r.diagnostics || []).filter((d) => d.severity === 'Error' || d.severity === 'error' || d.severity === 1);
      if (!r.result) {
        res = { ok: false, errores: (r.diagnostics || []).map(formatear) };
      } else {
        res = { ok: true, bytes: r.result, segundos: (performance.now() - t0) / 1000, avisos: errores.length ? errores.map(formatear) : [] };
        self.postMessage({ id, ok: true, res }, [r.result.buffer]);
        return;
      }
    }
    self.postMessage({ id, ok: true, res });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};

function formatear(d) {
  if (typeof d === 'string') return d;
  const lugar = d.path ? `${d.path.replace(/^\//, '')}${d.range ? ' · ' + d.range : ''}` : '';
  return `${lugar ? lugar + ': ' : ''}${d.message || JSON.stringify(d)}`;
}
