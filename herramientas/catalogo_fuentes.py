#!/usr/bin/env python3
"""Genera fuentes/catalogo.json (familia, peso y estilo de cada archivo) para el panel web."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont

D = Path(__file__).resolve().parent.parent / "fuentes"
cat = []
for f in sorted(D.glob("*.[ot]tf")):
    t = TTFont(f, lazy=True)
    n = t["name"]
    fam = n.getDebugName(16) or n.getDebugName(1)
    cat.append({"archivo": f.name, "familia": fam, "peso": t["OS/2"].usWeightClass,
                "italica": bool(t["OS/2"].fsSelection & 1)})
(D / "catalogo.json").write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(cat), "archivos,", len({c['familia'] for c in cat}), "familias")
