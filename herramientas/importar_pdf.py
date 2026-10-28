#!/usr/bin/env python3
"""
Importa un PDF de CRUZAR (exportado desde el procesador de texto) a Markdown por capítulos.

    python herramientas/importar_pdf.py Cruzar.pdf libros/cruzar

Reconoce: partes, capítulos (23 pt), secciones (14 pt), subtítulos en cursiva,
epígrafes, capitulares, notas al pie, cuadros, gráficos y mapas a doble página.
Está ajustado a los estilos del manuscrito de CRUZAR (EB Garamond 12/17).
Si tenés el .docx o .odt original, conviene importar desde ahí (más fiel).

Requiere: pip install pymupdf  ·  poppler-utils (pdftocairo) para exportar los mapas.
"""
import json, os, re, subprocess, sys, unicodedata
from pathlib import Path
import pymupdf as fitz

PDF, DEST = sys.argv[1], Path(sys.argv[2])
TXT = DEST / "texto"
for sub in ("texto", "mapas", "imagenes"):
    (DEST / sub).mkdir(parents=True, exist_ok=True)
doc = fitz.open(PDF)


# ───────────────────────── utilidades ─────────────────────────
def esc(t):
    t = t.replace("\\", "\\\\")
    for ch in "*_[]<>#`$@~^|":
        t = t.replace(ch, "\\" + ch)
    return t


def slug(s, n=38):
    s = unicodedata.normalize("NFKD", s.split("—")[0]).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:n].strip("-")


def is_ital(f):
    return "Italic" in f


# ───────────────────── líneas por línea de base ─────────────────────
def page_lines(p):
    spans = []
    for b in p.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"] == "":
                    continue
                spans.append(dict(x0=s["bbox"][0], x1=s["bbox"][2], y0=s["bbox"][1], y1=s["bbox"][3],
                                  base=s["origin"][1], size=round(s["size"], 1), font=s["font"], text=s["text"]))
    big = [s for s in spans if s["size"] >= 8]
    small = [s for s in spans if s["size"] < 8]
    lines = []
    for s in sorted(big, key=lambda s: (round(s["base"]), s["x0"])):
        for L in lines:
            if abs(L["base"] - s["base"]) < 2.0 and (s["size"] < 60) == (L["size"] < 60):
                L["spans"].append(s)
                break
        else:
            lines.append(dict(base=s["base"], spans=[s], size=s["size"]))
    for s in small:  # llamadas de nota: se pegan a la línea cuya base está apenas debajo
        cand = [L for L in lines if 0 <= L["base"] - s["base"] < 8 and L["size"] < 60]
        if cand:
            L = min(cand, key=lambda L: L["base"] - s["base"])
            s["ref"] = True
            L["spans"].append(s)
    out = []
    for L in lines:
        sp = sorted(L["spans"], key=lambda s: s["x0"])
        main = max((s for s in sp if not s.get("ref")), key=lambda s: len(s["text"].strip()) or 0.1)
        L.update(spans=sp, x0=min(s["x0"] for s in sp if not s.get("ref")), x1=max(s["x1"] for s in sp),
                 size=main["size"], font=main["font"], y=min(s["y0"] for s in sp if not s.get("ref")),
                 text="".join(s["text"] for s in sp if not s.get("ref")))
        L["ital"] = all(is_ital(s["font"]) for s in sp if not s.get("ref") and s["text"].strip())
        out.append(L)
    return sorted(out, key=lambda L: (L["base"], L["x0"]))


def split_refs(t):
    """«8687» = llamadas 86 y 87 pegadas."""
    if len(t) >= 3:
        for i in range(1, len(t)):
            a, b = t[:i], t[i:]
            if b[0] != "0" and int(b) == int(a) + 1:
                return [a, b]
    return [t]


