// ═════════════════════════════════════════════════════════════
//  Taller editorial — estilos del interior
//  Lee libros/<libro>/libro.toml y aplica medidas, tipografía y estilos.
//  No hace falta tocar este archivo para cambiar un libro: se cambia el .toml.
// ═════════════════════════════════════════════════════════════

#let LIBRO = sys.inputs.at("libro", default: "cruzar")
#let RAIZ = "/libros/" + LIBRO + "/"
#let _cfg = toml(RAIZ + "libro.toml")
#let _pre = toml("/plantilla/presets.toml")

// Valores que se pueden pisar desde la línea de comandos (--input clave=valor),
// así el simulador prueba combinaciones sin tocar el .toml.
#let _in(clave, defecto) = sys.inputs.at(clave, default: defecto)
#let _len(v) = if type(v) == str { eval(v) } else { v }

#let _formato = {
  let f = _cfg.at("formato", default: (:))
  let preset = _in("formato", f.at("preset", default: "15x23"))
  let base = _pre.formatos.at(preset, default: (ancho: f.at("ancho", default: "150mm"), alto: f.at("alto", default: "230mm")))
  (
    nombre: preset,
    ancho: _len(_in("ancho", f.at("ancho", default: base.ancho))),
    alto: _len(_in("alto", f.at("alto", default: base.alto))),
    interior: _len(_in("margen_interior", f.at("margen_interior", default: "20mm"))),
    exterior: _len(_in("margen_exterior", f.at("margen_exterior", default: "16mm"))),
    superior: _len(_in("margen_superior", f.at("margen_superior", default: "18mm"))),
    inferior: _len(_in("margen_inferior", f.at("margen_inferior", default: "22mm"))),
  )
}
#let _t = _cfg.at("tipografia", default: (:))
#let TIPO = (
  fuente: _in("fuente", _t.at("fuente", default: "EB Garamond")),
  titulos: _in("fuente_titulos", _t.at("fuente_titulos", default: _t.at("fuente", default: "EB Garamond"))),
  apoyo: _in("fuente_apoyo", _t.at("fuente_apoyo", default: "Inter")),
  cuerpo: _len(_in("cuerpo", _t.at("cuerpo", default: "11pt"))),
  interlineado: _len(_in("interlineado", _t.at("interlineado", default: "14.5pt"))),
  notas: _len(_in("notas", _t.at("notas", default: "9pt"))),
  sangria: _len(_in("sangria", _t.at("sangria", default: "1.2em"))),
  justificado: _t.at("justificado", default: true),
  guiones: _t.at("guiones", default: true),
  idioma: _t.at("idioma", default: "es"),
)
#let _e = _cfg.at("estilo", default: (:))
#let ESTILO = (
  cap_impar: _e.at("capitulo_en_impar", default: true),
  parte_impar: _e.at("parte_en_impar", default: true),
  numerar: _e.at("numerar_secciones", default: true),
  notas_cap: _e.at("notas_por_capitulo", default: false),
  cornisa_par: _e.at("cornisa_par", default: "autor"),
  cornisa_impar: _e.at("cornisa_impar", default: "capitulo"),
  folio: _e.at("folio", default: "abajo-afuera"),
  acento: rgb(_e.at("color_acento", default: "#000000")),
)
#let LIB = _cfg.libro
#let FORMATO = _formato

// ─── utilidades ──────────────────────────────────────────────
#let plano(c) = {
  if c == none { "" }
  else if type(c) == str { c }
  else if c.has("text") { if type(c.text) == str { c.text } else { plano(c.text) } }
  else if c.has("children") { c.children.map(plano).sum(default: "") }
  else if c.has("body") { plano(c.body) }
  else if c.func() == [ ].func() { " " }
  else { "" }
}
#let titulo-corto(c) = plano(c).split(" — ").at(0).trim()

#let ORDINALES = ("Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima")

// Marcadores para saber qué páginas llevan cornisa y folio.
#let _marca(nombre) = [#metadata(nombre) <marca>]
#let indexar = state("indexar", false)
#let modo = state("modo", "preliminar")   // preliminar | cuerpo | final

#let _paginas(nombre) = query(<marca>).filter(m => m.value == nombre).map(m => m.location().page())

// ¿página sin cornisa ni folio? (aperturas, partes, páginas blancas, portadas)
#let _pagina-limpia(p) = {
  if p in _paginas("limpia") { return true }
  let ini = _paginas("inicio")
  let fin = _paginas("fin")
  // páginas en blanco entre el fin de un bloque y el inicio del siguiente
  for (i, f) in fin.enumerate() {
    let siguiente = ini.filter(x => x > f)
    if siguiente.len() > 0 and p > f and p < siguiente.first() { return true }
  }
  false
}
#let _es-apertura(p) = p in _paginas("inicio")

