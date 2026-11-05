// Imágenes de tapa con IA: arma prompts precisos según las medidas reales y genera con
// Pollinations (gratis, sin clave) o Gemini (requiere plan pago de la API). También sirve
// para copiar el prompt y usarlo en ChatGPT o en la app de Gemini.

export const ESTILOS_IMAGEN = {
  documental: 'documentary photograph, natural light, photojournalism, 35mm, authentic, subtle film grain',
  cinematografica: 'cinematic photograph, dramatic light, shallow depth of field, rich atmosphere',
  ilustracion: 'editorial illustration, flat shapes, limited palette, textured paper, modern book cover art',
  acuarela: 'loose watercolor painting on cotton paper, soft washes, visible paper texture',
  grabado: 'woodcut / linocut print, bold carved lines, two-tone, hand-printed texture',
  collage: 'mixed media collage, torn paper, archival photographs, halftone textures, layered composition',
  minimalista: 'minimalist conceptual image, one strong symbolic object, lots of negative space, clean',
  abstracta: 'abstract geometric composition, bold color fields, Bauhaus-inspired, no figurative elements',
};
export const ENCUADRES = {
  tapa: { nombre: 'Foto de tapa', guia: 'vertical book front cover image; keep the upper third calm and uncluttered for the title, and the bottom area simple for the author name; main subject in the middle third' },
  envolvente: { nombre: 'Envolvente (contratapa + lomo + tapa)', guia: 'wide wraparound book cover image; the right half is the front cover with the main subject, the left half is the back cover and must be calm and low-detail so text can be read over it; a vertical strip in the exact center is the spine and must contain no important detail' },
  contratapa: { nombre: 'Fondo de contratapa', guia: 'soft, low-contrast background texture for a book back cover, so dark or light text can be read on top; no focal point' },
};

// Arma el prompt (en inglés: los modelos de imagen responden mejor) con las restricciones de imprenta.
export function armarPrompt({ idea, estilo, encuadre, colores = [], ancho, alto, extra = '' }) {
  const proporcion = (ancho / alto).toFixed(3);
  return [
    `${ENCUADRES[encuadre].guia}.`,
    `Subject and mood: ${idea.trim()}.`,
    `Visual style: ${ESTILOS_IMAGEN[estilo]}.`,
    colores.length ? `Color palette harmonizing with ${colores.join(', ')}.` : '',
    `Aspect ratio ${proporcion}:1 (${Math.round(ancho)} × ${Math.round(alto)} mm including 3 mm bleed). Important elements at least 8 mm away from every edge.`,
    'Absolutely no text, no letters, no words, no numbers, no logos, no watermarks, no borders, no frames, no mockup — the typography is added later.',
    'Print quality, high detail, sharp focus, balanced composition.',
    extra,
  ].filter(Boolean).join(' ');
}

// Pollinations: gratis, sin clave, una imagen cada ~15 s. Devuelve un Blob.
// El plan sin cuenta agrega una marca de agua abajo: se pide la imagen un poco más alta y se recorta esa franja.
export async function generarPollinations(prompt, { ancho, alto, semilla = Math.floor(Math.random() * 1e6) }, avisar = () => {}) {
  const lado = 1536;
  const w = ancho >= alto ? lado : Math.round(lado * ancho / alto), h = ancho >= alto ? Math.round(lado * alto / ancho) : lado;
  const hPedido = Math.round(h / 0.92);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${hPedido}&seed=${semilla}&nologo=true&model=flux`;
  let r, error = '';
  for (let intento = 0; intento < 4; intento++) {
    try {
      r = await fetch(url);
      if (r.ok) break;
      error = r.status === 429 ? 'Pollinations pide esperar entre imágenes.' : 'Pollinations respondió ' + r.status;
    } catch { error = 'No se pudo conectar con Pollinations.'; r = null; }
    if (intento < 3) { avisar(`${error} Reintento en 20 segundos…`); await new Promise((ok) => setTimeout(ok, 20000)); }
  }
  if (!r || !r.ok) throw new Error(error + ' Probá de nuevo en un minuto.');
  const original = await r.blob();
  try {
    const bmp = await createImageBitmap(original);
    const corte = Math.round(bmp.height * 0.92); // sin la franja de abajo (marca de agua)
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, bmp.width, corte, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.93));
    return { blob: blob || original, ancho: w, alto: h, origen: 'Pollinations (FLUX)' };
  } catch {
    return { blob: original, ancho: w, alto: h, origen: 'Pollinations (FLUX)' };
  }
}

const PROPORCIONES = [['1:1', 1], ['2:3', 2 / 3], ['3:4', 3 / 4], ['4:5', 4 / 5], ['9:16', 9 / 16], ['3:2', 3 / 2], ['4:3', 4 / 3], ['5:4', 5 / 4], ['16:9', 16 / 9], ['21:9', 21 / 9]];
export async function generarGemini(prompt, clave, { ancho, alto, modelo = 'gemini-2.5-flash-image' }) {
  const r0 = ancho / alto;
  const ar = PROPORCIONES.reduce((a, b) => (Math.abs(b[1] - r0) < Math.abs(a[1] - r0) ? b : a))[0];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(clave)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ar } } }),
  });
  if (!r.ok) {
    let m = r.status; try { m = (await r.json()).error?.message || m; } catch {}
    if (r.status === 429 || /quota|billing|free tier/i.test(String(m))) throw new Error('Gemini no genera imágenes en el plan gratuito de la API: hace falta activar la facturación en Google AI Studio. Mientras tanto usá Pollinations o copiá el prompt en la app de Gemini o ChatGPT.');
    throw new Error('Gemini respondió: ' + m);
  }
  const j = await r.json();
  const parte = (j.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData);
  if (!parte) throw new Error('Gemini no devolvió una imagen (puede haberla bloqueado por contenido). Probá con otra idea.');
  const bin = atob(parte.inlineData.data); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: parte.inlineData.mimeType || 'image/png' }), origen: 'Gemini (' + ar + ')' };
}