def inline(L, keep_refs=True):
    """Línea → markdown (cursivas, llamadas de nota, espacios de líneas justificadas)."""
    res, prev, cur_it, buf = "", None, False, ""
    parts = []
    for s in L["spans"]:
        if s.get("ref"):
            parts.append(("ref", s["text"].strip(), s))
            continue
        gap = (s["x0"] - prev["x1"]) if prev else 0
        t = s["text"]
        if prev and gap > 1.2 and not t.startswith(" ") and not (parts and parts[-1][1].endswith(" ")):
            t = " " + t
        parts.append(("i" if is_ital(s["font"]) else "", t, s))
        prev = s
    merged = []
    for st, t, s in parts:
        if merged and merged[-1][0] == st and st != "ref":
            merged[-1] = (st, merged[-1][1] + t)
        else:
            merged.append((st, t))
    for st, t in merged:
        if st == "ref":
            if keep_refs and t.isdigit():
                res = res.rstrip() + "".join(f"[^{n}]" for n in split_refs(t))
        elif st == "i":
            core = t.strip()
            if core:
                lead = t[:len(t) - len(t.lstrip())]
                trail = t[len(t.rstrip()):]
                res += lead + "*" + esc(core) + "*" + trail
            else:
                res += t
        else:
            res += esc(t)
    return res


def join(a, b, prev=None, url_mode=False):
    a, b = a.rstrip(), b.lstrip()
    if not a:
        return b
    last = a.split()[-1]
    if a.endswith("-") and not a.endswith(" -"):
        return a + b
    if url_mode and ("http" in last or "www." in last) and not b.startswith(("http", "Consulta")) and not re.match(r"^[A-ZÁÉÍÓÚ][a-záéíóú]+ ", b):
        return a + b
    if ("://" in last or "www." in last) and prev is not None and prev["x1"] > prev["right"] - 25 \
            and re.match(r"^[a-z0-9%/._=?&#-]", b) and " " not in b.split("/")[0][:1]:
        return a + b
    return a + " " + b


def para_md(t):
    t = re.sub(r"[ \t]+", " ", t).strip()
    t = re.sub(r"\*\s*\*", " ", t)          # cursivas cortadas por salto de línea
    t = re.sub(r"\* \*", " ", t)
    if re.match(r"^\d+\.", t):
        t = re.sub(r"^(\d+)\.", r"\1\\.", t)
    if t.startswith(("- ", "+ ")):
        t = "\\" + t
    return t


# ───────────────────────── recorrido ─────────────────────────
blocks = []          # (tipo, valor, pagina)
notes = {}
expected = 1
BIB = range(385, 439)   # páginas (1-based) de bibliografía y artículos
SKIP = set(range(5, 12)) | set(range(439, 445)) | {446}  # índice general, índice analítico, colofón (se generan solos)
map_n = 0
img_n = 0