// ─── piezas que usa el contenido ─────────────────────────────

// Abre un bloque nuevo (capítulo, parte, preliminar) en página impar si corresponde.
#let apertura(impar: true, reiniciar-notas: false) = {
  pagebreak(weak: true, to: if impar { "odd" } else { none })
  _marca("inicio")
  if reiniciar-notas { counter(footnote).update(0) }
}
#let cierre() = _marca("fin")

#let url(u) = {
  let partido = u.replace(regex("([/._?=&#-])"), m => m.text + "\u{200B}")
  link(u, text(hyphenate: false, partido))
}

#let separador() = align(center, block(above: 1.2em, below: 1.2em, text(tracking: 0.5em)[\*\*\*]))

#let epigrafe(body) = align(right, block(width: 65%, above: 0em, below: 2em)[
  #set par(justify: false, first-line-indent: 0pt)
  #set align(left)
  #set text(size: TIPO.cuerpo * 0.88, style: "italic")
  #body
])

#let cita(body) = pad(left: 1.5em, right: 1em, block(above: 1em, below: 1em)[
  #set text(size: TIPO.cuerpo * 0.9)
  #body
])

#let recuadro(body) = block(width: 100%, fill: luma(240), inset: 10pt, radius: 2pt, above: 1.2em, below: 1.2em)[
  #set text(font: TIPO.apoyo, size: TIPO.cuerpo * 0.78)
  #set par(first-line-indent: 0pt, justify: false, leading: 0.55em)
  #body
]

#let centrado(body) = align(center, body)

// Texto chico de apoyo: pies de cuadros y mapas, notas de fuente.
#let leyenda(body) = block(above: 0.7em, below: 1.1em, width: 100%)[
  #set text(size: TIPO.notas * 0.92)
  #set par(first-line-indent: 0pt, justify: false, leading: 0.42em, spacing: 0.6em)
  #body
]

#let bibliografia(body) = {
  set text(size: TIPO.notas)
  set par(hanging-indent: 1.4em, first-line-indent: 0pt, justify: false, spacing: TIPO.interlineado * 0.55)
  body
}

#let glosario(body) = {
  set par(hanging-indent: 1.4em, first-line-indent: 0pt, spacing: TIPO.interlineado * 0.5)
  body
}

#let tabla(body) = {
  set text(size: TIPO.notas)
  set par(justify: false, first-line-indent: 0pt, leading: 0.45em)
  set table(stroke: (x, y) => (top: if y == 0 { 0.8pt } else if y == 1 { 0.5pt } else { 0.3pt + luma(170) }, bottom: 0.8pt * 0, left: none, right: none), inset: (x: 5pt, y: 4pt))
  show table.cell.where(y: 0): set text(weight: "bold")
  show table.cell: set align(left)
  show table: set align(left)
  show figure: set block(breakable: true)
  show figure: set align(left)
  block(above: 1.2em, below: 1.2em, width: 100%, body)
}

// Figuras: fotos, mapas, gráficos.
#let _supl = (foto: "Foto", mapa: "Mapa", grafico: "Gráfico", ilustracion: "Ilustración")
#let figura(src, tipo: "foto", ancho: 100%, pie: none, fuente: none, pagina-completa: false, sangrado: false, apaisado: false) = {
  let leyenda = if pie != none or fuente != none {
    [#pie#if fuente != none [#if pie != none [. ]#text(style: "italic")[Fuente: #fuente.]]]
  } else { none }
  let alto-caja = FORMATO.alto - FORMATO.superior - FORMATO.inferior
  let ancho-caja = FORMATO.ancho - FORMATO.interior - FORMATO.exterior
  if apaisado {
    // lámina girada: ocupa una página entera para aprovechar el alto
    place(top, float: true, scope: "parent", clearance: 0pt, block(height: alto-caja, width: 100%,
      align(center + horizon, rotate(-90deg, reflow: true,
        figure(image(src, width: alto-caja - 1em), kind: tipo, supplement: _supl.at(tipo, default: "Figura"), caption: leyenda)))))
  } else if sangrado {
    // imagen a sangre: página propia, sin márgenes (la imprenta corta el sobrante)
    page(margin: 0pt, header: none, footer: none)[
      #_marca("limpia")
      #image(src, width: 100%, height: 100%, fit: "cover")
    ]
  } else if pagina-completa {
    place(top, float: true, scope: "parent", clearance: 0pt,
      block(height: FORMATO.alto - FORMATO.superior - FORMATO.inferior - 2em, width: 100%)[
        #figure(image(src, width: 100%, height: 1fr, fit: "contain"), kind: tipo, supplement: _supl.at(tipo, default: "Figura"), caption: leyenda)
      ])
  } else {
    figure(image(src, width: ancho), kind: tipo, supplement: _supl.at(tipo, default: "Figura"), caption: leyenda, placement: auto)
  }
}

