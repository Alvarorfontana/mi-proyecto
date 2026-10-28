# Taller editorial

Sistema para maquetar libros a partir de texto en Markdown. Genera el **interior en PDF listo para imprenta**, la **tapa completa** (contratapa, lomo, tapa y solapas, con sangrado) y un **EPUB**. Todo es gratuito: [Typst](https://typst.app) compone las páginas y [pandoc](https://pandoc.org) convierte los textos.

El primer libro es **CRUZAR** (`libros/cruzar/`).

## Cómo funciona

```
libros/cruzar/
├── libro.toml          ← medidas, tipografía, estilos, orden de capítulos, tapa
├── indice.toml         ← términos del índice analítico (las páginas se calculan solas)
├── texto/              ← un archivo .md por capítulo: acá se corrige
├── imagenes/  mapas/   ← fotos y mapas
├── tapa/               ← textos de contratapa y solapas, imagen de tapa
└── salida/             ← interior.pdf, tapa.pdf, tapa-guias.pdf, libro.epub
```

Corregís un `.md`, volvés a armar, y el libro se recompone entero en unos segundos: notas, numeración de secciones, índice general, índice analítico, cornisas y lomo se actualizan solos.

## Instalar (una sola vez)

1. **Typst** 0.13 o más nuevo: <https://github.com/typst/typst/releases> (en Mac: `brew install typst`; en Windows: `winget install --id Typst.Typst`).
2. **pandoc** 3.1 o más nuevo: <https://pandoc.org/installing.html>.
3. **Python** 3.11 o más nuevo, y opcionalmente `pip install pypdf`.

Sin instalar nada: si subís el repo a GitHub, cada cambio arma los PDF solo (pestaña **Actions** → última corrida → **Artifacts**).

## Usarlo online, sin instalar nada (GitHub Codespaces)

En la página del repo en GitHub: **Code → Codespaces → Create codespace on main**. La primera vez tarda un par de minutos porque instala Typst y pandoc. Después se abre solo el **panel** en una pestaña nueva; si no se abre, entrá a la pestaña **Ports** y abrí el puerto 8000.

Lo que cambiás en el panel queda en el Codespace. Para guardarlo en GitHub: en la barra izquierda, **Source Control → escribir un mensaje → Commit → Sync**. Al subirlo, GitHub Actions arma solo el PDF, la tapa y el EPUB (pestaña **Actions → Artifacts**).

Gratis: 60 horas por mes. Cerrá el Codespace cuando no lo uses (se apaga solo a los 30 minutos sin actividad).

## El panel (lo más cómodo)

```bash
python panel/servidor.py
```

O doble clic en `abrir-panel.command` (Mac) o `abrir-panel.bat` (Windows). Se abre en el navegador, en `http://localhost:8000`, y todo queda en tu compu.

- **Texto**: la lista de capítulos y partes (subir, bajar, quitar, agregar), un editor con botones para cursiva, notas, secciones, citas, epígrafes, leyendas, fotos, mapas y tablas, y la **vista previa con las páginas reales** al lado. Se actualiza sola mientras escribís. `Ctrl+S` guarda.
- **Estilos**: datos del libro, medida, márgenes, tipografías, cuerpo, interlineado, cornisas, folio, color. «Guardar y ver páginas» muestra el capítulo abierto con los cambios.
- **Tapa**: papel, solapas, sangrado, colores, imagen y textos, con la tapa completa a la vista (corte, pliegues y zona segura).
- **Producción**: arma el PDF de imprenta, la tapa y el EPUB; avisa lo que falta antes de imprenta (notas sin texto, imágenes que no están, ISBN); y el simulador de páginas, con un botón para aplicar la combinación elegida.

## Armar el libro (desde la terminal)

```bash
python herramientas/construir.py cruzar            # interior + tapa
python herramientas/construir.py cruzar --epub     # además, EPUB
python herramientas/construir.py cruzar --set formato=15x23 --set cuerpo=11pt --set interlineado=14.5pt
```

`--set` prueba un cambio sin tocar el `libro.toml`.

## Cuántas páginas da cada medida

```bash
python herramientas/probar_medidas.py cruzar --objetivo 500
python herramientas/probar_medidas.py cruzar --formatos 14x21 15x23 --cuerpos 11/14.5 12/16 --fuentes "EB Garamond" "Source Serif 4"
```

Compone el libro con cada combinación y muestra páginas y ancho de lomo. Sirve para decidir medida y cuerpo antes de recortar texto.

## Escribir en los .md

| Quiero… | Escribo |
|---|---|
| Título de capítulo (con bajada) | `# Venezuela — Una crisis regional…` (lo que va después de « — » sale como subtítulo) |
| Sección (se numera sola: 3.1, 3.2…) | `## La salida no admite una explicación única` |
| Subsección | `### El México-Embudo` |
| Sección sin número | `## Coda {.sin-numero}` |
| Cursiva | `*Infobae*` |
| Nota al pie | `texto.[^1]` y abajo `[^1]: Fuente…` (la numeración final la pone el sistema) |
| Foto | `![Pie de foto](imagenes/foto.jpg){ancho=80%}` |
| Mapa | `![Rutas por el Darién](mapas/darien.png){.mapa fuente="IGN"}` |
| Mapa a página entera | `![…](mapas/x.png){.mapa pagina=completa}` |
| Mapa apaisado (girado, página propia) | `![…](mapas/x.svg){.mapa apaisado=si}` |
| Pie chico de cuadro o mapa | `::: leyenda` … `:::` |
| Imagen a sangre (sin márgenes) | `![](imagenes/x.jpg){sangrado=si}` |
| Epígrafe | `::: epigrafe` … `:::` |
| Cita larga | `> texto` o `::: cita` … `:::` |
| Recuadro | `::: recuadro` … `:::` |
| Separador | `---` |

Las fotos y mapas flotan arriba o abajo de la página más cercana para no dejar huecos. Los mapas de CRUZAR están en SVG (vectorial: se ven nítidos a cualquier tamaño). Para fotos, usá imágenes de 300 dpi al tamaño de impresión (para 17 cm de ancho, unos 2000 px).

## Cambiar el aspecto (libro.toml)

- **Formato**: `preset = "15x23"` (ver `plantilla/presets.toml`: 11×17, 13×20, 14×21, 15×23, 16×23, 17×24, A5, 6×9 in) o `ancho`/`alto` a mano. Márgenes interior, exterior, superior e inferior.
- **Tipografía**: fuente de texto, de títulos y de apoyo; cuerpo, interlineado, notas, sangría, justificado, partición en castellano. Incluidas (licencia libre): EB Garamond, Source Serif 4, Libertinus Serif, Inter. Para sumar otra, copiá los `.otf`/`.ttf` a `fuentes/`.
- **Estilo**: capítulos en página impar, numeración de secciones, notas que reinician por capítulo, qué va en cada cornisa, posición del folio, color de acento, índice analítico y colofón.
- **Estructura**: el orden de `[[contenido]]` es el orden del libro. Tipos: `preliminar`, `parte`, `capitulo`, `interludio` (capítulo sin número dentro del cuerpo, como el de Francisco) y `final`. Para **fusionar o mover capítulos** se mueven o borran entradas; los números de capítulo, secciones y notas se recalculan.

## La tapa

`construir.py` cuenta las páginas del interior y calcula el lomo: `páginas ÷ 2 × espesor de la hoja + cartulina`. El espesor sale del papel elegido (`papel = "obra-80"`, `"bookcel-65"`, etc.). **Antes de imprimir, confirmá el espesor con la imprenta.**

- `tapa.pdf` es el archivo para imprenta: solapa + contratapa + lomo + tapa + solapa, con 3 mm de sangrado.
- `tapa-guias.pdf` muestra en colores el corte, los pliegues y la zona segura, con las medidas de cada panel. Es para revisar, no para mandar.
- Sin solapas: `solapa = "0mm"`. Con foto: `imagen = "tapa/foto.jpg"`. Si cargás el ISBN, el código de barras EAN-13 se genera solo.

## Un libro nuevo

Copiá `libros/cruzar` como `libros/otro-libro`, cambiá `libro.toml`, reemplazá los textos y corré `python herramientas/construir.py otro-libro`.