for pn in range(len(doc)):
    pg = pn + 1
    p = doc[pn]
    if pg in SKIP:
        continue
    # ── mapas a doble página ──
    if p.rect.width > 600:
        map_n += 1
        name = f"mapa-{map_n:02d}"
        out = DEST / "mapas" / name
        if not Path(str(out) + ".svg").exists(): subprocess.run(["pdftocairo", "-svg", "-f", str(pg), "-l", str(pg), PDF, str(out) + ".svg"], check=True)
        blocks.append(("mapa", name + ".svg", pg))
        continue

    lines = page_lines(p)
    body12 = [L for L in lines if L["size"] == 12.0 and 45 < L["y"] < 615]
    left = min([L["x0"] for L in body12] or [57])
    right = max([L["x1"] for L in body12] or [425])
    for L in lines:
        L["left"], L["right"] = left, right

    # ── cuadros ──
    tables = []
    if pg not in BIB:
        try:
            tables = [t for t in p.find_tables().tables if t.row_count >= 2 and t.col_count >= 2]
        except Exception:
            tables = []
    in_table = lambda L: next((t for t in tables if t.bbox[1] - 2 <= L["base"] <= t.bbox[3] + 2 and t.bbox[0] - 5 <= L["x0"] <= t.bbox[2]), None)
    table_done = set()

    # ── imágenes (gráficos) ──
    images = [im for im in p.get_image_info(xrefs=True) if (im["bbox"][3] - im["bbox"][1]) > 60]
    image_done = set()
    caption_lines = set()
    for k, im in enumerate(images):
        y0, y1 = im["bbox"][1], im["bbox"][3]
        cap = [L for L in lines if L["size"] <= 10.5 and (y0 - 40 < L["base"] < y0 + 5 or y1 - 2 < L["base"] < y1 + 40)]
        for L in cap:
            caption_lines.add(id(L))
        im["caption"] = " ".join(inline(L, False) for L in cap)

    # ── notas al pie: todo lo que está debajo del filete separador (línea corta a la izquierda) ──
    seps = [dr["rect"] for dr in p.get_drawings() if dr["rect"].height < 2 and 120 < dr["rect"].width < 170 and dr["rect"].x0 < left + 20]
    sep_y = min([r.y0 for r in seps if r.y0 > 200] or [None]) if seps else None
    max_body = max([b["base"] for b in body12 if sep_y is None or b["base"] < sep_y] or [0])

    events = []   # (y, tipo, linea|obj)
    for t in tables:
        events.append((t.bbox[1], "tabla", t))
    for im in images:
        events.append((im["bbox"][1], "imagen", im))
    for L in lines:
        if L["y"] < 45 or (re.fullmatch(r"\s*\d+\s*", L["text"]) and L["y"] > 600):
            continue
        if in_table(L) or id(L) in caption_lines:
            continue
        events.append((L["base"], "linea", L))
    events.sort(key=lambda e: e[0])

    for y, kind, obj in events:
        if kind == "tabla":
            rows = []
            for r in obj.rows:
                cells = []
                for c in r.cells:
                    if c is None:
                        cells.append("")
                        continue
                    ls = [L for L in lines if c[1] - 2 <= L["base"] <= c[3] + 2 and c[0] - 3 <= L["x0"] < c[2] - 2]
                    txt = ""
                    for L in sorted(ls, key=lambda L: L["base"]):
                        # sólo los spans dentro de la celda
                        sub = dict(L, spans=[s for s in L["spans"] if c[0] - 3 <= s["x0"] < c[2] - 1])
                        txt = join(txt, inline(sub))
                    cells.append(txt.replace("|", "\\|").strip())
                rows.append(cells)
            blocks.append(("tabla", rows, pg))
            continue
        if kind == "imagen":
            img_n += 1
            pix = fitz.Pixmap(doc, obj["xref"])
            if pix.alpha or pix.n > 3:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            name = f"grafico-{img_n:02d}.png"
            pix.save(str(DEST / "imagenes" / name))
            blocks.append(("imagen", (name, obj["caption"]), pg))
            continue
        L = obj
        s, txt = L["size"], L["text"].strip()
        if pg in BIB:
            if s == 23.0:
                blocks.append(("titulo", txt, pg))
            else:
                blocks.append(("bib", L, pg))
            continue
        if s >= 60:
            blocks.append(("capitular", txt, pg, L))
        elif s == 23.0:
            blocks.append(("titulo", txt, pg))
        elif s == 11.0 and "PARTE" in txt and "·" in txt:
            blocks.append(("parte", txt.split("·", 1)[1].strip(), pg))
        elif s == 11.0 and txt.startswith("CAPÍTULO"):
            pass
        elif s == 14.0:
            blocks.append(("seccion", txt, pg, L))
        elif sep_y is not None and L["base"] > sep_y and pg not in BIB:
            m = re.match(r"^\s*(\d+)\s*(.*)", L["text"])
            if m and int(m.group(1)) == expected and L["x0"] < left + 30:
                notes[expected] = [re.sub(r"^\s*\d+\s*", "", inline(L), count=1), L]
                expected += 1
            elif expected - 1 in notes:
                n = notes[expected - 1]
                n[0] = join(n[0], inline(L), n[1], url_mode=True)
                n[1] = L
        elif s in (11.0,) and L["x0"] > left + 120:
            blocks.append(("epigrafe", L, pg))
        elif s in (10.0, 10.5, 9.0) and L["ital"] or (s == 9.0):
            blocks.append(("nota-cuadro", L, pg))
        else:
            blocks.append(("linea", L, pg))

json.dump({str(k): v[0] for k, v in notes.items()}, open("/tmp/notas.json", "w"), ensure_ascii=False, indent=0)

# ───────────────────── armar documentos ─────────────────────
files, cur = [], None
pending_part = None
para, para_last, cap_letter, cap_bottom = None, None, None, 0
epi = []
tabla_buf = []


