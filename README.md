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

## La página web (sin instalar nada)

En `web/` está el taller como página independiente: corre entera en el navegador, con el mismo motor (Typst) que arma el libro.

- **Ingreso**: con una clave de GitHub (token) que tenga permiso de *Contents* y *Actions* sobre este repo. Queda guardada solo en tu navegador.
- **Texto**: índice de capítulos y partes, editor con buscar y reemplazar, y las páginas enfrentadas con marcas de corte, actualizadas mientras escribís.
- **Estilos**: medida, márgenes, letras (con muestra), cuerpo, interlineado, cornisas.
- **Tapa**: tres diseños (clásica, editorial, tipográfica), colores, letra del título, papel y solapas, con la tapa completa a la vista.
- **Producción**: arma el PDF de imprenta y la tapa en el navegador (unos 15 segundos para CRUZAR), avisos antes de imprenta, armado en GitHub (con EPUB) y simulador de páginas.
- **Asistente**: condensa, corrige, mejora la fluidez y busca repeticiones con Groq (plan gratuito; la clave se crea en console.groq.com/keys).
- **Guardar** sube los cambios directo al repo.

### Publicarla en Vercel (gratis)

1. En vercel.com → **Add New → Project** → importá este repositorio.
2. En **Root Directory** elegí `web`. Vercel detecta Vite solo.
3. **Deploy**. Cada cambio que subas al repo vuelve a publicar la página.

Para probarla en una compu: `cd web && npm install && npm run dev`.

Las tipografías se toman de `fuentes/`. Si sumás una, corré `python herramientas/catalogo_fuentes.py` para que la página la reconozca.

## Usarlo en GitHub Codespaces

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
- **Diseños de interior** (pestaña Estilos de la web): Clásico, Literario, Ensayo moderno, Académico, Periodístico, Contemporáneo, Manual y Novela. Cada uno trae su combinación de letras, cuerpo, interlineado y apertura de capítulo; un clic los aplica y después se ajusta a mano.
- **Apertura de capítulo** (`apertura`): `clasica`, `centrada`, `numero` (número gigante de color), `filete`, `banda` (banda de color a sangre, al estilo Orange Book) y `novela` (sin número, al estilo Wonderous). `secciones_color = true` pinta los números de sección con el color de acento. Ideas tomadas de plantillas libres de Typst (wonderous-book, ilm, Orange Book; licencia MIT-0).
- **Estilo**: capítulos en página impar, numeración de secciones, notas que reinician por capítulo, qué va en cada cornisa, posición del folio, color de acento, índice analítico y colofón.
- **Estructura**: el orden de `[[contenido]]` es el orden del libro. Tipos: `preliminar`, `parte`, `capitulo`, `interludio` (capítulo sin número dentro del cuerpo, como el de Francisco) y `final`. Para **fusionar o mover capítulos** se mueven o borran entradas; los números de capítulo, secciones y notas se recalculan.

## La tapa

`construir.py` cuenta las páginas del interior y calcula el lomo: `páginas ÷ 2 × espesor de la hoja + cartulina`. El espesor sale del papel elegido (`papel = "obra-80"`, `"bookcel-65"`, etc.). **Antes de imprimir, confirmá el espesor con la imprenta.**

