import { createTypstCompiler, loadFonts, initOptions } from '@myriaddreamin/typst.ts';
import { convertir } from './src/md2typ.js';
import fs from 'fs'; import { execSync } from 'child_process';
const R = '/home/claude/taller-editorial', S = '/tmp/claude-0/-home-claude/da74833f-1eab-590e-b8c6-9006b242cd34/scratchpad/tt';
const wasm = fs.readFileSync(R+'/web/node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const fonts = fs.readdirSync(R+'/fuentes').map(f => new Uint8Array(fs.readFileSync(R+'/fuentes/'+f)));
const c = createTypstCompiler();
await c.init({ getModule: () => wasm, beforeBuild: [initOptions.disableDefaultFontAssets(), loadFonts(fonts)] });
c.addSource('/plantilla/estilos.typ', fs.readFileSync(R+'/plantilla/estilos.typ','utf8'));
for (const f of ['plantilla/presets.toml','libros/cruzar/libro.toml','libros/cruzar/indice.toml']) c.mapShadow('/'+f, new Uint8Array(fs.readFileSync(R+'/'+f)));
const mapped = new Set();
async function comp(typ, out){
  for (const m of typ.matchAll(/#figura\("([^"]+)"/g)) if(!mapped.has(m[1])){ c.mapShadow(m[1], new Uint8Array(fs.readFileSync(R+m[1]))); mapped.add(m[1]); }
  c.addSource('/vista/capitulo.typ', typ);
  c.addSource('/vista/main.typ', '#import "/plantilla/estilos.typ": *\n#show: libro\n#modo.update("cuerpo")\n#apertura(impar: false)\n#include "capitulo.typ"\n#cierre()\n');
  const r = await c.compile({ mainFilePath: '/vista/main.typ', inputs: {libro:'cruzar', vista:'si'}, format: 1, diagnostics: 'unix' });
  if (!r.result) return 'ERROR ' + JSON.stringify(r.diagnostics).slice(0,400);
  fs.writeFileSync(out, r.result); return null;
}
const files = process.argv.slice(2);
for (const f of files) {
  const src = fs.readFileSync(R+'/libros/cruzar/texto/'+f,'utf8');
  const sinNum = !/^(0[5-9]|1[0-46-9]|2[0-3])-/.test(f);
  const js = convertir(src, { sinNumero: sinNum, base: '/libros/cruzar/' });
  fs.writeFileSync(S+'/js.typ', js);
  execSync(`cd ${R} && python3 -c "import sys; sys.path.insert(0,'herramientas'); import construir as C; from pathlib import Path; C.md_a_typst(Path('libros/cruzar/texto/${f}'), Path('${S}/pd.typ'), 'cruzar', ${sinNum ? 'True':'False'})"`);
  const pd = fs.readFileSync(S+'/pd.typ','utf8');
  const e1 = await comp(js, S+'/js.pdf'); const e2 = await comp(pd, S+'/pd.pdf');
  if (e1 || e2) { console.log(f, 'js:', e1, 'pd:', e2); continue; }
  const t = (p) => execSync(`pdftotext -q ${p} - | tr -s ' \\n' ' '`).toString();
  const a = t(S+'/js.pdf'), b = t(S+'/pd.pdf');
  const pa = execSync(`pdfinfo ${S}/js.pdf 2>/dev/null | grep Pages`).toString().trim(), pb = execSync(`pdfinfo ${S}/pd.pdf 2>/dev/null| grep Pages`).toString().trim();
  let k=0; while (k<a.length && a[k]===b[k]) k++;
  console.log(f.padEnd(40), pa, '|', pb, a===b ? 'IGUAL' : 'DIFIERE en '+k+': «'+a.slice(k-40,k+60)+'» vs «'+b.slice(k-40,k+60)+'»');
}
