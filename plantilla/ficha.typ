// Ficha técnica para la imprenta: lo que la imprenta necesita para presupuestar y producir.
#import "/plantilla/estilos.typ": LIB, FORMATO, TIPO, RAIZ, _cfg, _len
#let T = _cfg.at("tapa", default: (:))
#let paginas = int(sys.inputs.at("paginas", default: "0"))
#let lomo = sys.inputs.at("lomo", default: "—")
#let mm(l) = str(calc.round(_len(l).mm(), digits: 1)) + " mm"
#let solapa = _len(T.at("solapa", default: "0mm"))
#let sangre = _len(T.at("sangrado", default: "3mm"))
#let pliegue = if solapa > 0mm { _len(T.at("pliegue_solapa", default: "3mm")) } else { 0mm }
#let lomo-l = _len(lomo)
#let total = 2 * FORMATO.ancho + lomo-l + 2 * (solapa + pliegue) + 2 * sangre
#set page(paper: "a4", margin: (x: 22mm, y: 20mm), footer: align(right, text(size: 8pt, fill: luma(120))[Ficha técnica · #LIB.titulo · #datetime.today().display("[day]/[month]/[year]")]))
#set text(font: ("Inter", "Libertinus Serif"), size: 10pt, lang: "es")
#let fila(a, b) = (text(fill: luma(90))[#a], b)
#let tabla(..filas) = table(columns: (42%, 1fr), stroke: (x, y) => (bottom: 0.4pt + luma(210)), inset: (y: 6pt, x: 2pt), ..filas.pos().flatten())
#text(size: 8pt, tracking: 0.2em, fill: luma(110))[FICHA TÉCNICA PARA IMPRENTA]
#v(2mm)
#text(size: 20pt, weight: "bold")[#LIB.titulo]
#if LIB.at("subtitulo", default: "") != "" { linebreak(); text(size: 12pt, fill: luma(60))[#LIB.subtitulo] }
#v(1mm)
#text(size: 10pt)[#LIB.autor · #LIB.at("editorial", default: "") · #LIB.at("ciudad", default: "") #LIB.at("anio", default: "")]
#v(6mm)
== Interior
#tabla(
  fila[Formato (cerrado)][#mm(FORMATO.ancho) × #mm(FORMATO.alto)],
  fila[Páginas][#paginas (#calc.ceil(paginas / 16) pliegos de 16#if calc.rem(paginas, 16) != 0 [; el último incompleto: faltan #(16 - calc.rem(paginas, 16)) páginas])],
  fila[Papel][#T.at("papel", default: "obra-80") (confirmar gramaje y espesor)],
  fila[Impresión][1/1 (negro) · confirmar si hay páginas a color],
  fila[Márgenes][interior #mm(FORMATO.interior) · exterior #mm(FORMATO.exterior) · superior #mm(FORMATO.superior) · inferior #mm(FORMATO.inferior)],
  fila[Tipografía][#TIPO.fuente #str(calc.round(TIPO.cuerpo.pt(), digits: 1)) / #str(calc.round(TIPO.interlineado.pt(), digits: 1)) pt (fuentes incrustadas en el PDF)],
  fila[Encuadernación][#if T.at("encuadernacion", default: "rustica") == "dura" [tapa dura (cartoné) · cartón #T.at("carton", default: "2.5mm") · interior cosido] else [rústica · a definir: fresada o cosida (cosida recomendada desde 300 páginas)]],
)
== Tapa
#tabla(
  fila[Lomo][#lomo (calculado: páginas ÷ 2 × espesor de hoja + cartulina)],
  fila[Solapas][#if solapa > 0mm [#mm(solapa) cada una (+ #mm(pliegue) de pliegue)] else [sin solapas]],
  fila[Sangrado][#mm(sangre) por lado],
  fila[Medida total del pliego de tapa][#mm(total) × #mm(FORMATO.alto + 2 * sangre)],
  fila[Cartulina][a definir (habitual: ilustración 300 g)],
  fila[Impresión][4/0 (color de un lado)],
  fila[Terminación][a definir: laminado mate u OPP brillo, laca sectorizada],
  fila[ISBN][#if LIB.at("isbn", default: "") != "" [#LIB.isbn (con código de barras EAN-13 en contratapa)] else [pendiente]],
)
== Archivos que se entregan
#tabla(
  fila[Interior][interior-cmyk.pdf (o interior.pdf en RGB), páginas sueltas en orden, con marcas de corte opcionales],
  fila[Tapa][tapa-cmyk.pdf (pliego completo con sangrado) y tapa-guias.pdf (solo para revisar medidas)],
  fila[Prueba de color][pedir prueba de color de tapa antes de la tirada],
)
#v(4mm)
#text(size: 8.5pt, fill: luma(90))[Cantidad de ejemplares, papel definitivo y terminaciones: completar con la imprenta. El espesor del lomo cambia si cambia el papel: pedir que la imprenta lo confirme antes de cerrar la tapa.]