// Página de parte
#let parte(titulo) = {
  apertura(impar: ESTILO.parte_impar)
  _marca("limpia")
  counter("parte").step()
  [#metadata(titulo) <parte>]
  v(28%)
  align(center)[
    #context {
      let n = counter("parte").get().first()
      text(font: TIPO.apoyo, size: 9pt, tracking: 0.25em, weight: "medium", fill: ESTILO.acento)[#upper(ORDINALES.at(n - 1, default: str(n)) + " parte")]
    }
    #v(1.2em)
    #text(font: TIPO.titulos, size: 26pt, weight: "semibold")[#titulo]
  ]
  cierre()
}

// ─── preliminares ────────────────────────────────────────────
#let portadilla() = {
  _marca("inicio"); _marca("limpia")
  v(30%)
  align(center, text(font: TIPO.titulos, size: 22pt, tracking: 0.15em)[#upper(LIB.titulo)])
  _marca("fin")
}

#let portada() = {
  apertura(impar: true)
  _marca("limpia")
  align(center)[
    #v(12%)
    #text(font: TIPO.titulos, size: 13pt, tracking: 0.2em)[#upper(LIB.autor)]
    #v(1fr)
    #text(font: TIPO.titulos, size: 40pt, tracking: 0.08em, weight: "semibold")[#LIB.titulo]
    #v(0.8em)
    #block(width: 80%, text(font: TIPO.titulos, size: 15pt, style: "italic")[#LIB.at("subtitulo", default: "")])
    #v(1.4fr)
    #text(font: TIPO.apoyo, size: 9pt, tracking: 0.25em)[#upper(LIB.at("editorial", default: ""))]
    #v(4%)
  ]
}

