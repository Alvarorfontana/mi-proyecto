#!/usr/bin/env python3
"""
Arma un libro completo: interior en PDF, tapa con lomo calculado y (opcional) EPUB.

    python herramientas/construir.py cruzar
    python herramientas/construir.py cruzar --sin-tapa
    python herramientas/construir.py cruzar --epub
    python herramientas/construir.py cruzar --set cuerpo=11pt --set formato=15x23

Requiere: typst (0.13 o más nuevo) y pandoc (3.1 o más nuevo) instalados.
"""
import argparse, os, re, shutil, subprocess, sys, tomllib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FILTRO = RAIZ / "herramientas" / "filtro.lua"
FUENTES = RAIZ / "fuentes"


def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        sys.exit(f"\n✗ Falló: {' '.join(map(str, cmd))}")
    return r


def herramientas_ok():
    for t in ("typst", "pandoc"):
        if not shutil.which(t):
            sys.exit(f"✗ No encuentro '{t}'. Mirá el README, sección «Instalar».")


def md_a_typst(md: Path, destino: Path, libro: str, sin_numero: bool):
    r = sh(["pandoc", str(md), "-f", "markdown-citations-auto_identifiers-smart", "-t", "typst",
            "--wrap=none", "--lua-filter", str(FILTRO),
            "-M", f"sin_numero={'true' if sin_numero else 'false'}",
            "-M", f"base=/libros/{libro}/"])
    destino.write_text('#import "/plantilla/estilos.typ": *\n\n' + r.stdout, encoding="utf-8")


def contar_paginas(pdf: Path) -> int:
    try:
        from pypdf import PdfReader
        return len(PdfReader(str(pdf)).pages)
    except ImportError:
        pass
    try:
        import pymupdf
        return pymupdf.open(str(pdf)).page_count
    except ImportError:
        pass
    datos = pdf.read_bytes()
    return len(re.findall(rb"/Type\s*/Page[^s]", datos))


def armar_principal(cfg: dict, libro: str, build: Path) -> Path:
    est = cfg.get("estilo", {})
    pre = cfg.get("preliminares", {})
    L = ['#import "/plantilla/estilos.typ": *', "#show: libro", ""]
    if pre.get("portadilla", True):
        L.append("#portadilla()")
    L += ["#portada()", "#creditos()"]
    if pre.get("dedicatoria"):
        L.append('#dedicatoria(include "dedicatoria.typ")')
    pos_indice = pre.get("indice", "inicio")
    if pos_indice == "inicio":
        L.append("#indice-general()")

    primer_capitulo = True
    for i, item in enumerate(cfg.get("contenido", [])):
        tipo = item["tipo"]
        if tipo == "parte":
            L.append(f'#parte({tipo_str(item["titulo"])})')
            continue
        archivo = item["archivo"]
        nombre = f"{i:02d}-" + Path(archivo).stem + ".typ"
        indexa = "true" if item.get("indice", True) else "false"
        if tipo == "capitulo":
            if primer_capitulo:
                L += ["#counter(heading).update(0)", '#modo.update("cuerpo")']
                primer_capitulo = False
            reinicio = "true" if est.get("notas_por_capitulo", False) else "false"
            impar = "true" if est.get("capitulo_en_impar", True) else "false"
            L.append(f"#apertura(impar: {impar}, reiniciar-notas: {reinicio})")
        else:
            if tipo == "final":
                L.append('#modo.update("final")')
            L.append("#apertura(impar: true)")
        L += [f"#indexar.update({indexa})", f'#include "{nombre}"', "#cierre()", ""]

    L.append("#indexar.update(false)")
    if est.get("indice_analitico", True) and (RAIZ / "libros" / libro / "indice.toml").exists():
        L.append("#indice-analitico()")
    if pos_indice == "final":
        L.append("#indice-general()")
    if est.get("colofon", True):
        L.append("#colofon()")
    principal = build / "libro.typ"
    principal.write_text("\n".join(L) + "\n", encoding="utf-8")
    return principal


