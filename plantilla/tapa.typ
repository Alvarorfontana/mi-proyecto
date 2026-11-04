// ═════════════════════════════════════════════════════════════
//  Taller editorial — tapa completa (solapa · contratapa · lomo · tapa · solapa)
//  El lomo llega calculado desde construir.py según páginas y papel.
//  --input guias=si muestra pliegues, corte y zona segura (para revisar, no para imprenta).
// ═════════════════════════════════════════════════════════════
#import "/plantilla/estilos.typ": LIB, FORMATO, TIPO, RAIZ, _cfg, _len, url, plano

#let T = _cfg.at("tapa", default: (:))
#let guias = sys.inputs.at("guias", default: "no") == "si"
#let paginas = int(sys.inputs.at("paginas", default: "200"))
#let lomo = _len(sys.inputs.at("lomo", default: "12mm"))
#let sangre = _len(T.at("sangrado", default: "3mm"))
#let solapa = _len(T.at("solapa", default: "0mm"))
#let pliegue = if solapa > 0mm { _len(T.at("pliegue_solapa", default: "3mm")) } else { 0mm }
#let W = FORMATO.ancho
#let H = FORMATO.alto
#let _ti(k, d) = sys.inputs.at(k, default: T.at(k, default: d))
#let fondo = rgb(_ti("fondo", "#1d2a33"))
#let tinta = rgb(_ti("color_texto", "#f4efe6"))
#let acento = rgb(_ti("color_acento", "#d9a441"))
#let segundo = rgb(_ti("color_secundario", acento.darken(35%).to-hex()))
#let solo-tapa = sys.inputs.at("solo_tapa", default: "no") == "si"   // solo la tapa, sin sangrado (miniaturas)
#let coleccion = _ti("coleccion", "")
#let numero-col = str(_ti("numero", ""))
#let seguro = 6mm   // zona segura: nada importante más cerca del corte
#let estilo-tapa = sys.inputs.at("estilo_tapa", default: T.at("estilo", default: "clasica"))
// clasica | editorial | tipografica | minimalista | coleccion | dos-tintas | marco | cruce | centrada | foto | suiza | generativa
#let fuente-tapa = _ti("fuente_titulo", TIPO.titulos)

// posiciones horizontales (desde el borde izquierdo del papel, con sangrado)
#let x-solapa-tras = sangre
#let x-contra = sangre + solapa + pliegue
#let x-lomo = x-contra + W
#let x-tapa = x-lomo + lomo
#let x-solapa-del = x-tapa + W + pliegue
#let ancho-total = x-solapa-del + solapa + sangre
#let alto-total = H + 2 * sangre
// en modo solo_tapa todo se corre para que la tapa quede en el origen
#let ox = if solo-tapa { -x-tapa } else { 0pt }
#let oy = if solo-tapa { -sangre } else { 0pt }

#let _bloque(ruta) = {
  // los textos de tapa se convierten desde Markdown en _build/
  include RAIZ + "_build/" + ruta
}

#set document(title: LIB.titulo + " — tapa", author: LIB.autor)
#set page(width: if solo-tapa { W } else { ancho-total }, height: if solo-tapa { H } else { alto-total }, margin: 0pt, fill: fondo)
#set text(font: (TIPO.fuente, "Libertinus Serif"), lang: "es", fill: tinta, hyphenate: true)
#set par(justify: true, leading: 0.5em, first-line-indent: 0pt, spacing: 0.9em)

#let panel(x, ancho, cuerpo) = place(top + left, dx: x + ox, dy: sangre + oy, block(width: ancho, height: H, cuerpo))
// coordenadas relativas al corte de la tapa (0,0 = arriba a la izquierda, junto al lomo)
#let en-tapa(dx, dy, cuerpo) = place(top + left, dx: x-tapa + dx + ox, dy: sangre + dy + oy, cuerpo)
// cuánto se extiende un fondo de tapa hacia la derecha (sangrado, o el pliegue si hay solapa)
#let ext-der = if solapa > 0mm { pliegue } else { sangre }