#let creditos() = {
  pagebreak(weak: true)
  _marca("limpia")
  set text(size: TIPO.notas)
  set par(first-line-indent: 0pt, justify: false, spacing: 0.9em)
  v(1fr)
  [© #LIB.at("anio", default: "") #LIB.autor]
  parbreak()
  emph(LIB.titulo.clusters().first() + lower(LIB.titulo.clusters().slice(1).join())); [. #LIB.at("subtitulo", default: "")]
  parbreak()
  [#LIB.at("editorial", default: "")#if LIB.at("ciudad", default: "") != "" [, #LIB.ciudad]]
  parbreak()
  [#LIB.at("edicion", default: "")]
  if LIB.at("isbn", default: "") != "" { parbreak(); [ISBN #LIB.isbn] }
  if LIB.at("creditos_extra", default: "") != "" { parbreak(); LIB.creditos_extra }
  parbreak()
  [Queda hecho el depósito que marca la Ley 11.723. No se permite la reproducción total o parcial de este libro sin el permiso previo y escrito del autor.]
  _marca("fin")
}

#let dedicatoria(body) = {
  apertura(impar: true)
  _marca("limpia")
  v(22%)
  align(right, block(width: 70%)[
    #set par(first-line-indent: 0pt, justify: false, spacing: 1.1em)
    #set align(left)
    #set text(style: "italic")
    #body
  ])
  cierre()
}

#let _puntos = box(width: 1fr, repeat(gap: 0.35em)[.])

#let indice-general() = {
  apertura(impar: true)
  heading(level: 1, numbering: none, outlined: false)[Índice]
  context {
    let items = query(selector(heading.where(level: 1)).or(heading.where(level: 2)).or(<parte>))
    set par(first-line-indent: 0pt, justify: false, spacing: 0.55em)
    for it in items {
      let loc = it.location()
      let pag = counter(page).at(loc).first()
      if it.func() == metadata {
        let n = counter("parte").at(loc).first()
        block(above: 1.6em, below: 0.8em, text(font: TIPO.apoyo, size: 8pt, tracking: 0.2em, weight: "medium", fill: ESTILO.acento)[#upper(ORDINALES.at(n - 1, default: str(n)) + " parte · " + it.value)])
      } else if it.outlined == false {
      } else if it.level == 1 {
        let num = if it.numbering != none { str(counter(heading).at(loc).first()) + ". " } else { "" }
        block(above: 0.9em, below: 0.3em, link(loc)[#text(weight: "semibold")[#num#plano(it.body)] #_puntos #pag])
      } else if it.level == 2 {
        let num = if it.numbering != none and ESTILO.numerar { counter(heading).at(loc).slice(0, 2).map(str).join(".") + " " } else { "" }
        pad(left: 1.2em, link(loc)[#text(size: TIPO.cuerpo * 0.85)[#num#plano(it.body) #_puntos #pag]])
      }
    }
  }
  cierre()
}

// ─── índice analítico ────────────────────────────────────────
#let _terminos = {
  let ruta = RAIZ + "indice.toml"
  let datos = toml(ruta)
  datos.at("termino", default: ())
}

#let _rangos(nums) = {
  let s = nums.dedup().sorted()
  let out = ()
  let i = 0
  while i < s.len() {
    let j = i
    while j + 1 < s.len() and s.at(j + 1) == s.at(j) + 1 { j += 1 }
    out.push(if j > i { str(s.at(i)) + "–" + str(s.at(j)) } else { str(s.at(i)) })
    i = j + 1
  }
  out.join(", ")
}

#let indice-analitico() = {
  apertura(impar: true)
  heading(level: 1, numbering: none)[Índice analítico]
  context {
    let marcas = query(<idx>).filter(m => indexar.at(m.location()))
    let por = (:)
    for m in marcas {
      let p = counter(page).at(m.location()).first()
      por.insert(m.value, por.at(m.value, default: ()) + (p,))
    }
    set text(size: TIPO.notas)
    set par(first-line-indent: 0pt, hanging-indent: 1em, justify: false, spacing: 0.35em)
    columns(2, gutter: 1.5em, {
      let letra = ""
      for k in por.keys().sorted(key: k => lower(k).replace(regex("[áà]"), "a").replace(regex("[éè]"), "e").replace(regex("[íì]"), "i").replace(regex("[óò]"), "o").replace(regex("[úùü]"), "u")) {
        let l = upper(k.clusters().first()).replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U")
        if l != letra {
          letra = l
          block(above: 1em, below: 0.4em, text(font: TIPO.apoyo, weight: "bold", size: 8pt, fill: ESTILO.acento)[#l])
        }
        [#k, #_rangos(por.at(k))]
        parbreak()
      }
    })
  }
  cierre()
}

#let colofon() = {
  pagebreak(weak: true)
  _marca("inicio"); _marca("limpia")
  v(1fr)
  align(center, block(width: 75%)[
    #set text(size: TIPO.notas)
    #set par(first-line-indent: 0pt, justify: false)
    #text(tracking: 0.15em)[COLOFÓN] \
    #v(0.6em)
    #emph(LIB.titulo) se compuso en #TIPO.fuente de #repr(TIPO.cuerpo).replace("pt", "") sobre #repr(TIPO.interlineado).replace("pt", "") puntos, con notas de #repr(TIPO.notas).replace("pt", "") puntos, en un formato de #calc.round(FORMATO.ancho.cm(), digits: 1) × #calc.round(FORMATO.alto.cm(), digits: 1) cm. #LIB.at("editorial", default: ""), #LIB.at("ciudad", default: ""), #LIB.at("anio", default: "").
  ])
  v(12%)
  _marca("fin")
}

// ═════════════════════════════════════════════════════════════
//  Plantilla principal
// ═════════════════════════════════════════════════════════════
#let libro(body) = {
  set document(title: LIB.titulo, author: LIB.autor)
  set page(
    width: FORMATO.ancho, height: FORMATO.alto,
    margin: (inside: FORMATO.interior, outside: FORMATO.exterior, top: FORMATO.superior, bottom: FORMATO.inferior),
    binding: left,
    header-ascent: 40%,
    footer-descent: 35%,
    header: context {
      let p = here().page()
      if _pagina-limpia(p) or _es-apertura(p) { return }
      if modo.get() == "preliminar" and query(heading.where(level: 1)).filter(h => h.location().page() <= p).len() == 0 { return }
      let caps = query(heading.where(level: 1)).filter(h => h.location().page() <= p)
      let cap = if caps.len() > 0 { titulo-corto(caps.last().body) } else { "" }
      let que = if calc.even(p) { ESTILO.cornisa_par } else { ESTILO.cornisa_impar }
      let txt = if que == "autor" { LIB.autor } else if que == "titulo" { LIB.titulo } else if que == "capitulo" { cap } else { "" }
      set text(font: TIPO.apoyo, size: 7pt, tracking: 0.14em, fill: luma(60))
      align(if calc.even(p) { left } else { right }, upper(txt))
    },
    footer: context {
      let p = here().page()
      if _pagina-limpia(p) { return }
      let n = counter(page).display("1")
      set text(size: TIPO.cuerpo * 0.85)
      if ESTILO.folio == "abajo-centro" { align(center, n) }
      else { align(if calc.even(p) { left } else { right }, n) }
    },
  )

  set text(font: (TIPO.fuente, "Libertinus Serif"), size: TIPO.cuerpo, lang: TIPO.idioma, hyphenate: TIPO.guiones,
    top-edge: 0.8em, bottom-edge: -0.2em, number-type: "old-style")
  set par(justify: TIPO.justificado, leading: TIPO.interlineado - TIPO.cuerpo, spacing: TIPO.interlineado - TIPO.cuerpo,
    first-line-indent: (amount: TIPO.sangria, all: false))
  set heading(numbering: "1.1")
  set footnote.entry(separator: line(length: 28%, stroke: 0.4pt), gap: 0.35em, indent: 0pt, clearance: 1.1em)
  show footnote.entry: set text(size: TIPO.notas, top-edge: "cap-height", bottom-edge: "baseline", number-type: "lining")
  show footnote.entry: set par(leading: TIPO.notas * 0.42, justify: TIPO.justificado, first-line-indent: 0pt, hanging-indent: 0pt)
  show footnote: set text(number-type: "lining")
  show footnote.entry: it => {
    let n = counter(footnote).at(it.note.location()).first()
    block(above: 0pt, below: 0pt)[#super(str(n))#h(0.3em)#it.note.body]
  }
  show link: set text(fill: black)
  show figure.caption: set text(font: TIPO.apoyo, size: TIPO.notas * 0.85)
  show figure.caption: set par(justify: false, first-line-indent: 0pt, leading: 0.4em)
  show figure.caption: it => align(left, block(width: 100%, [#text(weight: "bold")[#it.supplement #context it.counter.display(it.numbering).]#h(0.4em)#it.body]))
  set figure(gap: 0.8em)
  show figure: set block(above: 1.4em, below: 1.4em)
  show quote.where(block: true): it => cita(it.body)

  // Capítulo
  show heading.where(level: 1): it => {
    let t = plano(it.body)
    let partes = t.split(" — ")
    let titulo = partes.at(0)
    let sub = if partes.len() > 1 { partes.slice(1).join(" — ") } else { none }
    set par(justify: false, first-line-indent: 0pt)
    set text(hyphenate: false)
    block(width: 100%, above: 0pt, below: 0pt)[
      #v(FORMATO.alto * 0.11)
      #if it.numbering != none {
        text(font: TIPO.apoyo, size: 8.5pt, tracking: 0.25em, weight: "medium", fill: ESTILO.acento)[CAPÍTULO #context counter(heading).display("1")]
        v(1em)
      }
      #text(font: TIPO.titulos, size: TIPO.cuerpo * 2.05, weight: "semibold", top-edge: "cap-height")[#titulo]
      #if sub != none {
        v(0.9em)
        text(font: TIPO.titulos, size: TIPO.cuerpo * 1.25, style: "italic")[#sub]
      }
      #v(TIPO.interlineado * 3)
    ]
  }
  // Sección
  show heading.where(level: 2): it => {
    set par(justify: false, first-line-indent: 0pt)
    set text(hyphenate: false)
    block(above: TIPO.interlineado * 1.8, below: TIPO.interlineado * 0.9, sticky: true)[
      #set text(font: TIPO.titulos, size: TIPO.cuerpo * 1.08, weight: "semibold")
      #if it.numbering != none and ESTILO.numerar [#context counter(heading).display("1.1")#h(0.6em)]#it.body
    ]
  }
  // Subsección
  show heading.where(level: 3): it => {
    set par(justify: false, first-line-indent: 0pt)
    block(above: TIPO.interlineado * 1.2, below: TIPO.interlineado * 0.6, sticky: true)[
      #set text(font: TIPO.titulos, size: TIPO.cuerpo, style: "italic")
      #it.body
    ]
  }

  // Índice analítico: cada término del indice.toml deja una marca invisible donde aparece.
  show: cuerpo => {
    let res = cuerpo
    for t in (if sys.inputs.at("vista", default: "no") == "si" { () } else { _terminos }) {
      let patron = "\\b(?:" + t.buscar.join("|") + ")\\b"
      res = {
        show regex(patron): it => it + [#metadata(t.entrada)<idx>]
        res
      }
    }
    res
  }

  body
}
