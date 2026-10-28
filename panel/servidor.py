#!/usr/bin/env python3
"""
Panel de producción del Taller editorial.

    python panel/servidor.py            → abre http://localhost:8000

Edita capítulos, estilos y tapa, muestra la vista previa con páginas reales
y arma el PDF de imprenta. Todo corre en tu computadora: no sube nada a internet.
Requiere typst y pandoc instalados (ver README).
"""
import json, os, re, shutil, subprocess, sys, threading, time, tomllib, uuid, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "herramientas"))
import construir as C  # noqa: E402

LIBROS = RAIZ / "libros"
PANEL = Path(__file__).resolve().parent
PUERTO = int(os.environ.get("PUERTO", "8000"))
VISTA_LOCK = threading.Lock()
TRABAJOS = {}   # id -> dict(estado, log, resultado)


# ─── utilidades ────────────────────────────────────────────────
def libro_dir(slug):
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", slug or ""):
        raise ValueError("Nombre de libro inválido")
    d = LIBROS / slug
    if not (d / "libro.toml").exists():
        raise ValueError(f"No existe el libro «{slug}»")
    return d


def ruta_segura(slug, ruta):
    """Sólo deja tocar archivos .md dentro de texto/ o tapa/ del libro."""
    d = libro_dir(slug)
    p = (d / ruta).resolve()
    if not str(p).startswith(str(d.resolve()) + os.sep):
        raise ValueError("Ruta fuera del libro")
    if p.suffix != ".md" or p.relative_to(d.resolve()).parts[0] not in ("texto", "tapa"):
        raise ValueError("Sólo se editan archivos .md de texto/ o tapa/")
    return p


def leer_cfg(slug):
    return tomllib.loads((libro_dir(slug) / "libro.toml").read_text(encoding="utf-8"))


def primer_titulo(md: Path):
    try:
        for linea in md.read_text(encoding="utf-8").splitlines():
            if linea.startswith("# "):
                return linea[2:].strip().replace("\\", "")
    except FileNotFoundError:
        return "(falta el archivo)"
    return md.stem


