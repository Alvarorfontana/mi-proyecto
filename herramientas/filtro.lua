-- Filtro de pandoc: Markdown → Typst con los estilos del taller.
--
--  ::: clase  ...  :::          → #clase[ ... ]   (epigrafe, cita, recuadro, bibliografia, glosario, tabla, centrado)
--  ![Pie](mapas/x.png){.mapa ancho=80% fuente="IGN"}  → #figura(...)
--  ![Pie](img.jpg){pagina=completa}                    → figura a página entera
--  ## Título {.sin-numero}                              → sección sin número
--  https://...                                          → #url("...") (se parte bien al final de línea)
--  Variables (pasadas por construir.py):
--    sin_numero=true   → todos los títulos del archivo van sin numerar (preliminares y finales)
--    base=/libros/x/   → prefijo para rutas de imágenes

local sin_numero = false
local base = ""

local function typst_inlines(inls)
  return pandoc.write(pandoc.Pandoc({pandoc.Plain(inls)}), "typst"):gsub("%s+$", "")
end

local function str(s)
  return '"' .. s:gsub("\\", "\\\\"):gsub('"', '\\"') .. '"'
end

local function figura(img, caption_inlines)
  local src = img.src
  if not src:match("^/") and not src:match("^https?:") then src = base .. src end
  local a = img.attributes
  local tipo = "foto"
  for _, c in ipairs(img.classes) do
    if c == "mapa" or c == "grafico" or c == "foto" or c == "ilustracion" then tipo = c end
  end
  local args = {str(src)}
  table.insert(args, "tipo: " .. str(tipo))
  if a["ancho"] or a["width"] then table.insert(args, "ancho: " .. (a["ancho"] or a["width"])) end
  if a["pagina"] == "completa" then table.insert(args, "pagina-completa: true") end
  if a["sangrado"] == "si" or a["sangrado"] == "true" then table.insert(args, "sangrado: true") end
  if a["fuente"] then table.insert(args, "fuente: [" .. a["fuente"] .. "]") end
  local cap = typst_inlines(caption_inlines or {})
  if cap ~= "" then table.insert(args, "pie: [" .. cap .. "]") end
  return pandoc.RawBlock("typst", "#figura(" .. table.concat(args, ", ") .. ")")
end

return {
  {
    Meta = function(m)
      if m.sin_numero then sin_numero = pandoc.utils.stringify(m.sin_numero) == "true" end
      if m.base then base = pandoc.utils.stringify(m.base) end
    end
  },
  {
    Str = function(s)
      if s.text:match("^https?://") or s.text:match("^www%.") then
        local u, tail = s.text:match("^(.-)([%.,;:%)]*)$")
        return {pandoc.RawInline("typst", "#url(" .. str(u) .. ")"), pandoc.Str(tail)}
      end
    end,

    Link = function(l)
      local t = pandoc.utils.stringify(l.content)
      if t == l.target or t:match("^https?://") then
        return pandoc.RawInline("typst", "#url(" .. str(l.target) .. ")")
      end
    end,

    Figure = function(f)
      local img
      pandoc.walk_block(f, {Image = function(i) img = i end})
      if img then
        local cap = {}
        if f.caption and f.caption.long then
          for _, b in ipairs(f.caption.long) do
            for _, x in ipairs(b.content or {}) do table.insert(cap, x) end
          end
        end
        if #cap == 0 then cap = img.caption end
        return figura(img, cap)
      end
    end,

    Para = function(p)
      if #p.content == 1 and p.content[1].t == "Image" then
        return figura(p.content[1], p.content[1].caption)
      end
    end,

    Header = function(h)
      local unnumbered = sin_numero or h.classes:includes("unnumbered") or h.classes:includes("sin-numero")
      local args = "level: " .. h.level
      if unnumbered then args = args .. ", numbering: none" end
      return pandoc.RawBlock("typst", "#heading(" .. args .. ")[" .. typst_inlines(h.content) .. "]")
    end,

    Div = function(d)
      local cls = d.classes[1]
      if not cls then return nil end
      local out = {pandoc.RawBlock("typst", "#" .. cls .. "[")}
      for _, b in ipairs(d.content) do table.insert(out, b) end
      table.insert(out, pandoc.RawBlock("typst", "]"))
      return out
    end,

    -- columnas con ancho automático (el ancho de los guiones del Markdown no manda)
    Table = function(t)
      for i, cs in ipairs(t.colspecs) do
        t.colspecs[i] = {cs[1], pandoc.ColWidthDefault}
      end
      return t
    end,

    HorizontalRule = function()
      return pandoc.RawBlock("typst", "#separador()")
    end,
  }
}
