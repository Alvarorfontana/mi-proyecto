#!/usr/bin/env python3
"""
Simulador de extensión: compone el libro con distintas medidas y tipografías
y muestra cuántas páginas da cada combinación, sin tocar el libro.toml.

    python herramientas/probar_medidas.py cruzar
    python herramientas/probar_medidas.py cruzar --objetivo 500
    python herramientas/probar_medidas.py cruzar --formatos 14x21 15x23 --cuerpos 11/14.5 12/16

Cada «cuerpo» es tamaño/interlineado en puntos (ej. 11/14.5).
"""
import argparse, sys, tempfile, tomllib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import construir as C  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("libro")
    ap.add_argument("--formatos", nargs="+", default=["14x21", "15x23", "16x23", "17x24"])
    ap.add_argument("--cuerpos", nargs="+", default=["10.5/14", "11/14.5", "11.5/15", "12/16"])
    ap.add_argument("--fuentes", nargs="+", default=None, help="ej. 'EB Garamond' 'Source Serif 4'")
    ap.add_argument("--objetivo", type=int, default=None, help="páginas buscadas (marca las más cercanas)")
    ap.add_argument("--hilos", type=int, default=4)
    a = ap.parse_args()
    C.herramientas_ok()

    cfg, principal = C.preparar(a.libro)
    fuentes = a.fuentes or [cfg.get("tipografia", {}).get("fuente", "EB Garamond")]
    combos = [(f, c, fu) for fu in fuentes for f in a.formatos for c in a.cuerpos]
    print(f"→ Probando {len(combos)} combinaciones de «{a.libro}»…\n")
    tmp = Path(tempfile.mkdtemp())

    def probar(combo):
        formato, cuerpo, fuente = combo
        tam, inter = cuerpo.split("/")
        sets = {"formato": formato, "cuerpo": f"{tam}pt", "interlineado": f"{inter}pt",
                "notas": f"{round(float(tam) * 0.8, 1)}pt", "fuente": fuente}
        pdf = tmp / f"{formato}-{tam}-{inter}-{fuente.replace(' ', '')}.pdf"
        C.compilar(principal, pdf, a.libro, sets)
        n = C.contar_paginas(pdf)
        return combo, n, C.lomo_mm(cfg, n)

    with ThreadPoolExecutor(a.hilos) as ex:
        res = list(ex.map(probar, combos))

    cerca = set()
    if a.objetivo:
        orden = sorted(res, key=lambda r: abs(r[1] - a.objetivo))
        cerca = {r[0] for r in orden[:3]}

    ancho_f = max(len(f) for f in fuentes)
    print(f"{'formato':<8} {'cuerpo/interl.':<15} {'fuente':<{ancho_f}}  {'páginas':>7}  {'lomo':>8}")
    print("─" * (45 + ancho_f))
    for (formato, cuerpo, fuente), n, lomo in res:
        marca = "  ← cerca del objetivo" if (formato, cuerpo, fuente) in cerca else ""
        print(f"{formato:<8} {cuerpo + ' pt':<15} {fuente:<{ancho_f}}  {n:>7}  {lomo:>6.1f}mm{marca}")
    csv = C.RAIZ / "libros" / a.libro / "salida" / "simulacion.csv"
    csv.parent.mkdir(exist_ok=True)
    csv.write_text("formato,cuerpo,interlineado,fuente,paginas,lomo_mm\n" + "\n".join(
        f"{f},{c.split('/')[0]},{c.split('/')[1]},{fu},{n},{l:.1f}" for (f, c, fu), n, l in res) + "\n", encoding="utf-8")
    print(f"\n✓ Tabla guardada en {csv.relative_to(C.RAIZ)}")


if __name__ == "__main__":
    main()