- `tapa.pdf` es el archivo para imprenta: solapa + contratapa + lomo + tapa + solapa, con 3 mm de sangrado.
- `tapa-guias.pdf` muestra en colores el corte, los pliegues y la zona segura, con las medidas de cada panel. Es para revisar, no para mandar.
- **Doce diseños** (`estilo`): `clasica`, `editorial`, `tipografica`, `minimalista`, `coleccion`, `dos-tintas`, `marco`, `cruce`, `centrada`, `foto`, `suiza` y `generativa` (arte geométrico creado con las letras del título, adaptado del generador 10PRINT de la NYPL, `mgiraldo/tenprintcover-py`, MIT). En la web cada diseño muestra una miniatura real de tu tapa, y hay diez paletas de color listas para aplicar.
- Colores: `fondo`, `color_texto`, `color_acento` y `color_secundario`. Para el diseño Colección: `coleccion` y `numero`.
- **Textos de tapa**: en la web se editan el título de tapa (con `|` para cortar la línea), el subtítulo, y los textos de contratapa y solapas, sin salir de la pestaña. Se puede ocultar el subtítulo, el autor o la editorial.
- **Fotos**: el botón «Subir» manda la foto a `libros/<libro>/tapa/` en GitHub (si es muy grande la achica a 4200 px). Sirve para la foto de tapa, la de contratapa y la del autor.
- **Textos y fotos libres**: frases, sellos («Nuevo», «Prólogo de…»), logos o fotos en cualquier cara (tapa, contratapa, lomo o solapas), con posición, tamaño, letra, color, recuadro, giro y esquinas redondeadas. Quedan en `tapa/elementos.json`.
- **Arrastrar**: en la vista de la tapa, los textos y fotos agregados tienen un recuadro celeste. Se arrastran con el mouse (si se sueltan en otra cara, se mudan a esa cara) y la bolita de la esquina cambia el tamaño.
- **Solapas**: foto del autor rectangular o redonda, con tamaño y crédito; tamaño de letra de solapas y contratapa; color propio para solapas y lomo; logo de la editorial (va en el lomo, la contratapa y la solapa trasera).
- **Código de barras**: EAN-13 del ISBN con verificación del dígito de control (la web avisa si está mal y convierte un ISBN de 10 cifras), agregado EAN-5 opcional para el precio (`codigo_precio`, `90000` = sin precio), precio impreso y posición (derecha, izquierda o centro).
- Sin solapas: `solapa = "0mm"`. Con foto: `imagen = "tapa/foto.jpg"`. Si cargás el ISBN, el código de barras EAN-13 se genera solo.

## Plano de página

En **Estilos**, el panel derecho muestra el **plano**: la página par y la impar lado a lado, con los cuatro márgenes (interior, exterior, superior, inferior) acotados en milímetros, las columnas y su medianil, la cornisa con su línea, el pie y el número de página. Los bordes de la caja de texto se **arrastran con el mouse** y los márgenes cambian en los dos lados (espejados). Abajo muestra la caja de texto, el ancho de columna, los **caracteres por línea** (lo cómodo es entre 45 y 75) y las líneas por página.

Opciones de página: una, dos o tres columnas; separación entre columnas; línea bajo la cornisa y sobre el pie; número de página abajo afuera, abajo al centro o arriba junto a la cornisa.

**Cortes de palabra**: normales, pocos (Typst penaliza más los guiones) o ninguno. **Viudas y huérfanas**: evita renglones sueltos al pie o al tope de una página y finales de párrafo de una sola palabra.

## Índice

- **Índice general**: se arma solo con los títulos (`#`) y secciones (`##`, y `###` si se elige) de cada capítulo, en el orden del libro, con puntos guía opcionales. El título no se corta en sílabas y el número de página queda alineado.
- **Índice en vivo**: en la pestaña Texto, el panel «Índice» muestra cómo va quedando, con páginas aproximadas; un clic abre el capítulo.
- **Índice analítico**: «Sugerir términos del texto» encuentra nombres propios, lugares y organismos que se repiten y no están en `indice.toml`; se eligen y se agregan con un clic.

## Citas

En la pestaña Texto, el panel **Citas** busca la fuente de lo que marques en el editor:

- **Libros y artículos**: OpenAlex y Crossref (bases abiertas y gratuitas de publicaciones académicas, con DOI).
- **Wikipedia**.
- **Google (con Gemini)**: busca la fuente original de un dato (organismos, estudios, diarios) y devuelve los enlaces.

