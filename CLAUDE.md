# CLAUDE.md · proyecto «aliados» (EsSalud · FEN 2026-2027)

Contexto para continuar este proyecto con Claude Code en cualquier computadora (PC de escritorio o laptop). Las preferencias generales del usuario están en el `~/.claude/CLAUDE.md` de cada máquina: explicar en español, código comentado por procesos numerados (insumo → método → resultado), nombres en español y no modificar datos sin decir cuántos registros se afectan.

## Qué es
Web estática publicada en GitHub Pages: https://diegosimemirror.github.io/aliados/ (rama main, carpeta raíz, con `.nojekyll`; activada el 18/11/2026). Lee las hojas en vivo cada 5 minutos. Hay además una copia como artefacto privado de Claude (https://claude.ai/artifact/VWX6Jj1cHqVtf1Mi3Nwdia), que no lee en vivo y solo se actualiza si se vuelve a publicar. Es de la oficina de cooperación internacional de EsSalud para buscar cooperación ante el FEN 2026-2027. Decisión que informa: a qué aliado pedir qué apoyo y para qué zona.

**Reglas permanentes**
- Reconocer siempre a la web de aliados del MIDIS (https://claude.ai/artifact/XCFnRvFZUEnCZ79exZgucG) como la referencia de arquitectura y conceptualización: en el pie de la web, en el README y en el pipeline.
- Sin logo por ahora y sin la ilustración de lluvia y casa de la web del MIDIS: fondo neutro en `assets/fondo.svg`.
- El pipeline es interno: vive en `docs/pipeline.html` (estilo n8n) y en el diagrama Mermaid del README. No se enlaza desde la web.
- Las hojas son públicas con el enlace: no agregar columnas de datos personales.

## Piezas
- `scripts/01_preparar_datos.py` (P1–P8):
  - Mapa distrital → `datos/mapa.json`, que incluye `proy` para proyectar puntos.
  - Matriz y tablas de `datos/fuentes/` → `datos/fen_historico.json`, con escenarios, distritos, tipos de riesgo y catálogo de riesgos.
  - Catálogo de lugares.
- `scripts/02_crear_plantillas.py`: estructura de las dos hojas (`plantillas/*.xlsx`). Se importan con Archivo › Importar › «Reemplazar hoja de cálculo», para conservar el ID de la hoja.
- `scripts/03_copiar_hojas.py`: copia CSV de las pestañas en `datos/copia/`; la web la usa si falla la lectura en vivo.
- `scripts/04_establecimientos_essalud.py`: RENIPRESS → `datos/essalud_establecimientos.json` (solo activos) y `.csv`.
- `assets/app.js` (W1–W9):
  - Lee las hojas en vivo con `gviz/tq?tqx=out:csv&sheet=<pestaña>` cada 5 min.
  - Dibuja el mapa SVG con zoom.
  - Filtro de tipo de riesgo: en «Todos» colorea por fuente (azul y naranja); con un riesgo, usa el color de ese riesgo.
  - Puntos de EsSalud: llenos si su distrito tiene riesgo FEN.
  - Mini mapas por riesgo en canvas, panel lateral y secciones.
- Insumos (rutas por defecto, en Google Drive sincronizado):
  - `G:\Mi unidad\1_Comun\14_Mapa_Peru_Distrito\peru_distritos_1892_2025.gpkg`
  - `G:\Mi unidad\1_Comun\13_Py_FEN\Matriz_Escenarios_El_Nino_2026-2027_MIDIS.xlsx`
  - `G:\Mi unidad\1_Comun\13_Py_FEN\fuentes\RENIPRESS_30-10-2026.csv`
  - En otra ruta, usar `--mapa`, `--matriz` o `--renipress`.
- Python: Anaconda (en la PC, `C:\Users\Principal\anaconda3\python.exe`; ejecutar con `-I -X utf8`). Necesita geopandas, shapely 2.1 o superior y openpyxl.
- Plantillas listas para importar desde el diálogo de Google (Mi unidad): `G:\Mi unidad\1_Comun\13_Py_FEN\plantillas_web\plantilla_*.xlsx`.

## Hojas de Google (dueño: cuenta del usuario; compartidas como lector para la web)
- FEN_2026_2027 `1YE-9gXDLxJOuHyfflAFxznstzzi1sihIF3RiLt6zp5c`: LEEME, Radar, Demanda, Listas, Lugares.
- Identificacion_Aliados_Essalud `1NYboI4a8f3SYIUpmPrKBunqqmcSTwwL6GylItubkLIE`: LEEME, Aliados, Oferta, Tipologias, Listas, Lugares.
- **Lugar:** se elige de un desplegable que termina en «(código)»: 00 país, 2 dígitos departamento, 4 provincia, 6 distrito.
- **Fenómeno del radar:** cada valor de la lista corresponde a un tipo de riesgo, según `fenomenos_radar` en `riesgos_fen.csv`. Si no coincide exactamente, se usan las palabras clave de `CLAVES_RIESGO` en `app.js`.
- **Nombres fijos:** la web busca pestañas y columnas por nombre; no renombrarlas sin cambiar `app.js` (W3).
- **Herramientas:** el conector de Google Drive de Claude usa otra cuenta y NO puede editar estas hojas. En Chrome, el diálogo Importar de Google congela las capturas, así que la importación conviene hacerla a mano.

## Decisiones tomadas
- **Capa FEN histórico:** 753 distritos, 135 nombrados uno por uno. Casilla «Solo distritos nombrados».
- **Tipos de riesgo:** 7, que son lluvias, huaicos, sequía, calor, heladas, mar y dengue.
  - Se clasificaron por la columna «Fenómeno natural» de la matriz.
  - Colores validados como pares contiguos de la leyenda: nunca van los 7 en un mismo mapa, siempre con ícono y nombre.
- **Otros colores** (validados con la guía dataviz): azul = FEN histórico, naranja = FEN 2026-27 y franjas = ambas capas.
- **EsSalud:** solo los 409 activos del RENIPRESS. Hay 384 con punto (23 caen en otro distrito); 211 están en distritos con riesgo.
- **Tipologías:** las 4 del MIDIS + Financiero y Técnico (propuesta para EsSalud, editables en la pestaña Tipologias).
- **Matriz:** no se publica la columna «Implicancias para MIDIS».

## Estado y pendientes (actualizar al cerrar cada sesión)
- 18/11/2026: web con mapa, riesgos, EsSalud, radar, demanda, aliados, niveles y tipologías. Pipeline movido a `docs/`.
- 18/11: FEN_2026_2027 ya está importada y compartida; Radar y Demanda responden 200 con las columnas correctas.
- Pendiente del usuario: importar y compartir Identificacion_Aliados_Essalud. Aliados, Oferta y Tipologias todavía dan 401.
- Después de eso:
  - Comprobar con `curl` que `gviz/tq?tqx=out:csv&sheet=Radar` responde 200.
  - Correr `03_copiar_hojas.py`, armar de nuevo el artefacto y volver a publicarlo.
- GitHub Pages se actualiza solo con las hojas. El artefacto de Claude solo cambia si se vuelve a publicar a pedido.
- Antes de editar: `git pull`. Para probar: `python -m http.server 8000` en la carpeta del repo.
- 18/11/2026: copia publicada como artefacto privado de Claude: https://claude.ai/artifact/VWX6Jj1cHqVtf1Mi3Nwdia
  - El artefacto no puede leer las hojas en vivo, porque su política de seguridad bloquea docs.google.com. Usa `datos/copia/*.csv`, así que hay que volver a publicarlo después de correr `03_copiar_hojas.py`.
  - Para actualizarlo: copiar `index.html` sin las etiquetas `<!doctype>`, `<html>`, `<head>`, `<meta charset>`, `<meta viewport>` y `<body>`. Junto a ella van `assets/` y `datos/` (los 3 JSON y `copia/`). Se publica con la herramienta Artifact, pasando `url` y el mapa `files`.
