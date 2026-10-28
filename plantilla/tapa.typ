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
#let fondo = rgb(T.at("fondo", default: "#1d2a33"))
#let tinta = rgb(T.at("color_texto", default: "#f4efe6"))
#let acento = rgb(T.at("color_acento", default: "#d9a441"))
#let seguro = 6mm   // zona segura: nada importante más cerca del corte

// posiciones horizontales (desde el borde izquierdo del papel, con sangrado)
#let x-solapa-tras = sangre
#let x-contra = sangre + solapa + pliegue
#let x-lomo = x-contra + W
#let x-tapa = x-lomo + lomo
#let x-solapa-del = x-tapa + W + pliegue
#let ancho-total = x-solapa-del + solapa + sangre
#let alto-total = H + 2 * sangre

#let _bloque(ruta) = {
  // los textos de tapa se convierten desde Markdown en _build/
  include RAIZ + "_build/" + ruta
}

#set document(title: LIB.titulo + " — tapa", author: LIB.autor)
#set page(width: ancho-total, height: alto-total, margin: 0pt, fill: fondo)
#set text(font: (TIPO.fuente, "Libertinus Serif"), lang: "es", fill: tinta, hyphenate: true)
#set par(justify: true, leading: 0.5em, first-line-indent: 0pt, spacing: 0.9em)

#let panel(x, ancho, cuerpo) = place(top + left, dx: x, dy: sangre, block(width: ancho, height: H, cuerpo))

// ── imagen de tapa (opcional, a sangre) ──
#if T.at("imagen", default: "") != "" {
  place(top + left, dx: x-tapa, dy: 0pt, image(RAIZ + T.imagen, width: W + pliegue + solapa + sangre, height: alto-total, fit: "cover"))
}
#if T.at("imagen_contratapa", default: "") != "" {
  place(top + left, dx: 0pt, dy: 0pt, image(RAIZ + T.imagen_contratapa, width: x-lomo, height: alto-total, fit: "cover"))
}

// ── la línea que cruza: atraviesa contratapa, lomo y tapa ──
#let y-linea = sangre + H * 0.56
#place(top + left, dx: x-contra, dy: y-linea, line(length: W * 2 + lomo, stroke: 0.8pt + acento))

// ── TAPA ──
#panel(x-tapa, W, {
  let mx = 16mm
  place(top + left, dx: mx, dy: 22mm, text(font: TIPO.apoyo, size: 9pt, tracking: 0.3em, weight: "medium")[#upper(LIB.autor)])
  place(top + left, dx: mx, dy: 0pt, block(width: W - 2 * mx, height: H * 0.56 - 7mm,
    align(bottom + left, text(font: TIPO.titulos, size: 58pt, weight: "semibold", tracking: 0.04em, hyphenate: false, top-edge: "cap-height", bottom-edge: "baseline")[#LIB.titulo])))
  place(top + left, dx: mx, dy: H * 0.56 + 8mm, block(width: (W - 2 * mx) * 0.85,
    text(font: TIPO.titulos, size: 17pt, style: "italic", hyphenate: false)[#set par(justify: false); #LIB.at("subtitulo", default: "")]))
  place(bottom + left, dx: mx, dy: -14mm, text(font: TIPO.apoyo, size: 7.5pt, tracking: 0.3em)[#upper(LIB.at("editorial", default: ""))])
})

// ── LOMO ──
#place(top + left, dx: x-lomo, dy: sangre, block(width: lomo, height: H, {
  if lomo >= 6mm {
    set align(center + horizon)
    rotate(90deg, reflow: true, box(width: H - 2 * seguro, height: lomo, align(horizon,
      grid(columns: (1fr, auto, 1fr), align: (left + horizon, center + horizon, right + horizon),
        text(font: TIPO.apoyo, size: calc.min(8pt, lomo * 0.38), tracking: 0.2em)[#upper(LIB.autor)],
        text(font: TIPO.titulos, size: calc.min(15pt, lomo * 0.62), weight: "semibold", tracking: 0.08em)[#LIB.titulo],
        text(font: TIPO.apoyo, size: calc.min(6.5pt, lomo * 0.3), tracking: 0.2em)[#upper(LIB.at("editorial", default: ""))],
      ))))
  }
}))

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

#panel(x-contra, W, pad(x: 18mm, top: 24mm, bottom: 14mm)[
  #set text(size: 12pt)
  #set par(leading: 0.62em, spacing: 1.1em)
  #block(height: H * 0.56 - 22mm - 8mm, clip: false)[#_bloque("tapa-contratapa.typ")]
  #v(1fr)
  #grid(columns: (1fr, auto), align: (left + bottom, right + bottom),
    text(font: TIPO.apoyo, size: 7.5pt, tracking: 0.3em)[#upper(LIB.at("editorial", default: ""))],
    if LIB.at("isbn", default: "") != "" { ean13(LIB.isbn) } else {
      box(width: 36mm, height: 24mm, fill: white, align(center + horizon, text(font: TIPO.apoyo, size: 7pt, fill: black)[código de barras\ ISBN pendiente]))
    })
])

// ── SOLAPAS ──
#if solapa > 0mm {
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

// ── GUÍAS (solo en tapa-guias.pdf) ──
#if guias {
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