def out(s):
    cur["lines"].append(s)
    cur["lines"].append("")


def flush_para():
    global para
    if para is not None:
        out(para_md(para))
    para = None


def flush_epi():
    global epi
    if epi:
        body = "\\\n".join(para_md(e) for e in epi)
        out("::: epigrafe\n" + body + "\n:::")
    epi = []


def new_file(title, pg):
    global cur
    flush_para(); flush_epi()
    cur = dict(title=title, lines=["# " + esc(title), ""], parte=None, page=pg)
    files.append(cur)


prev_kind, prev_line = None, None
title_buf, title_pg = [], 0
for b in blocks:
    kind, val, pg = b[0], b[1], b[2]
    if kind != "titulo" and title_buf:
        new_file(" ".join(title_buf), title_pg)
        if pending_part:
            cur["parte"] = pending_part
            pending_part = None
        title_buf = []
        prev_kind = "titulo"
    if kind == "titulo":
        flush_para()
        if not title_buf:
            title_pg = pg
        title_buf.append(val.strip())
        continue
    if cur is None:
        continue
    if kind == "parte":
        flush_para(); flush_epi()
        pending_part = val
        continue
    if kind == "mapa":
        flush_para()
        out(f"![](mapas/{val}){{.mapa girar=si}}")
        prev_kind = "bloque"
        continue
    if kind == "imagen":
        flush_para()
        name, capt = val
        capt = re.sub(r"\s+", " ", capt).strip()
        m = re.match(r"^(Gráfico|Cronología|Figura|Mapa)\s*\d+\.?\s*(.*)", capt)
        tipo = "grafico"
        if m:
            capt = m.group(2)
        fuente = ""
        mf = re.search(r"\s*Fuentes?:\s*(.*)$", capt)
        if mf:
            fuente, capt = mf.group(1).strip().rstrip("."), capt[:mf.start()].strip().rstrip(".")
        attrs = ".grafico" + (f' fuente="{fuente.replace(chr(34), chr(39))}"' if fuente else "")
        out(f"![{capt}](imagenes/{name}){{{attrs}}}")
        prev_kind = "bloque"
        continue
    if kind == "tabla":
        flush_para()
        rows = val
        ncol = max(len(r) for r in rows)
        rows = [r + [""] * (ncol - len(r)) for r in rows]
        md = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * ncol]
        md += ["| " + " | ".join(r) + " |" for r in rows[1:]]
        # el título «Cuadro …» quedó como párrafo justo antes: lo metemos adentro del bloque
        caption = ""
        if cur["lines"] and len(cur["lines"]) >= 2 and re.match(r"^(\*\*)?(Cuadro|Tabla|Cronología)", cur["lines"][-2]):
            caption = cur["lines"][-2]
            cur["lines"] = cur["lines"][:-2]
        cur["lines"] += ["::: tabla", ""] + ([("**" + caption.strip("*") + "**"), ""] if caption else []) + md + ["", ":::", ""]
        prev_kind = "tabla"
        continue
    if kind == "nota-cuadro":
        L = val
        t = inline(L)
        if prev_kind == "tabla" or prev_kind == "nota-cuadro":
            # pie del cuadro: se agrega dentro del bloque ::: tabla
            if cur["lines"][-2] == ":::":
                cur["lines"] = cur["lines"][:-2]
                cur["lines"] += [para_md(t), "", ":::", ""]
            else:
                j = len(cur["lines"]) - 4
                cur["lines"][j] = join(cur["lines"][j], t)
            prev_kind = "nota-cuadro"
            continue
        flush_para()
        out(para_md(t))
        prev_kind = "linea"
        continue
    if kind == "epigrafe":
        flush_para()
        epi.append(inline(val))
        prev_kind = "epigrafe"
        continue
    if kind == "capitular":
        flush_para(); flush_epi()
        cap_letter, cap_bottom = val, b[3]["base"] + 4
        prev_kind = "capitular"
        continue
    if kind == "seccion":
        flush_para(); flush_epi()
        L = b[3]
        t = L["text"].strip()
        if prev_kind == "seccion" and prev_line is not None and L["base"] - prev_line["base"] < 22:
            cur["lines"][-2] += " " + esc(t)
        else:
            m = re.match(r"^(\d+\.)+\d*\s+", t)
            if m:
                out("## " + esc(t[m.end():]))
            else:
                out("## " + esc(t) + " {.sin-numero}")
        prev_kind, prev_line = "seccion", L
        continue
    if kind == "bib":
        L = val
        t = inline(L)
        if para is None or L["x0"] <= L["left"] + 4:
            flush_para()
            para, para_last = t, L
        else:
            para = join(para, t, para_last, url_mode=True)
            para_last = L
        prev_kind = "bib"
        continue
    # ── línea de texto común ──
    L = val
    flush_epi() if prev_kind == "epigrafe" else None
    t = inline(L)
    gap = (L["base"] - para_last["base"]) if (para_last is not None and para_last.get("pg") == pg) else 0
    L["pg"] = pg
    if L["ital"] and len(L["text"].strip()) < 90 and L["x1"] < L["right"] - 30 and (prev_kind in ("seccion", "titulo", "bloque", "tabla") or gap > 21 or para is None) \
            and not L["text"].strip().endswith((".", ",", ";")):
        flush_para()
        out("### " + esc(L["text"].strip()))
        prev_kind, para_last = "sub", L
        continue
    indented = L["x0"] > L["left"] + 6
    if cap_letter and L["base"] <= cap_bottom + 30:
        if para is None:
            para = cap_letter + t.lstrip()
            cap_letter = None
        else:
            para = join(para, t, para_last)
        para_last = L
        prev_kind = "linea"
        continue
    if para is None or indented or prev_kind in ("seccion", "titulo", "sub", "bloque", "tabla", "nota-cuadro", "epigrafe") or gap > 21:
        flush_para()
        para = t
    else:
        para = join(para, t, para_last)
    para_last = L
    prev_kind = "linea"