def toml_valor(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return '"' + str(v).replace("\\", "\\\\").replace('"', '\\"') + '"'


def toml_set(texto, seccion, clave, valor):
    """Cambia `clave = …` dentro de [seccion] conservando comentarios y formato."""
    lineas = texto.split("\n")
    ini = None
    for i, l in enumerate(lineas):
        if l.strip() == f"[{seccion}]":
            ini = i
            break
    if ini is None:
        lineas += ["", f"[{seccion}]", f"{clave} = {toml_valor(valor)}"]
        return "\n".join(lineas)
    fin = len(lineas)
    for j in range(ini + 1, len(lineas)):
        if lineas[j].lstrip().startswith("["):
            fin = j
            break
    patron = re.compile(r"^(\s*#?\s*)" + re.escape(clave) + r"(\s*=\s*)([^#\n]*?)(\s*#.*)?$")
    for j in range(ini + 1, fin):
        m = patron.match(lineas[j])
        if m:
            com = m.group(4) or ""
            lineas[j] = f"{clave}{m.group(2)}{toml_valor(valor)}{com}"
            return "\n".join(lineas)
    # no estaba: va al final de la sección
    k = fin
    while k > ini + 1 and not lineas[k - 1].strip():
        k -= 1
    lineas.insert(k, f"{clave} = {toml_valor(valor)}")
    return "\n".join(lineas)


def toml_contenido(texto, items):
    """Reescribe la lista [[contenido]] respetando el resto del archivo."""
    bloques = []
    for it in items:
        b = ["[[contenido]]", f"tipo = {toml_valor(it['tipo'])}"]
        if it["tipo"] == "parte":
            b.append(f"titulo = {toml_valor(it['titulo'])}")
        else:
            b.append(f"archivo = {toml_valor(it['archivo'])}")
            if it.get("indice") is False:
                b.append("indice = false")
        bloques.append("\n".join(b))
    nuevo = "\n\n".join(bloques) + "\n"
    # quitar los bloques existentes
    patron = re.compile(r"^\[\[contenido\]\]\n(?:(?![\[#])[^\n]*\n?)*", re.M)
    m = patron.search(texto)
    if not m:
        return texto.rstrip() + "\n\n" + nuevo
    pos = m.start()
    sin = patron.sub("", texto)
    return sin[:pos] + nuevo + "\n" + sin[pos:]


def fuentes_disponibles():
    try:
        r = subprocess.run(["typst", "fonts", "--font-path", str(RAIZ / "fuentes"), "--ignore-system-fonts"],
                           capture_output=True, text=True, timeout=30)
        fam = [l.strip() for l in r.stdout.splitlines() if l.strip()]
        return [f for f in fam if "Math" not in f and "Mono" not in f]
    except Exception:
        return ["EB Garamond", "Source Serif 4", "Libertinus Serif", "Inter"]


def presets():
    return tomllib.loads((RAIZ / "plantilla" / "presets.toml").read_text(encoding="utf-8"))


# ─── información del libro ─────────────────────────────────────
def info_libro(slug):
    d = libro_dir(slug)
    cfg = leer_cfg(slug)
    contenido = []
    ncap = 0
    for it in cfg.get("contenido", []):
        e = {"tipo": it["tipo"]}
        if it["tipo"] == "parte":
            e["titulo"] = it.get("titulo", "")
        else:
            md = d / it["archivo"]
            e["archivo"] = it["archivo"]
            e["titulo"] = primer_titulo(md)
            e["palabras"] = len(md.read_text(encoding="utf-8").split()) if md.exists() else 0
            e["existe"] = md.exists()
            if it.get("indice") is False:
                e["indice"] = False
            if it["tipo"] == "capitulo":
                ncap += 1
                e["numero"] = ncap
        contenido.append(e)
    salida = d / "salida"
    archivos = {}
    for n in ("interior.pdf", "tapa.pdf", "tapa-guias.pdf", "libro.epub", "simulacion.csv"):
        if (salida / n).exists():
            archivos[n] = {"url": f"/archivos/{slug}/salida/{n}", "fecha": (salida / n).stat().st_mtime}
    tapa_md = [v for k, v in cfg.get("tapa", {}).items() if isinstance(v, str) and v.endswith(".md")]
    return {
        "slug": slug, "libro": cfg.get("libro", {}), "formato": cfg.get("formato", {}),
        "tipografia": cfg.get("tipografia", {}), "estilo": cfg.get("estilo", {}),
        "tapa": cfg.get("tapa", {}), "preliminares": cfg.get("preliminares", {}),
        "contenido": contenido, "archivos": archivos, "tapa_textos": tapa_md,
        "dedicatoria": cfg.get("preliminares", {}).get("dedicatoria"),
        "ultimo": json.loads((salida / "ultimo.json").read_text()) if (salida / "ultimo.json").exists() else None,
    }


# ─── vista previa de un capítulo ───────────────────────────────
def vista_previa(slug, ruta, texto):
    d = libro_dir(slug)
    cfg = leer_cfg(slug)
    tipo, numero, n = "capitulo", 1, 0
    for it in cfg.get("contenido", []):
        if it["tipo"] == "capitulo":
            n += 1
        if it.get("archivo") == ruta:
            tipo, numero = it["tipo"], n
            break
    vista = d / "_vista"
    vista.mkdir(exist_ok=True)
    for viejo in vista.glob("v-*"):
        if time.time() - viejo.stat().st_mtime > 120:
            shutil.rmtree(viejo, ignore_errors=True)
    tag = "v-" + uuid.uuid4().hex[:8]
    w = vista / tag
    w.mkdir()
    md = w / "capitulo.md"
    md.write_text(texto, encoding="utf-8")
    es_tapa = ruta.startswith("tapa/")
    C.md_a_typst(md, w / "capitulo.typ", slug, tipo != "capitulo" or es_tapa)
    previo = "" if tipo != "capitulo" else f"#counter(heading).update({numero - 1})\n"
    (w / "main.typ").write_text(
        '#import "/plantilla/estilos.typ": *\n#show: libro\n' + previo +
        '#modo.update("cuerpo")\n#apertura(impar: false)\n#include "capitulo.typ"\n#cierre()\n', encoding="utf-8")
    cmd = ["typst", "compile", "--root", str(RAIZ), "--font-path", str(RAIZ / "fuentes"),
           "--input", f"libro={slug}", "--input", "vista=si", "--format", "svg",
           str(w / "main.typ"), str(w / "p-{0p}.svg")]
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if r.returncode != 0:
        return {"ok": False, "error": limpiar_error(r.stderr)}
    pags = sorted(w.glob("p-*.svg"))
    return {"ok": True, "paginas": [f"/archivos/{slug}/_vista/{tag}/{p.name}" for p in pags],
            "segundos": round(time.time() - t0, 1)}


def vista_tapa(slug):
    d = libro_dir(slug)
    cfg = leer_cfg(slug)
    ult = d / "salida" / "ultimo.json"
    n = json.loads(ult.read_text())["paginas"] if ult.exists() else 300
    build = d / "_build"
    if not build.exists():
        C.preparar(slug)   # convierte los textos de tapa
    else:
        tapa = cfg.get("tapa", {})
        for clave in ("contratapa", "solapa_delantera", "solapa_trasera"):
            destino = build / ("tapa-" + clave.replace("_", "-") + ".typ")
            if tapa.get(clave) and (d / tapa[clave]).exists():
                C.md_a_typst(d / tapa[clave], destino, slug, True)
    vista = d / "_vista"
    vista.mkdir(exist_ok=True)
    out = vista / f"tapa-{uuid.uuid4().hex[:6]}.svg"
    for viejo in vista.glob("tapa-*.svg"):
        viejo.unlink()
    cmd = ["typst", "compile", "--root", str(RAIZ), "--font-path", str(RAIZ / "fuentes"),
           "--input", f"libro={slug}", "--input", f"paginas={n}", "--input", f"lomo={C.lomo_mm(cfg, n):.2f}mm",
           "--input", "guias=si", "--format", "svg", str(RAIZ / "plantilla" / "tapa.typ"), str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        return {"ok": False, "error": limpiar_error(r.stderr)}
    return {"ok": True, "url": f"/archivos/{slug}/_vista/{out.name}", "paginas": n,
            "lomo": round(C.lomo_mm(cfg, n), 1), "estimado": not ult.exists()}


def limpiar_error(s):
    s = s.replace(str(RAIZ), "")
    return "\n".join(s.strip().splitlines()[:25])


# ─── trabajos largos (armar, simular) ──────────────────────────
def lanzar(fn, *args):
    tid = uuid.uuid4().hex[:10]
    TRABAJOS[tid] = {"estado": "corriendo", "log": [], "resultado": None, "inicio": time.time()}

    def correr():
        try:
            TRABAJOS[tid]["resultado"] = fn(tid, *args)
            TRABAJOS[tid]["estado"] = "listo"
        except Exception as e:  # noqa: BLE001
            TRABAJOS[tid]["estado"] = "error"
            TRABAJOS[tid]["log"].append(str(e))
    threading.Thread(target=correr, daemon=True).start()
    return tid


def log(tid, msg):
    TRABAJOS[tid]["log"].append(msg)


def proceso(tid, cmd):
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=RAIZ)
    for linea in p.stdout:
        log(tid, limpiar_error(linea.rstrip()))
    p.wait()
    if p.returncode != 0:
        raise RuntimeError("El armado falló. Mirá el registro.")


def armar(tid, slug, epub):
    cmd = [sys.executable, str(RAIZ / "herramientas" / "construir.py"), slug]
    if epub:
        cmd.append("--epub")
    proceso(tid, cmd)
    pdf = LIBROS / slug / "salida" / "interior.pdf"
    n = C.contar_paginas(pdf)
    cfg = leer_cfg(slug)
    res = {"paginas": n, "lomo": round(C.lomo_mm(cfg, n), 1), "fecha": time.time(), "avisos": revisar(slug)}
    (LIBROS / slug / "salida" / "ultimo.json").write_text(json.dumps(res))
    return res


def simular(tid, slug, formatos, cuerpos, objetivo):
    cmd = [sys.executable, str(RAIZ / "herramientas" / "probar_medidas.py"), slug, "--hilos", "4",
           "--formatos", *formatos, "--cuerpos", *cuerpos]
    if objetivo:
        cmd += ["--objetivo", str(objetivo)]
    proceso(tid, cmd)
    filas = []
    csv = (LIBROS / slug / "salida" / "simulacion.csv").read_text(encoding="utf-8").splitlines()[1:]
    for l in csv:
        f, c, i, fu, p, lo = l.split(",")
        filas.append({"formato": f, "cuerpo": c, "interlineado": i, "fuente": fu, "paginas": int(p), "lomo": float(lo)})
    return {"filas": filas}


def revisar(slug):
    """Avisos de producción: cosas a resolver antes de imprenta."""
    d = libro_dir(slug)
    cfg = leer_cfg(slug)
    avisos = []
    for it in cfg.get("contenido", []):
        if it["tipo"] == "parte":
            continue
        md = d / it["archivo"]
        if not md.exists():
            avisos.append(f"Falta el archivo {it['archivo']}.")
            continue
        s = md.read_text(encoding="utf-8")
        if "NOTA FALTANTE" in s:
            avisos.append(f"{it['archivo']}: hay notas sin texto («NOTA FALTANTE»).")
        if re.search(r"[Ee]spacio reservado", s):
            avisos.append(f"{it['archivo']}: todavía tiene texto de «espacio reservado».")
        llamadas = set(re.findall(r"\[\^([^\]]+)\](?!:)", s))
        defs = set(re.findall(r"^\[\^([^\]]+)\]:", s, re.M))
        if llamadas - defs:
            avisos.append(f"{it['archivo']}: notas llamadas sin definir: {', '.join(sorted(llamadas - defs)[:5])}.")
        for img in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", s):
            if not img.startswith("http") and not (d / img).exists():
                avisos.append(f"{it['archivo']}: no encuentro la imagen {img}.")
    if not cfg.get("libro", {}).get("isbn"):
        avisos.append("Falta el ISBN (la contratapa lleva un recuadro en su lugar).")
    return avisos


# ─── servidor HTTP ─────────────────────────────────────────────
TIPOS = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
         ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
         ".pdf": "application/pdf", ".epub": "application/epub+zip", ".csv": "text/csv; charset=utf-8",
         ".json": "application/json"}