def tipo_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def preparar(libro: str):
    """Convierte los .md a .typ y escribe el archivo principal. Devuelve (cfg, principal)."""
    dir_libro = RAIZ / "libros" / libro
    if not (dir_libro / "libro.toml").exists():
        sys.exit(f"✗ No existe libros/{libro}/libro.toml")
    cfg = tomllib.loads((dir_libro / "libro.toml").read_text(encoding="utf-8"))
    build = dir_libro / "_build"
    if build.exists():
        shutil.rmtree(build)
    build.mkdir()
    if not (dir_libro / "indice.toml").exists():
        (dir_libro / "indice.toml").write_text("# términos del índice analítico\n", encoding="utf-8")

    pre = cfg.get("preliminares", {})
    if pre.get("dedicatoria"):
        md_a_typst(dir_libro / pre["dedicatoria"], build / "dedicatoria.typ", libro, True)
    for i, item in enumerate(cfg.get("contenido", [])):
        if item["tipo"] == "parte":
            continue
        md = dir_libro / item["archivo"]
        if not md.exists():
            sys.exit(f"✗ Falta el archivo {item['archivo']}")
        md_a_typst(md, build / (f"{i:02d}-" + md.stem + ".typ"), libro, item["tipo"] != "capitulo")
    tapa = cfg.get("tapa", {})
    for clave in ("contratapa", "solapa_delantera", "solapa_trasera"):
        destino = build / ("tapa-" + clave.replace("_", "-") + ".typ")
        if tapa.get(clave) and (dir_libro / tapa[clave]).exists():
            md_a_typst(dir_libro / tapa[clave], destino, libro, True)
        else:
            destino.write_text("", encoding="utf-8")
    return cfg, armar_principal(cfg, libro, build)


def compilar(principal: Path, salida: Path, libro: str, sets: dict):
    cmd = ["typst", "compile", "--root", str(RAIZ), "--font-path", str(FUENTES),
           "--input", f"libro={libro}"]
    for k, v in sets.items():
        cmd += ["--input", f"{k}={v}"]
    cmd += [str(principal), str(salida)]
    sh(cmd)


def lomo_mm(cfg: dict, paginas: int) -> float:
    presets = tomllib.loads((RAIZ / "plantilla" / "presets.toml").read_text(encoding="utf-8"))
    tapa = cfg.get("tapa", {})
    papel = tapa.get("papel", "obra-80")
    hoja = tapa.get("grosor_hoja_mm") or presets["papeles"].get(papel)
    if hoja is None:
        sys.exit(f"✗ Papel desconocido: {papel}. Agregalo en plantilla/presets.toml")
    return paginas / 2 * hoja + tapa.get("cartulina_mm", 0.6)


def main():
    ap = argparse.ArgumentParser(description="Construye interior y tapa de un libro.")
    ap.add_argument("libro", help="carpeta dentro de libros/ (ej. cruzar)")
    ap.add_argument("--sin-tapa", action="store_true")
    ap.add_argument("--epub", action="store_true", help="también genera un EPUB con pandoc")
    ap.add_argument("--set", action="append", default=[], metavar="clave=valor",
                    help="pisa un valor sin tocar el .toml (formato, cuerpo, interlineado, fuente, margen_interior…)")
    a = ap.parse_args()
    herramientas_ok()
    sets = dict(s.split("=", 1) for s in a.set)

    dir_libro = RAIZ / "libros" / a.libro
    salida = dir_libro / "salida"
    salida.mkdir(exist_ok=True)

    print(f"→ Convirtiendo textos de «{a.libro}»…")
    cfg, principal = preparar(a.libro)
    pdf = salida / "interior.pdf"
    print("→ Componiendo el interior…")
    compilar(principal, pdf, a.libro, sets)
    n = contar_paginas(pdf)
    print(f"✓ Interior: {pdf.relative_to(RAIZ)}  ({n} páginas)")
    if n % 16:
        print(f"  · Para pliegos de 16 páginas faltan {16 - n % 16} páginas (o sobran {n % 16}).")

    if not a.sin_tapa:
        lomo = lomo_mm(cfg, n)
        print(f"→ Tapa: lomo de {lomo:.1f} mm para {n} páginas en papel {cfg.get('tapa', {}).get('papel', 'obra-80')}")
        tapa_pdf = salida / "tapa.pdf"
        cmd = {**sets, "paginas": str(n), "lomo": f"{lomo:.2f}mm"}
        compilar(RAIZ / "plantilla" / "tapa.typ", tapa_pdf, a.libro, cmd)
        print(f"✓ Tapa: {tapa_pdf.relative_to(RAIZ)}")
        compilar(RAIZ / "plantilla" / "tapa.typ", salida / "tapa-guias.pdf", a.libro, {**cmd, "guias": "si"})
        print(f"✓ Tapa con guías (para revisar): {(salida / 'tapa-guias.pdf').relative_to(RAIZ)}")

    if a.epub:
        lib = cfg["libro"]
        archivos = [str(dir_libro / it["archivo"]) for it in cfg["contenido"] if it["tipo"] != "parte"]
        ep = salida / "libro.epub"
        sh(["pandoc", *archivos, "-f", "markdown-citations", "-o", str(ep), "--split-level=1",
            "-M", f"title={lib['titulo']}", "-M", f"subtitle={lib.get('subtitulo', '')}",
            "-M", f"author={lib['autor']}", "-M", "lang=es", "--toc", f"--resource-path={dir_libro}"])
        print(f"✓ EPUB: {ep.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