La referencia sale en APA 7, Chicago o ISO 690 y se inserta como **nota al pie** (y, si se quiere, también en la bibliografía del capítulo). «Buscar enlaces para las notas» revisa las notas que no tienen link ni DOI, busca la obra que citan y propone agregar el enlace.

## PDF, impresión e imprenta

- **Capítulo suelto**: el botón «PDF» arriba de las páginas descarga o imprime el capítulo abierto, con la medida real del libro (para revisar en papel, imprimir en A4 con «Tamaño real»).
- **Libro completo**: en Producción, «Armar acá» da el interior, la tapa y la tapa con guías; cada uno tiene su botón de descargar y de imprimir.
- **CMYK**: al armar en GitHub, además de los PDF en RGB salen `interior-cmyk.pdf` y `tapa-cmyk.pdf` (convertidos con Ghostscript), que es lo que suelen pedir las imprentas. Igual conviene pedirle a la imprenta una prueba de color.

## Pegar texto (del bloc de notas al libro)

El botón **Pegar texto** (abajo del índice) arma capítulos solos a partir de un texto pegado o de un `.txt`/`.md`, **sin límite de largo**: todo se procesa en el navegador.

1. **Antes de pegar** se eligen las variables: diseño del interior, medida y si va como capítulos nuevos o reemplaza el capítulo abierto.
2. **Al pegar**, el taller reconoce:
   - títulos de capítulo («Capítulo 3», «CAPÍTULO 2: EL DARIÉN», «Prólogo», «Título — bajada», renglones cortos en mayúsculas) y de sección;
   - partes («PARTE I» con su nombre);
   - notas al pie numeradas, ya sea en una sección «Notas» o al final del capítulo, con las llamadas en el texto como `palabra.12`, `palabra¹²`, `[12]` o `(12)`. Se convierten en notas al pie de verdad;
   - bibliografía («Bibliografía», «Referencias», «Fuentes»), con sangría francesa;
   - epígrafes (líneas cortas al comienzo con «— Autor»);
   - renglones cortados de un PDF copiado (los une y arregla las palabras partidas con guion).
3. **Antes de crear**, muestra cómo lo va a armar: capítulos, partes, notas, y avisa si alguna nota no encontró su llamada (queda al final del capítulo para ubicarla a mano). Los títulos se pueden corregir ahí.

## Dictado por voz

El botón **Dictar** de la barra del editor escribe lo que decís donde está el cursor. Entiende «coma», «punto», «punto y aparte», «nuevo párrafo», «dos puntos», «punto y coma», «abrir/cerrar comillas», «abrir/cerrar pregunta», «abrir/cerrar exclamación», «abrir/cerrar paréntesis» y «raya». Usa el reconocimiento del navegador (gratis, en vivo, en Chrome y Edge) o, si está cargada la clave de Groq, **Whisper** (más preciso; transcribe cada 25 segundos). Después se pule con la Revisión.

## Corrección del texto

En la pestaña Texto, el panel **Revisión** tiene tres correctores:

- El subrayado ortográfico del navegador mientras escribís (se apaga con una casilla).
- **LanguageTool** (gratis, sin clave): ortografía, gramática, puntuación y estilo. Subraya en rojo, azul o amarillo y propone la corrección; un clic la aplica.
- **Revisión con IA** (Gemini o Groq): lee el capítulo como un corrector de estilo y devuelve observaciones con su sugerencia, en la misma lista.

El panel **Asistente** no tiene límite de largo: si el texto es más grande de lo que el modelo acepta de una vez, lo trabaja por tramos. Usa Gemini (clave gratis en aistudio.google.com/apikey) o Groq (console.groq.com/keys) para condensar, corregir, mejorar la fluidez, buscar repeticiones, sugerir títulos o resumir. Las claves quedan guardadas solo en tu navegador.

## Un libro nuevo

Copiá `libros/cruzar` como `libros/otro-libro`, cambiá `libro.toml`, reemplazá los textos y corré `python herramientas/construir.py otro-libro`.