// ── imagen de tapa (opcional, a sangre) ──
#if _ti("imagen", "") != "" {
  place(top + left, dx: x-tapa + ox, dy: oy, image(RAIZ + _ti("imagen", ""), width: W + ext-der, height: alto-total, fit: "cover"))
}
#if T.at("imagen_contratapa", default: "") != "" and not solo-tapa {
  place(top + left, dx: 0pt, dy: 0pt, image(RAIZ + T.imagen_contratapa, width: x-lomo, height: alto-total, fit: "cover"))
}

// ── la línea que cruza contratapa, lomo y tapa (estilo clásico) ──
#let y-linea = sangre + H * 0.56
#if estilo-tapa == "clasica" {
  place(top + left, dx: x-contra + ox, dy: y-linea + oy, line(length: W * 2 + lomo, stroke: 0.8pt + acento))
}

// ── TAPA ──
// Once diseños. Ideas tomadas de tapas clásicas de colección, del estilo suizo
// y del generador 10PRINT de la NYPL (mgiraldo/tenprintcover-py, licencia MIT).
#let _mostrar(k) = _ti("mostrar_" + k, true) in (true, "true", "si")
#let _o(k, d) = { let v = _ti(k, ""); if v == "" { d } else { v } }   // vacío = el del libro
#let sub = if _mostrar("subtitulo") { _o("subtitulo", LIB.at("subtitulo", default: "")) } else { "" }
#let ed = if _mostrar("editorial") { LIB.at("editorial", default: "") } else { "" }
#let autor-t = if _mostrar("autor") { LIB.autor } else { "" }
#let anio = str(LIB.at("anio", default: ""))
// el título de tapa puede cortarse en líneas con «|»
#let titulo-t = _o("titulo", LIB.titulo)
#let titulo-c = titulo-t.split("|").map(x => x.trim()).join("\n")
// tamaño del título según la palabra más larga, para que nunca desborde
#let tam-titulo(ancho, maximo, factor: 1.55) = {
  let largo = calc.max(..titulo-t.split(regex("[ |]")).map(p => p.clusters().len()), 1)
  calc.min(maximo, ancho / largo * factor)
}
#let titulo(tam, peso: "semibold", fill: tinta, tracking: 0em, estilo: "normal", fuente: fuente-tapa, alin: left) = {
  set par(justify: false, leading: 0.18em)
  set align(alin)
  text(font: fuente, size: tam, weight: peso, style: estilo, hyphenate: false, tracking: tracking, top-edge: "cap-height", bottom-edge: "baseline", fill: fill, titulo-c.split("\n").join(linebreak()))
}
#let bajada(tam, fill: tinta, ancho: 100%, alin: left, estilo: "italic", fuente: fuente-tapa) = if sub != "" {
  block(width: ancho, { set par(justify: false, leading: 0.45em); set align(alin); text(font: fuente, size: tam, style: estilo, hyphenate: false, fill: fill)[#sub] })
}
#let versal(t, tam, fill: tinta, tracking: 0.28em, peso: "medium") = text(font: TIPO.apoyo, size: tam, tracking: tracking, weight: peso, fill: fill)[#upper(t)]
// fondo a sangre de la tapa (o de una franja de ella)
#let franja(dy, alto, color, arriba: false, abajo: false) = {
  let y0 = if arriba { -sangre } else { dy }
  let h = alto + (if arriba { sangre } else { 0pt }) + (if abajo { sangre } else { 0pt })
  en-tapa(0pt, y0, rect(width: W + ext-der, height: h, fill: color, stroke: none))
}

#if estilo-tapa == "editorial" {
  panel(x-tapa, W, pad(x: 16mm, top: 18mm, bottom: 16mm, grid(rows: (auto, 1fr, auto), {
    grid(columns: (1fr, auto), versal(ed, 7pt, fill: tinta.transparentize(35%), tracking: 0.3em, peso: "regular"), text(font: TIPO.apoyo, size: 7pt, fill: tinta.transparentize(35%))[#anio])
  }, align(horizon, {
    line(length: 16mm, stroke: 1.2pt + acento)
    v(10mm)
    titulo(tam-titulo(W - 32mm, 50pt))
    v(7mm)
    bajada(16pt, fill: tinta.transparentize(15%), ancho: 88%)
    v(12mm)
    line(length: 32mm, stroke: 0.5pt + tinta.transparentize(60%))
    v(6mm)
    versal(autor-t, 9pt, fill: acento, tracking: 0.25em)
  }), {
    set text(font: TIPO.apoyo, size: 6.5pt, tracking: 0.08em, fill: tinta.transparentize(45%))
    grid(columns: (1fr, auto), LIB.at("edicion", default: ""), if LIB.at("isbn", default: "") != "" [ISBN #LIB.isbn])
  })))
} else if estilo-tapa == "tipografica" {
  franja(H * 0.8, H * 0.2, acento, abajo: true)
  en-tapa(14mm, 16mm, block(width: W - 28mm, {
    titulo(tam-titulo(W - 28mm, 96pt), peso: "bold", tracking: -0.01em)
    v(8mm)
    bajada(17pt)
  }))
  en-tapa(14mm, H * 0.8 + 12mm, versal(autor-t, 10pt, fill: fondo, tracking: 0.25em, peso: "bold"))
  en-tapa(14mm, H - 14mm, versal(ed, 7pt, fill: fondo, tracking: 0.3em, peso: "regular"))
} else if estilo-tapa == "minimalista" {
  // mucho aire: título chico en el tercio superior, un punto de color
  en-tapa(0pt, H * 0.24, block(width: W, align(center, {
    titulo(tam-titulo(W - 50mm, 30pt, factor: 1.3), peso: "regular", tracking: 0.12em, alin: center)
    v(7mm)
    circle(radius: 2.2mm, fill: acento, stroke: none)
    v(7mm)
    block(width: 70%, bajada(11pt, alin: center, fill: tinta.transparentize(20%)))
  })))
  en-tapa(0pt, H - 30mm, block(width: W, align(center, versal(autor-t, 8pt, tracking: 0.35em, peso: "regular"))))
  en-tapa(0pt, H - 16mm, block(width: W, align(center, versal(ed, 6pt, tracking: 0.35em, peso: "regular", fill: tinta.transparentize(45%)))))
} else if estilo-tapa == "coleccion" {
  // tapa de colección: franja de color arriba con sello y número, título en caja
  let alto-f = H * 0.3
  franja(0pt, alto-f, acento, arriba: true)
  en-tapa(14mm, 13mm, block(width: W - 28mm, grid(columns: (1fr, auto), align: (left, right),
    versal(if coleccion != "" { coleccion } else { ed }, 8pt, fill: fondo, peso: "bold"),
    if numero-col != "" { text(font: fuente-tapa, size: 26pt, weight: "bold", fill: fondo)[#numero-col] }
  )))
  en-tapa(14mm, alto-f - 15mm, versal(autor-t, 10pt, fill: fondo, peso: "bold", tracking: 0.2em))
  en-tapa(14mm, alto-f + 16mm, block(width: W - 28mm, {
    titulo(tam-titulo(W - 28mm, 54pt), peso: "bold")
    v(7mm)
    line(length: 22mm, stroke: 2pt + acento)
    v(6mm)
    bajada(15pt, ancho: 92%)
  }))
  en-tapa(14mm, H - 14mm, versal(ed, 7pt, fill: tinta.transparentize(35%), peso: "regular"))
} else if estilo-tapa == "dos-tintas" {
  // mitad de color, mitad fondo, con el título montado sobre el corte
  let corte = H * 0.52
  franja(0pt, corte, acento, arriba: true)
  en-tapa(14mm, 16mm, versal(autor-t, 9pt, fill: fondo, peso: "bold"))
  en-tapa(14mm, 0pt, block(width: W - 28mm, height: corte + 0.5pt, align(bottom + left,
    titulo(tam-titulo(W - 28mm, 80pt, factor: 1.6), peso: "bold", fill: fondo, tracking: -0.01em))))
  en-tapa(14mm, corte + 10mm, block(width: W - 28mm, bajada(16pt, ancho: 90%)))
  en-tapa(14mm, H - 14mm, versal(ed, 7pt, fill: tinta.transparentize(35%), peso: "regular"))
} else if estilo-tapa == "marco" {
  // doble filete y composición centrada, de libro de biblioteca
  en-tapa(9mm, 9mm, rect(width: W - 18mm, height: H - 18mm, stroke: 1.4pt + acento))
  en-tapa(11.5mm, 11.5mm, rect(width: W - 23mm, height: H - 23mm, stroke: 0.5pt + acento))
  en-tapa(0pt, 30mm, block(width: W, align(center, versal(autor-t, 9pt, fill: acento, tracking: 0.3em))))
  en-tapa(0pt, 0pt, block(width: W, height: H, align(center + horizon, {
    titulo(tam-titulo(W - 44mm, 52pt), peso: "regular", tracking: 0.06em, alin: center)
    v(8mm)
    box(width: 30mm, grid(columns: (1fr, auto, 1fr), align: horizon, column-gutter: 3mm, line(length: 100%, stroke: 0.5pt + acento), rotate(45deg, rect(width: 2.4mm, height: 2.4mm, fill: acento, stroke: none)), line(length: 100%, stroke: 0.5pt + acento)))
    v(7mm)
    block(width: W - 50mm, bajada(13pt, alin: center))
  })))
  en-tapa(0pt, H - 28mm, block(width: W, align(center, versal(ed, 7pt, fill: tinta.transparentize(30%), peso: "regular"))))
} else if estilo-tapa == "cruce" {
  // dos franjas diagonales que se cruzan
  let grueso = W * 0.2
  en-tapa(-sangre, -sangre, box(width: W + sangre + ext-der, height: H + 2 * sangre, clip: true, {
    place(center + horizon, rotate(-58deg, rect(width: H * 1.9, height: grueso, fill: acento, stroke: none)))
    place(center + horizon, dy: H * 0.08, rotate(32deg, rect(width: H * 1.9, height: grueso * 0.55, fill: segundo, stroke: none)))
  }))
  en-tapa(14mm, 16mm, block(width: W - 28mm, {
    box(fill: fondo, inset: (x: 3mm, y: 2.5mm), titulo(tam-titulo(W - 34mm, 60pt), peso: "bold"))
  }))
  en-tapa(14mm, H - 44mm, block(width: W * 0.72, box(fill: fondo, inset: (x: 3mm, y: 2.5mm), bajada(13pt))))
  en-tapa(14mm, H - 16mm, box(fill: fondo, inset: (x: 3mm, y: 1.6mm), versal(autor-t, 9pt, peso: "bold")))
} else if estilo-tapa == "centrada" {
  en-tapa(0pt, 22mm, block(width: W, align(center, versal(autor-t, 10pt, tracking: 0.3em))))
  en-tapa(0pt, 0pt, block(width: W, height: H * 0.9, align(center + horizon, {
    titulo(tam-titulo(W - 30mm, 70pt), peso: "bold", alin: center, tracking: 0.02em)
    v(9mm)
    line(length: 40mm, stroke: 0.8pt + acento)
    v(8mm)
    block(width: W - 40mm, bajada(15pt, alin: center))
  })))
  en-tapa(0pt, H - 18mm, block(width: W, align(center, versal(ed, 7pt, fill: acento, peso: "regular"))))
} else if estilo-tapa == "foto" {
  // imagen a sangre (o un degradé si todavía no hay foto) y texto abajo sobre sombra
  if _ti("imagen", "") == "" {
    en-tapa(0pt, -sangre, rect(width: W + ext-der, height: H + 2 * sangre, stroke: none,
      fill: gradient.linear(acento, segundo, fondo, angle: 70deg)))
  }
  en-tapa(0pt, H * 0.45, rect(width: W + ext-der, height: H * 0.55 + sangre, stroke: none,
    fill: gradient.linear(fondo.transparentize(100%), fondo.transparentize(10%), angle: 90deg)))
  en-tapa(14mm, 16mm, versal(autor-t, 9.5pt, peso: "bold"))
  en-tapa(14mm, 0pt, block(width: W - 28mm, height: H - 18mm, align(bottom + left, {
    titulo(tam-titulo(W - 28mm, 64pt), peso: "bold")
    v(6mm)
    bajada(14pt, ancho: 92%)
    v(8mm)
    versal(ed, 7pt, fill: tinta.transparentize(30%), peso: "regular")
  })))
} else if estilo-tapa == "suiza" {
  // grilla suiza: barra vertical de color, todo en palo seco, alineado a la izquierda
  en-tapa(0pt, -sangre, rect(width: 11mm, height: H + 2 * sangre, fill: acento, stroke: none))
  en-tapa(22mm, 18mm, block(width: W - 36mm, grid(columns: (1fr, auto),
    text(font: TIPO.apoyo, size: 10pt, weight: "bold")[#autor-t],
    text(font: TIPO.apoyo, size: 10pt, fill: acento, weight: "bold")[#anio])))
  en-tapa(22mm, 26mm, line(length: W - 36mm, stroke: 0.6pt + tinta))
  en-tapa(22mm, 0pt, block(width: W - 36mm, height: H - 40mm, align(bottom + left, {
    titulo(tam-titulo(W - 36mm, 72pt, factor: 1.45), peso: "black", fuente: TIPO.apoyo, tracking: -0.03em)
    v(7mm)
    bajada(14pt, estilo: "normal", fuente: TIPO.apoyo, ancho: 90%, fill: tinta.transparentize(15%))
  })))
  en-tapa(22mm, H - 22mm, line(length: W - 36mm, stroke: 0.6pt + tinta))
  en-tapa(22mm, H - 16mm, text(font: TIPO.apoyo, size: 8pt, weight: "medium")[#ed])
} else if estilo-tapa == "generativa" {
  // arte generado a partir del título (adaptación del 10PRINT de la NYPL, MIT)
  let alto-arte = calc.min(W, H * 0.62)
  let y-arte = H - alto-arte
  franja(y-arte, alto-arte, acento, abajo: true)
  let letras = titulo-t.replace("|", " ").clusters()
  let n = calc.clamp(int(2 + (letras.len() - 2) * 9 / 58), 3, 11)
  let s = W / n
  let g = s * 0.12
  let formas = (
    (x, y) => place(dx: x, dy: y, circle(radius: s / 2, fill: segundo, stroke: none)),
    (x, y) => place(dx: x + g, dy: y + g, circle(radius: s / 2 - g, fill: none, stroke: 1.6 * g + segundo)),
    (x, y) => place(dx: x, dy: y, polygon(fill: segundo, stroke: none, (0pt, s), (s / 2, 0pt), (s, s))),
    (x, y) => place(dx: x, dy: y, polygon(fill: segundo, stroke: none, (0pt, 0pt), (s / 2, s), (s, 0pt))),
    (x, y) => place(dx: x, dy: y + s / 2 - g, rect(width: s, height: 2 * g, fill: segundo, stroke: none)),
    (x, y) => place(dx: x + s / 2 - g, dy: y, rect(width: 2 * g, height: s, fill: segundo, stroke: none)),
    (x, y) => place(dx: x, dy: y, polygon(fill: segundo, stroke: none, (0pt, s / 2), (s / 2, 0pt), (s, s / 2), (s / 2, s))),
    (x, y) => place(dx: x, dy: y, polygon(fill: segundo, stroke: none, (0pt, 0pt), (s, 0pt), (0pt, s))),
    (x, y) => place(dx: x, dy: y, polygon(fill: segundo, stroke: none, (s, 0pt), (s, s), (0pt, s))),
    (x, y) => { place(dx: x, dy: y, rect(width: s, height: g * 1.6, fill: segundo, stroke: none)); place(dx: x, dy: y, rect(width: g * 1.6, height: s, fill: segundo, stroke: none)) },
    (x, y) => place(dx: x + s * 0.3, dy: y + s * 0.3, circle(radius: s * 0.2, fill: tinta, stroke: none)),
    (x, y) => place(dx: x, dy: y, rect(width: s, height: s, fill: segundo, stroke: none)),
  )
  let codigos = letras.map(c => c.to-unicode())
  en-tapa(0pt, y-arte, box(width: W, height: alto-arte, clip: true, {
    for i in range(n * n) {
      let cod = codigos.at(calc.rem(i, codigos.len()))
      if cod == 32 { continue }
      let f = formas.at(calc.rem(cod + calc.quo(i, codigos.len()), formas.len()))
      f(calc.rem(i, n) * s, calc.quo(i, n) * s)
    }
  }))
  en-tapa(14mm, 16mm, block(width: W - 28mm, height: y-arte - 24mm, {
    versal(autor-t, 9pt, peso: "bold")
    v(1fr)
    titulo(tam-titulo(W - 28mm, 58pt), peso: "bold")
    v(5mm)
    bajada(13pt, ancho: 94%)
  }))
} else {
  // clásica: autor arriba, título sobre la línea que cruza todo el libro
  panel(x-tapa, W, {
    let mx = 16mm
    place(top + left, dx: mx, dy: 22mm, versal(autor-t, 9pt, tracking: 0.3em))
    place(top + left, dx: mx, dy: 0pt, block(width: W - 2 * mx, height: H * 0.56 - 7mm,
      align(bottom + left, titulo(tam-titulo(W - 2 * mx, 58pt), tracking: 0.04em))))
    place(top + left, dx: mx, dy: H * 0.56 + 8mm, bajada(17pt, ancho: (W - 2 * mx) * 0.85))
    place(bottom + left, dx: mx, dy: -14mm, versal(ed, 7.5pt, tracking: 0.3em, peso: "regular"))
  })
}


// ── LOMO ──
#if not solo-tapa { place(top + left, dx: x-lomo, dy: sangre, block(width: lomo, height: H, {
  if lomo >= 6mm {
    set align(center + horizon)
    rotate(90deg, reflow: true, box(width: H - 2 * seguro, height: lomo, align(horizon,
      grid(columns: (1fr, auto, 1fr), align: (left + horizon, center + horizon, right + horizon),
        text(font: TIPO.apoyo, size: calc.min(8pt, lomo * 0.38), tracking: 0.2em)[#upper(LIB.autor)],
        text(font: TIPO.titulos, size: calc.min(15pt, lomo * 0.62), weight: "semibold", tracking: 0.08em)[#LIB.titulo],
        text(font: TIPO.apoyo, size: calc.min(6.5pt, lomo * 0.3), tracking: 0.2em)[#upper(LIB.at("editorial", default: ""))],
      ))))
  }
})) }

// ── CONTRATAPA ──
#let ean13(isbn) = {
  let d = isbn.replace("-", "").replace(" ", "").clusters().map(int)
  if d.len() == 13 { d = d.slice(0, 12) }
  let suma = range(12).map(i => d.at(i) * if calc.even(i) { 1 } else { 3 }).sum()
  d.push(calc.rem(10 - calc.rem(suma, 10), 10))
  let L = ("0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011")
  let G = ("0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111")
  let R = ("1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100")
  let par = ("LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL")
  let bits = "101"
  for i in range(6) { bits += if par.at(d.at(0)).at(i) == "L" { L.at(d.at(i + 1)) } else { G.at(d.at(i + 1)) } }
  bits += "01010"
  for i in range(6) { bits += R.at(d.at(i + 7)) }
  bits += "101"
  let m = 0.33mm
  let guarda(i) = i < 3 or (i >= 45 and i < 50) or i >= 92
  box(fill: white, inset: (x: 3mm, top: 2.5mm, bottom: 1.5mm), {
    set text(font: TIPO.apoyo, fill: black, size: 6.5pt, tracking: 0.05em)
    align(center, text(size: 6pt)[ISBN #isbn])
    v(0.5mm)
    box(width: 95 * m, height: 20mm, {
      for (i, b) in bits.clusters().enumerate() {
        if b == "1" { place(dx: i * m, rect(width: m, height: if guarda(i) { 20mm } else { 17.5mm }, fill: black, stroke: none)) }
      }
    })
    v(-1.8mm)
    align(center, text(size: 7pt)[#d.map(str).join()])
  })
}

#if not solo-tapa { panel(x-contra, W, pad(x: 18mm, top: 24mm, bottom: 14mm)[
  #set text(size: 12pt)
  #set par(leading: 0.62em, spacing: 1.1em)
  #block(height: H * 0.56 - 22mm - 8mm, clip: false)[#_bloque("tapa-contratapa.typ")]
  #v(1fr)
  #grid(columns: (1fr, auto), align: (left + bottom, right + bottom),
    text(font: TIPO.apoyo, size: 7.5pt, tracking: 0.3em)[#upper(LIB.at("editorial", default: ""))],
    if LIB.at("isbn", default: "") != "" { ean13(LIB.isbn) } else {
      box(width: 36mm, height: 24mm, fill: white, align(center + horizon, text(font: TIPO.apoyo, size: 7pt, fill: black)[código de barras\ ISBN pendiente]))
    })
]) }

// ── SOLAPAS ──
#if solapa > 0mm and not solo-tapa {
  panel(x-solapa-del, solapa, pad(left: 9mm, right: 10mm, top: 24mm, bottom: 14mm)[
    #set text(size: 9.5pt)
    #set par(justify: false, leading: 0.6em)
    #if T.at("foto_autor", default: "") != "" {
      image(RAIZ + T.foto_autor, width: 100%)
      v(4mm)
    }
    #_bloque("tapa-solapa-delantera.typ")
  ])
  panel(x-solapa-tras, solapa, pad(left: 10mm, right: 9mm, top: 24mm, bottom: 14mm)[
    #set text(size: 9.5pt)
    #set par(justify: false, leading: 0.6em)
    #_bloque("tapa-solapa-trasera.typ")
  ])
}

// ── TEXTOS Y FOTOS AGREGADOS (tapa/elementos.json) ──
// Cada elemento va en una cara (tapa, contratapa, lomo, solapa-del, solapa-tras)
// con posición y ancho en % de esa cara. Los pinta la web; también se pueden escribir a mano.
#let _elementos = if _ti("elementos", "") != "" { json(RAIZ + _ti("elementos", "")) } else { () }
#let _caras = (tapa: (x-tapa, W), contratapa: (x-contra, W), lomo: (x-lomo, lomo), solapa-del: (x-solapa-del, solapa), solapa-tras: (x-solapa-tras, solapa))
#for e in _elementos {
  let cara = e.at("cara", default: "tapa")
  if cara not in _caras { continue }
  if solo-tapa and cara != "tapa" { continue }
  if cara.starts-with("solapa") and solapa == 0mm { continue }
  let (x0, ac) = _caras.at(cara)
  let pc(k, d) = float(e.at(k, default: d)) / 100
  let px = ac * pc("x", 10)
  let py = H * pc("y", 10)
  let w = ac * pc("ancho", 80)
  let giro = float(e.at("giro", default: 0)) * 1deg
  let cuerpo = if e.at("tipo", default: "texto") == "foto" {
    if e.at("archivo", default: "") == "" { none } else {
      let h = H * pc("alto", 30)
      let sang = e.at("sangre", default: false)
      // a sangre: si toca un borde exterior, se estira hasta el sangrado
      let (izq, der, arr, aba) = if sang { (if px <= 0.5mm and cara != "tapa" { sangre } else { 0pt }, if px + w >= ac - 0.5mm and cara != "contratapa" { sangre } else { 0pt }, if py <= 0.5mm { sangre } else { 0pt }, if py + h >= H - 0.5mm { sangre } else { 0pt }) } else { (0pt, 0pt, 0pt, 0pt) }
      px = px - izq; py = py - arr
      box(width: w + izq + der, height: h + arr + aba, clip: true, radius: float(e.at("redondeo", default: 0)) * 1mm,
        stroke: if e.at("borde", default: "") != "" { 0.8pt + rgb(e.borde) } else { none },
        image(RAIZ + e.archivo, width: 100%, height: 100%, fit: e.at("ajuste", default: "cover")))
    }
  } else {
    let t = e.at("texto", default: "")
    if e.at("mayusculas", default: false) { t = upper(t) }
    let caja = e.at("fondo", default: "")
    block(width: w, fill: if caja != "" { rgb(caja) } else { none }, inset: if caja != "" { 2.5mm } else { 0pt }, {
      set par(justify: false, leading: float(e.at("interlineado", default: 0.45)) * 1em)
      set align(eval(e.at("alineacion", default: "left")))
      text(font: (e.at("fuente", default: TIPO.titulos), "Libertinus Serif"), size: float(e.at("tam", default: 14)) * 1pt,
        weight: if e.at("negrita", default: false) { "bold" } else { "regular" },
        style: if e.at("cursiva", default: false) { "italic" } else { "normal" },
        tracking: float(e.at("espaciado", default: 0)) * 0.01em, hyphenate: false,
        fill: rgb(e.at("color", default: tinta.to-hex())),
        t.split("\n").join(linebreak()))
    })
  }
  if cuerpo != none {
    place(top + left, dx: x0 + px + ox, dy: sangre + py + oy, if giro != 0deg { rotate(giro, origin: top + left, reflow: false, cuerpo) } else { cuerpo })
  }
}

// ── GUÍAS (solo en tapa-guias.pdf) ──
#if guias and not solo-tapa {
  let corte = 0.4pt + rgb("#ff2d55")
  let doblez = (paint: rgb("#00c2ff"), thickness: 0.5pt, dash: "dashed")
  let zona = (paint: rgb("#38d97a"), thickness: 0.4pt, dash: "dotted")
  // corte final
  place(top + left, dx: sangre, dy: sangre, rect(width: ancho-total - 2 * sangre, height: H, stroke: corte))
  // pliegues
  for x in (x-lomo, x-tapa) + if solapa > 0mm { (x-contra, x-solapa-del, x-contra - pliegue, x-solapa-del - pliegue) } else { () } {
    place(top + left, dx: x, dy: 0pt, line(start: (0pt, 0pt), end: (0pt, alto-total), stroke: doblez))
  }
  // zonas seguras
  for (x, w) in ((x-contra, W), (x-tapa, W)) + if solapa > 0mm { ((x-solapa-tras, solapa), (x-solapa-del, solapa)) } else { () } {
    place(top + left, dx: x + seguro, dy: sangre + seguro, rect(width: w - 2 * seguro, height: H - 2 * seguro, stroke: zona))
  }
  // rótulos
  let rotulo(x, w, t) = place(top + left, dx: x, dy: alto-total - sangre - 5mm, box(width: w, align(center, text(font: TIPO.apoyo, size: 6pt, fill: rgb("#00c2ff"))[#t])))
  let mm(l) = str(calc.round(l.mm(), digits: 1)) + " mm"
  rotulo(x-contra, W, "CONTRATAPA · " + mm(W))
  rotulo(x-tapa, W, "TAPA · " + mm(W))
  rotulo(x-lomo - 10mm, lomo + 20mm, "LOMO " + mm(lomo))
  if solapa > 0mm {
    rotulo(x-solapa-tras, solapa, "SOLAPA · " + mm(solapa))
    rotulo(x-solapa-del, solapa, "SOLAPA · " + mm(solapa))
  }
  place(top + left, dx: sangre + 2mm, dy: 1mm, text(font: TIPO.apoyo, size: 6pt, fill: rgb("#ff2d55"))[
    Papel total #mm(ancho-total) × #mm(alto-total) · sangrado #mm(sangre) · #paginas páginas · lomo #mm(lomo) — rojo: corte · celeste: pliegues · verde: zona segura
  ])
}