flush_para(); flush_epi()

# ───────────────────── escribir archivos ─────────────────────
ref_re = re.compile(r"\[\^(\d+)\]")
manifest = []
num = 0
for f in files:
    t = f["title"]
    low = t.lower()
    if low.startswith("dedicatoria"):
        tipo, name = "dedicatoria", "dedicatoria.md"
    elif f["page"] < 20:
        tipo, name = "preliminar", f"00-{slug(t)}.md"
    elif 20 <= f["page"] < 356 and not low.startswith("francisco"):
        num += 1
        tipo, name = "capitulo", f"{num:02d}-{slug(t)}.md"
    elif low.startswith("francisco"):
        tipo, name = "interludio", f"{num:02d}b-{slug(t)}.md"
    else:
        tipo, name = "final", f"9{len([m for m in manifest if m['tipo'] == 'final'])}-{slug(t)}.md"
    body = "\n".join(f["lines"]).rstrip() + "\n"
    if tipo == "dedicatoria":
        body = "\n".join(f["lines"][2:]).strip() + "\n"
    refs = []
    for r in ref_re.findall(body):
        if r not in refs:
            refs.append(r)
    if refs:
        body += "\n" + "".join(f"[^{r}]: {para_md(notes[int(r)][0]) if int(r) in notes else 'NOTA FALTANTE'}\n" for r in refs)
    if t.lower().startswith(("bibliograf", "mis artículos")):
        h, rest = body.split("\n", 1)
        body = h + "\n\n::: bibliografia\n" + rest + "\n:::\n"
    (TXT / name).write_text(body, encoding="utf-8")
    manifest.append(dict(tipo=tipo, archivo="texto/" + name, titulo=t, parte=f["parte"], palabras=len(body.split()), notas=len(refs)))
json.dump(manifest, open(DEST / "_importado.json", "w"), ensure_ascii=False, indent=1)
for m in manifest:
    print(f"{m['tipo']:<11} {m['archivo']:<55} {m['palabras']:>6} pal. {m['notas']:>4} notas" + (f"   [parte: {m['parte']}]" if m["parte"] else ""))
print("notas encontradas:", len(notes), "· mapas:", map_n, "· gráficos:", img_n)
