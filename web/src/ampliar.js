// Ampliador de imágenes con IA (ESRGAN, de UpscalerJS, licencia MIT), en el navegador y sin servidores.
// El modelo pesa menos de 1 MB y se sirve desde la propia página (public/modelos-ia).
let motor = null;
async function cargar(escala) {
  const [{ default: Upscaler }, tf] = await Promise.all([import('upscaler'), import('@tensorflow/tfjs')]);
  await tf.ready();
  const def = escala === 2 ? (await import('@upscalerjs/esrgan-slim/2x')).default : (await import('@upscalerjs/esrgan-slim/4x')).default;
  return new Upscaler({ model: { ...def, path: `/modelos-ia/esrgan-slim/x${escala}/model.json` } });
}
// Agranda un Blob de imagen ×2 o ×4 y devuelve un Blob JPEG. alProgreso(0..1)
export async function ampliarImagen(blob, { escala = 4, alProgreso = () => {} } = {}) {
  if (!motor || motor.escala !== escala) motor = { escala, up: await cargar(escala) };
  const url = URL.createObjectURL(blob);
  const img = new Image(); img.src = url; await img.decode();
  const salida = await motor.up.upscale(img, { patchSize: 64, padding: 4, output: 'base64', progress: (p) => alProgreso(p) });
  URL.revokeObjectURL(url);
  const r = await fetch(salida);
  // pasar a JPEG de alta calidad para que no pese tanto
  const bmp = await createImageBitmap(await r.blob());
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  return { blob: await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.93)), ancho: c.width, alto: c.height };
}