class Manejador(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def responder(self, datos, codigo=200, tipo="application/json"):
        cuerpo = datos if isinstance(datos, bytes) else json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(cuerpo)

    def archivo(self, p: Path):
        if not p.exists() or not p.is_file():
            return self.responder({"error": "no existe"}, 404)
        self.responder(p.read_bytes(), 200, TIPOS.get(p.suffix.lower(), "application/octet-stream"))

    def cuerpo(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path in ("/", "/index.html"):
                return self.archivo(PANEL / "index.html")
            if u.path == "/api/libros":
                return self.responder([{"slug": p.name, "titulo": tomllib.loads((p / "libro.toml").read_text(encoding="utf-8")).get("libro", {}).get("titulo", p.name)}
                                       for p in sorted(LIBROS.iterdir()) if (p / "libro.toml").exists()])
            if u.path == "/api/libro":
                return self.responder(info_libro(q["libro"]))
            if u.path == "/api/opciones":
                pr = presets()
                return self.responder({"formatos": list(pr["formatos"].keys()), "papeles": list(pr["papeles"].keys()),
                                       "fuentes": fuentes_disponibles()})
            if u.path == "/api/archivo":
                p = ruta_segura(q["libro"], q["ruta"])
                return self.responder({"texto": p.read_text(encoding="utf-8") if p.exists() else ""})
            if u.path == "/api/trabajo":
                return self.responder(TRABAJOS.get(q["id"], {"estado": "desconocido"}))
            if u.path == "/api/tapa-vista":
                with VISTA_LOCK:
                    return self.responder(vista_tapa(q["libro"]))
            if u.path == "/api/revisar":
                return self.responder({"avisos": revisar(q["libro"])})
            if u.path.startswith("/archivos/"):
                partes = unquote(u.path).split("/")[2:]
                d = libro_dir(partes[0])
                p = (d / "/".join(partes[1:])).resolve()
                if not str(p).startswith(str(d.resolve())):
                    return self.responder({"error": "ruta"}, 403)
                return self.archivo(p)
            return self.responder({"error": "no encontrado"}, 404)
        except (ValueError, KeyError) as e:
            return self.responder({"error": str(e)}, 400)

    def do_POST(self):
        u = urlparse(self.path)
        try:
            b = self.cuerpo()
            slug = b.get("libro")
            if u.path == "/api/archivo":
                p = ruta_segura(slug, b["ruta"])
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(b["texto"], encoding="utf-8")
                return self.responder({"ok": True, "palabras": len(b["texto"].split())})
            if u.path == "/api/vista":
                with VISTA_LOCK:
                    return self.responder(vista_previa(slug, b["ruta"], b["texto"]))
            if u.path == "/api/config":
                ruta = libro_dir(slug) / "libro.toml"
                txt = ruta.read_text(encoding="utf-8")
                for seccion, valores in b["cambios"].items():
                    for k, v in valores.items():
                        txt = toml_set(txt, seccion, k, v)
                tomllib.loads(txt)  # valida antes de guardar
                ruta.write_text(txt, encoding="utf-8")
                return self.responder({"ok": True})
            if u.path == "/api/contenido":
                ruta = libro_dir(slug) / "libro.toml"
                txt = toml_contenido(ruta.read_text(encoding="utf-8"), b["contenido"])
                tomllib.loads(txt)
                ruta.write_text(txt, encoding="utf-8")
                return self.responder({"ok": True})
            if u.path == "/api/nuevo-capitulo":
                d = libro_dir(slug)
                titulo = b.get("titulo", "Capítulo nuevo").strip() or "Capítulo nuevo"
                base = re.sub(r"[^a-z0-9]+", "-", titulo.lower().encode("ascii", "ignore").decode()).strip("-")[:30] or "capitulo"
                n = len(list((d / "texto").glob("*.md"))) + 1
                ruta = f"texto/{n:02d}-{base}.md"
                (d / ruta).write_text(f"# {titulo}\n\nEscribí acá.\n", encoding="utf-8")
                return self.responder({"ok": True, "archivo": ruta})
            if u.path == "/api/armar":
                return self.responder({"id": lanzar(armar, slug, bool(b.get("epub")))})
            if u.path == "/api/simular":
                return self.responder({"id": lanzar(simular, slug, b.get("formatos") or ["14x21", "15x23", "17x24"],
                                                    b.get("cuerpos") or ["11/14.5", "11.5/15.5", "12/17"], b.get("objetivo"))})
            return self.responder({"error": "no encontrado"}, 404)
        except (ValueError, KeyError, tomllib.TOMLDecodeError) as e:
            return self.responder({"error": str(e)}, 400)
        except subprocess.TimeoutExpired:
            return self.responder({"error": "La vista previa tardó demasiado."}, 500)


def main():
    for t in ("typst", "pandoc"):
        if not shutil.which(t):
            sys.exit(f"✗ No encuentro «{t}». Instalalo (ver README) y volvé a abrir el panel.")
    srv = ThreadingHTTPServer(("127.0.0.1", PUERTO), Manejador)
    url = f"http://localhost:{PUERTO}"
    print(f"✓ Panel abierto en {url}  (Ctrl+C para cerrar)")
    if not os.environ.get("SIN_NAVEGADOR"):
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nPanel cerrado.")


if __name__ == "__main__":
    main()
