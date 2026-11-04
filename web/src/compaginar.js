// Compaginación: miniaturas de todas las páginas del libro (con pdf.js), en pliegos, con capítulos marcados.
import * as pdfjs from 'pdfjs-dist';
import trabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = trabajador;

export async function abrirPdf(bytes) {
  return pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
}

// Páginas donde empieza cada entrada del marcador (capítulos y partes que Typst exporta como índice del PDF).
export async function marcadores(doc) {
  const out = [];
  const recorrer = async (items, nivel) => {
    for (const it of items || []) {
      try {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (Array.isArray(dest)) out.push({ titulo: it.title, nivel, pagina: (await doc.getPageIndex(dest[0])) + 1 });
      } catch {}
      if (nivel < 1) await recorrer(it.items, nivel + 1);
    }
  };
  await recorrer(await doc.getOutline(), 0);
  return out.sort((a, b) => a.pagina - b.pagina);
}

export async function dibujarPagina(doc, n, canvas, ancho) {
  const p = await doc.getPage(n);
  const v0 = p.getViewport({ scale: 1 });
  const escala = (ancho * (window.devicePixelRatio || 1)) / v0.width;
  const v = p.getViewport({ scale: escala });
  canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
  canvas.style.width = ancho + 'px'; canvas.style.height = Math.round(ancho * v0.height / v0.width) + 'px';
  await p.render({ canvasContext: canvas.getContext('2d'), viewport: v }).promise;
  // ¿página en blanco? (sirve para marcar las blancas de compaginación)
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let tinta = 0; for (let i = 0; i < d.length; i += 64) if (d[i] < 200) tinta++;
  return tinta < 3;
}
